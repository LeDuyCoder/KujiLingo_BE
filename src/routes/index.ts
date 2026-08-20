import type { FastifyInstance } from "fastify";
import { authRoutes } from "../modules/auth/index.js";
import { adminRoutes } from "../modules/admin/index.js";

export async function registerRoutes(app: FastifyInstance) {
    await app.register(authRoutes);
    await app.register(adminRoutes);
}
