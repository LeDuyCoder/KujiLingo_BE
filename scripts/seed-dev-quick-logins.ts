import "dotenv/config";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { prisma } from "../src/config/prisma.js";

const frontendEnvPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../KujiLingo_FE/apps/web/.env.local");
dotenv.config({ path: frontendEnvPath });

async function main() {
    if (process.env.NODE_ENV === "production") {
        throw new Error("Development login seed is disabled in production.");
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl || !["localhost", "127.0.0.1", "::1"].includes(new URL(databaseUrl).hostname)) {
        throw new Error("Development login seed only runs against a local database.");
    }

    const learner = {
        email: (process.env.NEXT_PUBLIC_DEMO_USER_EMAIL || "user_demo_1@example.com").trim().toLowerCase(),
        password: process.env.NEXT_PUBLIC_DEMO_USER_PASSWORD || "Password123",
        displayName: "Demo Learner",
        role: "user",
    };
    const adminEmail = process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
        throw new Error("Configure NEXT_PUBLIC_DEMO_ADMIN_EMAIL and NEXT_PUBLIC_DEMO_ADMIN_PASSWORD in KujiLingo_FE/apps/web/.env.local first.");
    }
    if (adminEmail === learner.email) {
        throw new Error("Demo learner and admin must use different email addresses.");
    }

    const accounts = [learner, {
        email: adminEmail,
        password: adminPassword,
        displayName: "Demo Admin",
        role: "admin",
    }];

    for (const account of accounts) {
        const existing = await prisma.users.findUnique({
            where: { email: account.email },
            select: { password_hash: true, status: true, role: true },
        });

        if (existing) {
            const passwordMatches = Boolean(existing.password_hash && await bcrypt.compare(account.password, existing.password_hash));
            console.log(`${account.role}: already exists; password ${passwordMatches ? "matches" : "does not match configured quick-login"}; unchanged.`);
            continue;
        }

        await prisma.users.create({
            data: {
                id: crypto.randomUUID(),
                email: account.email,
                password_hash: await bcrypt.hash(account.password, 12),
                display_name: account.displayName,
                accepted_terms: true,
                status: "active",
                email_verified: true,
                email_verified_at: new Date(),
                role: account.role,
            },
        });
        console.log(`${account.role}: created the local development quick-login account.`);
    }
}

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : "Could not seed development quick-login accounts.");
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
