import type { FastifyInstance } from "fastify";
import { pvpWebSocketRoutes } from "./pvp.socket.js";

export async function registerWebSocketRoutes(app: FastifyInstance) {
    await app.register(pvpWebSocketRoutes);
}
