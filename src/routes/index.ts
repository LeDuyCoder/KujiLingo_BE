import type { FastifyInstance } from "fastify";
import { authRoutes } from "../modules/auth/index.js";
import { adminRoutes } from "../modules/admin/index.js";
import { coursesRoutes } from "../modules/courses/index.js";
import { dashboardRoutes } from "../modules/dashboard/dashboard.routes.js";
import { dictionaryRoutes } from "../modules/dictionary/dictionary.routes.js";

export async function registerRoutes(app: FastifyInstance) {
    await app.register(authRoutes);
    await app.register(adminRoutes);
    await app.register(coursesRoutes);
    await app.register(dashboardRoutes);
    await app.register(dictionaryRoutes);
}
