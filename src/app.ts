import Fastify from "fastify";

const app = Fastify({
    logger: true,
});

app.get("/", async () => {
    return {
        message: "KujiLingo API is running 🚀",
    };
});

export default app;