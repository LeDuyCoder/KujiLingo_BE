import "dotenv/config";
import { leaderboardService } from "../src/modules/leaderboard/leaderboard.service.js";

async function main() {
    try {
        console.log("Calling getLeaderboard directly...");
        const res = await leaderboardService.getLeaderboard({ period_type: "weekly" });
        console.log("Result:", JSON.stringify(res, null, 2));
    } catch (e: any) {
        console.error("Error thrown directly by service:");
        console.error(e);
    }
}

main();
