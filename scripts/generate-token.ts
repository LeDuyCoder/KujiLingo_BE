import "dotenv/config";
import { prisma } from "../src/config/prisma.js";
import jwt from "jsonwebtoken";
import { env } from "../src/config/env.js";

async function main() {
    let privateKey = env.JWT_PRIVATE_KEY;
    if (privateKey && !privateKey.includes("-----BEGIN")) {
        privateKey = Buffer.from(privateKey, "base64").toString("utf8");
    }

    const userId = "00000000-0000-0000-0000-000000000001";
    let user = await prisma.users.findUnique({ where: { id: userId } });

    if (!user) {
        user = await prisma.users.create({
            data: {
                id: userId,
                email: "postman_dev@kujilingo.com",
                password_hash: "hashed",
                display_name: "Postman Dev User",
                role: "USER",
                status: "active",
            },
        });
    }

    // Sign long-lived token (30 days) for dev postman testing
    const token = jwt.sign(
        {
            sub: user.id,
            role: user.role,
        },
        privateKey!,
        {
            algorithm: "RS256",
            expiresIn: "30d",
        }
    );

    console.log("=== FRESH LONG-LIVED POSTMAN ACCESS TOKEN (30 DAYS) ===");
    console.log("User ID:", user.id);
    console.log("User Email:", user.email);
    console.log("Expires In: 30 Days");
    console.log("\nBearer Token:\n" + token);
    console.log("=======================================================");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
