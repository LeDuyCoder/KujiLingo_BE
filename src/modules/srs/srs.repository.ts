import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import crypto from "node:crypto";

type TransactionClient = Prisma.TransactionClient;

export const srsRepository = {
    /**
     * Find due cards up to a batch size to sort in JS
     */
    async findDueCards(userId: string, itemType?: string, tx?: TransactionClient) {
        const client = tx || prisma;
        const now = new Date();
        return client.srs_cards.findMany({
            where: {
                user_id: userId,
                due_at: { lte: now },
                ...(itemType && { item_type: itemType as any })
            },
            orderBy: {
                due_at: "asc"
            },
            take: 300 // Fetch a window to prioritize in memory
        });
    },

    /**
     * Get a card uniquely by user and content item
     */
    async findCardByUserAndItem(userId: string, itemType: string, itemId: string, tx?: TransactionClient) {
        const client = tx || prisma;
        return client.srs_cards.findUnique({
            where: {
                user_id_item_type_item_id: {
                    user_id: userId,
                    item_type: itemType as any,
                    item_id: itemId
                }
            }
        });
    },

    /**
     * Lock single card row using SELECT FOR UPDATE
     */
    async findCardByIdAndUser(cardId: string, userId: string, tx?: TransactionClient) {
        const client = tx || prisma;
        const cards = await client.$queryRaw<any[]>`
            SELECT * FROM "srs_cards"
            WHERE "id" = ${cardId}::uuid AND "user_id" = ${userId}::uuid
            LIMIT 1
            FOR UPDATE
        `;
        return cards[0] || null;
    },

    /**
     * Check vocabulary exists
     */
    async checkVocabularyExists(id: string, tx?: TransactionClient): Promise<boolean> {
        const client = tx || prisma;
        const count = await client.vocabularies.count({
            where: { id }
        });
        return count > 0;
    },

    /**
     * Check active kanji exists
     */
    async checkKanjiExists(id: string, tx?: TransactionClient): Promise<boolean> {
        const client = tx || prisma;
        const count = await client.kanjis.count({
            where: { id, deleted_at: null }
        });
        return count > 0;
    },

    /**
     * Check active grammar point exists
     */
    async checkGrammarExists(id: string, tx?: TransactionClient): Promise<boolean> {
        const client = tx || prisma;
        const count = await client.grammar_points.count({
            where: { id, deleted_at: null }
        });
        return count > 0;
    },

    /**
     * Insert new SRS card
     */
    async insertCard(
        tx: TransactionClient,
        data: {
            user_id: string;
            item_type: string;
            item_id: string;
            ease_factor: number;
            interval_days: number;
            repetitions: number;
            due_at: Date;
            state: string;
        }
    ) {
        return tx.srs_cards.create({
            data: {
                id: crypto.randomUUID(),
                user_id: data.user_id,
                item_type: data.item_type as any,
                item_id: data.item_id,
                ease_factor: data.ease_factor,
                interval_days: data.interval_days,
                repetitions: data.repetitions,
                due_at: data.due_at,
                state: data.state as any
            }
        });
    },

    /**
     * Update card scheduling variables
     */
    async updateCard(
        tx: TransactionClient,
        cardId: string,
        data: {
            ease_factor: number;
            interval_days: number;
            repetitions: number;
            due_at: Date;
            state: string;
        }
    ) {
        return tx.srs_cards.update({
            where: { id: cardId },
            data: {
                ease_factor: data.ease_factor,
                interval_days: data.interval_days,
                repetitions: data.repetitions,
                due_at: data.due_at,
                state: data.state as any
            }
        });
    },

    /**
     * Record a review history log entry
     */
    async insertReviewHistory(
        tx: TransactionClient,
        data: {
            srs_card_id: string;
            user_id: string;
            rating: string;
            interval_before_days: number;
            interval_after_days: number;
            ease_factor_before: number;
            ease_factor_after: number;
            reviewed_at: Date;
        }
    ) {
        return tx.srs_review_histories.create({
            data: {
                id: crypto.randomUUID(),
                srs_card_id: data.srs_card_id,
                user_id: data.user_id,
                rating: data.rating as any,
                interval_before_days: data.interval_before_days,
                interval_after_days: data.interval_after_days,
                ease_factor_before: data.ease_factor_before,
                ease_factor_after: data.ease_factor_after,
                reviewed_at: data.reviewed_at
            }
        });
    },

    /**
     * Increment words_reviewed for daily statistics
     */
    async upsertDailyStatistics(tx: TransactionClient, userId: string, date: Date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        return tx.user_statistics_daily.upsert({
            where: {
                user_id_stat_date: {
                    user_id: userId,
                    stat_date: startOfDay
                }
            },
            create: {
                user_id: userId,
                stat_date: startOfDay,
                words_reviewed: 1
            },
            update: {
                words_reviewed: { increment: 1 }
            }
        });
    },

    /**
     * Polymorphic vocabulary content batch fetch
     */
    async resolveVocabulariesContent(ids: string[], tx?: TransactionClient) {
        const client = tx || prisma;
        return client.vocabularies.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                kanji: true,
                hiragana: true,
                romaji: true,
                vocabulary_meanings: {
                    where: { language: "vi" },
                    orderBy: { display_order: "asc" },
                    take: 1
                }
            }
        });
    },

    /**
     * Polymorphic kanji content batch fetch
     */
    async resolveKanjisContent(ids: string[], tx?: TransactionClient) {
        const client = tx || prisma;
        return client.kanjis.findMany({
            where: { id: { in: ids }, deleted_at: null },
            select: {
                id: true,
                kanji: true,
                meaning: true,
                onyomi: true,
                kunyomi: true
            }
        });
    },

    /**
     * Polymorphic grammar points content batch fetch
     */
    async resolveGrammarContent(ids: string[], tx?: TransactionClient) {
        const client = tx || prisma;
        return client.grammar_points.findMany({
            where: { id: { in: ids }, deleted_at: null },
            select: {
                id: true,
                title_jp: true,
                title: true,
                structure: true,
                meaning_vi: true,
                meaning: true
            }
        });
    }
};
