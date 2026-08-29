import app from "./app.js";

const start = async () => {
    try {
        await app.listen({
            host: "0.0.0.0",
            port: 8000,
        });
        //comment test CI v0.0.1
        console.log("ðŸš€ Server running at http://localhost:8000");
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
// touch to reload
