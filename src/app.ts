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

// Register global error handler before registering routes so it is correctly inherited
app.setErrorHandler((error: any, request, reply) => {
    if (error.validation) {
        return reply.status(400).send({
            success: false,
            error: {
                code: "VALIDATION_ERROR",
                message: error.message,
            },
        });
    }
    reply.send(error);
});

await registerSwagger(app);
await registerRoutes(app);

app.get("/", async () => {
    return {
        message: "KujiLingo API is running 🚀",
    };
});

export default app;