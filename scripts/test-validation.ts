import "dotenv/config";
import { leaderboardService } from "../src/modules/leaderboard/leaderboard.service.js";
import { z } from "zod";

async function main() {
    try {
        const result = await leaderboardService.getLeaderboard({ period_type: "weekly" });
        const firstEntry = result.data.entries[0];
        console.log("First entry:", firstEntry);
        console.log("Type of user_id:", typeof firstEntry.user_id);
        console.log("Length of user_id:", firstEntry.user_id.length);
        
        // Test with different UUID regexes
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        console.log("Regex test:", uuidRegex.test(firstEntry.user_id));
        
        const zodUuid = z.string().uuid();
        const parsed = zodUuid.safeParse(firstEntry.user_id);
        console.log("Zod validation result:", parsed);
        if (!parsed.success) {
            console.error("Zod Error:", parsed.error);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
