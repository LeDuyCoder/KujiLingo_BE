import { db } from "../../config/prisma.js";
import { srsRepository } from "./srs.repository.js";

export const srsService = {
    /**
     * Fetch due cards, resolve polymorphic content details, and apply caps
     */
    async getDueCards(userId: string, query: { item_type?: string; limit?: number }) {
        const limit = query.limit ?? 20;

        // 1. Fetch due cards
        const cards = await srsRepository.findDueCards(userId, query.item_type);

        // 2. Sort in memory (due_at ASC, state priority: relearning > learning > review > new)
        const statePriority: Record<string, number> = {
            relearning: 4,
            learning: 3,
            review: 2,
            new: 1
        };

        const sortedCards = [...cards].sort((a, b) => {
            const timeDiff = a.due_at.getTime() - b.due_at.getTime();
            // If due within the same second, sort by state priority
            if (Math.abs(timeDiff) <= 1000) {
                const prioA = statePriority[a.state] ?? 0;
                const prioB = statePriority[b.state] ?? 0;
                return prioB - prioA;
            }
            return timeDiff;
        });

        // 3. Group and resolve polymorphic contents
        const vocabIds: string[] = [];
        const kanjiIds: string[] = [];
        const grammarIds: string[] = [];

        sortedCards.forEach(c => {
            if (c.item_type === "vocabulary") vocabIds.push(c.item_id);
            else if (c.item_type === "kanji") kanjiIds.push(c.item_id);
            else if (c.item_type === "grammar") grammarIds.push(c.item_id);
        });

        const [vocabs, kanjis, grammars] = await Promise.all([
            vocabIds.length > 0 ? srsRepository.resolveVocabulariesContent(vocabIds) : [],
            kanjiIds.length > 0 ? srsRepository.resolveKanjisContent(kanjiIds) : [],
            grammarIds.length > 0 ? srsRepository.resolveGrammarContent(grammarIds) : []
        ]);

        const contentMap = new Map<string, any>();

        vocabs.forEach(v => {
            contentMap.set(`vocabulary:${v.id}`, {
                word_jp: v.kanji || v.hiragana || "",
                reading_hiragana: v.hiragana || "",
                meaning_vi: v.vocabulary_meanings[0]?.meaning || ""
            });
        });

        kanjis.forEach(k => {
            contentMap.set(`kanji:${k.id}`, {
                character: k.kanji || "",
                readings: [k.onyomi, k.kunyomi].filter(Boolean).join(" / ") || "",
                meaning: k.meaning || ""
            });
        });

        grammars.forEach(g => {
            contentMap.set(`grammar:${g.id}`, {
                title: g.title_jp || g.title || "",
                structure: g.structure || "",
                meaning_vi: g.meaning_vi || g.meaning || ""
            });
        });

        // 4. Filter out soft-deleted content and apply 10-card cap on 'new' cards
        let newCount = 0;
        const finalCards: any[] = [];

        for (const card of sortedCards) {
            const content = contentMap.get(`${card.item_type}:${card.item_id}`);
            if (!content) {
                continue; // Orphaned or deleted
            }

            const isNew = card.state === "new" || card.repetitions === 0;
            if (isNew) {
                if (newCount >= 10) {
                    continue; // Skip new card cap
                }
                newCount++;
            }

            finalCards.push({
                card_id: card.id,
                item_type: card.item_type,
                item_id: card.item_id,
                state: card.state,
                due_at: card.due_at,
                content
            });

            if (finalCards.length >= limit) {
                break;
            }
        }

        return {
            success: true,
            data: finalCards,
            meta: {
                total_due: finalCards.length
            }
        };
    },

    /**
     * Submit recall rating and compute next spaced replication schedule
     */
    async submitReview(userId: string, cardId: string, rating: "again" | "hard" | "good" | "easy") {
        const result = await db.prisma.$transaction(async (tx) => {
            // 1. Lock card row FOR UPDATE
            const card = await srsRepository.findCardByIdAndUser(cardId, userId, tx);
            if (!card) {
                throw new Error("CARD_NOT_FOUND");
            }

            let nextRepetitions = card.repetitions;
            let nextInterval = card.interval_days;
            let nextEase = Number(card.ease_factor);
            let nextState = card.state;

            // 2. SM-2 Scheduling Logic
            if (rating === "again") {
                nextRepetitions = 0;
                nextInterval = 1;
                nextState = "relearning";
                nextEase = Math.max(1.3, nextEase - 0.2);
            } else if (rating === "hard") {
                nextInterval = Math.max(1, Math.round(card.interval_days * 1.2));
                nextEase = Math.max(1.3, nextEase - 0.15);
                nextRepetitions = card.repetitions + 1;
                nextState = "review";
            } else if (rating === "good") {
                if (card.repetitions === 0) {
                    nextInterval = 1;
                } else if (card.repetitions === 1) {
                    nextInterval = 6;
                } else {
                    nextInterval = Math.round(card.interval_days * nextEase);
                }
                nextRepetitions = card.repetitions + 1;
                nextState = "review";
            } else if (rating === "easy") {
                if (card.repetitions === 0) {
                    nextInterval = 1;
                } else if (card.repetitions === 1) {
                    nextInterval = 8; // standard 6 * 1.3 approx = 8
                } else {
                    nextInterval = Math.round(card.interval_days * nextEase * 1.3);
                }
                nextEase = nextEase + 0.15; // only 1.3 floor, no max ease capped
                nextRepetitions = card.repetitions + 1;
                nextState = "review";
            }

            const now = new Date();
            const nextDueAt = new Date(now);
            nextDueAt.setDate(now.getDate() + nextInterval);

            // 3. Save updates, history logs, and study stats
            await srsRepository.updateCard(tx, cardId, {
                ease_factor: nextEase,
                interval_days: nextInterval,
                repetitions: nextRepetitions,
                due_at: nextDueAt,
                state: nextState
            });

            await srsRepository.insertReviewHistory(tx, {
                srs_card_id: cardId,
                user_id: userId,
                rating,
                interval_before_days: card.interval_days,
                interval_after_days: nextInterval,
                ease_factor_before: Number(card.ease_factor),
                ease_factor_after: nextEase,
                reviewed_at: now
            });

            await srsRepository.upsertDailyStatistics(tx, userId, now);

            return {
                card_id: cardId,
                rating,
                new_interval_days: nextInterval,
                new_due_at: nextDueAt,
                new_state: nextState,
                repetitions: nextRepetitions
            };
        });

        return {
            success: true,
            data: result,
            message: "Review recorded."
        };
    },

    /**
     * Add vocabulary, kanji, or grammar item to review queue
     */
    async addItem(userId: string, itemType: "vocabulary" | "kanji" | "grammar", itemId: string) {
        let exists = false;
        if (itemType === "vocabulary") {
            exists = await srsRepository.checkVocabularyExists(itemId);
        } else if (itemType === "kanji") {
            exists = await srsRepository.checkKanjiExists(itemId);
        } else if (itemType === "grammar") {
            exists = await srsRepository.checkGrammarExists(itemId);
        }

        if (!exists) {
            throw new Error("INVALID_ITEM_REFERENCE");
        }

        const alreadyAdded = await srsRepository.findCardByUserAndItem(userId, itemType, itemId);
        if (alreadyAdded) {
            throw new Error("ITEM_ALREADY_IN_SRS");
        }

        const now = new Date();
        const card = await db.prisma.$transaction(async (tx) => {
            return srsRepository.insertCard(tx, {
                user_id: userId,
                item_type: itemType,
                item_id: itemId,
                ease_factor: 2.5,
                interval_days: 0,
                repetitions: 0,
                due_at: now,
                state: "new"
            });
        });

        return {
            success: true,
            data: {
                card_id: card.id,
                item_type: card.item_type,
                item_id: card.item_id,
                state: card.state,
                due_at: card.due_at
            },
            message: "Added to your review queue."
        };
    }
};
