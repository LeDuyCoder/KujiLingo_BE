import { favoriteVocabulariesRepository } from "./favorite-vocabularies.repository.js";
import type { FavoriteVocabularyItemDTO } from "./favorite-vocabularies.types.js";

export const favoriteVocabulariesService = {
    /**
     * Lấy danh sách từ vựng yêu thích của user
     */
    async listFavorites(userId: string, language: string = "vi", page: number = 1, limit: number = 30) {
        const { favorites, total } = await favoriteVocabulariesRepository.findByUser(
            userId,
            language,
            page,
            limit
        );

        const data: FavoriteVocabularyItemDTO[] = favorites.map((fav) => ({
            vocabulary_id: fav.vocabulary_id,
            kanji: fav.vocabularies.kanji,
            hiragana: fav.vocabularies.hiragana,
            meaning: fav.vocabularies.vocabulary_meanings[0]?.meaning ?? null,
            jlpt: fav.vocabularies.jlpt,
        }));

        const totalPages = Math.ceil(total / limit);

        return {
            success: true as const,
            data,
            meta: {
                page,
                limit,
                total,
                total_pages: totalPages,
            },
        };
    },

    /**
     * Thêm từ vựng vào danh sách yêu thích
     */
    async addFavorite(userId: string, vocabularyId: string) {
        const vocabExists = await favoriteVocabulariesRepository.existsVocabulary(vocabularyId);
        if (!vocabExists) {
            throw new Error("INVALID_VOCABULARY_REFERENCE");
        }

        try {
            await favoriteVocabulariesRepository.addFavorite(userId, vocabularyId);
        } catch (error: any) {
            // Prisma code P2002 đại diện cho Unique constraint (Composite PK violation)
            if (error?.code === "P2002" || error?.message?.includes("Unique constraint")) {
                throw new Error("ALREADY_FAVORITED");
            }
            throw error;
        }

        return {
            success: true as const,
            message: "Added to favorites.",
        };
    },

    /**
     * Xóa từ vựng khỏi danh sách yêu thích (Idempotent)
     */
    async removeFavorite(userId: string, vocabularyId: string) {
        await favoriteVocabulariesRepository.removeFavorite(userId, vocabularyId);
        return {
            success: true as const,
            message: "Removed from favorites.",
        };
    },
};
