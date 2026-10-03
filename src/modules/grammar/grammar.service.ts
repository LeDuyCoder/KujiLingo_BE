import crypto from "node:crypto";
import { grammarRepository } from "./grammar.repository.js";
import type { CreateGrammarDto, ListGrammarQuery, UpdateGrammarDto } from "./grammar.types.js";

export class GrammarCustomError extends Error {
    statusCode: number;
    code: string;

    constructor(statusCode: number, code: string, message: string) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
    }
}

export const grammarService = {
    async listGrammarPoints(query: ListGrammarQuery, userId?: string) {
        const { items, total } = await grammarRepository.findFiltered(query);
        const limit = query.limit || 30;
        const page = query.page || 1;
        const total_pages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

        const data = items.map((item) => ({
            id: item.id,
            title_jp: item.title_jp || item.title || "",
            structure: item.structure || "",
            meaning_vi: item.meaning_vi || item.meaning || "",
            jlpt_level: item.jlpt_level || item.jlpt || "N5",
            is_saved: false,
        }));

        return {
            success: true,
            data,
            meta: {
                page,
                limit,
                total,
                total_pages,
            },
        };
    },

    async getGrammarDetail(id: string, userId?: string) {
        const item = await grammarRepository.findById(id);
        if (!item) {
            throw new GrammarCustomError(404, "GRAMMAR_NOT_FOUND", "Grammar point not found.");
        }

        const exampleSentences = Array.isArray(item.example_sentences)
            ? item.example_sentences
            : [];

        return {
            success: true,
            data: {
                id: item.id,
                title_jp: item.title_jp || item.title || "",
                structure: item.structure || "",
                meaning_vi: item.meaning_vi || item.meaning || "",
                explanation: item.explanation || item.usage || null,
                jlpt_level: item.jlpt_level || item.jlpt || "N5",
                example_sentences: exampleSentences,
                is_saved: false,
                folder_ids: [],
            },
        };
    },

    async createGrammarPoint(adminId: string, dto: CreateGrammarDto) {
        // 1. Duplicate check
        const existing = await grammarRepository.findDuplicate(dto.title_jp, dto.jlpt_level);
        if (existing) {
            throw new GrammarCustomError(409, "DUPLICATE_GRAMMAR", "This grammar point already exists for this level.");
        }

        // 2. Reference checks
        if (dto.lesson_id) {
            const exists = await grammarRepository.existsLesson(dto.lesson_id);
            if (!exists) {
                throw new GrammarCustomError(422, "INVALID_LESSON_REFERENCE", "Referenced lesson does not exist.");
            }
        }

        if (dto.topic_id) {
            const exists = await grammarRepository.existsTopic(dto.topic_id);
            if (!exists) {
                throw new GrammarCustomError(422, "INVALID_TOPIC_REFERENCE", "Referenced topic does not exist.");
            }
        }

        const newId = crypto.randomUUID();
        const created = await grammarRepository.create({
            ...dto,
            id: newId,
            created_by: adminId,
        });

        return {
            success: true,
            data: {
                id: created.id,
                title_jp: created.title_jp || created.title || "",
                jlpt_level: created.jlpt_level || created.jlpt || "N5",
                created_at: created.created_at || new Date(),
            },
            message: "Grammar point created successfully.",
        };
    },

    async updateGrammarPoint(adminId: string, id: string, dto: UpdateGrammarDto) {
        const existing = await grammarRepository.findById(id);
        if (!existing) {
            throw new GrammarCustomError(404, "GRAMMAR_NOT_FOUND", "Grammar point not found.");
        }

        if (Object.keys(dto).length === 0) {
            throw new GrammarCustomError(400, "EMPTY_UPDATE", "At least one field must be provided for update.");
        }

        // Check duplicate if title_jp or jlpt_level changed
        const titleJp = dto.title_jp || existing.title_jp || existing.title || "";
        const jlptLevel = dto.jlpt_level || existing.jlpt_level || existing.jlpt || "N5";

        if (dto.title_jp || dto.jlpt_level) {
            const dup = await grammarRepository.findDuplicate(titleJp, jlptLevel, id);
            if (dup) {
                throw new GrammarCustomError(409, "DUPLICATE_GRAMMAR", "This grammar point already exists for this level.");
            }
        }

        // Reference checks
        if (dto.lesson_id) {
            const exists = await grammarRepository.existsLesson(dto.lesson_id);
            if (!exists) {
                throw new GrammarCustomError(422, "INVALID_LESSON_REFERENCE", "Referenced lesson does not exist.");
            }
        }

        if (dto.topic_id) {
            const exists = await grammarRepository.existsTopic(dto.topic_id);
            if (!exists) {
                throw new GrammarCustomError(422, "INVALID_TOPIC_REFERENCE", "Referenced topic does not exist.");
            }
        }

        const updated = await grammarRepository.update(id, dto, adminId, existing);

        return {
            success: true,
            data: {
                id: updated.id,
                updated_at: updated.updated_at || new Date(),
            },
            message: "Grammar point updated successfully.",
        };
    },

    async deleteGrammarPoint(adminId: string, id: string) {
        const existing = await grammarRepository.findById(id);
        if (!existing) {
            throw new GrammarCustomError(404, "GRAMMAR_NOT_FOUND", "Grammar point not found.");
        }

        await grammarRepository.softDelete(id, adminId);

        return {
            success: true,
            message: "Grammar point deleted successfully.",
        };
    },
};
