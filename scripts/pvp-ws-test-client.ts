import WebSocket from "ws";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import app from "../src/app.js";
import { signToken } from "../src/common/utils/jwt.js";
import { db } from "../src/config/prisma.js";

async function getOrCreateTestUser(email: string, name: string) {
    let user = await db.prisma.users.findUnique({ where: { email } });
    if (!user) {
        const password_hash = await bcrypt.hash("TestPass123!", 10);
        user = await db.prisma.users.create({
            data: {
                id: uuidv4(),
                email,
                display_name: name,
                password_hash,
                status: "active",
            },
        });
    }
    const token = signToken({ sub: user.id, role: "user" });
    return { user, token };
}

async function main() {
    // Parse mode from command line arguments (--mode=SPEED_QUIZ | HP_BATTLE | ENERGY_BAR)
    const modeArg = process.argv.find((arg) => arg.startsWith("--mode="))?.split("=")[1] || "SPEED_QUIZ";
    const validModes = ["SPEED_QUIZ", "HP_BATTLE", "ENERGY_BAR"];
    const battleMode = validModes.includes(modeArg) ? modeArg : "SPEED_QUIZ";

    console.log(`\n==================================================`);
    console.log(`🚀 Starting PVP WebSocket Realtime Test Client`);
    console.log(`🎮 Selected Battle Mode: ${battleMode}`);
    console.log(`==================================================\n`);

    // Start Fastify server on an ephemeral port (port 0)
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address() as { port: number };
    const PORT = address.port;
    console.log(`⚡ Fastify Test Server running on port ${PORT}`);

    // 1. Prepare 2 Test Users
    const u1 = await getOrCreateTestUser("pvp_test_player1@kujilingo.com", "PVP Player 1");
    const u2 = await getOrCreateTestUser("pvp_test_player2@kujilingo.com", "PVP Player 2");

    const wsUrl1 = `ws://127.0.0.1:${PORT}/ws/v1/pvp?access_token=${u1.token}`;
    const wsUrl2 = `ws://127.0.0.1:${PORT}/ws/v1/pvp?access_token=${u2.token}`;

    console.log(`📡 Connecting Player 1 (${u1.user.display_name})...`);
    const ws1 = new WebSocket(wsUrl1);

    console.log(`📡 Connecting Player 2 (${u2.user.display_name})...`);
    const ws2 = new WebSocket(wsUrl2);

    let matchId = "";
    let questionCount = 0;
    let answeredQuestions = 0;

    const setupClient = (ws: WebSocket, playerName: string, isPlayer1: boolean) => {
        ws.on("open", () => {
            console.log(`✅ [${playerName}] Connected to WSS /ws/v1/pvp`);
        });

        ws.on("message", async (data: Buffer) => {
            const msg = JSON.parse(data.toString());
            console.log(`📥 [${playerName}] Received Event: '${msg.type}'`);

            if (msg.type === "connection.ready") {
                // Step 1: Send lobby.join
                const joinCmd = {
                    type: "lobby.join",
                    request_id: `req_join_${isPlayer1 ? 1 : 2}`,
                    data: {
                        battle_mode: battleMode,
                        difficulty_level: "N3",
                        question_type: "VOCAB",
                        question_count: 5,
                        time_limit_seconds: 10,
                        base_hp: 2000,
                    },
                };
                console.log(`📤 [${playerName}] Sending 'lobby.join' (${battleMode})`);
                ws.send(JSON.stringify(joinCmd));
            } else if (msg.type === "lobby.joined") {
                // Step 2: Send matchmaking.start
                const startCmd = {
                    type: "matchmaking.start",
                    request_id: `req_search_${isPlayer1 ? 1 : 2}`,
                    data: { mode: "RANDOM" },
                };
                console.log(`📤 [${playerName}] Sending 'matchmaking.start'`);
                ws.send(JSON.stringify(startCmd));
            } else if (msg.type === "matchmaking.found") {
                matchId = msg.data.match_id;
                console.log(`🎯 [${playerName}] Opponent Found! Match ID: ${matchId}`);
            } else if (msg.type === "match.ready_check") {
                // Step 3: Send player.ready
                const readyCmd = {
                    type: "player.ready",
                    request_id: `req_ready_${isPlayer1 ? 1 : 2}`,
                    data: { match_id: matchId },
                };
                console.log(`📤 [${playerName}] Sending 'player.ready'`);
                ws.send(JSON.stringify(readyCmd));
            } else if (msg.type === "match.started") {
                questionCount = msg.data.question_count;
                console.log(`🔥 [${playerName}] Match Started! Mode: ${msg.data.battle_mode}, Questions: ${questionCount}`);
            } else if (msg.type === "question.issued") {
                const q = msg.data;
                console.log(`❓ [${playerName}] Question ${q.question_number}/${q.total_questions}: ${q.japanese}`);
                const chosenOption = q.choices[Math.floor(Math.random() * q.choices.length)].text;

                // Answer after 500ms delay
                setTimeout(() => {
                    const ansCmd = {
                        type: "question.answer",
                        request_id: `req_ans_${q.question_number}_${isPlayer1 ? 1 : 2}`,
                        data: {
                            match_id: matchId,
                            question_id: q.question_id,
                            answer: chosenOption,
                            client_sent_at: new Date().toISOString(),
                        },
                    };
                    console.log(`📤 [${playerName}] Answered Question ${q.question_number}`);
                    ws.send(JSON.stringify(ansCmd));
                }, isPlayer1 ? 500 : 1200);
            } else if (msg.type === "question.result") {
                console.log(`📊 [${playerName}] Question Result: correct=${msg.data.is_correct}`);
                if (battleMode === "SPEED_QUIZ") console.log(`   Scores:`, msg.data.scores);
                if (battleMode === "HP_BATTLE") console.log(`   HP:`, msg.data.hp);
                if (battleMode === "ENERGY_BAR") console.log(`   Energy %:`, msg.data.energy);
            } else if (msg.type === "match.finished") {
                console.log(`🏆 [${playerName}] Match Finished! Winner: ${msg.data.winner_id || "DRAW"}, Condition: ${msg.data.win_condition}`);
                // Fallback exit timer if settlement.completed takes time or does not fire
                setTimeout(async () => {
                    if (answeredQuestions < 2) {
                        console.log(`\n🎉 Test Completed for mode ${battleMode}!\n`);
                        answeredQuestions = 999;
                        try { ws1.close(); } catch (e) {}
                        try { ws2.close(); } catch (e) {}
                        await app.close();
                        process.exit(0);
                    }
                }, 2000);
            } else if (msg.type === "settlement.completed") {
                console.log(`💳 [${playerName}] Settlement Completed! Rating Changes:`, msg.data.rating_changes);
                answeredQuestions++;
                if (answeredQuestions >= 2 && answeredQuestions < 900) {
                    console.log(`\n🎉 Test Completed Successfully for mode ${battleMode}!\n`);
                    try { ws1.close(); } catch (e) {}
                    try { ws2.close(); } catch (e) {}
                    await app.close();
                    process.exit(0);
                }
            }
        });

        ws.on("error", (err) => {
            console.error(`❌ [${playerName}] Error:`, err);
        });
    };

    setupClient(ws1, "Player 1", true);
    setupClient(ws2, "Player 2", false);
}

main().catch((err) => {
    console.error("Test Client Fatal Error:", err);
    process.exit(1);
});
