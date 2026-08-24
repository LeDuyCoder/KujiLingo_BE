import { db } from "../../config/prisma.js";
import { topicsRepository } from "./topics.repository.js";
import { adminRepository } from "../admin/admin.repository.js";
import { memoryCache } from "../../common/utils/cache.js";
import type { CreateTopicBody, UpdateTopicBody, AddVocabularyBody } from "./topics.types.js";

export const topicsService = {
    /**
     * Get details of a topic. Personalization layer merged live.
     */
    async getTopicDetail(topicId: string, userId: string | null, language: string) {
        const cacheKey = `topics:detail:${topicId}:${language}`;
        let cached = memoryCache.get(cacheKey);

        if (!cached) {
            const topic = await topicsRepository.findById(topicId);
            if (!topic) {
                throw new Error("TOPIC_NOT_FOUND");
            }

            const vocabularies = await topicsRepository.findVocabulariesByTopicId(topicId);
            const vocabIds = vocabularies.map(v => v.id);

            // Fetch primary meanings
            const langQuery = [language];
            if (language !== "vi") {
                langQuery.push("vi");
            }
            const meanings = await topicsRepository.findMeaningsByVocabulariesAndLanguages(vocabIds, langQuery);

            const meaningsMap = new Map<string, any[]>();
            meanings.forEach(m => {
                if (m.vocabulary_id) {
                    const list = meaningsMap.get(m.vocabulary_id) || [];
                    list.push(m);
                    meaningsMap.set(m.vocabulary_id, list);
                }
            });

            const vocabList = vocabularies.map(v => {
                const list = meaningsMap.get(v.id) || [];
                // Sort to ensure we prioritize lower display_order ASC
                list.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

                let chosen = list.find(m => m.language === language);
                if (!chosen && language !== "vi") {
                    chosen = list.find(m => m.language === "vi");
                }

                return {
                    id: v.id,
                    kanji: v.kanji,
                    hiragana: v.hiragana,
                    romaji: v.romaji,
                    word_type: v.word_type,
                    jlpt: v.jlpt,
                    meaning: chosen ? chosen.meaning : null
                };
            });

            cached = {
                id: topic.id,
                lesson_id: topic.lesson_id,
                title: topic.title,
                description: topic.description,
                image: topic.image,
                vocabularies: vocabList
            };

            memoryCache.set(cacheKey, cached, 3600); // 1 hour TTL
        }

        // Live Personalization
        if (userId) {
            const vocabIds = cached.vocabularies.map((v: any) => v.id);
            const [favoritesSet, progressList] = await Promise.all([
                topicsRepository.findFavorites(userId, vocabIds),
                topicsRepository.findLearningProgress(userId, vocabIds)
            ]);

            const progressMap = new Map<string, string>();
            progressList.forEach(p => {
                if (p.vocabulary_id && p.status) {
                    progressMap.set(p.vocabulary_id, p.status);
                }
            });

            const personalizedVocabs = cached.vocabularies.map((v: any) => ({
                ...v,
                is_favorited: favoritesSet.has(v.id),
                learning_status: progressMap.get(v.id) || "NEW"
            }));

            return {
                success: true,
                data: {
                    ...cached,
                    vocabularies: personalizedVocabs
                }
            };
        }

        // Default Guest flags
        const guestVocabs = cached.vocabularies.map((v: any) => ({
            ...v,
            is_favorited: false,
            learning_status: "NEW"
        }));

        return {
            success: true,
            data: {
                ...cached,
                vocabularies: guestVocabs
            }
        };
    },

    /**
     * Create a new topic under a lesson
     */
    async createTopic(adminId: string, data: CreateTopicBody) {
        const newTopic = await db.prisma.$transaction(async (tx) => {
            const lessonExists = await topicsRepository.checkLessonExists(data.lesson_id, tx);
            if (!lessonExists) {
                throw new Error("INVALID_LESSON_REFERENCE");
            }

            const insertParams: { lesson_id: string; title: string; description?: string; image?: string; order_no?: number } = {
                lesson_id: data.lesson_id,
                title: data.title
            };
            if (data.description !== undefined) insertParams.description = data.description;
            if (data.image !== undefined) insertParams.image = data.image;
            if (data.order_no !== undefined) insertParams.order_no = data.order_no;

            const topic = await topicsRepository.createTopic(tx, insertParams);

            await adminRepository.createAuditLog(tx, {
                adminId,
                action: "topic.created",
                entityId: topic.id,
                afterState: topic
            });

            return topic;
        });

        // Invalidate parent lesson detail cache
        memoryCache.delete(`lessons:detail:${data.lesson_id}`);

        return {
            success: true,
            data: {
                id: newTopic.id,
                lesson_id: newTopic.lesson_id,
                title: newTopic.title,
                order_no: newTopic.order_no
            },
            message: "Topic created successfully."
        };
    },

    /**
     * Update an existing topic
     */
    async updateTopic(adminId: string, id: string, data: UpdateTopicBody) {
        const updateParams: { lesson_id?: string; title?: string; description?: string; image?: string; order_no?: number } = {};
        let hasFields = false;

        if (data.lesson_id !== undefined) {
            updateParams.lesson_id = data.lesson_id;
            hasFields = true;
        }
        if (data.title !== undefined) {
            updateParams.title = data.title;
            hasFields = true;
        }
        if (data.description !== undefined) {
            updateParams.description = data.description;
            hasFields = true;
        }
        if (data.image !== undefined) {
            updateParams.image = data.image;
            hasFields = true;
        }
        if (data.order_no !== undefined) {
            updateParams.order_no = data.order_no;
            hasFields = true;
        }

        if (!hasFields) {
            throw new Error("EMPTY_UPDATE");
        }

        const result = await db.prisma.$transaction(async (tx) => {
            const oldTopic = await topicsRepository.findById(id, tx);
            if (!oldTopic) {
                throw new Error("TOPIC_NOT_FOUND");
            }

            if (updateParams.lesson_id !== undefined && updateParams.lesson_id !== oldTopic.lesson_id) {
                const lessonExists = await topicsRepository.checkLessonExists(updateParams.lesson_id, tx);
                if (!lessonExists) {
                    throw new Error("INVALID_LESSON_REFERENCE");
                }
            }

            const updated = await topicsRepository.updateTopic(tx, id, updateParams);

            await adminRepository.createAuditLog(tx, {
                adminId,
                action: "topic.updated",
                entityId: id,
                beforeState: oldTopic,
                afterState: updateParams
            });

            return {
                updated,
                oldLessonId: oldTopic.lesson_id
            };
        });

        // Invalidate caches
        memoryCache.deletePattern(`topics:detail:${id}:*`);
        if (result.oldLessonId) {
            memoryCache.delete(`lessons:detail:${result.oldLessonId}`);
        }
        if (updateParams.lesson_id && updateParams.lesson_id !== result.oldLessonId) {
            memoryCache.delete(`lessons:detail:${updateParams.lesson_id}`);
        }

        return {
            success: true,
            data: {
                id,
                title: result.updated.title
            },
            message: "Topic updated successfully."
        };
    },

    /**
     * Atomic delete of a topic and its join associations
     */
    async deleteTopic(adminId: string, id: string) {
        const result = await db.prisma.$transaction(async (tx) => {
            const oldTopic = await topicsRepository.findById(id, tx);
            if (!oldTopic) {
                throw new Error("TOPIC_NOT_FOUND");
            }

            await topicsRepository.deleteTopicVocabulariesByTopicId(tx, id);
            await topicsRepository.deleteTopic(tx, id);

            await adminRepository.createAuditLog(tx, {
                adminId,
                action: "topic.deleted",
                entityId: id,
                beforeState: oldTopic
            });

            return oldTopic;
        });

        // Invalidate caches
        memoryCache.deletePattern(`topics:detail:${id}:*`);
        if (result.lesson_id) {
            memoryCache.delete(`lessons:detail:${result.lesson_id}`);
        }

        return {
            success: true,
            message: "Topic deleted successfully."
        };
    },

    /**
     * Attach a vocabulary item to a topic
     */
    async addVocabulary(adminId: string, topicId: string, data: AddVocabularyBody) {
        await db.prisma.$transaction(async (tx) => {
            const topicExists = await topicsRepository.findById(topicId, tx);
            if (!topicExists) {
                throw new Error("TOPIC_NOT_FOUND");
            }

            const vocabExists = await topicsRepository.checkVocabularyExists(data.vocabulary_id, tx);
            if (!vocabExists) {
                throw new Error("INVALID_VOCABULARY_REFERENCE");
            }

            const alreadyAttached = await topicsRepository.checkTopicVocabularyExists(topicId, data.vocabulary_id, tx);
            if (alreadyAttached) {
                throw new Error("VOCABULARY_ALREADY_IN_TOPIC");
            }

            await topicsRepository.insertTopicVocabulary(tx, topicId, data.vocabulary_id);
        });

        // Invalidate detail cache
        memoryCache.deletePattern(`topics:detail:${topicId}:*`);

        return {
            success: true,
            message: "Vocabulary added to topic."
        };
    },

    /**
     * Idempotent removal of a vocabulary item from a topic
     */
    async removeVocabulary(adminId: string, topicId: string, vocabularyId: string) {
        await db.prisma.$transaction(async (tx) => {
            try {
                await topicsRepository.deleteTopicVocabulary(tx, topicId, vocabularyId);
            } catch (e) {
                // Idempotent unlink safely skips missing records
            }
        });

        // Invalidate cache
        memoryCache.deletePattern(`topics:detail:${topicId}:*`);

        return {
            success: true,
            message: "Vocabulary removed from topic."
        };
    }
};
