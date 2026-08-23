import "dotenv/config";
import app from "../src/app.js";
import { signToken } from "../src/common/utils/jwt.js";
import { prisma } from "../src/config/prisma.js";

async function main() {
    try {
        // Find an active user
        let user = await prisma.users.findFirst({
            where: { status: "active" }
        });
        
        if (!user) {
            console.log("No active user found. Creating one...");
            user = await prisma.users.create({
                data: {
                    id: "c0000000-0000-0000-0000-000000000000",
                    email: "test_serialization@example.com",
                    display_name: "Test Serialization User",
                    status: "active",
                    role: "user",
                    email_verified: true,
                }
            });
        }

        const token = signToken({ sub: user.id, role: user.role });
        console.log(`Using token for user: ${user.email}`);

        console.log("Injecting request with invalid period_type...");
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/leaderboard?period_type=invalid",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        console.log("Status:", res.statusCode);
        console.log("Body:", res.body);

        console.log("\nInjecting request with valid params but no snapshots...");
        const res2 = await app.inject({
            method: "GET",
            url: "/api/v1/leaderboard?period_type=weekly",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        console.log("Status:", res2.statusCode);
        console.log("Body:", res2.body);

    } catch (e: any) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
