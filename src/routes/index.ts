import type { FastifyInstance } from "fastify";
import { authRoutes } from "../modules/auth/index.js";

export async function registerRoutes(app: FastifyInstance) {
    await app.register(authRoutes);
}
