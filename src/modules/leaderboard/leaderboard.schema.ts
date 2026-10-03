import { z } from "zod";

export const getLeaderboardQuerySchema = z.object({
    period_type: z.enum(["daily", "weekly", "monthly", "all_time"]).default("weekly"),
    limit: z.coerce.number().int().min(1, "limit must be at least 1.").max(100, "limit cannot exceed 100.").default(50),
});
