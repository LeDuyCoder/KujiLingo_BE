import Fastify from "fastify";
import { registerSwagger } from "./config/swagger.js";

const app = Fastify({
    logger: true,
});

await registerSwagger(app);

app.get("/", async () => {
    return {
        message: "KujiLingo API is running 🚀",
    };
});

export default app;