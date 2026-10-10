import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { adminGuard } from "../../common/middlewares/admin.guard.js";
import { getAdminMonitoring, type MonitoringRange } from "../../common/services/admin-monitoring.js";
import { pool } from "../../config/prisma.js";
import { authRepository } from "../auth/auth.repository.js";

const querySchema = z.object({ range: z.enum(["1h", "24h", "7d", "30d"]).default("24h") });
type DatabaseHealth = {
    status: "healthy" | "down";
    probeMs: number | null;
    totalConnections: number;
    idleConnections: number;
    waitingConnections: number;
    maxConnections: number;
};

let lastDatabaseProbeAt = 0;
let cachedDatabaseHealth: DatabaseHealth = {
    status: "down", probeMs: null, totalConnections: 0, idleConnections: 0, waitingConnections: 0, maxConnections: pool.options.max ?? 10,
};

async function readDatabaseHealth(): Promise<DatabaseHealth> {
    const now = Date.now();
    if (now - lastDatabaseProbeAt >= 5_000) {
        lastDatabaseProbeAt = now;
        const startedAt = performance.now();
        try {
            await pool.query("SELECT 1");
            cachedDatabaseHealth = {
                status: "healthy",
                probeMs: Math.round((performance.now() - startedAt) * 10) / 10,
                totalConnections: pool.totalCount,
                idleConnections: pool.idleCount,
                waitingConnections: pool.waitingCount,
                maxConnections: pool.options.max ?? 10,
            };
        } catch {
            cachedDatabaseHealth = {
                status: "down", probeMs: null, totalConnections: pool.totalCount, idleConnections: pool.idleCount,
                waitingConnections: pool.waitingCount, maxConnections: pool.options.max ?? 10,
            };
        }
    }
    return {
        ...cachedDatabaseHealth,
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingConnections: pool.waitingCount,
    };
}

async function readSnapshot(range: MonitoringRange) {
    const database = await readDatabaseHealth();
    const snapshot = getAdminMonitoring(range, database);
    const status = database.status === "down" ? "degraded" : snapshot.api.errorRatePercent !== null && snapshot.api.errorRatePercent >= 5 ? "degraded" : "healthy";
    return { ...snapshot, status };
}

function sendEvent(reply: FastifyReply, event: string, data: unknown) {
    reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function adminMonitoringRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();
    const protectedRoute = { preHandler: [adminGuard], schema: { querystring: querySchema } };

    router.get("/api/v1/admin/monitoring", protectedRoute, async (request, reply) => {
        const { range } = request.query as { range: MonitoringRange };
        return reply.send({ success: true, data: await readSnapshot(range) });
    });

    router.get("/api/v1/admin/monitoring/stream", protectedRoute, async (request, reply) => {
        const { range } = request.query as { range: MonitoringRange };
        const adminId = request.user?.id;
        if (!adminId) return reply.code(401).send({ success: false, error: { code: "UNAUTHORIZED", message: "Admin session is required." } });

        reply.hijack();
        const raw = reply.raw;
        raw.writeHead(200, {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        });
        raw.flushHeaders();

        let closed = false;
        let publishing = false;
        let lastAuthCheck = 0;
        const closeStream = () => {
            if (closed) return;
            closed = true;
            clearInterval(publishTimer);
            clearTimeout(maxDurationTimer);
            raw.off("close", closeStream);
            if (!raw.destroyed) raw.end();
        };
        const publish = async () => {
            if (closed || publishing) return;
            publishing = true;
            try {
                if (Date.now() - lastAuthCheck >= 15_000) {
                    lastAuthCheck = Date.now();
                    const admin = await authRepository.findUserById(adminId);
                    if (!admin || admin.role !== "admin" || admin.status !== "active") {
                        closeStream();
                        return;
                    }
                }
                const data = await readSnapshot(range);
                if (!closed && !raw.destroyed) sendEvent(reply, "snapshot", { success: true, data });
            } catch {
                if (!closed && !raw.destroyed) raw.write(": telemetry temporarily unavailable\n\n");
            } finally {
                publishing = false;
            }
        };
        const publishTimer = setInterval(() => void publish(), 2_000);
        const maxDurationTimer = setTimeout(closeStream, 55_000);
        raw.on("close", closeStream);
        await publish();
    });
}