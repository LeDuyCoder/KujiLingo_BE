import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { topicsService } from "../../src/modules/topics/topics.service.js";
import { topicsRepository } from "../../src/modules/topics/topics.repository.js";
import { adminRepository } from "../../src/modules/admin/admin.repository.js";
import { memoryCache } from "../../src/common/utils/cache.js";

test("Topics Service - Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
        memoryCache.clear();
    });

    afterEach(() => {
        memoryCache.clear();
    });

    await t.test("getTopicDetail - returns unpersonalized detail and caches results", async () => {
        const mockTopic = {
            id: "topic-1",
            lesson_id: "lesson-1",
            title: "Greetings",
            description: "Say hello",
            image: "img.png"
        };
        const mockVocabularies = [
            { id: "vocab-1", kanji: "日", hiragana: "ひ", romaji: "hi", word_type: "NOUN", jlpt: "N5", frequency: 10 }
        ];
        const mockMeanings = [
            { id: "m1", vocabulary_id: "vocab-1", language: "vi", meaning: "ngày", display_order: 1 }
        ];
        const mockGrammar = [
            { id: "grammar-1", title_jp: "～てください", structure: "V-てください", meaning_vi: "hãy...", explanation: null, usage: null, jlpt_level: "N5" }
        ];

        const findTopicMock = mock.method(topicsRepository, "findById", async () => mockTopic);
        const findVocabMock = mock.method(topicsRepository, "findVocabulariesByTopicId", async () => mockVocabularies);
        const findMeaningsMock = mock.method(topicsRepository, "findMeaningsByVocabulariesAndLanguages", async () => mockMeanings);
        const findGrammarMock = mock.method(topicsRepository, "findGrammarPointsByTopicId", async () => mockGrammar);

        // 1st request (cache miss)
        const result1 = await topicsService.getTopicDetail("topic-1", null, "vi");
        assert.strictEqual(result1.success, true);
        assert.strictEqual(result1.data.id, "topic-1");
        assert.strictEqual(result1.data.vocabularies[0].meaning, "ngày");
        assert.strictEqual(result1.data.grammar_points[0].title_jp, "～てください");
        assert.strictEqual(findTopicMock.mock.callCount(), 1);

        // 2nd request (cache hit)
        const result2 = await topicsService.getTopicDetail("topic-1", null, "vi");
        assert.deepStrictEqual(result1, result2);
        assert.strictEqual(findTopicMock.mock.callCount(), 1); // should still be 1
    });

    await t.test("getTopicDetail - merges favorites and progress live for authenticated user", async () => {
        const mockTopic = { id: "topic-1", lesson_id: "lesson-1", title: "Greetings", description: null, image: null };
        const mockVocabularies = [
            { id: "vocab-1", kanji: "日", hiragana: "ひ", romaji: "hi", word_type: "NOUN", jlpt: "N5", frequency: 10 }
        ];
        const mockMeanings = [
            { id: "m1", vocabulary_id: "vocab-1", language: "vi", meaning: "ngày", display_order: 1 }
        ];

        mock.method(topicsRepository, "findById", async () => mockTopic);
        mock.method(topicsRepository, "findVocabulariesByTopicId", async () => mockVocabularies);
        mock.method(topicsRepository, "findMeaningsByVocabulariesAndLanguages", async () => mockMeanings);
        mock.method(topicsRepository, "findGrammarPointsByTopicId", async () => []);

        const favoritesMock = mock.method(topicsRepository, "findFavorites", async () => new Set(["vocab-1"]));
        const progressMock = mock.method(topicsRepository, "findLearningProgress", async () => [
            { vocabulary_id: "vocab-1", status: "LEARNING" }
        ]);

        const result = await topicsService.getTopicDetail("topic-1", "user-123", "vi");
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.vocabularies[0].is_favorited, true);
        assert.strictEqual(result.data.vocabularies[0].learning_status, "LEARNING");
        assert.strictEqual(favoritesMock.mock.callCount(), 1);
        assert.strictEqual(progressMock.mock.callCount(), 1);
    });

    await t.test("getTopicDetail - falls back to vi meaning when requested language is missing", async () => {
        const mockTopic = { id: "topic-1", lesson_id: "lesson-1", title: "Greetings", description: null, image: null };
        const mockVocabularies = [{ id: "vocab-1", kanji: "日", hiragana: "ひ", romaji: "hi", word_type: "NOUN", jlpt: "N5", frequency: 10 }];
        const mockMeanings = [
            { id: "m1", vocabulary_id: "vocab-1", language: "vi", meaning: "ngày", display_order: 1 }
        ];

        mock.method(topicsRepository, "findById", async () => mockTopic);
        mock.method(topicsRepository, "findVocabulariesByTopicId", async () => mockVocabularies);
        mock.method(topicsRepository, "findMeaningsByVocabulariesAndLanguages", async () => mockMeanings);
        mock.method(topicsRepository, "findGrammarPointsByTopicId", async () => []);

        const result = await topicsService.getTopicDetail("topic-1", null, "en"); // requested English but only Vietnamese exists
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.vocabularies[0].meaning, "ngày"); // fallback to vi
    });

    await t.test("createTopic - creates topic successfully and invalidates cache", async () => {
        const createdTopic = { id: "topic-created", lesson_id: "lesson-1", title: "New Topic", order_no: 3 };

        mock.method(topicsRepository, "checkLessonExists", async () => true);
        const insertMock = mock.method(topicsRepository, "createTopic", async () => createdTopic);
        mock.method(adminRepository, "createAuditLog", async () => ({}));
        const cacheDeleteMock = mock.method(memoryCache, "delete");

        const result = await topicsService.createTopic("admin-1", {
            lesson_id: "lesson-1",
            title: "New Topic",
            order_no: 3
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.id, "topic-created");
        assert.strictEqual(insertMock.mock.callCount(), 1);
        assert.strictEqual(cacheDeleteMock.mock.callCount(), 1);
        assert.strictEqual(cacheDeleteMock.mock.calls[0].arguments[0], "lessons:detail:lesson-1");
    });

    await t.test("updateTopic - throws EMPTY_UPDATE if no fields provided", async () => {
        await assert.rejects(
            topicsService.updateTopic("admin-1", "topic-1", {}),
            (err: any) => {
                assert.strictEqual(err.message, "EMPTY_UPDATE");
                return true;
            }
        );
    });

    await t.test("deleteTopic - deletes topic atomically in transaction", async () => {
        const oldTopic = { id: "topic-1", lesson_id: "lesson-1", title: "Topic 1" };

        mock.method(topicsRepository, "findById", async () => oldTopic);
        const deleteJoinsMock = mock.method(topicsRepository, "deleteTopicVocabulariesByTopicId", async () => ({}));
        const deleteTopicMock = mock.method(topicsRepository, "deleteTopic", async () => ({}));
        mock.method(adminRepository, "createAuditLog", async () => ({}));

        const result = await topicsService.deleteTopic("admin-1", "topic-1");

        assert.strictEqual(result.success, true);
        assert.strictEqual(deleteJoinsMock.mock.callCount(), 1);
        assert.strictEqual(deleteTopicMock.mock.callCount(), 1);
    });

    await t.test("addVocabulary - adds vocabulary item to topic", async () => {
        mock.method(topicsRepository, "findById", async () => ({ id: "topic-1" }));
        mock.method(topicsRepository, "checkVocabularyExists", async () => true);
        mock.method(topicsRepository, "checkTopicVocabularyExists", async () => false);
        const insertJoinMock = mock.method(topicsRepository, "insertTopicVocabulary", async () => ({}));

        const result = await topicsService.addVocabulary("admin-1", "topic-1", {
            vocabulary_id: "vocab-1"
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(insertJoinMock.mock.callCount(), 1);
    });

    await t.test("addVocabulary - throws VOCABULARY_ALREADY_IN_TOPIC if duplicate", async () => {
        mock.method(topicsRepository, "findById", async () => ({ id: "topic-1" }));
        mock.method(topicsRepository, "checkVocabularyExists", async () => true);
        mock.method(topicsRepository, "checkTopicVocabularyExists", async () => true); // already attached

        await assert.rejects(
            topicsService.addVocabulary("admin-1", "topic-1", { vocabulary_id: "vocab-1" }),
            (err: any) => {
                assert.strictEqual(err.message, "VOCABULARY_ALREADY_IN_TOPIC");
                return true;
            }
        );
    });

    await t.test("removeVocabulary - detach idempotent skip if missing", async () => {
        const deleteJoinMock = mock.method(topicsRepository, "deleteTopicVocabulary", async () => {
            throw new Error("Record to delete does not exist");
        });

        const result = await topicsService.removeVocabulary("admin-1", "topic-1", "vocab-1");
        assert.strictEqual(result.success, true); // should safely pass (idempotent unlink)
        assert.strictEqual(deleteJoinMock.mock.callCount(), 1);
    });
});
