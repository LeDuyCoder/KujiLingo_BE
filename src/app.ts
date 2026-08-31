import cors from "@fastify/cors";
import "dotenv/config";
import Fastify from "fastify";
import { validatorCompiler, serializerCompiler } from "fastify-type-provider-zod";
import { registerSwagger } from "./config/swagger.js";
import { registerRoutes } from "./routes/index.js";

const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
});

// Register global error handler before registering routes so it is correctly inherited
app.setErrorHandler((error: any, request, reply) => {
    const statusCode = error.statusCode || 500;
    let errorCode = "INTERNAL_ERROR";

    if (error.validation || error.name === "ZodError") {
        return reply.status(400).send({
            success: false,
            error: {
                code: "VALIDATION_ERROR",
                message: error.message,
            },
        });
    }

    if (error.code && !error.code.startsWith("FST_ERR_")) {
        errorCode = error.code;
    } else {
        if (statusCode === 400) {
            errorCode = "VALIDATION_ERROR";
        } else if (statusCode === 401) {
            errorCode = "UNAUTHORIZED";
        } else if (statusCode === 403) {
            errorCode = "FORBIDDEN";
        } else if (statusCode === 404) {
            errorCode = "NOT_FOUND";
        }
    }

    return reply.status(statusCode).send({
        success: false,
        error: {
            code: errorCode,
            message: error.message || "An unexpected error occurred. Please try again later.",
        },
    });
});

await registerSwagger(app);
await registerRoutes(app);

export default app;