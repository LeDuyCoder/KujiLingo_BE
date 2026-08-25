import { prisma } from "../../config/prisma.js";
import crypto from "crypto";

export const vocabulariesRepository = {
    async findFiltered(filters: {
        jlpt_level?: string;
        topic_id?: string;
        lesson_id?: string;
        search?: string;
    }, page: number = 1, limit: number = 30, userId?: string) {
        const skip = (page - 1) * limit;

        const where: any = {
            deleted_at: null
        };

        if (filters.jlpt_level) {
            where.jlpt = filters.jlpt_level as any;
        }

        if (filters.topic_id) {
            where.topic_vocabularies = {
                some: {
                    topic_id: filters.topic_id
                }
            };
        } else if (filters.lesson_id) {
            // Filter by lesson indirectly via topics
            where.topic_vocabularies = {
                some: {
                    topics: {
                        lesson_id: filters.lesson_id
                    }
                }
            };
        }

        if (filters.search) {
            where.OR = [
                { kanji: { contains: filters.search, mode: "insensitive" } },
                { hiragana: { contains: filters.search, mode: "insensitive" } },
                {
                    vocabulary_meanings: {
                        some: {
                            meaning: { contains: filters.search, mode: "insensitive" }
                        }
                    }
                }
            ];
        }

        const select: any = {
            id: true,
            kanji: true,
            hiragana: true,
            romaji: true,
            word_type: true,
            jlpt: true,
            frequency: true,
            audio: true,
            image: true,
            created_at: true,
            vocabulary_meanings: {
                select: {
                    language: true,
                    meaning: true
                }
            }
        };

        if (userId) {
            select.favorite_vocabularies = {
                where: { user_id: userId },
                select: { user_id: true }
            };
            select.folder_system_vocabularies = {
                where: { folders: { user_id: userId } },
                select: { folder_id: true }
            };
        }

        // Sorting: If search, rank exact matches or prefixes first.
        // In Prisma, we will order by frequency asc (nulls last) for default, 
        // and if search is present, we will do sorting after fetching or default to frequency/alphabetical.
        // Let's implement relevance sorting in memory after fetching because page limits are <= 100.
        // To be safe, fetch and apply.
        const [items, total] = await Promise.all([
            prisma.vocabularies.findMany({
                where,
                skip,
                take: limit,
                orderBy: filters.search ? { kanji: "asc" } : { frequency: "asc" },
                select
            }),
            prisma.vocabularies.count({ where })
        ]);

        return {
            items,
            total
        };
    },

    async findById(id: string, userId?: string) {
        const select: any = {
            id: true,
            kanji: true,
            hiragana: true,
            romaji: true,
            word_type: true,
            jlpt: true,
            frequency: true,
            audio: true,
            image: true,
            created_at: true,
            example_sentences: {
                select: {
                    japanese: true,
                    translation: true
                }
            },
            vocabulary_meanings: {
                select: {
                    language: true,
                    meaning: true
                }
            }
        };

        if (userId) {
            select.favorite_vocabularies = {
                where: { user_id: userId },
                select: { user_id: true }
            };
            select.folder_system_vocabularies = {
                where: { folders: { user_id: userId } },
                select: { folder_id: true }
            };
        }

        return prisma.vocabularies.findFirst({
            where: {
                id,
                deleted_at: null
            },
            select
        });
    },

    async findByWordAndLevel(kanji: string, jlpt: string) {
        return prisma.vocabularies.findFirst({
            where: {
                kanji,
                jlpt: jlpt as any,
                deleted_at: null
            }
        });
    },

    async checkLessonExists(lessonId: string) {
        const count = await prisma.lessons.count({
            where: { id: lessonId }
        });
        return count > 0;
    },

    async checkTopicExists(topicId: string) {
        const count = await prisma.topics.count({
            where: { id: topicId }
        });
        return count > 0;
    },

    async insert(data: {
        word_jp: string;
        reading_hiragana: string;
        reading_romaji?: string;
        meaning_vi: string;
        meaning_en?: string;
        part_of_speech?: string;
        jlpt_level: string;
        example_sentence_jp?: string;
        example_sentence_vi?: string;
        audio_url?: string;
        image_url?: string;
        lesson_id?: string;
        topic_id?: string;
        frequency_rank?: number;
    }, adminId: string) {
        const vocabularyId = crypto.randomUUID();

        return prisma.$transaction(async (tx) => {
            // 1. Create main vocabulary
            const vocab = await tx.vocabularies.create({
                data: {
                    id: vocabularyId,
                    kanji: data.word_jp,
                    hiragana: data.reading_hiragana,
                    romaji: data.reading_romaji || null,
                    word_type: data.part_of_speech as any || null,
                    jlpt: data.jlpt_level as any,
                    frequency: data.frequency_rank || null,
                    audio: data.audio_url || null,
                    image: data.image_url || null,
                    created_at: new Date()
                }
            });

            // 2. Create meanings
            await tx.vocabulary_meanings.create({
                data: {
                    id: crypto.randomUUID(),
                    vocabulary_id: vocabularyId,
                    language: "vi",
                    meaning: data.meaning_vi,
                    display_order: 1
                }
            });

            if (data.meaning_en) {
                await tx.vocabulary_meanings.create({
                    data: {
                        id: crypto.randomUUID(),
                        vocabulary_id: vocabularyId,
                        language: "en",
                        meaning: data.meaning_en,
                        display_order: 2
                    }
                });
            }

            // 3. Create example sentence if present
            if (data.example_sentence_jp || data.example_sentence_vi) {
                await tx.example_sentences.create({
                    data: {
                        id: crypto.randomUUID(),
                        vocabulary_id: vocabularyId,
                        japanese: data.example_sentence_jp || null,
                        translation: data.example_sentence_vi || null
                    }
                });
            }

            // 4. Link to topic if present
            if (data.topic_id) {
                await tx.topic_vocabularies.create({
                    data: {
                        topic_id: data.topic_id,
                        vocabulary_id: vocabularyId
                    }
                });
            } else if (data.lesson_id) {
                // If lesson_id is specified but no topic_id, find the first topic of this lesson
                const firstTopic = await tx.topics.findFirst({
                    where: { lesson_id: data.lesson_id },
                    orderBy: { order_no: "asc" }
                });
                if (firstTopic) {
                    await tx.topic_vocabularies.create({
                        data: {
                            topic_id: firstTopic.id,
                            vocabulary_id: vocabularyId
                        }
                    });
                }
            }

            // 5. Create audit log
            await tx.admin_audit_logs.create({
                data: {
                    id: crypto.randomUUID(),
                    admin_id: adminId,
                    action: "vocabulary.created",
                    entity_id: vocabularyId,
                    after_state: vocab as any,
                    created_at: new Date()
                }
            });

            return vocab;
        });
    },

    async update(id: string, data: {
        word_jp?: string;
        reading_hiragana?: string;
        reading_romaji?: string;
        meaning_vi?: string;
        meaning_en?: string;
        part_of_speech?: string;
        jlpt_level?: string;
        example_sentence_jp?: string;
        example_sentence_vi?: string;
        audio_url?: string;
        image_url?: string;
        lesson_id?: string;
        topic_id?: string;
        frequency_rank?: number;
    }, adminId: string, currentVocab: any) {
        return prisma.$transaction(async (tx) => {
            const updateData: any = {};
            if (data.word_jp !== undefined) updateData.kanji = data.word_jp;
            if (data.reading_hiragana !== undefined) updateData.hiragana = data.reading_hiragana;
            if (data.reading_romaji !== undefined) updateData.romaji = data.reading_romaji;
            if (data.part_of_speech !== undefined) updateData.word_type = data.part_of_speech as any;
            if (data.jlpt_level !== undefined) updateData.jlpt = data.jlpt_level as any;
            if (data.frequency_rank !== undefined) updateData.frequency = data.frequency_rank;
            if (data.audio_url !== undefined) updateData.audio = data.audio_url;
            if (data.image_url !== undefined) updateData.image = data.image_url;

            // 1. Update main vocabulary
            const updated = await tx.vocabularies.update({
                where: { id },
                data: updateData
            });

            // 2. Update meanings
            if (data.meaning_vi !== undefined) {
                await tx.vocabulary_meanings.deleteMany({
                    where: { vocabulary_id: id, language: "vi" }
                });
                await tx.vocabulary_meanings.create({
                    data: {
                        id: crypto.randomUUID(),
                        vocabulary_id: id,
                        language: "vi",
                        meaning: data.meaning_vi,
                        display_order: 1
                    }
                });
            }

            if (data.meaning_en !== undefined) {
                await tx.vocabulary_meanings.deleteMany({
                    where: { vocabulary_id: id, language: "en" }
                });
                if (data.meaning_en !== null && data.meaning_en !== "") {
                    await tx.vocabulary_meanings.create({
                        data: {
                            id: crypto.randomUUID(),
                            vocabulary_id: id,
                            language: "en",
                            meaning: data.meaning_en,
                            display_order: 2
                        }
                    });
                }
            }

            // 3. Update example sentence
            if (data.example_sentence_jp !== undefined || data.example_sentence_vi !== undefined) {
                // Fetch existing example sentence
                const existingSentence = await tx.example_sentences.findFirst({
                    where: { vocabulary_id: id }
                });

                const jp = data.example_sentence_jp !== undefined ? data.example_sentence_jp : (existingSentence?.japanese || null);
                const vi = data.example_sentence_vi !== undefined ? data.example_sentence_vi : (existingSentence?.translation || null);

                await tx.example_sentences.deleteMany({
                    where: { vocabulary_id: id }
                });

                if (jp || vi) {
                    await tx.example_sentences.create({
                        data: {
                            id: crypto.randomUUID(),
                            vocabulary_id: id,
                            japanese: jp,
                            translation: vi
                        }
                    });
                }
            }

            // 4. Update topic_vocabularies association
            if (data.topic_id !== undefined || data.lesson_id !== undefined) {
                await tx.topic_vocabularies.deleteMany({
                    where: { vocabulary_id: id }
                });

                if (data.topic_id) {
                    await tx.topic_vocabularies.create({
                        data: {
                            topic_id: data.topic_id,
                            vocabulary_id: id
                        }
                    });
                } else if (data.lesson_id) {
                    const firstTopic = await tx.topics.findFirst({
                        where: { lesson_id: data.lesson_id },
                        orderBy: { order_no: "asc" }
                    });
                    if (firstTopic) {
                        await tx.topic_vocabularies.create({
                            data: {
                                topic_id: firstTopic.id,
                                vocabulary_id: id
                            }
                        });
                    }
                }
            }

            // 5. Create audit log
            await tx.admin_audit_logs.create({
                data: {
                    id: crypto.randomUUID(),
                    admin_id: adminId,
                    action: "vocabulary.updated",
                    entity_id: id,
                    before_state: currentVocab as any,
                    after_state: updated as any,
                    created_at: new Date()
                }
            });

            return updated;
        });
    },

    async softDelete(id: string, adminId: string, currentVocab: any) {
        return prisma.$transaction(async (tx) => {
            const updated = await tx.vocabularies.update({
                where: { id },
                data: {
                    deleted_at: new Date()
                }
            });

            await tx.admin_audit_logs.create({
                data: {
                    id: crypto.randomUUID(),
                    admin_id: adminId,
                    action: "vocabulary.deleted",
                    entity_id: id,
                    before_state: currentVocab as any,
                    after_state: updated as any,
                    created_at: new Date()
                }
            });

            return updated;
        });
    }
};
