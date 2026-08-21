export interface GrammarExampleItem {
    jp: string;
    vi: string;
    audio_url?: string | null;
}

export interface ListGrammarQuery {
    jlpt_level?: "N5" | "N4" | "N3" | "N2" | "N1";
    topic_id?: string;
    lesson_id?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export interface CreateGrammarDto {
    title_jp: string;
    structure: string;
    meaning_vi: string;
    explanation?: string;
    jlpt_level: "N5" | "N4" | "N3" | "N2" | "N1";
    example_sentences?: GrammarExampleItem[];
    audio_url?: string;
    lesson_id?: string;
    topic_id?: string;
}

export interface UpdateGrammarDto {
    title_jp?: string;
    structure?: string;
    meaning_vi?: string;
    explanation?: string;
    jlpt_level?: "N5" | "N4" | "N3" | "N2" | "N1";
    example_sentences?: GrammarExampleItem[];
    audio_url?: string;
    lesson_id?: string;
    topic_id?: string;
}

export interface GrammarItemResponse {
    id: string;
    title_jp: string;
    structure: string;
    meaning_vi: string;
    explanation?: string | null;
    jlpt_level: string;
    example_sentences?: GrammarExampleItem[];
    audio_url?: string | null;
    is_saved?: boolean;
    folder_ids?: string[];
}
