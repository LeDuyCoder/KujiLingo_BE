import type { JLPTLevel } from "../../../generated/prisma/client.js";

export interface FavoriteVocabularyItemDTO {
    vocabulary_id: string;
    kanji: string | null;
    hiragana: string | null;
    meaning: string | null;
    jlpt: JLPTLevel | string | null;
}

export interface ListFavoritesQuery {
    page?: number;
    limit?: number;
}

export interface ListFavoritesHeaders {
    "accept-language"?: string;
}

export interface AddFavoriteBody {
    vocabulary_id: string;
}

export interface RemoveFavoriteParams {
    vocabularyId: string;
}
