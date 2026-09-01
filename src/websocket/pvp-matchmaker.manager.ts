import { v4 as uuidv4 } from "uuid";
import { sessionManager } from "./pvp-session.manager.js";
import type { BattleParameters, BattleMode, WSBaseMessage } from "./pvp-ws.types.js";

export interface QueueEntry {
    userId: string;
    parameters: BattleParameters;
    queuedAt: number;
}

export interface FriendInvite {
    inviteId: string;
    inviterUserId: string;
    targetUserId: string;
    parameters: BattleParameters;
    expiresAt: number;
}

class MatchmakerManager {
    // Stores user's selected lobby parameters: userId -> BattleParameters
    private userLobbyParams = new Map<string, BattleParameters>();
    // Queue: key = `${battle_mode}_${difficulty_level}` -> QueueEntry[]
    private searchQueues = new Map<string, QueueEntry[]>();
    // Invites: inviteId -> FriendInvite
    private pendingInvites = new Map<string, FriendInvite>();

    public setUserLobbyParams(userId: string, params: BattleParameters) {
        this.userLobbyParams.set(userId, params);
    }

    public getUserLobbyParams(userId: string): BattleParameters | undefined {
        return this.userLobbyParams.get(userId);
    }

    public removeUserFromLobby(userId: string) {
        this.userLobbyParams.delete(userId);
        this.cancelSearch(userId);
    }

    public startSearch(userId: string): { matched: boolean; opponentId?: string; matchId?: string; parameters?: BattleParameters } {
        const params = this.userLobbyParams.get(userId);
        if (!params) {
            throw new Error("LOBBY_PARAMS_NOT_SET");
        }

        const queueKey = `${params.battle_mode}_${params.difficulty_level}`;
        let queue = this.searchQueues.get(queueKey);
        if (!queue) {
            queue = [];
            this.searchQueues.set(queueKey, queue);
        }

        // Check if user is already in queue
        const existingIndex = queue.findIndex((item) => item.userId === userId);
        if (existingIndex !== -1) {
            queue.splice(existingIndex, 1);
        }

        // Look for available opponent in queue
        const opponentEntry = queue.shift();
        if (opponentEntry && opponentEntry.userId !== userId) {
            const matchId = `match_${uuidv4()}`;
            return {
                matched: true,
                opponentId: opponentEntry.userId,
                matchId,
                parameters: params,
            };
        }

        // No opponent yet, add self to queue
        queue.push({
            userId,
            parameters: params,
            queuedAt: Date.now(),
        });

        return { matched: false };
    }

    public cancelSearch(userId: string): boolean {
        let found = false;
        for (const queue of this.searchQueues.values()) {
            const index = queue.findIndex((item) => item.userId === userId);
            if (index !== -1) {
                queue.splice(index, 1);
                found = true;
                break;
            }
        }
        return found;
    }

    public sendInvite(inviterUserId: string, targetUserId: string): FriendInvite {
        const inviterSession = sessionManager.getSessionByUserId(inviterUserId);
        const targetSession = sessionManager.getSessionByUserId(targetUserId);

        if (!targetSession) {
            throw new Error("OPPONENT_UNAVAILABLE");
        }

        const params = this.userLobbyParams.get(inviterUserId) || {
            battle_mode: "SPEED_QUIZ" as BattleMode,
            difficulty_level: "N3",
            question_type: "VOCAB",
            question_count: 10,
            time_limit_seconds: 30,
        };

        const inviteId = `inv_${uuidv4()}`;
        const expiresAt = Date.now() + 30000; // 30s invite expiry

        const invite: FriendInvite = {
            inviteId,
            inviterUserId,
            targetUserId,
            parameters: params,
            expiresAt,
        };

        this.pendingInvites.set(inviteId, invite);

        // Notify target user
        const inviteMessage: WSBaseMessage = {
            type: "invite.received",
            event_id: `evt_${uuidv4()}`,
            server_time: new Date().toISOString(),
            data: {
                invite_id: inviteId,
                inviter: {
                    user_id: inviterUserId,
                    display_name: inviterSession?.displayName || "Player",
                    avatar: inviterSession?.avatar || null,
                },
                parameters: params,
                expires_at: new Date(expiresAt).toISOString(),
            },
        };

        sessionManager.sendToSession(targetSession, inviteMessage);
        return invite;
    }

    public respondInvite(targetUserId: string, inviteId: string, decision: "ACCEPT" | "DECLINE"): { accepted: boolean; invite?: FriendInvite; matchId?: string } {
        const invite = this.pendingInvites.get(inviteId);
        if (!invite) {
            throw new Error("INVITE_EXPIRED");
        }

        if (invite.targetUserId !== targetUserId) {
            throw new Error("INVALID_COMMAND");
        }

        if (Date.now() > invite.expiresAt) {
            this.pendingInvites.delete(inviteId);
            throw new Error("INVITE_EXPIRED");
        }

        this.pendingInvites.delete(inviteId);

        if (decision === "DECLINE") {
            // Notify inviter
            sessionManager.sendToUser(invite.inviterUserId, {
                type: "invite.declined",
                event_id: `evt_${uuidv4()}`,
                server_time: new Date().toISOString(),
                data: { invite_id: inviteId },
            });
            return { accepted: false, invite };
        }

        // ACCEPT -> Create match
        const matchId = `match_${uuidv4()}`;
        return {
            accepted: true,
            invite,
            matchId,
        };
    }
}

export const matchmakerManager = new MatchmakerManager();
