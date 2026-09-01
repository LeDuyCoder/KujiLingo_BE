import cors from "@fastify/cors";
import "dotenv/config";
import Fastify from "fastify";
import { validatorCompiler, serializerCompiler } from "fastify-type-provider-zod";
import { registerSwagger } from "./config/swagger.js";
import { registerRoutes } from "./routes/index.js";
import { HttpException } from "./common/errors/http.exception.js";

const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"]
});

// Register global error handler before registering routes so it is correctly inherited
app.setErrorHandler((error: any, request, reply) => {
    const statusCode = error.statusCode || 500;
    let errorCode = "INTERNAL_ERROR";
    let message = "An unexpected error occurred. Please try again later.";

    // Xử lý lỗi validation từ Zod / Fastify
    if (error.validation || error.name === "ZodError") {
        return reply.status(400).send({
            success: false,
            error: {
                code: "VALIDATION_ERROR",
                message: error.message,
            },
        });
    }

    // Chỉ tin tưởng error.code/error.message
    if (error instanceof HttpException) {
        errorCode = error.code;
        message = error.message;
    } else {
        // Lỗi không xác định: map theo statusCode (nếu có) nhưng KHÔNG rò rỉ error.code hay error.message thô
        if (statusCode === 401) errorCode = "UNAUTHORIZED";
        else if (statusCode === 403) errorCode = "FORBIDDEN";
        else if (statusCode === 404) errorCode = "NOT_FOUND";
        // 400 ở đây không cần map vì validation đã xử lý ở trên, các status khác giữ INTERNAL_ERROR
    }

    return reply.status(statusCode).send({
        success: false,
        error: {
            code: errorCode,
            message,
        },
    });
});

await registerSwagger(app);
await registerRoutes(app);

export default app;
