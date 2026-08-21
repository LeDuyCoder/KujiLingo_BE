import { dashboardRepository } from "./dashboard.repository.js";

export async function getDashboardSummary(userId: string) {
    const [user, todayStats, srsCount] = await Promise.all([
        dashboardRepository.getUserBasics(userId),
        dashboardRepository.getTodayStats(userId),
        dashboardRepository.countSrsDue(userId),
    ]);

    if (!user) throw new Error("USER_NOT_FOUND");

    const minutesStudiedToday = todayStats?.minutes_studied || 0;
    const goalMinutes = user.learning_goal_minutes || 15; // default 15 minutes if not set
    const continueLearning = await dashboardRepository.findContinueLearning(userId, user.jlpt_target_level || "N5");
    const percent = Math.min(Math.round((minutesStudiedToday / goalMinutes) * 100), 100);
    const isAtRisk = false;

    return {
        success: true,
        data: {
            streak: {
                current_streak_days: user.streak || 0,
                longest_streak_days: user.longest_streak || 0,
                is_at_risk: isAtRisk
            },
            daily_goal_progress: {
                minutes_studied_today: minutesStudiedToday,
                goal_minutes: goalMinutes,
                percent: percent
            },
            continue_learning: continueLearning,
            srs_due_count: srsCount,
            recent_achievements: []
        }
    }

}