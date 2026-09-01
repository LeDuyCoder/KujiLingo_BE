import { v4 as uuidv4 } from "uuid";
import { db } from "../config/prisma.js";
import { sessionManager } from "./pvp-session.manager.js";
import { pvpService } from "../modules/pvp/pvp.service.js";
import type {
    BattleParameters,
    BattleMode,
    PlayerPublicProfile,
    QuestionChoice,
    QuestionIssuedPayload,
    QuestionResultPayload,
    ScoreUpdatedPayload,
    MatchFinishedPayload,
    SettlementCompletedPayload,
    WSBaseMessage,
} from "./pvp-ws.types.js";

export interface RoomPlayer {
    userId: string;
    displayName: string;
    avatar: string | null;
    ready: boolean;
    score: number;
    hp: number;
    energy: number;
    currentAnswer?: {
        answer: string;
        sentAt: number;
        responseTimeMs: number;
    } | undefined;
}

export interface RoomQuestion {
    id: string;
    japanese: string;
    hiragana?: string | undefined;
    romaji?: string | undefined;
    audio?: string | undefined;
    image?: string | undefined;
    correctAnswer: string;
    choices: QuestionChoice[];
}

export class PVPRoom {
    public matchId: string;
    public battleMode: BattleMode;
    public parameters: BattleParameters;
    public players = new Map<string, RoomPlayer>();
    public state: "READY_CHECK" | "PLAYING" | "FINISHED" = "READY_CHECK";
    public questions: RoomQuestion[] = [];
    public currentQuestionIndex = 0;
    public questionDeadline = 0;
    public sequence = 0;
    public readyTimeoutTimer?: NodeJS.Timeout | undefined;
    public questionTimer?: NodeJS.Timeout | undefined;

    constructor(matchId: string, parameters: BattleParameters, player1: RoomPlayer, player2: RoomPlayer) {
        this.matchId = matchId;
        this.battleMode = parameters.battle_mode;
        this.parameters = parameters;
        this.players.set(player1.userId, player1);
        this.players.set(player2.userId, player2);
    }

    public getPlayerProfiles(): PlayerPublicProfile[] {
        return Array.from(this.players.values()).map((p) => ({
            user_id: p.userId,
            display_name: p.displayName,
            avatar: p.avatar,
            ready: p.ready,
        }));
    }

    public broadcast(event: WSBaseMessage) {
        for (const userId of this.players.keys()) {
            sessionManager.sendToUser(userId, event);
        }
    }

    public markReady(userId: string): boolean {
        const player = this.players.get(userId);
        if (player) {
            player.ready = true;
        }
        const allReady = Array.from(this.players.values()).every((p) => p.ready);
        return allReady;
    }

    public async loadQuestions() {
        const jlptLevel = (this.parameters.difficulty_level || "N3") as any;
        const count = Math.min(20, Math.max(5, this.parameters.question_count || 10));

        // Fetch random vocabularies from DB matching JLPT level
        const vocabs = await db.prisma.vocabularies.findMany({
            where: { jlpt: jlptLevel },
            include: { vocabulary_meanings: true },
            take: count * 4,
        });

        const shuffled = vocabs.sort(() => Math.random() - 0.5).slice(0, count);

        if (shuffled.length === 0) {
            const fallbackVocabs = [
                { id: `q_fb_1`, japanese: "猫 (ねこ)", correctAnswer: "Con mèo", distractors: ["Con chó", "Con chim", "Con cá"] },
                { id: `q_fb_2`, japanese: "犬 (いぬ)", correctAnswer: "Con chó", distractors: ["Con mèo", "Con thỏ", "Con gấu"] },
                { id: `q_fb_3`, japanese: "桜 (さくら)", correctAnswer: "Hoa anh đào", distractors: ["Hoa hồng", "Hoa cúc", "Hoa sen"] },
                { id: `q_fb_4`, japanese: "山 (やま)", correctAnswer: "Ngọn núi", distractors: ["Dòng sông", "Biển", "Bầu trời"] },
                { id: `q_fb_5`, japanese: "川 (かわ)", correctAnswer: "Dòng sông", distractors: ["Ngọn núi", "Hồ nước", "Biển"] },
            ];

            this.questions = fallbackVocabs.slice(0, count).map((item) => ({
                id: item.id,
                japanese: item.japanese,
                correctAnswer: item.correctAnswer,
                choices: [
                    { id: `opt_corr_${item.id}`, text: item.correctAnswer },
                    ...item.distractors.map((d, i) => ({ id: `opt_dist_${i}_${item.id}`, text: d })),
                ].sort(() => Math.random() - 0.5),
            }));
            return;
        }

        this.questions = shuffled.map((vocab) => {
            const correctAnswerText = vocab.vocabulary_meanings[0]?.meaning || vocab.romaji || "Correct Meaning";
            // Create 3 distractor choices
            const otherVocabs = vocabs.filter((v) => v.id !== vocab.id).sort(() => Math.random() - 0.5).slice(0, 3);
            const choicesList: QuestionChoice[] = [
                { id: `opt_corr_${vocab.id}`, text: correctAnswerText },
                ...otherVocabs.map((ov, i) => ({
                    id: `opt_dist_${i}_${ov.id}`,
                    text: ov.vocabulary_meanings[0]?.meaning || ov.romaji || `Option ${i + 1}`,
                })),
            ].sort(() => Math.random() - 0.5);

            return {
                id: vocab.id,
                japanese: vocab.kanji || vocab.hiragana || "日本語",
                hiragana: vocab.hiragana || undefined,
                romaji: vocab.romaji || undefined,
                audio: vocab.audio || undefined,
                image: vocab.image || undefined,
                correctAnswer: correctAnswerText,
                choices: choicesList,
            };
        });
    }

    public startMatch() {
        if (this.readyTimeoutTimer) clearTimeout(this.readyTimeoutTimer);
        this.state = "PLAYING";

        const initialStats: { scores?: Record<string, number>; hp?: Record<string, number>; energy?: Record<string, number> } = {};
        if (this.battleMode === "SPEED_QUIZ") {
            initialStats.scores = this.getScoresMap();
        } else if (this.battleMode === "HP_BATTLE") {
            initialStats.hp = this.getHpMap();
        } else if (this.battleMode === "ENERGY_BAR") {
            initialStats.energy = this.getEnergyMap();
        }

        this.broadcast({
            type: "match.started",
            event_id: `evt_${uuidv4()}`,
            server_time: new Date().toISOString(),
            data: {
                match_id: this.matchId,
                battle_mode: this.battleMode,
                question_count: this.questions.length,
                deadline: new Date(Date.now() + (this.parameters.time_limit_seconds || 30) * 1000).toISOString(),
                initial_stats: initialStats,
            },
        });

        this.issueQuestion(0);
    }

    public issueQuestion(index: number) {
        if (index >= this.questions.length) {
            this.finishMatch("ALL_QUESTIONS_COMPLETED", "SCORE_HIGHER");
            return;
        }

        this.currentQuestionIndex = index;
        const q = this.questions[index];
        if (!q) {
            this.finishMatch("ALL_QUESTIONS_COMPLETED", "SCORE_HIGHER");
            return;
        }
        const timeLimit = (this.parameters.time_limit_seconds || 30) * 1000;
        this.questionDeadline = Date.now() + timeLimit;

        // Reset players current answer
        for (const player of this.players.values()) {
            player.currentAnswer = undefined;
        }

        const issuedPayload: QuestionIssuedPayload = {
            match_id: this.matchId,
            question_id: q.id,
            question_number: index + 1,
            total_questions: this.questions.length,
            japanese: q.japanese,
            hiragana: q.hiragana,
            romaji: q.romaji,
            audio: q.audio,
            image: q.image,
            choices: q.choices,
            deadline: new Date(this.questionDeadline).toISOString(),
        };

        this.broadcast({
            type: "question.issued",
            event_id: `evt_${uuidv4()}`,
            server_time: new Date().toISOString(),
            data: issuedPayload,
        });

        // Set timer for question deadline
        if (this.questionTimer) clearTimeout(this.questionTimer);
        this.questionTimer = setTimeout(() => {
            this.evaluateCurrentQuestion();
        }, timeLimit + 500); // 500ms grace period
    }

    public recordAnswer(userId: string, questionId: string, answerText: string, clientSentAt: string): boolean {
        if (this.state !== "PLAYING") return false;
        const q = this.questions[this.currentQuestionIndex];
        if (!q || q.id !== questionId) return false;

        const player = this.players.get(userId);
        if (!player || player.currentAnswer) return false; // Already answered once

        const now = Date.now();
        const responseTimeMs = Math.max(0, Math.min(now - (this.questionDeadline - (this.parameters.time_limit_seconds || 30) * 1000), (this.parameters.time_limit_seconds || 30) * 1000));

        player.currentAnswer = {
            answer: answerText,
            sentAt: now,
            responseTimeMs,
        };

        // Check if both players answered
        const allAnswered = Array.from(this.players.values()).every((p) => p.currentAnswer !== undefined);
        if (allAnswered) {
            if (this.questionTimer) clearTimeout(this.questionTimer);
            this.evaluateCurrentQuestion();
        }

        return true;
    }

    public evaluateCurrentQuestion() {
        if (this.questionTimer) clearTimeout(this.questionTimer);
        const q = this.questions[this.currentQuestionIndex];
        if (!q) return;

        const playerList = Array.from(this.players.values());
        const timeLimitMs = (this.parameters.time_limit_seconds || 30) * 1000;

        // Evaluate answer correctness & score/hp/energy deltas
        for (const player of playerList) {
            const ans = player.currentAnswer;
            const isCorrect = ans ? ans.answer === q.correctAnswer : false;
            const responseTimeMs = ans ? ans.responseTimeMs : timeLimitMs;

            let pointsAwarded = 0;
            let hpDelta = 0;
            let energyDelta = 0;
            let damageReason: "WRONG_ANSWER" | "SLOWER_CORRECT" | "TIMEOUT" | undefined = undefined;

            if (this.battleMode === "SPEED_QUIZ") {
                if (isCorrect) {
                    const speedRatio = 1 - responseTimeMs / timeLimitMs;
                    pointsAwarded = Math.max(10, Math.floor(100 * speedRatio));
                    player.score += pointsAwarded;
                }
            } else if (this.battleMode === "HP_BATTLE") {
                if (!ans) {
                    hpDelta = -500;
                    damageReason = "TIMEOUT";
                } else if (!isCorrect) {
                    hpDelta = -500;
                    damageReason = "WRONG_ANSWER";
                } else {
                    // Compare with opponent speed
                    const opponent = playerList.find((p) => p.userId !== player.userId);
                    const oppAns = opponent?.currentAnswer;
                    if (oppAns && oppAns.answer === q.correctAnswer && oppAns.responseTimeMs < responseTimeMs) {
                        const timeDiff = responseTimeMs - oppAns.responseTimeMs;
                        hpDelta = -Math.floor(300 * (timeDiff / timeLimitMs));
                        damageReason = "SLOWER_CORRECT";
                    }
                }
                player.hp = Math.max(0, player.hp + hpDelta);
            } else if (this.battleMode === "ENERGY_BAR") {
                if (isCorrect) {
                    const speedRatio = 1 - responseTimeMs / timeLimitMs;
                    energyDelta = Math.min(100 - player.energy, Math.floor(15 + 10 * speedRatio));
                    player.energy = Math.min(100, player.energy + energyDelta);
                }
            }

            // Emit question.result for this player
            const resultPayload: QuestionResultPayload = {
                match_id: this.matchId,
                question_id: q.id,
                user_id: player.userId,
                is_correct: isCorrect,
                correct_answer: q.correctAnswer,
                response_time_ms: responseTimeMs,
                battle_mode: this.battleMode,
                points_awarded: pointsAwarded,
                hp_delta: hpDelta,
                energy_delta: energyDelta,
                damage_reason: damageReason,
                scores: this.getScoresMap(),
                hp: this.getHpMap(),
                energy: this.getEnergyMap(),
            };

            this.broadcast({
                type: "question.result",
                event_id: `evt_${uuidv4()}`,
                server_time: new Date().toISOString(),
                data: resultPayload,
            });
        }

        // Broadcast score.updated
        this.sequence += 1;
        const scoreUpdatedPayload: ScoreUpdatedPayload = {
            match_id: this.matchId,
            battle_mode: this.battleMode,
            sequence: this.sequence,
            scores: this.getScoresMap(),
            hp: this.getHpMap(),
            energy: this.getEnergyMap(),
        };

        this.broadcast({
            type: "score.updated",
            event_id: `evt_${uuidv4()}`,
            server_time: new Date().toISOString(),
            data: scoreUpdatedPayload,
        });

        // Check immediate win conditions (HP 0 or Energy 100%)
        if (this.battleMode === "HP_BATTLE") {
            const player1 = playerList[0];
            const player2 = playerList[1];
            if (player1 && player2 && (player1.hp <= 0 || player2.hp <= 0)) {
                this.finishMatch("HP_ZERO_REACHED", "HP_ZERO");
                return;
            }
        } else if (this.battleMode === "ENERGY_BAR") {
            const fullPlayer = playerList.find((p) => p.energy >= 100);
            if (fullPlayer) {
                this.finishMatch("ENERGY_FULL_REACHED", "ENERGY_FULL");
                return;
            }
        }

        // Move to next question after 2s delay
        setTimeout(() => {
            this.issueQuestion(this.currentQuestionIndex + 1);
        }, 2000);
    }

    public async finishMatch(
        reason: string,
        winConditionOverride?: "SCORE_HIGHER" | "HP_ZERO" | "HP_HIGHER" | "ENERGY_FULL" | "ENERGY_HIGHER" | "FORFEIT" | "DRAW"
    ) {
        if (this.state === "FINISHED") return;
        this.state = "FINISHED";

        if (this.readyTimeoutTimer) clearTimeout(this.readyTimeoutTimer);
        if (this.questionTimer) clearTimeout(this.questionTimer);

        const playerList = Array.from(this.players.values());
        const p1 = playerList[0];
        const p2 = playerList[1];
        if (!p1 || !p2) return;

        let winnerId: string | null = null;
        let winCondition: "SCORE_HIGHER" | "HP_ZERO" | "HP_HIGHER" | "ENERGY_FULL" | "ENERGY_HIGHER" | "FORFEIT" | "DRAW" = "DRAW";

        if (winConditionOverride === "FORFEIT") {
            winCondition = "FORFEIT";
            // Check who didn't forfeit
            winnerId = p1.hp > 0 || p1.score > 0 ? p1.userId : p2.userId;
        } else if (this.battleMode === "SPEED_QUIZ") {
            winCondition = "SCORE_HIGHER";
            if (p1.score > p2.score) winnerId = p1.userId;
            else if (p2.score > p1.score) winnerId = p2.userId;
            else winCondition = "DRAW";
        } else if (this.battleMode === "HP_BATTLE") {
            winCondition = p1.hp <= 0 || p2.hp <= 0 ? "HP_ZERO" : "HP_HIGHER";
            if (p1.hp > p2.hp) winnerId = p1.userId;
            else if (p2.hp > p1.hp) winnerId = p2.userId;
            else winCondition = "DRAW";
        } else if (this.battleMode === "ENERGY_BAR") {
            winCondition = p1.energy >= 100 || p2.energy >= 100 ? "ENERGY_FULL" : "ENERGY_HIGHER";
            if (p1.energy > p2.energy) winnerId = p1.userId;
            else if (p2.energy > p1.energy) winnerId = p2.userId;
            else winCondition = "DRAW";
        }

        const matchFinishedPayload: MatchFinishedPayload = {
            match_id: this.matchId,
            winner_id: winnerId,
            win_condition: winCondition,
            reason,
            final_stats: {
                scores: this.getScoresMap(),
                hp: this.getHpMap(),
                energy: this.getEnergyMap(),
            },
        };

        this.broadcast({
            type: "match.finished",
            event_id: `evt_${uuidv4()}`,
            server_time: new Date().toISOString(),
            data: matchFinishedPayload,
        });

        // Trigger REST Settlement asynchronously
        await this.settleMatch(p1, p2, winnerId);
    }

    private async settleMatch(p1: RoomPlayer, p2: RoomPlayer, winnerId: string | null) {
        try {
            let ratingChangeUser = 0;
            let ratingChangeOpponent = 0;

            if (winnerId === p1.userId) {
                ratingChangeUser = 15;
                ratingChangeOpponent = -15;
            } else if (winnerId === p2.userId) {
                ratingChangeUser = -15;
                ratingChangeOpponent = 15;
            }

            const recordResult = await pvpService.recordMatch({
                user_id: p1.userId,
                opponent_id: p2.userId,
                winner_id: winnerId,
                user_score: p1.score,
                opponent_score: p2.score,
                rating_change_user: ratingChangeUser,
                rating_change_opponent: ratingChangeOpponent,
                played_at: new Date().toISOString(),
                external_match_id: this.matchId,
            });

            const settlementPayload: SettlementCompletedPayload = {
                match_id: this.matchId,
                history_id: recordResult.match_id,
                rating_changes: {
                    [p1.userId]: ratingChangeUser,
                    [p2.userId]: ratingChangeOpponent,
                },
            };

            this.broadcast({
                type: "settlement.completed",
                event_id: `evt_${uuidv4()}`,
                server_time: new Date().toISOString(),
                data: settlementPayload,
            });
        } catch (error) {
            // Log error
        }
    }

    private getScoresMap(): Record<string, number> {
        const map: Record<string, number> = {};
        for (const [id, p] of this.players) map[id] = p.score;
        return map;
    }

    private getHpMap(): Record<string, number> {
        const map: Record<string, number> = {};
        for (const [id, p] of this.players) map[id] = p.hp;
        return map;
    }

    private getEnergyMap(): Record<string, number> {
        const map: Record<string, number> = {};
        for (const [id, p] of this.players) map[id] = p.energy;
        return map;
    }
}

class RoomManager {
    private rooms = new Map<string, PVPRoom>();
    private userToRoomId = new Map<string, string>();

    public async createRoom(parameters: BattleParameters, player1Session: any, player2Session: any, matchId: string): Promise<PVPRoom> {
        const baseHp = parameters.base_hp || 2000;
        const p1: RoomPlayer = {
            userId: player1Session.userId,
            displayName: player1Session.displayName,
            avatar: player1Session.avatar,
            ready: false,
            score: 0,
            hp: baseHp,
            energy: 0,
        };
        const p2: RoomPlayer = {
            userId: player2Session.userId,
            displayName: player2Session.displayName,
            avatar: player2Session.avatar,
            ready: false,
            score: 0,
            hp: baseHp,
            energy: 0,
        };

        const room = new PVPRoom(matchId, parameters, p1, p2);
        this.rooms.set(matchId, room);
        this.userToRoomId.set(player1Session.userId, matchId);
        this.userToRoomId.set(player2Session.userId, matchId);

        // Load questions before starting ready check
        await room.loadQuestions();

        // 15 seconds ready check deadline
        const readyDeadline = new Date(Date.now() + 15000).toISOString();

        // Emit match.ready_check to both players
        room.broadcast({
            type: "match.ready_check",
            event_id: `evt_${uuidv4()}`,
            server_time: new Date().toISOString(),
            data: {
                match_id: matchId,
                players: room.getPlayerProfiles(),
                ready_deadline: readyDeadline,
            },
        });

        // Set ready timeout (15s)
        room.readyTimeoutTimer = setTimeout(() => {
            if (room.state === "READY_CHECK") {
                room.finishMatch("PLAYER_READY_TIMEOUT", "FORFEIT");
                this.removeRoom(matchId);
            }
        }, 15000);

        return room;
    }

    public getRoom(matchId: string): PVPRoom | undefined {
        return this.rooms.get(matchId);
    }

    public getRoomByUserId(userId: string): PVPRoom | undefined {
        const roomId = this.userToRoomId.get(userId);
        if (roomId) return this.rooms.get(roomId);
        return undefined;
    }

    public removeRoom(matchId: string) {
        const room = this.rooms.get(matchId);
        if (room) {
            for (const userId of room.players.keys()) {
                this.userToRoomId.delete(userId);
            }
            if (room.readyTimeoutTimer) clearTimeout(room.readyTimeoutTimer);
            if (room.questionTimer) clearTimeout(room.questionTimer);
            this.rooms.delete(matchId);
        }
    }
}

export const roomManager = new RoomManager();
