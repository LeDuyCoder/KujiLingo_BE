export type BattleMode = "SPEED_QUIZ" | "HP_BATTLE" | "ENERGY_BAR";
export type MatchState = "LOBBY" | "SEARCHING" | "READY_CHECK" | "PLAYING" | "FINISHED";

export interface WSBaseMessage<T = any> {
    type: string;
    event_id: string;
    request_id?: string | undefined;
    server_time: string;
    data?: T | undefined;
}

export interface PlayerPublicProfile {
    user_id: string;
    display_name: string;
    avatar: string | null;
    ready: boolean;
}

export interface BattleParameters {
    battle_mode: BattleMode;
    difficulty_level: string; // e.g. "N5", "N4", "N3", "N2", "N1"
    question_type: string;    // e.g. "VOCAB"
    question_count: number;
    time_limit_seconds: number;
    base_hp?: number | undefined;
}

// --- CLIENT COMMAND PAYLOADS ---

export interface LobbyJoinPayload extends BattleParameters {}

export interface MatchmakingStartPayload {
    mode: "RANDOM";
}

export interface InviteSendPayload {
    target_user_id: string;
}

export interface InviteRespondPayload {
    invite_id: string;
    decision: "ACCEPT" | "DECLINE";
}

export interface PlayerReadyPayload {
    match_id: string;
}

export interface QuestionAnswerPayload {
    match_id: string;
    question_id: string;
    answer: string;
    client_sent_at: string;
}

export interface SessionResumePayload {
    session_id: string;
    last_received_event_id: string;
}

// --- SERVER EVENT PAYLOADS ---

export interface ConnectionReadyPayload {
    connection_id: string;
    server_time: string;
    heartbeat_interval_seconds: number;
    protocol_version: number;
}

export interface LobbyJoinedPayload {
    session_id: string;
    parameters: BattleParameters;
}

export interface MatchmakingSearchingPayload {
    queue_position: number | null;
}

export interface MatchmakingFoundPayload {
    match_id: string;
    battle_mode: BattleMode;
    parameters: BattleParameters;
    players: PlayerPublicProfile[];
    ready_deadline: string;
}

export interface InviteReceivedPayload {
    invite_id: string;
    inviter: {
        user_id: string;
        display_name: string;
        avatar: string | null;
    };
    parameters: BattleParameters;
    expires_at: string;
}

export interface MatchReadyCheckPayload {
    match_id: string;
    players: PlayerPublicProfile[];
    ready_deadline: string;
}

export interface MatchStartedPayload {
    match_id: string;
    battle_mode: BattleMode;
    question_count: number;
    deadline: string;
    initial_stats: {
        scores?: Record<string, number> | undefined;
        hp?: Record<string, number> | undefined;
        energy?: Record<string, number> | undefined;
    };
}

export interface QuestionChoice {
    id: string;
    text: string;
}

export interface QuestionIssuedPayload {
    match_id: string;
    question_id: string;
    question_number: number;
    total_questions: number;
    japanese: string;
    hiragana?: string | undefined;
    romaji?: string | undefined;
    audio?: string | undefined;
    image?: string | undefined;
    choices: QuestionChoice[];
    deadline: string;
}

export interface QuestionResultPayload {
    match_id: string;
    question_id: string;
    user_id: string;
    is_correct: boolean;
    correct_answer: string;
    response_time_ms: number;
    battle_mode: BattleMode;
    // Mode specific fields
    points_awarded?: number | undefined;
    hp_delta?: number | undefined;
    energy_delta?: number | undefined;
    damage_reason?: "WRONG_ANSWER" | "SLOWER_CORRECT" | "TIMEOUT" | undefined;
    // Current totals
    scores?: Record<string, number> | undefined;
    hp?: Record<string, number> | undefined;
    energy?: Record<string, number> | undefined;
}

export interface ScoreUpdatedPayload {
    match_id: string;
    battle_mode: BattleMode;
    sequence: number;
    scores?: Record<string, number> | undefined;
    hp?: Record<string, number> | undefined;
    energy?: Record<string, number> | undefined;
}

export interface MatchFinishedPayload {
    match_id: string;
    winner_id: string | null;
    win_condition: "SCORE_HIGHER" | "HP_ZERO" | "HP_HIGHER" | "ENERGY_FULL" | "ENERGY_HIGHER" | "FORFEIT" | "DRAW";
    reason: string;
    final_stats: {
        scores: Record<string, number>;
        hp?: Record<string, number> | undefined;
        energy?: Record<string, number> | undefined;
    };
}

export interface SettlementCompletedPayload {
    match_id: string;
    history_id: string;
    rating_changes: Record<string, number>;
}

export interface ErrorPayload {
    code: string;
    message: string;
    retryable: boolean;
}
