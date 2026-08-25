import { prisma } from "../../config/prisma.js";
import crypto from "crypto";

export const userVocabularyRepository = {
    async findByUser(userId: string, search?: string, page: number = 1, limit: number = 30) {
        const skip = (page - 1) * limit;

        const where: any = {
            user_id: userId
        };

        if (search) {
            where.OR = [
                { kanji: { contains: search, mode: "insensitive" } },
                { hiragana: { contains: search, mode: "insensitive" } },
                { meaning: { contains: search, mode: "insensitive" } }
            ];
        }

        const [items, total] = await Promise.all([
            prisma.user_vocabularies.findMany({
                where,
                orderBy: { created_at: "desc" },
                skip,
                take: limit,
                select: {
                    id: true,
                    kanji: true,
                    hiragana: true,
                    romaji: true,
                    meaning: true,
                    note: true,
                    image: true,
                    audio: true,
                    created_at: true
                }
            }),
            prisma.user_vocabularies.count({ where })
        ]);

        return {
            items,
            total
        };
    },

    async findByIdAndUser(id: string, userId: string) {
        return prisma.user_vocabularies.findFirst({
            where: {
                id,
                user_id: userId
            }
        });
    },

    async insert(userId: string, data: {
        kanji: string;
        hiragana?: string;
        romaji?: string;
        meaning: string;
        note?: string;
        image?: string;
        audio?: string;
    }) {
        return prisma.user_vocabularies.create({
            data: {
                id: crypto.randomUUID(),
                user_id: userId,
                kanji: data.kanji,
                hiragana: data.hiragana || null,
                romaji: data.romaji || null,
                meaning: data.meaning,
                note: data.note || null,
                image: data.image || null,
                audio: data.audio || null,
            }
        });
    },

    async update(id: string, data: {
        kanji?: string;
        hiragana?: string;
        romaji?: string;
        meaning?: string;
        note?: string;
        image?: string;
        audio?: string;
    }) {
        const updateData: any = {};
        if (data.kanji !== undefined) updateData.kanji = data.kanji;
        if (data.hiragana !== undefined) updateData.hiragana = data.hiragana;
        if (data.romaji !== undefined) updateData.romaji = data.romaji;
        if (data.meaning !== undefined) updateData.meaning = data.meaning;
        if (data.note !== undefined) updateData.note = data.note;
        if (data.image !== undefined) updateData.image = data.image;
        if (data.audio !== undefined) updateData.audio = data.audio;

        return prisma.user_vocabularies.update({
            where: { id },
            data: updateData
        });
    },

    async delete(id: string) {
        return prisma.$transaction(async (tx) => {
            // Delete references in folder join table first
            await tx.folder_user_vocabularies.deleteMany({
                where: { user_vocabulary_id: id }
            });

            // Delete the main user vocabulary entry
            return tx.user_vocabularies.delete({
                where: { id }
            });
        });
    }
};
