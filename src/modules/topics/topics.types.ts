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

export interface TopicGrammarPointDTO {
    id: string;
    title_jp: string;
    structure: string | null;
    meaning_vi: string;
    explanation: string | null;
    usage: string | null;
    jlpt_level: string;
}

export interface TopicDetailDTO {
    id: string;
    lesson_id: string | null;
    title: string | null;
    description: string | null;
    image: string | null;
    vocabularies: VocabularySummaryDTO[];
    grammar_points: TopicGrammarPointDTO[];
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
