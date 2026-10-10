import type { FastifyRequest } from "fastify";

const RETENTION_MINUTES = 30 * 24 * 60;
const trackedRequests = new WeakMap<FastifyRequest, bigint>();

type MinuteBucket = {
    requests: number;
    successful: number;
    clientError: number;
    serverError: number;
    responseTotalMs: number;
    durationsMs: number[];
    sampledDurations: number;
    slowRequests: number;
    users: Set<string>;
};

const buckets = new Map<number, MinuteBucket>();

export function startAdminMonitoringRequest(request: FastifyRequest) {
    if (request.url.startsWith("/api/v1/admin/monitoring")) return;
    trackedRequests.set(request, process.hrtime.bigint());
}

export function recordAdminMonitoringResponse(request: FastifyRequest, statusCode: number) {
    const startedAt = trackedRequests.get(request);
    if (startedAt === undefined) return;
    trackedRequests.delete(request);

    const now = Date.now();
    const minute = Math.floor(now / 60_000) * 60_000;
    let bucket = buckets.get(minute);
    if (!bucket) {
        bucket = { requests: 0, successful: 0, clientError: 0, serverError: 0, responseTotalMs: 0, durationsMs: [], sampledDurations: 0, slowRequests: 0, users: new Set() };
        buckets.set(minute, bucket);
    }

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    bucket.requests += 1;
    bucket.responseTotalMs += durationMs;
    if (durationMs >= 1_000) bucket.slowRequests += 1;
    if (statusCode >= 500) bucket.serverError += 1;
    else if (statusCode >= 400) bucket.clientError += 1;
    else bucket.successful += 1;
    // Keep a representative reservoir sample for P95 without retaining every request.
    bucket.sampledDurations += 1;
    if (bucket.durationsMs.length < 120) bucket.durationsMs.push(durationMs);
    else {
        const replacement = Math.floor(Math.random() * bucket.sampledDurations);
        if (replacement < bucket.durationsMs.length) bucket.durationsMs[replacement] = durationMs;
    }
    if (request.user?.id) bucket.users.add(request.user.id);

    const cutoff = minute - RETENTION_MINUTES * 60_000;
    for (const timestamp of buckets.keys()) {
        if (timestamp >= cutoff) break;
        buckets.delete(timestamp);
    }
}

function flatten(from: number, to: number) {
    return [...buckets.entries()]
        .filter(([minute]) => minute >= from && minute < to)
        .sort(([a], [b]) => a - b)
        .map(([, bucket]) => bucket);
}

function percentile95(values: number[]) {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]!);
}

function summarize(items: MinuteBucket[]) {
    const requests = items.reduce((sum, item) => sum + item.requests, 0);
    const successful = items.reduce((sum, item) => sum + item.successful, 0);
    const clientError = items.reduce((sum, item) => sum + item.clientError, 0);
    const serverError = items.reduce((sum, item) => sum + item.serverError, 0);
    const responseTotalMs = items.reduce((sum, item) => sum + item.responseTotalMs, 0);
    const durations = items.flatMap((item) => item.durationsMs);
    const slowRequests = items.reduce((sum, item) => sum + item.slowRequests, 0);
    return {
        requests,
        successful,
        clientError,
        serverError,
        avgMs: requests ? Math.round(responseTotalMs / requests) : null,
        p95Ms: percentile95(durations),
        errorRatePercent: requests ? Number(((clientError + serverError) / requests * 100).toFixed(2)) : null,
        slowRequests,
        activeUsers: new Set(items.flatMap((item) => [...item.users])).size,
    };
}

const rangeMs = { "1h": 60 * 60_000, "24h": 24 * 60 * 60_000, "7d": 7 * 24 * 60 * 60_000, "30d": 30 * 24 * 60 * 60_000 } as const;
export type MonitoringRange = keyof typeof rangeMs;

export function getAdminMonitoring(range: MonitoringRange, database: {
    status: "healthy" | "down";
    probeMs: number | null;
    totalConnections: number;
    idleConnections: number;
    waitingConnections: number;
    maxConnections: number;
}) {
    const now = Date.now();
    const from = now - rangeMs[range];
    const recent = summarize(flatten(now - 5 * 60_000, now + 1));
    const previous = summarize(flatten(now - 10 * 60_000, now - 5 * 60_000));
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    const activeUsersToday = summarize(flatten(today.getTime(), now + 1)).activeUsers;

    const interval = Math.max(60_000, Math.ceil((now - from) / 48 / 60_000) * 60_000);
    const groups = new Map<number, MinuteBucket[]>();
    for (const [minute, bucket] of buckets.entries()) {
        if (minute < from || minute > now) continue;
        const key = Math.floor(minute / interval) * interval;
        const group = groups.get(key) ?? [];
        group.push(bucket);
        groups.set(key, group);
    }
    const traffic = [...groups.entries()].sort(([a], [b]) => a - b).map(([timestamp, group]) => {
        const summary = summarize(group);
        return {
            label: new Date(timestamp).toLocaleTimeString("vi-VN", range === "1h" || range === "24h" ? { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" } : { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }),
            requests: summary.requests,
            successful: summary.successful,
            failed: summary.clientError + summary.serverError,
            responseMs: summary.avgMs ?? 0,
        };
    });

    const uptimeSeconds = Math.floor(process.uptime());
    const cpuNow = process.cpuUsage();
    const cpuAt = performance.now();
    const priorCpu = (globalThis as typeof globalThis & { __kujiCpuSample?: { usage: NodeJS.CpuUsage; at: number } }).__kujiCpuSample;
    let cpuPercent: number | null = null;
    if (priorCpu) {
        const elapsedUs = (cpuAt - priorCpu.at) * 1_000;
        const usedUs = (cpuNow.user - priorCpu.usage.user) + (cpuNow.system - priorCpu.usage.system);
        if (elapsedUs > 0) cpuPercent = Number(Math.min(100, usedUs / elapsedUs * 100).toFixed(1));
    }
    (globalThis as typeof globalThis & { __kujiCpuSample?: { usage: NodeJS.CpuUsage; at: number } }).__kujiCpuSample = { usage: cpuNow, at: cpuAt };

    const totalRequests = recent.requests;
    return {
        sampledAt: new Date(now).toISOString(),
        historyAvailableSeconds: uptimeSeconds,
        process: {
            uptimeSeconds,
            cpuPercent,
            rssBytes: process.memoryUsage().rss,
            heapUsedBytes: process.memoryUsage().heapUsed,
            heapTotalBytes: process.memoryUsage().heapTotal,
        },
        api: {
            requestCount: totalRequests,
            avgMs: recent.avgMs,
            p95Ms: recent.p95Ms,
            previousAvgMs: previous.avgMs,
            errorRatePercent: recent.errorRatePercent,
            slowRequests: recent.slowRequests,
            activeUsersNow: recent.activeUsers,
            activeUsersToday,
            statusDistribution: {
                success: totalRequests ? Number((recent.successful / totalRequests * 100).toFixed(2)) : 0,
                clientError: totalRequests ? Number((recent.clientError / totalRequests * 100).toFixed(2)) : 0,
                serverError: totalRequests ? Number((recent.serverError / totalRequests * 100).toFixed(2)) : 0,
            },
        },
        database,
        traffic,
    };
}
