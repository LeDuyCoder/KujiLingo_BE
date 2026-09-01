import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import { sessionManager, type UserSession } from "./pvp-session.manager.js";
import { matchmakerManager } from "./pvp-matchmaker.manager.js";
import { roomManager } from "./pvp-room.manager.js";
import type { WSBaseMessage } from "./pvp-ws.types.js";

export async function pvpWebSocketRoutes(app: FastifyInstance) {
    app.get("/ws/v1/pvp", { websocket: true }, async (connection, req) => {
        const socket: WebSocket = (connection as any).socket || connection;

        // 1. Extract Token from Header or Query string
        let token = "";
        const authHeader = req.headers?.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1] || "";
        } else if ((req.query as any)?.access_token) {
            token = String((req.query as any).access_token || "");
        }

        if (!token && req.url) {
            try {
                const parsedUrl = new URL(req.url, "http://localhost");
                token = parsedUrl.searchParams.get("access_token") || "";
            } catch (e) {
                // ignore
            }
        }

        // 2. Authenticate
        const user = await sessionManager.authenticateSocket(token);
        if (!user) {
            console.warn(`⚠️ [WSS Auth Fail] Unable to authenticate token. Token length: ${token.length}, URL: ${req.url}`);
            const errMsg: WSBaseMessage = {
                type: "error",
                event_id: `evt_${uuidv4()}`,
                server_time: new Date().toISOString(),
                data: {
                    code: "UNAUTHORIZED",
                    message: "Missing, invalid, or expired WebSocket authentication token.",
                    retryable: false,
                },
            };
            try {
                socket.send(JSON.stringify(errMsg));
                socket.close(4001, "UNAUTHORIZED");
            } catch (e) {
                // ignore
            }
            return;
        }

        // 3. Register Session & Send connection.ready
        const session = sessionManager.registerSession(socket, user);

        sessionManager.sendToSession(session, {
            type: "connection.ready",
            event_id: `evt_${uuidv4()}`,
            server_time: new Date().toISOString(),
            data: {
                connection_id: session.connectionId,
                server_time: new Date().toISOString(),
                heartbeat_interval_seconds: 25,
                protocol_version: 1,
            },
        });

        // 4. Handle incoming messages
        socket.on("message", async (rawMessage: Buffer | string) => {
            try {
                const messageStr = rawMessage.toString();
                if (messageStr === "pong" || messageStr === '{"type":"pong"}') {
                    sessionManager.recordPong(session.connectionId);
                    return;
                }

                const msg: WSBaseMessage = JSON.parse(messageStr);
                const { type, request_id, data } = msg;

                switch (type) {
                    case "lobby.join": {
                        const params = {
                            battle_mode: data?.battle_mode || "SPEED_QUIZ",
                            difficulty_level: data?.difficulty_level || "N3",
                            question_type: data?.question_type || "VOCAB",
                            question_count: data?.question_count || 10,
                            time_limit_seconds: data?.time_limit_seconds || 30,
                            base_hp: data?.base_hp || 2000,
                        };
                        matchmakerManager.setUserLobbyParams(session.userId, params);

                        sessionManager.sendToSession(session, {
                            type: "lobby.joined",
                            event_id: `evt_${uuidv4()}`,
                            request_id,
                            server_time: new Date().toISOString(),
                            data: {
                                session_id: session.sessionId,
                                parameters: params,
                            },
                        });
                        break;
                    }

                    case "matchmaking.start": {
                        try {
                            const matchResult = matchmakerManager.startSearch(session.userId);
                            if (!matchResult.matched) {
                                sessionManager.sendToSession(session, {
                                    type: "matchmaking.searching",
                                    event_id: `evt_${uuidv4()}`,
                                    request_id,
                                    server_time: new Date().toISOString(),
                                    data: { queue_position: 1 },
                                });
                            } else {
                                const opponentSession = sessionManager.getSessionByUserId(matchResult.opponentId!);
                                if (opponentSession) {
                                    const room = await roomManager.createRoom(
                                        matchResult.parameters!,
                                        session,
                                        opponentSession,
                                        matchResult.matchId!
                                    );

                                    const foundData = {
                                        match_id: room.matchId,
                                        battle_mode: room.battleMode,
                                        parameters: room.parameters,
                                        players: room.getPlayerProfiles(),
                                        ready_deadline: new Date(Date.now() + 15000).toISOString(),
                                    };

                                    const foundMsg: WSBaseMessage = {
                                        type: "matchmaking.found",
                                        event_id: `evt_${uuidv4()}`,
                                        server_time: new Date().toISOString(),
                                        data: foundData,
                                    };

                                    sessionManager.sendToSession(session, foundMsg);
                                    sessionManager.sendToSession(opponentSession, foundMsg);
                                }
                            }
                        } catch (err: any) {
                            sendError(session, request_id, "INVALID_PARAMETERS", err.message || "Matchmaking error");
                        }
                        break;
                    }

                    case "matchmaking.cancel": {
                        matchmakerManager.cancelSearch(session.userId);
                        sessionManager.sendToSession(session, {
                            type: "matchmaking.cancelled",
                            event_id: `evt_${uuidv4()}`,
                            request_id,
                            server_time: new Date().toISOString(),
                            data: { reason: "CANCELLED_BY_USER" },
                        });
                        break;
                    }

                    case "invite.send": {
                        try {
                            matchmakerManager.sendInvite(session.userId, data?.target_user_id);
                        } catch (err: any) {
                            sendError(session, request_id, "OPPONENT_UNAVAILABLE", "Target user is offline or unavailable.");
                        }
                        break;
                    }

                    case "invite.respond": {
                        try {
                            const res = matchmakerManager.respondInvite(session.userId, data?.invite_id, data?.decision);
                            if (res.accepted && res.matchId) {
                                const inviterSession = sessionManager.getSessionByUserId(res.invite!.inviterUserId);
                                if (inviterSession) {
                                    const room = await roomManager.createRoom(
                                        res.invite!.parameters,
                                        inviterSession,
                                        session,
                                        res.matchId
                                    );

                                    const acceptedMsg: WSBaseMessage = {
                                        type: "invite.accepted",
                                        event_id: `evt_${uuidv4()}`,
                                        server_time: new Date().toISOString(),
                                        data: {
                                            match_id: room.matchId,
                                            battle_mode: room.battleMode,
                                            parameters: room.parameters,
                                            players: room.getPlayerProfiles(),
                                        },
                                    };

                                    sessionManager.sendToSession(inviterSession, acceptedMsg);
                                    sessionManager.sendToSession(session, acceptedMsg);
                                }
                            }
                        } catch (err: any) {
                            sendError(session, request_id, "INVITE_EXPIRED", err.message || "Invite error");
                        }
                        break;
                    }

                    case "player.ready": {
                        const room = roomManager.getRoom(data?.match_id) || roomManager.getRoomByUserId(session.userId);
                        if (!room) {
                            sendError(session, request_id, "MATCH_NOT_FOUND", "Match not found.");
                            break;
                        }

                        const allReady = room.markReady(session.userId);
                        if (allReady) {
                            room.startMatch();
                        }
                        break;
                    }

                    case "question.answer": {
                        const room = roomManager.getRoom(data?.match_id) || roomManager.getRoomByUserId(session.userId);
                        if (!room) {
                            sendError(session, request_id, "MATCH_NOT_FOUND", "Match not found.");
                            break;
                        }

                        const ok = room.recordAnswer(session.userId, data?.question_id, data?.answer, data?.client_sent_at);
                        if (!ok) {
                            sendError(session, request_id, "QUESTION_DEADLINE_EXCEEDED", "Answer already submitted or deadline exceeded.");
                        }
                        break;
                    }

                    case "lobby.leave": {
                        matchmakerManager.removeUserFromLobby(session.userId);
                        const room = roomManager.getRoomByUserId(session.userId);
                        if (room && room.state === "PLAYING") {
                            room.finishMatch("PLAYER_LEFT", "FORFEIT");
                            roomManager.removeRoom(room.matchId);
                        }
                        break;
                    }

                    case "session.resume": {
                        const oldSession = sessionManager.getSessionBySessionId(data?.session_id);
                        if (oldSession) {
                            const lastEvtId = data?.last_received_event_id;
                            let startIndex = 0;
                            if (lastEvtId) {
                                const idx = oldSession.eventBuffer.findIndex((e) => e.event_id === lastEvtId);
                                if (idx !== -1) startIndex = idx + 1;
                            }
                            const missedEvents = oldSession.eventBuffer.slice(startIndex);

                            sessionManager.sendToSession(session, {
                                type: "session.resumed",
                                event_id: `evt_${uuidv4()}`,
                                request_id,
                                server_time: new Date().toISOString(),
                                data: {
                                    session_id: oldSession.sessionId,
                                    replayed_event_count: missedEvents.length,
                                },
                            });

                            // Replay events
                            for (const evt of missedEvents) {
                                sessionManager.sendToSession(session, evt);
                            }
                        } else {
                            sendError(session, request_id, "SESSION_EXPIRED", "Session has expired.");
                        }
                        break;
                    }

                    default: {
                        sendError(session, request_id, "INVALID_COMMAND", `Unknown command type '${type}'.`);
                        break;
                    }
                }
            } catch (err: any) {
                sendError(session, undefined, "INVALID_COMMAND", "Malformed message payload.");
            }
        });

        // 5. On Socket Disconnect / Close
        socket.on("close", () => {
            sessionManager.markDisconnected(session);

            // Check if player is in an active room
            const room = roomManager.getRoomByUserId(session.userId);
            if (room && room.state === "PLAYING") {
                // Notify peer
                room.broadcast({
                    type: "player.disconnected",
                    event_id: `evt_${uuidv4()}`,
                    server_time: new Date().toISOString(),
                    data: {
                        user_id: session.userId,
                        grace_period_seconds: 30,
                    },
                });

                // Wait 30 seconds for reconnect, if not reconnected -> forfeit
                setTimeout(() => {
                    const currentSession = sessionManager.getSessionByUserId(session.userId);
                    if (!currentSession || !currentSession.isAlive) {
                        room.finishMatch("PLAYER_DISCONNECTED_TIMEOUT", "FORFEIT");
                        roomManager.removeRoom(room.matchId);
                    }
                }, 30000);
            }

            // Remove after 30s
            setTimeout(() => {
                sessionManager.removeSession(session.connectionId);
            }, 30000);
        });

        socket.on("error", () => {
            try {
                socket.close();
            } catch (e) {
                // ignore
            }
        });
    });
}

function sendError(session: UserSession, requestId: string | undefined, code: string, message: string) {
    sessionManager.sendToSession(session, {
        type: "error",
        event_id: `evt_${uuidv4()}`,
        request_id: requestId,
        server_time: new Date().toISOString(),
        data: {
            code,
            message,
            retryable: false,
        },
    });
}
