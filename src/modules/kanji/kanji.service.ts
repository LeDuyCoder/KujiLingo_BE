import crypto from "node:crypto";
import { kanjiRepository } from "./kanji.repository.js";
import type { CreateKanjiDto, ListKanjiQuery, UpdateKanjiDto } from "./kanji.types.js";

export class KanjiCustomError extends Error {
    statusCode: number;
    code: string;

    constructor(statusCode: number, code: string, message: string) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
    }
}

export const kanjiService = {
    async listKanji(query: ListKanjiQuery, userId?: string) {
        // Validate cross-field business rule
        if (query.min_strokes !== undefined && query.max_strokes !== undefined) {
            if (query.min_strokes > query.max_strokes) {
                throw new KanjiCustomError(422, "INVALID_STROKE_RANGE", "min_strokes must not exceed max_strokes.");
            }
        }

        const { items, total } = await kanjiRepository.findFiltered(query);
        const limit = query.limit || 50;
        const page = query.page || 1;
        const total_pages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

        const data = items.map((item) => ({
            id: item.id,
            character: item.kanji || "",
            meaning_vi: item.meaning || "",
            onyomi: item.onyomi || "",
            kunyomi: item.kunyomi || "",
            stroke_count: item.stroke_count || 0,
            jlpt_level: item.jlpt || "N5",
            is_saved: false, // Default false, mock until folders support kanjis
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

    async getKanjiDetail(id: string, userId?: string) {
        const item = await kanjiRepository.findById(id);
        if (!item) {
            throw new KanjiCustomError(404, "KANJI_NOT_FOUND", "Kanji not found.");
        }

        const examples = Array.isArray(item.examples) ? item.examples : [];

        return {
            success: true,
            data: {
                id: item.id,
                character: item.kanji || "",
                meaning_vi: item.meaning || "",
                onyomi: item.onyomi || "",
                kunyomi: item.kunyomi || "",
                stroke_count: item.stroke_count || 0,
                jlpt_level: item.jlpt || "N5",
                radical: item.radical || "",
                stroke_order_image_url: item.stroke_order_image_url || "",
                examples,
                is_saved: false,
                folder_ids: [],
            },
        };
    },

    async createKanji(adminId: string, dto: CreateKanjiDto) {
        // 1. Duplicate check
        const existing = await kanjiRepository.findDuplicate(dto.character);
        if (existing) {
            throw new KanjiCustomError(409, "DUPLICATE_KANJI", "This kanji character already exists.");
        }

        // 2. Reference check
        if (dto.lesson_id) {
            const exists = await kanjiRepository.existsLesson(dto.lesson_id);
            if (!exists) {
                throw new KanjiCustomError(422, "INVALID_LESSON_REFERENCE", "Referenced lesson does not exist.");
            }
        }

        const newId = crypto.randomUUID();
        const created = await kanjiRepository.create({
            ...dto,
            id: newId,
            created_by: adminId,
        });

        return {
            success: true,
            data: {
                id: created.id,
                character: created.kanji || "",
                jlpt_level: created.jlpt || "N5",
                created_at: created.created_at,
            },
            message: "Kanji created successfully.",
        };
    },

    async updateKanji(adminId: string, id: string, dto: UpdateKanjiDto) {
        const existing = await kanjiRepository.findById(id);
        if (!existing) {
            throw new KanjiCustomError(404, "KANJI_NOT_FOUND", "Kanji not found.");
        }

        if (Object.keys(dto).length === 0) {
            throw new KanjiCustomError(400, "EMPTY_UPDATE", "At least one field must be provided for update.");
        }

        // Check duplicate if character changes
        if (dto.character && dto.character !== existing.kanji) {
            const dup = await kanjiRepository.findDuplicate(dto.character, id);
            if (dup) {
                throw new KanjiCustomError(409, "DUPLICATE_KANJI", "This kanji character already exists.");
            }
        }

        // Reference check
        if (dto.lesson_id) {
            const exists = await kanjiRepository.existsLesson(dto.lesson_id);
            if (!exists) {
                throw new KanjiCustomError(422, "INVALID_LESSON_REFERENCE", "Referenced lesson does not exist.");
            }
        }

        const updated = await kanjiRepository.update(id, dto, adminId, existing);

        return {
            success: true,
            data: {
                id: updated.id,
            },
            message: "Kanji updated successfully.",
        };
    },

    async deleteKanji(adminId: string, id: string) {
        const existing = await kanjiRepository.findById(id);
        if (!existing) {
            throw new KanjiCustomError(404, "KANJI_NOT_FOUND", "Kanji not found.");
        }

        await kanjiRepository.softDelete(id, adminId);

        return {
            success: true,
            message: "Kanji deleted successfully.",
        };
    },
};
