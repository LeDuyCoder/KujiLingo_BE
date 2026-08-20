import type { FastifyInstance } from "fastify";
import { authRoutes } from "../modules/auth/index.js";
import { adminRoutes } from "../modules/admin/index.js";
import { coursesRoutes } from "../modules/courses/index.js";

export async function registerRoutes(app: FastifyInstance) {
    await app.register(authRoutes);
    await app.register(adminRoutes);
    await app.register(coursesRoutes);
}
