export type LearningStatus = "NEW" | "LEARNING" | "REVIEWING" | "MASTERED";

export interface LearningProgressOverviewResponse {
    success: boolean;
    data: {
        by_status: Record<LearningStatus, number>;
        by_jlpt: Record<string, number>;
        total_started: number;
        total_mastered: number;
        platform_total_vocabulary: number;
    };
}

export interface GetDueReviewQueueQuery {
    jlpt?: "N5" | "N4" | "N3" | "N2" | "N1";
    status?: LearningStatus;
    limit: number;
}

export interface DueReviewItem {
    progress_id: string;
    vocabulary_id: string;
    kanji: string | null;
    hiragana: string | null;
    meaning: string | null;
    jlpt: "N5" | "N4" | "N3" | "N2" | "N1";
    status: LearningStatus;
    mastery: number;
    correct_count: number;
    wrong_count: number;
    next_review: string;
}

export interface SubmitVocabularyReviewBody {
    vocabulary_id: string;
    correct: boolean;
    duration?: number;
}

export interface GetReviewHistoryQuery {
    start_date: string;
    end_date: string;
}
