export interface DashboardSummaryDTO {
    streak: {
        current_streak_days: number;
        longest_streak_days: number;
        is_at_risk: boolean;
    };
    daily_goal_progress: {
        minutes_studied_today: number;
        goal_minutes: number;
        percent: number;
    };
    continue_learning: {
        lesson_id: string;
        lesson_title: string;
        course_title: string;
        reason: "in_progress" | "next_up" | "recommended"
    } | null;
    srs_due_count: number;
    recent_achievements: string[];
}