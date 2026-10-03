import { prisma } from "../src/config/prisma.js";

async function main() {
    try {
        console.log("Attempting database query...");
        const result = await prisma.favorite_vocabularies.deleteMany({});
        console.log("Success:", result);
    } catch (e: any) {
        console.error("Prisma error occurred:");
        console.error("Message:", e.message);
        console.error("Code:", e.code);
        console.error("Meta:", e.meta);
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
