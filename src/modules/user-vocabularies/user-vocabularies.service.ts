import { userVocabularyRepository } from "./user-vocabularies.repository.js";

export const userVocabularyService = {
    async list(userId: string, filters: { search?: string | undefined; page?: number | undefined; limit?: number | undefined }) {
        const page = filters.page || 1;
        const limit = filters.limit || 30;

        const { items, total } = await userVocabularyRepository.findByUser(userId, filters.search, page, limit);
        const totalPages = Math.ceil(total / limit);

        return {
            success: true,
            data: items,
            meta: {
                page,
                limit,
                total,
                total_pages: totalPages || 1
            }
        };
    },

    async create(userId: string, dto: {
        kanji: string;
        hiragana?: string;
        romaji?: string;
        meaning: string;
        note?: string;
        image?: string;
        audio?: string;
    }) {
        const created = await userVocabularyRepository.insert(userId, dto);

        return {
            success: true,
            data: {
                id: created.id,
                kanji: created.kanji,
                meaning: created.meaning
            },
            message: "Word added successfully."
        };
    },

    async update(userId: string, id: string, dto: {
        kanji?: string;
        hiragana?: string;
        romaji?: string;
        meaning?: string;
        note?: string;
        image?: string;
        audio?: string;
    }) {
        const existing = await userVocabularyRepository.findByIdAndUser(id, userId);
        if (!existing) {
            throw new Error("USER_VOCABULARY_NOT_FOUND");
        }

        const keys = Object.keys(dto).filter(k => (dto as any)[k] !== undefined);
        if (keys.length === 0) {
            throw new Error("EMPTY_UPDATE");
        }

        const updated = await userVocabularyRepository.update(id, dto);

        // Build return data with updated properties
        const returnData: any = { id: updated.id };
        keys.forEach(k => {
            returnData[k] = (updated as any)[k];
        });

        return {
            success: true,
            data: returnData,
            message: "Word updated successfully."
        };
    },

    async delete(userId: string, id: string) {
        const existing = await userVocabularyRepository.findByIdAndUser(id, userId);
        if (!existing) {
            throw new Error("USER_VOCABULARY_NOT_FOUND");
        }

        await userVocabularyRepository.delete(id);

        return {
            success: true,
            message: "Word deleted successfully."
        };
    }
};
