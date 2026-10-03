import type { Prisma } from "../../../generated/prisma/client.js";
import { db } from "../../config/prisma.js";
import type { CreateKanjiDto, ListKanjiQuery, UpdateKanjiDto } from "./kanji.types.js";

export const kanjiRepository = {
    async findFiltered(query: ListKanjiQuery) {
        const { jlpt_level, radical, min_strokes, max_strokes, search, page = 1, limit = 50 } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.kanjisWhereInput = {
            deleted_at: null,
            ...(jlpt_level && { jlpt: jlpt_level }),
            ...(radical && { radical }),
            ...(min_strokes !== undefined || max_strokes !== undefined ? {
                stroke_count: {
                    ...(min_strokes !== undefined && { gte: min_strokes }),
                    ...(max_strokes !== undefined && { lte: max_strokes }),
                }
            } : {}),
            ...(search && {
                OR: [
                    { kanji: { contains: search, mode: "insensitive" } },
                    { onyomi: { contains: search, mode: "insensitive" } },
                    { kunyomi: { contains: search, mode: "insensitive" } },
                ],
            }),
        };

        const [items, total] = await Promise.all([
            db.prisma.kanjis.findMany({
                where,
                skip,
                take: limit,
                orderBy: [
                    { stroke_count: "asc" },
                    { kanji: "asc" }
                ],
            }),
            db.prisma.kanjis.count({ where }),
        ]);
        return { items, total };
    },

    async findById(id: string) {
        return db.prisma.kanjis.findFirst({
            where: {
                id,
                deleted_at: null,
            },
        });
    },

    async findDuplicate(character: string, excludeId?: string) {
        return db.prisma.kanjis.findFirst({
            where: {
                kanji: character,
                deleted_at: null,
                ...(excludeId && { id: { not: excludeId } }),
            },
        });
    },

    async existsLesson(lessonId: string) {
        const count = await db.prisma.lessons.count({
            where: { id: lessonId },
        });
        return count > 0;
    },

    async create(data: CreateKanjiDto & { id: string; created_by?: string }) {
        return db.prisma.$transaction(async (tx) => {
            const created = await tx.kanjis.create({
                data: {
                    id: data.id,
                    kanji: data.character,
                    meaning: data.meaning_vi,
                    onyomi: data.onyomi || null,
                    kunyomi: data.kunyomi || null,
                    stroke_count: data.stroke_count,
                    jlpt: data.jlpt_level,
                    radical: data.radical || null,
                    stroke_order_image_url: data.stroke_order_image_url || null,
                    examples: data.examples ? (data.examples as any) : [],
                },
            });
            if (data.created_by) {
                await tx.admin_audit_logs.create({
                    data: {
                        admin_id: data.created_by,
                        action: "kanji.created",
                        entity_id: created.id,
                        after_state: created as any,
                    },
                });
            }
            return created;
        });
    },

    async update(id: string, data: UpdateKanjiDto, adminId?: string, beforeState?: any) {
        return db.prisma.$transaction(async (tx) => {
            const updated = await tx.kanjis.update({
                where: { id },
                data: {
                    ...(data.character !== undefined && { kanji: data.character }),
                    ...(data.meaning_vi !== undefined && { meaning: data.meaning_vi }),
                    ...(data.onyomi !== undefined && { onyomi: data.onyomi }),
                    ...(data.kunyomi !== undefined && { kunyomi: data.kunyomi }),
                    ...(data.stroke_count !== undefined && { stroke_count: data.stroke_count }),
                    ...(data.jlpt_level !== undefined && { jlpt: data.jlpt_level }),
                    ...(data.radical !== undefined && { radical: data.radical }),
                    ...(data.stroke_order_image_url !== undefined && { stroke_order_image_url: data.stroke_order_image_url }),
                    ...(data.examples !== undefined && { examples: data.examples as any }),
                },
            });
            if (adminId) {
                await tx.admin_audit_logs.create({
                    data: {
                        admin_id: adminId,
                        action: "kanji.updated",
                        entity_id: id,
                        before_state: beforeState as any,
                        after_state: updated as any,
                    },
                });
            }
            return updated;
        });
    },

    async softDelete(id: string, adminId?: string) {
        return db.prisma.$transaction(async (tx) => {
            const deleted = await tx.kanjis.update({
                where: { id },
                data: {
                    deleted_at: new Date(),
                },
            });
            if (adminId) {
                await tx.admin_audit_logs.create({
                    data: {
                        admin_id: adminId,
                        action: "kanji.deleted",
                        entity_id: id,
                        before_state: deleted as any,
                    },
                });
            }
            return deleted;
        });
    },
};