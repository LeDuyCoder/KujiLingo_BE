import type { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import { verifyToken } from "../common/utils/jwt.js";
import { db } from "../config/prisma.js";
import type { WSBaseMessage } from "./pvp-ws.types.js";

export interface UserSession {
    connectionId: string;
    sessionId: string;
    userId: string;
    displayName: string;
    avatar: string | null;
    socket: WebSocket;
    lastPingAt: number;
    lastPongAt: number;
    isAlive: boolean;
    joinedAt: Date;
    eventBuffer: WSBaseMessage[];
    disconnectedAt?: number | undefined;
}

class SessionManager {
    private sessionsByConn = new Map<string, UserSession>();
    private sessionsBySessionId = new Map<string, UserSession>();
    private sessionsByUserId = new Map<string, UserSession>();
    private heartbeatTimer?: NodeJS.Timeout | undefined;

    constructor() {
        this.startHeartbeatTimer();
    }

    public async authenticateSocket(token: string): Promise<{ id: string; display_name: string; avatar: string | null } | null> {
        try {
            if (!token) return null;
            const decoded = verifyToken(token) as { sub: string; role: string };
            if (!decoded?.sub) return null;

            const user = await db.prisma.users.findUnique({
                where: { id: decoded.sub },
                select: { id: true, display_name: true, avatar: true, status: true },
            });

            if (!user || user.status === "suspended" || user.status === "banned") {
                return null;
            }

            return {
                id: user.id,
                display_name: user.display_name || "Player",
                avatar: user.avatar || null,
            };
        } catch (error) {
            return null;
        }
    }

    public registerSession(socket: WebSocket, user: { id: string; display_name: string; avatar: string | null }): UserSession {
        // If user already has an active session, disconnect old one to prevent duplicate connections
        const existingSession = this.sessionsByUserId.get(user.id);
        if (existingSession && existingSession.socket !== socket) {
            try {
                this.sendToSession(existingSession, {
                    type: "error",
                    event_id: `evt_${uuidv4()}`,
                    server_time: new Date().toISOString(),
                    data: {
                        code: "DUPLICATE_SESSION",
                        message: "Another session was established for this account.",
                        retryable: false,
                    },
                });
                existingSession.socket.close(4000, "DUPLICATE_SESSION");
            } catch (e) {
                // ignore
            }
            this.removeSession(existingSession.connectionId);
        }

        const connectionId = `conn_${uuidv4()}`;
        const sessionId = `sess_${uuidv4()}`;

        const session: UserSession = {
            connectionId,
            sessionId,
            userId: user.id,
            displayName: user.display_name,
            avatar: user.avatar,
            socket,
            lastPingAt: Date.now(),
            lastPongAt: Date.now(),
            isAlive: true,
            joinedAt: new Date(),
            eventBuffer: [],
        };

        this.sessionsByConn.set(connectionId, session);
        this.sessionsBySessionId.set(sessionId, session);
        this.sessionsByUserId.set(user.id, session);

        return session;
    }

    public getSessionByConnection(connectionId: string): UserSession | undefined {
        return this.sessionsByConn.get(connectionId);
    }

    public getSessionByUserId(userId: string): UserSession | undefined {
        return this.sessionsByUserId.get(userId);
    }

    public getSessionBySessionId(sessionId: string): UserSession | undefined {
        return this.sessionsBySessionId.get(sessionId);
    }

    public removeSession(connectionId: string) {
        const session = this.sessionsByConn.get(connectionId);
        if (session) {
            this.sessionsByConn.delete(connectionId);
            this.sessionsBySessionId.delete(session.sessionId);
            this.sessionsByUserId.delete(session.userId);
        }
    }

    public markDisconnected(session: UserSession) {
        session.disconnectedAt = Date.now();
        session.isAlive = false;
    }

    public sendToSession(session: UserSession, message: WSBaseMessage) {
        if (session.socket && session.socket.readyState === session.socket.OPEN) {
            session.socket.send(JSON.stringify(message));
        }
        // Buffer event for reconnection (limit to last 50 events)
        session.eventBuffer.push(message);
        if (session.eventBuffer.length > 50) {
            session.eventBuffer.shift();
        }
    }

    public sendToUser(userId: string, message: WSBaseMessage): boolean {
        const session = this.sessionsByUserId.get(userId);
        if (session) {
            this.sendToSession(session, message);
            return true;
        }
        return false;
    }

    public recordPong(connectionId: string) {
        const session = this.sessionsByConn.get(connectionId);
        if (session) {
            session.isAlive = true;
            session.lastPongAt = Date.now();
        }
    }

    private startHeartbeatTimer() {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

        this.heartbeatTimer = setInterval(() => {
            const now = Date.now();
            for (const session of this.sessionsByConn.values()) {
                if (!session.isAlive) {
                    // Missed 2 heartbeats -> close socket
                    try {
                        session.socket.terminate();
                    } catch (e) {
                        // ignore
                    }
                    this.removeSession(session.connectionId);
                    continue;
                }

                session.isAlive = false; // reset flag, wait for pong
                session.lastPingAt = now;
                try {
                    session.socket.ping();
                } catch (e) {
                    session.isAlive = false;
                }
            }
        }, 25000); // 25 seconds heartbeat interval

        if (this.heartbeatTimer && typeof this.heartbeatTimer.unref === "function") {
            this.heartbeatTimer.unref();
        }
    }
}

export const sessionManager = new SessionManager();
