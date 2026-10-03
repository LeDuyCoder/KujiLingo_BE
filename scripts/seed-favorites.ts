import "dotenv/config";
import { prisma } from "../src/config/prisma.js";
import { signToken } from "../src/common/utils/jwt.js";
import crypto from "node:crypto";
import bcrypt from "bcrypt";

async function seed() {
    console.log("🌱 Starting seed for Favorite Vocabulary testing...");

    // 1. Create or get test user
    const userEmail = "testuser_fav@example.com";
    let user = await prisma.users.findUnique({ where: { email: userEmail } });

    if (!user) {
        const passwordHash = await bcrypt.hash("Password123!", 10);
        user = await prisma.users.create({
            data: {
                id: crypto.randomUUID(),
                email: userEmail,
                password_hash: passwordHash,
                display_name: "Test User Favorites",
                role: "USER",
                status: "active",
                email_verified: true,
                created_at: new Date(),
            },
        });
        console.log(`✅ Created test user: ${user.email} (ID: ${user.id})`);
    } else {
        console.log(`ℹ️ Using existing test user: ${user.email} (ID: ${user.id})`);
    }

    // 2. Generate Access Token (15m validity)
    const token = signToken({ sub: user.id, role: user.role });

    // 3. Create Sample Vocabularies
    const sampleWords = [
        {
            kanji: "食べる",
            hiragana: "たべる",
            romaji: "taberu",
            word_type: "VERB" as const,
            jlpt: "N5" as const,
            frequency: 1,
            meanings: [
                { language: "vi", meaning: "ăn" },
                { language: "en", meaning: "to eat" },
            ],
        },
        {
            kanji: "飲む",
            hiragana: "のむ",
            romaji: "nomu",
            word_type: "VERB" as const,
            jlpt: "N5" as const,
            frequency: 2,
            meanings: [
                { language: "vi", meaning: "uống" },
                { language: "en", meaning: "to drink" },
            ],
        },
        {
            kanji: "行く",
            hiragana: "いく",
            romaji: "iku",
            word_type: "VERB" as const,
            jlpt: "N5" as const,
            frequency: 3,
            meanings: [
                { language: "vi", meaning: "đi" },
                { language: "en", meaning: "to go" },
            ],
        },
    ];

    const createdVocabs = [];

    for (const item of sampleWords) {
        let vocab = await prisma.vocabularies.findFirst({
            where: { kanji: item.kanji, hiragana: item.hiragana },
        });

        if (!vocab) {
            const vocabId = crypto.randomUUID();
            vocab = await prisma.vocabularies.create({
                data: {
                    id: vocabId,
                    kanji: item.kanji,
                    hiragana: item.hiragana,
                    romaji: item.romaji,
                    word_type: item.word_type,
                    jlpt: item.jlpt,
                    frequency: item.frequency,
                    vocabulary_meanings: {
                        createMany: {
                            data: item.meanings.map((m, idx) => ({
                                id: crypto.randomUUID(),
                                language: m.language,
                                meaning: m.meaning,
                                display_order: idx + 1,
                            })),
                        },
                    },
                },
            });
            console.log(`✅ Created vocabulary: ${item.kanji} (${item.hiragana}) - ID: ${vocab.id}`);
        } else {
            console.log(`ℹ️ Vocabulary already exists: ${item.kanji} - ID: ${vocab.id}`);
        }

        createdVocabs.push(vocab);
    }

    // 4. Optionally seed one favorite entry for testing GET
    await prisma.favorite_vocabularies.upsert({
        where: {
            user_id_vocabulary_id: {
                user_id: user.id,
                vocabulary_id: createdVocabs[0].id,
            },
        },
        create: {
            user_id: user.id,
            vocabulary_id: createdVocabs[0].id,
        },
        update: {},
    });
    console.log(`✅ Added 1 favorite item (${createdVocabs[0].kanji}) for user ${user.id}`);

    console.log("\n=======================================================");
    console.log("🎉 SEED COMPLETED SUCCESSFULLY!");
    console.log("=======================================================\n");
    console.log(`🔑 Bearer Token (Authorization: Bearer <TOKEN>):\n${token}\n`);
    console.log("📚 Vocabulary IDs available for testing:");
    createdVocabs.forEach((v, index) => {
        console.log(`  [${index + 1}] ${v.kanji} (${v.hiragana}): ${v.id}`);
    });
    console.log("\n=======================================================");
}

seed()
    .catch((err) => {
        console.error("❌ Seed error:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
