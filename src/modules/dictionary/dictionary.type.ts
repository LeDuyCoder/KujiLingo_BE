export interface DictionaryDTO {
    id: string;
    term_jp: string;
    reading_hiragana: string | null;
    meaning_vi: string | null;
    meaning_en: string | null;
    part_of_speech: string | null;
    jlpt_level: string | null;
    related_vocabulary_id: string | null;
    is_favorited: boolean;
    is_saved: boolean;
}

export interface SearchQueryParams {
    q: string;
    jlpt_level?: string;
    page?: number;
    limit?: number;
}

export interface DictionarySearchResponse {
    success: boolean;
    data: DictionaryDTO[];
    meta: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
    }
}

export interface DictionaryDetailResponse {
    success: boolean;
    data: DictionaryDTO & {
        vocabulary: any | null;
        kanji: any | null;
    }
}