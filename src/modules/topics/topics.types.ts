export interface VocabularySummaryDTO {
    id: string;
    kanji: string | null;
    hiragana: string | null;
    romaji: string | null;
    word_type: string | null;
    jlpt: string | null;
    meaning: string | null;
    is_favorited: boolean;
    learning_status: string;
}

export interface TopicDetailDTO {
    id: string;
    lesson_id: string | null;
    title: string | null;
    description: string | null;
    image: string | null;
    vocabularies: VocabularySummaryDTO[];
}

export interface CreateTopicBody {
    lesson_id: string;
    title: string;
    description?: string;
    image?: string;
    order_no?: number;
}

export interface UpdateTopicBody {
    lesson_id?: string;
    title?: string;
    description?: string;
    image?: string;
    order_no?: number;
}

export interface AddVocabularyBody {
    vocabulary_id: string;
}
