import { db } from "../../config/prisma.js";
import type { CreateGrammarDto, ListGrammarQuery, UpdateGrammarDto } from "./grammar.types.js";
import type { Prisma } from "../../../generated/prisma/client.js";

export const grammarRepository = {
    async findFiltered(query: ListGrammarQuery) {
        const { jlpt_level, topic_id, lesson_id, search, page = 1, limit = 30 } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.grammar_pointsWhereInput = {
            deleted_at: null,
            ...(jlpt_level && { jlpt_level }),
            ...(topic_id && { topic_id }),
            ...(lesson_id && { lesson_id }),
            ...(search && {
                OR: [
                    { title_jp: { contains: search, mode: "insensitive" } },
                    { structure: { contains: search, mode: "insensitive" } },
                    { meaning_vi: { contains: search, mode: "insensitive" } },
                ],
            }),
        };

        const [items, total] = await Promise.all([
            db.prisma.grammar_points.findMany({
                where,
                skip,
                take: limit,
                orderBy: search
                    ? [{ structure: "asc" }, { title_jp: "asc" }]
                    : [{ jlpt_level: "asc" }, { title_jp: "asc" }],
            }),
            db.prisma.grammar_points.count({ where }),
        ]);

        return { items, total };
    },

    async findById(id: string) {
        return db.prisma.grammar_points.findFirst({
            where: {
                id,
                deleted_at: null,
            },
        });
    },

    async findDuplicate(title_jp: string, jlpt_level: string, excludeId?: string) {
        return db.prisma.grammar_points.findFirst({
            where: {
                title_jp,
                jlpt_level: jlpt_level as any,
                deleted_at: null,
                ...(excludeId && { id: { not: excludeId } }),
            },
        });
    },

    async existsLesson(lesson_id: string) {
        const count = await db.prisma.lessons.count({
            where: { id: lesson_id },
        });
        return count > 0;
    },

    async existsTopic(topic_id: string) {
        const count = await db.prisma.topics.count({
            where: { id: topic_id },
        });
        return count > 0;
    },

    async create(data: CreateGrammarDto & { id: string; created_by?: string }) {
        return db.prisma.$transaction(async (tx) => {
            const created = await tx.grammar_points.create({
                data: {
                    id: data.id,
                    title_jp: data.title_jp,
                    structure: data.structure,
                    meaning_vi: data.meaning_vi,
                    explanation: data.explanation || null,
                    jlpt_level: data.jlpt_level as any,
                    example_sentences: (data.example_sentences as any) || [],
                    audio_url: data.audio_url || null,
                    lesson_id: data.lesson_id || null,
                    topic_id: data.topic_id || null,
                    created_by: data.created_by || null,
                },
            });

            if (data.created_by) {
                await tx.admin_audit_logs.create({
                    data: {
                        admin_id: data.created_by,
                        action: "grammar.created",
                        entity_id: created.id,
                        after_state: created as any,
                    },
                });
            }

            return created;
        });
    },

    async update(id: string, data: UpdateGrammarDto, adminId?: string, beforeState?: any) {
        return db.prisma.$transaction(async (tx) => {
            const updated = await tx.grammar_points.update({
                where: { id },
                data: {
                    ...(data.title_jp !== undefined && { title_jp: data.title_jp }),
                    ...(data.structure !== undefined && { structure: data.structure }),
                    ...(data.meaning_vi !== undefined && { meaning_vi: data.meaning_vi }),
                    ...(data.explanation !== undefined && { explanation: data.explanation }),
                    ...(data.jlpt_level !== undefined && { jlpt_level: data.jlpt_level as any }),
                    ...(data.example_sentences !== undefined && { example_sentences: data.example_sentences as any }),
                    ...(data.audio_url !== undefined && { audio_url: data.audio_url }),
                    ...(data.lesson_id !== undefined && { lesson_id: data.lesson_id }),
                    ...(data.topic_id !== undefined && { topic_id: data.topic_id }),
                },
            });

            if (adminId) {
                await tx.admin_audit_logs.create({
                    data: {
                        admin_id: adminId,
                        action: "grammar.updated",
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
            const deleted = await tx.grammar_points.update({
                where: { id },
                data: {
                    deleted_at: new Date(),
                },
            });

            if (adminId) {
                await tx.admin_audit_logs.create({
                    data: {
                        admin_id: adminId,
                        action: "grammar.deleted",
                        entity_id: id,
                        before_state: deleted as any,
                    },
                });
            }

            return deleted;
        });
    },
};
