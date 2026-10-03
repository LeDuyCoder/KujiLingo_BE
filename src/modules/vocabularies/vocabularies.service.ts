import { vocabulariesRepository } from "./vocabularies.repository.js";

export const vocabulariesService = {
    async list(userId: string | undefined, filters: {
        jlpt_level?: string;
        topic_id?: string;
        lesson_id?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) {
        const page = filters.page || 1;
        const limit = filters.limit || 30;

        const { items, total } = await vocabulariesRepository.findFiltered(filters, page, limit, userId);

        const data = (items as any[]).map(item => {
            const meanings = item.vocabulary_meanings || [];
            const meaning_vi = meanings.find((m: any) => m.language === "vi")?.meaning || null;
            
            const is_favorited = item.favorite_vocabularies ? item.favorite_vocabularies.length > 0 : false;
            const is_saved = item.folder_system_vocabularies ? item.folder_system_vocabularies.length > 0 : false;

            return {
                id: item.id,
                word_jp: item.kanji,
                reading_hiragana: item.hiragana,
                meaning_vi,
                jlpt_level: item.jlpt,
                audio_url: item.audio,
                is_favorited,
                is_saved
            };
        });

        return {
            success: true,
            data,
            meta: {
                page,
                limit,
                total,
                total_pages: Math.ceil(total / limit) || 1
            }
        };
    },

    async getDetail(id: string, userId?: string) {
        const item = await vocabulariesRepository.findById(id, userId);

        if (!item) {
            throw new Error("VOCABULARY_NOT_FOUND");
        }

        const itemAny = item as any;
        const meaning_vi = (itemAny.vocabulary_meanings || []).find((m: any) => m.language === "vi")?.meaning || null;
        const meaning_en = (itemAny.vocabulary_meanings || []).find((m: any) => m.language === "en")?.meaning || null;
        
        const is_favorited = itemAny.favorite_vocabularies ? itemAny.favorite_vocabularies.length > 0 : false;
        const is_saved = itemAny.folder_system_vocabularies ? itemAny.folder_system_vocabularies.length > 0 : false;
        const folder_ids = itemAny.folder_system_vocabularies ? itemAny.folder_system_vocabularies.map((f: any) => f.folder_id) : [];

        const example = itemAny.example_sentences?.[0] || null;

        return {
            success: true,
            data: {
                id: itemAny.id,
                word_jp: itemAny.kanji,
                reading_hiragana: itemAny.hiragana,
                reading_romaji: itemAny.romaji,
                meaning_vi,
                meaning_en,
                part_of_speech: itemAny.word_type,
                jlpt_level: itemAny.jlpt,
                example_sentence_jp: example?.japanese || null,
                example_sentence_vi: example?.translation || null,
                audio_url: itemAny.audio,
                image_url: itemAny.image,
                is_favorited,
                is_saved,
                folder_ids
            }
        };
    },

    async create(adminId: string, dto: {
        word_jp: string;
        reading_hiragana: string;
        reading_romaji?: string;
        meaning_vi: string;
        meaning_en?: string;
        part_of_speech?: string;
        jlpt_level: string;
        example_sentence_jp?: string;
        example_sentence_vi?: string;
        audio_url?: string;
        image_url?: string;
        lesson_id?: string;
        topic_id?: string;
        frequency_rank?: number;
    }) {
        // 1. Check duplicate
        const existing = await vocabulariesRepository.findByWordAndLevel(dto.word_jp, dto.jlpt_level);
        if (existing) {
            throw new Error("DUPLICATE_VOCABULARY");
        }

        // 2. Check references
        if (dto.lesson_id) {
            const lessonExists = await vocabulariesRepository.checkLessonExists(dto.lesson_id);
            if (!lessonExists) throw new Error("INVALID_LESSON_REFERENCE");
        }
        if (dto.topic_id) {
            const topicExists = await vocabulariesRepository.checkTopicExists(dto.topic_id);
            if (!topicExists) throw new Error("INVALID_TOPIC_REFERENCE");
        }

        const created = await vocabulariesRepository.insert(dto, adminId);

        return {
            success: true,
            data: {
                id: created.id,
                word_jp: created.kanji,
                jlpt_level: created.jlpt,
                created_at: created.created_at
            },
            message: "Vocabulary created successfully."
        };
    },

    async update(adminId: string, id: string, dto: {
        word_jp?: string;
        reading_hiragana?: string;
        reading_romaji?: string;
        meaning_vi?: string;
        meaning_en?: string;
        part_of_speech?: string;
        jlpt_level?: string;
        example_sentence_jp?: string;
        example_sentence_vi?: string;
        audio_url?: string;
        image_url?: string;
        lesson_id?: string;
        topic_id?: string;
        frequency_rank?: number;
    }) {
        // 1. Check existence
        const current = await vocabulariesRepository.findById(id);
        if (!current) {
            throw new Error("VOCABULARY_NOT_FOUND");
        }

        const keys = Object.keys(dto).filter(k => (dto as any)[k] !== undefined);
        if (keys.length === 0) {
            throw new Error("EMPTY_UPDATE");
        }

        // 2. Check duplicate if word_jp or jlpt_level changing
        const currentAny = current as any;
        const newWord = dto.word_jp || currentAny.kanji;
        const newLevel = dto.jlpt_level || currentAny.jlpt;

        if (dto.word_jp || dto.jlpt_level) {
            const existing = await vocabulariesRepository.findByWordAndLevel(newWord, newLevel);
            if (existing && existing.id !== id) {
                throw new Error("DUPLICATE_VOCABULARY");
            }
        }

        // 3. Check references
        if (dto.lesson_id) {
            const lessonExists = await vocabulariesRepository.checkLessonExists(dto.lesson_id);
            if (!lessonExists) throw new Error("INVALID_LESSON_REFERENCE");
        }
        if (dto.topic_id) {
            const topicExists = await vocabulariesRepository.checkTopicExists(dto.topic_id);
            if (!topicExists) throw new Error("INVALID_TOPIC_REFERENCE");
        }

        const updated = await vocabulariesRepository.update(id, dto, adminId, current);

        return {
            success: true,
            data: {
                id: updated.id,
                updated_at: new Date()
            },
            message: "Vocabulary updated successfully."
        };
    },

    async delete(adminId: string, id: string) {
        const current = await vocabulariesRepository.findById(id);
        if (!current) {
            throw new Error("VOCABULARY_NOT_FOUND");
        }

        await vocabulariesRepository.softDelete(id, adminId, current);

        return {
            success: true,
            message: "Vocabulary deleted successfully."
        };
    }
};
