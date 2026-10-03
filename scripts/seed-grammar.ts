import "dotenv/config";
import { prisma } from "../src/config/prisma.js";
import { signToken } from "../src/common/utils/jwt.js";
import crypto from "node:crypto";

async function main() {
    console.log("🌱 Starting seed for Grammar module testing...");

    // 1. Find or create an admin user
    const adminEmail = "admin_grammar@example.com";
    let adminUser = await prisma.users.findUnique({
        where: { email: adminEmail },
    });

    if (!adminUser) {
        adminUser = await prisma.users.create({
            data: {
                id: crypto.randomUUID(),
                email: adminEmail,
                password_hash: "$2b$10$e8Za4E5eT2.yZ19u8PZJueQvS9uN8.1hN7kL1g6N2G8r.b9O4Y0mS",
                display_name: "Admin Grammar Test",
                role: "admin",
                status: "active",
                email_verified: true,
            },
        });
        console.log(`✅ Created test admin user: ${adminEmail}`);
    } else {
        console.log(`ℹ️ Using existing admin user: ${adminEmail}`);
    }

    // 2. Sample grammar points
    const sampleGrammars = [
        {
            id: "11111111-1111-4111-a111-111111111111",
            title_jp: "〜ば〜ほど",
            structure: "Verb-ば + Verb-る-ほど",
            meaning_vi: "càng... càng...",
            explanation: "Diễn tả mối quan hệ tỷ lệ thuận giữa hai vế.",
            jlpt_level: "N3" as const,
            example_sentences: [
                { jp: "勉強すればするほど、上手になります。", vi: "Càng học càng giỏi.", audio_url: "https://cdn.kujilingo.com/audio/g1.mp3" },
            ],
        },
        {
            id: "22222222-2222-4222-a222-222222222222",
            title_jp: "〜から〜にかけて",
            structure: "Noun1 から Noun2 にかけて",
            meaning_vi: "từ... đến...",
            explanation: "Diễn tả khoảng thời gian hoặc không gian từ điểm này tới điểm khác một cách mơ ước/tương đối.",
            jlpt_level: "N3" as const,
            example_sentences: [
                { jp: "明日は関東地方から東北地方にかけて雨が降るでしょう。", vi: "Ngày mai trời có thể sẽ mưa từ vùng Kanto đến vùng Tohoku." },
            ],
        },
        {
            id: "33333333-3333-4333-a333-333333333333",
            title_jp: "〜てはいけない",
            structure: "Verb-て + はいけない",
            meaning_vi: "không được làm...",
            explanation: "Dùng để cấm đoán, cho biết một hành vi nào đó là không được phép.",
            jlpt_level: "N5" as const,
            example_sentences: [
                { jp: " here で写真を撮ってはいけません。", vi: "Không được chụp ảnh ở đây." },
            ],
        },
    ];

    for (const g of sampleGrammars) {
        await prisma.grammar_points.upsert({
            where: { id: g.id },
            update: {
                title_jp: g.title_jp,
                structure: g.structure,
                meaning_vi: g.meaning_vi,
                explanation: g.explanation,
                jlpt_level: g.jlpt_level,
                example_sentences: g.example_sentences,
                deleted_at: null,
            },
            create: {
                id: g.id,
                title_jp: g.title_jp,
                structure: g.structure,
                meaning_vi: g.meaning_vi,
                explanation: g.explanation,
                jlpt_level: g.jlpt_level,
                example_sentences: g.example_sentences,
                created_by: adminUser.id,
            },
        });
    }

    const token = signToken({ sub: adminUser.id, role: adminUser.role });

    console.log("\n=======================================================");
    console.log("🎉 GRAMMAR SEED COMPLETED SUCCESSFULLY!");
    console.log("=======================================================\n");
    console.log("🔑 Admin Bearer Token (Authorization: Bearer <TOKEN>):");
    console.log(token);
    console.log("\n📚 Grammar IDs available for testing:");
    console.log(`  [1] ${sampleGrammars[0].title_jp} (${sampleGrammars[0].jlpt_level}): ${sampleGrammars[0].id}`);
    console.log(`  [2] ${sampleGrammars[1].title_jp} (${sampleGrammars[1].jlpt_level}): ${sampleGrammars[1].id}`);
    console.log(`  [3] ${sampleGrammars[2].title_jp} (${sampleGrammars[2].jlpt_level}): ${sampleGrammars[2].id}`);
    console.log("\n=======================================================\n");
}

main()
    .catch((err) => {
        console.error("❌ Seed failed:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
