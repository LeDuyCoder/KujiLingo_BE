import { prisma } from "../../config/prisma.js";
import crypto from "node:crypto";
import type { WordType, JLPTLevel } from "../../../generated/prisma/client.js";
import { env } from "../../config/env.js";

export const dictionaryRepository = {
    async search(query: string, jlptLevel?: string, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const where: any = {
            OR: [
                { kanji: { contains: query, mode: "insensitive" } },
                { hiragana: { contains: query, mode: "insensitive" } },
                { romaji: { contains: query, mode: "insensitive" } },
                { vocabulary_meanings: { some: { meaning: { contains: query, mode: "insensitive" } } } }
            ],
            ...(jlptLevel ? { jlpt: jlptLevel as any } : {})
        };

        const [data, total] = await Promise.all([
            prisma.vocabularies.findMany({
                where,
                include: { vocabulary_meanings: true },
                skip: offset,
                take: limit,
                orderBy: { frequency: "asc" }
            }),
            prisma.vocabularies.count({ where })
        ]);

        return { data, total };
    },

    async findById(id: string) {
        return prisma.vocabularies.findUnique({
            where: { id },
            include: { vocabulary_meanings: true }
        });
    },

    async getUserInteractions(userId: string, vocabularyIds: string[]) {
        if (vocabularyIds.length === 0) {
            return { favoritedIds: new Set<string>(), savedIds: new Set<string>() };
        }

        const [favorites, folderItems] = await Promise.all([
            prisma.favorite_vocabularies.findMany({
                where: {
                    user_id: userId,
                    vocabulary_id: { in: vocabularyIds }
                },
                select: { vocabulary_id: true }
            }),
            prisma.folder_system_vocabularies.findMany({
                where: {
                    folders: { user_id: userId },
                    vocabulary_id: { in: vocabularyIds }
                },
                select: { vocabulary_id: true }
            })
        ]);

        return {
            favoritedIds: new Set(favorites.map(f => f.vocabulary_id)),
            savedIds: new Set(folderItems.map(f => f.vocabulary_id))
        };
    },

    /**
     * Gọi API Jisho.org để lấy từ vựng bị thiếu và nạp vào DB
     */
    async fetchAndSaveFromJisho(query: string): Promise<boolean> {
        try {
            const url = `${env.JISHO_API_URL}?keyword=${encodeURIComponent(query)}`;
            const response = await fetch(url);
            
            if (!response.ok) return false;
            
            const json = await response.json();
            if (!json.data || json.data.length === 0) return false;

            // Chỉ lấy top 5 kết quả đầu tiên để tránh phình to DB không cần thiết
            const topResults = json.data.slice(0, 5);
            let hasAdded = false;

            for (const item of topResults) {
                const kanji = item.japanese[0]?.word || null;
                const hiragana = item.japanese[0]?.reading || null;
                
                if (!kanji && !hiragana) continue;

                // Kiểm tra xem từ vựng đã tồn tại trong DB chưa để tránh trùng lặp
                const existing = await prisma.vocabularies.findFirst({
                    where: {
                        kanji: kanji || undefined,
                        hiragana: hiragana || undefined
                    }
                });

                if (existing) continue;

                // Trích xuất và Map JLPT Level
                let mappedJlpt: JLPTLevel | null = null;
                const jlptTag = item.jlpt?.find((j: string) => j.startsWith("jlpt-n"));
                if (jlptTag) {
                    mappedJlpt = jlptTag.replace("jlpt-n", "N").toUpperCase() as JLPTLevel;
                }

                // Trích xuất và Map Word Type
                let wordType: WordType | null = null;
                const pos = item.senses[0]?.parts_of_speech?.[0]?.toLowerCase() || "";
                if (pos.includes("noun")) wordType = "NOUN";
                else if (pos.includes("suru verb") || pos.includes("verb")) wordType = "VERB";
                else if (pos.includes("i-adjective")) wordType = "I_ADJECTIVE";
                else if (pos.includes("na-adjective")) wordType = "NA_ADJECTIVE";
                else if (pos.includes("adverb")) wordType = "ADVERB";
                else if (pos.includes("pronoun")) wordType = "PRONOUN";
                else if (pos.includes("particle")) wordType = "PARTICLE";
                else if (pos.includes("conjunction")) wordType = "CONJUNCTION";
                else if (pos.includes("expression")) wordType = "EXPRESSION";

                // Trích xuất nghĩa Tiếng Anh
                const englishMeanings = item.senses[0]?.english_definitions?.join(", ");

                // Tạo object dữ liệu động tránh truyền undefined
                const vocabId = crypto.randomUUID();
                const createData: any = {
                    id: vocabId,
                    frequency: item.is_common ? 1 : null
                };

                if (kanji !== null) createData.kanji = kanji;
                if (hiragana !== null) createData.hiragana = hiragana;
                if (wordType !== null) createData.word_type = wordType;
                if (mappedJlpt !== null) createData.jlpt = mappedJlpt;

                if (englishMeanings) {
                    createData.vocabulary_meanings = {
                        create: {
                            id: crypto.randomUUID(),
                            language: "en",
                            meaning: englishMeanings
                        }
                    };
                }

                await prisma.vocabularies.create({
                    data: createData
                });

                hasAdded = true;
            }

            return hasAdded;
        } catch (error) {
            console.error("Error fetching from Jisho:", error);
            return false;
        }
    }
};