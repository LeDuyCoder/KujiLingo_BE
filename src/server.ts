import app from "./app.js";

const start = async () => {
    try {
        await app.listen({
            host: "0.0.0.0",
            port: 3000,
        });
        //comment test CI v0.0.1
        console.log("🚀 Server running at http://localhost:3000");
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();