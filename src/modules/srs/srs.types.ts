export interface SrsCardDTO {
    card_id: string;
    item_type: "vocabulary" | "kanji" | "grammar";
    item_id: string;
    state: "new" | "learning" | "review" | "relearning";
    due_at: Date;
    content: {
        word_jp?: string;
        reading_hiragana?: string;
        meaning_vi?: string;
        character?: string;
        readings?: string;
        meaning?: string;
        title?: string;
        structure?: string;
    };
}

export interface SubmitReviewBody {
    rating: "again" | "hard" | "good" | "easy";
}

export interface AddItemBody {
    item_type: "vocabulary" | "kanji" | "grammar";
    item_id: string;
}
