import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

export async function registerSwagger(app: FastifyInstance) {
    await app.register(swagger, {
        openapi: {
            info: {
                title: "KujiLingo API",
                description: "API Documentation for KujiLingo backend",
                version: "1.0.0",
            },
            servers: [
                {
                    url: "http://localhost:3000",
                    description: "Development Server",
                },
            ],
        },
    });

    await app.register(swaggerUi, {
        routePrefix: "/docs",
        uiConfig: {
            docExpansion: "list",
            deepLinking: false,
        },
        staticCSP: true,
        transformStaticCSP: (header) => header,
    });
}
