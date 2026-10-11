import { memoryCache } from "../../common/utils/cache.js";
import { dictionaryRepository } from "./dictionary.repository.js";
import type { DictionaryDTO } from "./dictionary.type.js";
import { translateVocabularyTexts } from "../../common/services/translation.service.js";

type DisplayLanguage = "vi" | "en";

async function translateMissingMeanings(data: DictionaryDTO[], language: DisplayLanguage) {
    const missingIndexes: number[] = [];
    const sourceTexts: string[] = [];
    data.forEach((entry, index) => {
        const targetMeaning = language === "vi" ? entry.meaning_vi : entry.meaning_en;
        const sourceMeaning = language === "vi" ? entry.meaning_en : entry.meaning_vi;
        if (!targetMeaning && sourceMeaning) {
            missingIndexes.push(index);
            sourceTexts.push(sourceMeaning);
        }
    });
    const translated = await translateVocabularyTexts(sourceTexts, language);
    missingIndexes.forEach((index, translationIndex) => {
        const entry = data[index];
        const meaning = translated[translationIndex] ?? sourceTexts[translationIndex];
        if (!entry || typeof meaning !== "string") return;
        if (language === "vi") entry.meaning_vi = meaning;
        else entry.meaning_en = meaning;
    });
    return data;
}

function mapToDictionaryDTO(
    vocab: any,
    favoritedIds: Set<string>,
    savedIds: Set<string>
): DictionaryDTO {
    const meaningVi = vocab.vocabulary_meanings?.find((m: any) => m.language === "vi")?.meaning || null;
    const meaningEn = vocab.vocabulary_meanings?.find((m: any) => m.language === "en")?.meaning || null;

    return {
        id: vocab.id,
        term_jp: vocab.kanji || vocab.hiragana || "",
        reading_hiragana: vocab.hiragana || null,
        meaning_vi: meaningVi,
        meaning_en: meaningEn,
        part_of_speech: vocab.word_type || null,
        jlpt_level: vocab.jlpt || null,
        related_vocabulary_id: vocab.id,
        is_favorited: favoritedIds.has(vocab.id),
        is_saved: savedIds.has(vocab.id)
    };
}

export const dictionaryService = {
    async search(query: string, jlptLevel: any, page: number, limit: number, userId?: string, displayLanguage: DisplayLanguage = "vi") {
        const normalizedQuery = query.trim().normalize("NFC");
        const cacheKey = `dict:search:${normalizedQuery}:${jlptLevel || "ALL"}:${page}:${limit}`;
        let cached = memoryCache.get<{ data: any[]; total: number }>(cacheKey);

        if (!cached) {
            cached = await dictionaryRepository.search(normalizedQuery, jlptLevel, page, limit);
            
            // Nếu không có kết quả trong DB ở trang 1, tự động crawl từ Jisho
            if (cached.total === 0) {
                const jishoHasResults = await dictionaryRepository.fetchAndSaveFromJisho(normalizedQuery);
                if (jishoHasResults) {
                    // Query lại database sau khi đã thêm mới từ vựng
                    cached = await dictionaryRepository.search(normalizedQuery, jlptLevel, page, limit);
                }
            }
            
            if (cached.total > 0) {
                memoryCache.set(cacheKey, cached, 60 * 5);
            }
        }

        let favoritedIds = new Set<string>();
        let savedIds = new Set<string>();

        if (userId && cached.data && cached.data.length > 0) {
            const ids = cached.data.map(v => v.id);
            const interactions = await dictionaryRepository.getUserInteractions(userId, ids);
            favoritedIds = interactions.favoritedIds;
            savedIds = interactions.savedIds;
        }

        const formattedData = (cached.data || []).map(vocab =>
            mapToDictionaryDTO(vocab, favoritedIds, savedIds)
        );
        await translateMissingMeanings(formattedData, displayLanguage);

        return {
            data: formattedData,
            meta: {
                page,
                limit,
                total: cached.total || 0,
                total_pages: Math.ceil((cached.total || 0) / limit) || 1
            }
        };
    },

    async getDetail(id: string, userId?: string, displayLanguage: DisplayLanguage = "vi") {
        const cacheKey = `dict:detail:${id}`;
        let vocab = memoryCache.get<any>(cacheKey);

        if (!vocab) {
            vocab = await dictionaryRepository.findById(id);
            if (!vocab) {
                return null;
            }
            memoryCache.set(cacheKey, vocab, 60 * 60); // Cache 1 giờ
        }

        let isFavorited = false;
        let isSaved = false;

        if (userId) {
            const interactions = await dictionaryRepository.getUserInteractions(userId, [id]);
            isFavorited = interactions.favoritedIds.has(id);
            isSaved = interactions.savedIds.has(id);
        }

        const baseDTO = mapToDictionaryDTO(vocab, new Set(isFavorited ? [id] : []), new Set(isSaved ? [id] : []));
        await translateMissingMeanings([baseDTO], displayLanguage);

        return {
            ...baseDTO,
            vocabulary: vocab,
            kanji: null 
        };
    }
};
