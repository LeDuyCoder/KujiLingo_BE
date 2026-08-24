import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import crypto from "node:crypto";

type TransactionClient = Prisma.TransactionClient;

export const topicsRepository = {
    /**
     * Find topic metadata by ID
     */
    async findById(id: string, tx?: TransactionClient) {
        const client = tx || prisma;
        return client.topics.findUnique({
            where: { id }
        });
    },

    /**
     * Find vocabularies linked to a topic
     */
    async findVocabulariesByTopicId(topicId: string, tx?: TransactionClient) {
        const client = tx || prisma;
        const joined = await client.topic_vocabularies.findMany({
            where: { topic_id: topicId },
            include: {
                vocabularies: true
            }
        });

        // Safe JS sorting on nullable frequency to guarantee frequency ASC, NULLS LAST
        return joined
            .map(j => j.vocabularies)
            .sort((a, b) => {
                const fa = a.frequency;
                const fb = b.frequency;
                if (fa === null || fa === undefined) return 1;
                if (fb === null || fb === undefined) return -1;
                return fa - fb;
            });
    },

    /**
     * Find vocabulary meanings by vocabulary IDs and languages
     */
    async findMeaningsByVocabulariesAndLanguages(
        vocabularyIds: string[],
        languages: string[],
        tx?: TransactionClient
    ) {
        const client = tx || prisma;
        return client.vocabulary_meanings.findMany({
            where: {
                vocabulary_id: { in: vocabularyIds },
                language: { in: languages }
            },
            orderBy: [
                { vocabulary_id: "asc" },
                { display_order: "asc" }
            ]
        });
    },

    /**
     * Find favorited vocabulary IDs for a user
     */
    async findFavorites(userId: string, vocabularyIds: string[], tx?: TransactionClient) {
        const client = tx || prisma;
        const list = await client.favorite_vocabularies.findMany({
            where: {
                user_id: userId,
                vocabulary_id: { in: vocabularyIds }
            },
            select: {
                vocabulary_id: true
            }
        });
        return new Set(list.map(f => f.vocabulary_id));
    },

    /**
     * Find learning progress status for a user's vocabularies
     */
    async findLearningProgress(userId: string, vocabularyIds: string[], tx?: TransactionClient) {
        const client = tx || prisma;
        return client.learning_progress.findMany({
            where: {
                user_id: userId,
                vocabulary_id: { in: vocabularyIds }
            },
            select: {
                vocabulary_id: true,
                status: true
            }
        });
    },

    /**
     * Check if a lesson exists
     */
    async checkLessonExists(lessonId: string, tx?: TransactionClient): Promise<boolean> {
        const client = tx || prisma;
        const count = await client.lessons.count({
            where: { id: lessonId }
        });
        return count > 0;
    },

    /**
     * Check if a vocabulary exists
     */
    async checkVocabularyExists(vocabId: string, tx?: TransactionClient): Promise<boolean> {
        const client = tx || prisma;
        const count = await client.vocabularies.count({
            where: { id: vocabId }
        });
        return count > 0;
    },

    /**
     * Check if a topic has a vocabulary item already attached
     */
    async checkTopicVocabularyExists(
        topicId: string,
        vocabId: string,
        tx?: TransactionClient
    ): Promise<boolean> {
        const client = tx || prisma;
        const count = await client.topic_vocabularies.count({
            where: {
                topic_id: topicId,
                vocabulary_id: vocabId
            }
        });
        return count > 0;
    },

    /**
     * Create a new topic
     */
    async createTopic(
        tx: TransactionClient,
        data: {
            lesson_id: string;
            title: string;
            description?: string;
            image?: string;
            order_no?: number;
        }
    ) {
        return tx.topics.create({
            data: {
                id: crypto.randomUUID(),
                lesson_id: data.lesson_id,
                title: data.title,
                description: data.description !== undefined ? data.description : null,
                image: data.image !== undefined ? data.image : null,
                order_no: data.order_no !== undefined ? data.order_no : 0
            }
        });
    },

    /**
     * Update an existing topic
     */
    async updateTopic(
        tx: TransactionClient,
        id: string,
        data: {
            lesson_id?: string;
            title?: string;
            description?: string;
            image?: string;
            order_no?: number;
        }
    ) {
        const updateData: any = {};
        if (data.lesson_id !== undefined) updateData.lesson_id = data.lesson_id;
        if (data.title !== undefined) updateData.title = data.title;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.image !== undefined) updateData.image = data.image;
        if (data.order_no !== undefined) updateData.order_no = data.order_no;

        return tx.topics.update({
            where: { id },
            data: updateData
        });
    },

    /**
     * Delete a topic row
     */
    async deleteTopic(tx: TransactionClient, id: string) {
        return tx.topics.delete({
            where: { id }
        });
    },

    /**
     * Delete join table associations by topic ID
     */
    async deleteTopicVocabulariesByTopicId(tx: TransactionClient, topicId: string) {
        return tx.topic_vocabularies.deleteMany({
            where: { topic_id: topicId }
        });
    },

    /**
     * Attach a vocabulary item to a topic
     */
    async insertTopicVocabulary(tx: TransactionClient, topicId: string, vocabId: string) {
        return tx.topic_vocabularies.create({
            data: {
                topic_id: topicId,
                vocabulary_id: vocabId
            }
        });
    },

    /**
     * Detach a vocabulary item from a topic
     */
    async deleteTopicVocabulary(tx: TransactionClient, topicId: string, vocabId: string) {
        return tx.topic_vocabularies.delete({
            where: {
                topic_id_vocabulary_id: {
                    topic_id: topicId,
                    vocabulary_id: vocabId
                }
            }
        });
    }
};
