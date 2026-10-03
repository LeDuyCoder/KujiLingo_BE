import type { JLPTLevel } from "../../../generated/prisma/client.js";

export interface KanjiExample {
    word_jp: string;
    reading: string;
    meaning_vi: string;
}

export interface ListKanjiQuery {
    jlpt_level?: JLPTLevel;
    radical?: string;
    min_strokes?: number;
    max_strokes?: number;
    search?: string;
    page?: number;
    limit?: number;
}

export interface CreateKanjiDto {
    character: string;             // Map to db.kanji
    meaning_vi: string;            // Map to db.meaning
    meaning_en?: string;
    onyomi?: string;
    kunyomi?: string;
    stroke_count: number;
    jlpt_level: JLPTLevel;         // Map to db.jlpt
    radical?: string;
    stroke_order_image_url?: string;
    examples?: KanjiExample[];
    lesson_id?: string;
}

export interface ListKanjiQuery {
    jlpt_level?: JLPTLevel;
    radical?: string;
    min_strikes?: number;
    max_strikes?: number;
    search?: string;
    page?: number;
    limit?: number;
}


export interface CreateKanjiDto {
    character: string;             // Map to db.kanji
    meaning_vi: string;            // Map to db.meaning
    meaning_en?: string;
    onyomi?: string;
    kunyomi?: string;
    stroke_count: number;
    jlpt_level: JLPTLevel;         // Map to db.jlpt
    radical?: string;
    stroke_order_image_url?: string;
    examples?: KanjiExample[];
    lesson_id?: string;
}

export interface UpdateKanjiDto {
    character?: string;
    meaning_vi?: string;
    meaning_en?: string;
    onyomi?: string;
    kunyomi?: string;
    stroke_count?: number;
    jlpt_level?: JLPTLevel;
    radical?: string;
    stroke_order_image_url?: string;
    examples?: KanjiExample[];
    lesson_id?: string;
}
