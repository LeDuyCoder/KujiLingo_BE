import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { vocabulariesService } from "../../src/modules/vocabularies/vocabularies.service.js";
import { vocabulariesRepository } from "../../src/modules/vocabularies/vocabularies.repository.js";

test("Platform Vocabulary Service - Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
    });

    afterEach(() => {
        mock.restoreAll();
    });

    await t.test("list - returns items and pagination metadata", async () => {
        const userId = "user-id";
        const mockItems = [
            {
                id: "1",
                kanji: "食べる",
                hiragana: "たべる",
                romaji: "taberu",
                jlpt: "N5",
                frequency: 1,
                audio: "audio.mp3",
                image: "image.png",
                created_at: new Date(),
                vocabulary_meanings: [{ language: "vi", meaning: "ăn" }],
                favorite_vocabularies: [],
                folder_system_vocabularies: []
            }
        ];

        const findFilteredMock = mock.method(vocabulariesRepository, "findFiltered", async () => ({
            items: mockItems,
            total: 1
        }));

        const result = await vocabulariesService.list(userId, { page: 1, limit: 30 });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.length, 1);
        assert.strictEqual(result.data[0].word_jp, "食べる");
        assert.strictEqual(result.data[0].meaning_vi, "ăn");
        assert.strictEqual(result.data[0].is_favorited, false);
        assert.strictEqual(result.data[0].is_saved, false);
        assert.strictEqual(findFilteredMock.mock.callCount(), 1);
    });

    await t.test("getDetail - success and throws error when not found", async () => {
        const vocabId = "vocab-1";
        const mockItem = {
            id: vocabId,
            kanji: "飲む",
            hiragana: "のむ",
            romaji: "nomu",
            word_type: "verb",
            jlpt: "N5",
            frequency: 2,
            audio: "audio.mp3",
            image: "image.png",
            created_at: new Date(),
            example_sentences: [{ japanese: "お茶を飲む", translation: "uống trà" }],
            vocabulary_meanings: [{ language: "vi", meaning: "uống" }, { language: "en", meaning: "to drink" }],
            favorite_vocabularies: [{ user_id: "user-id" }],
            folder_system_vocabularies: [{ folder_id: "folder-1" }]
        };

        const findByIdMock = mock.method(vocabulariesRepository, "findById", async () => mockItem);

        const result = await vocabulariesService.getDetail(vocabId, "user-id");

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.word_jp, "飲む");
        assert.strictEqual(result.data.meaning_vi, "uống");
        assert.strictEqual(result.data.meaning_en, "to drink");
        assert.strictEqual(result.data.is_favorited, true);
        assert.strictEqual(result.data.is_saved, true);
        assert.deepStrictEqual(result.data.folder_ids, ["folder-1"]);
        assert.strictEqual(result.data.example_sentence_jp, "お茶を飲む");

        // Test not found
        mock.restoreAll();
        mock.method(vocabulariesRepository, "findById", async () => null);
        await assert.rejects(
            vocabulariesService.getDetail("vocab-2"),
            /VOCABULARY_NOT_FOUND/
        );
    });

    await t.test("create - success, duplicate conflict, and reference checks", async () => {
        const adminId = "admin-id";
        const dto = {
            word_jp: "勉強する",
            reading_hiragana: "べんきょうする",
            meaning_vi: "học",
            jlpt_level: "N4",
            lesson_id: "lesson-id"
        };
        const mockCreated = {
            id: "vocab-new",
            kanji: "勉強する",
            jlpt: "N4",
            created_at: new Date()
        };

        const findByWordAndLevelMock = mock.method(vocabulariesRepository, "findByWordAndLevel", async () => null);
        const checkLessonExistsMock = mock.method(vocabulariesRepository, "checkLessonExists", async () => true);
        const insertMock = mock.method(vocabulariesRepository, "insert", async () => mockCreated);

        const result = await vocabulariesService.create(adminId, dto);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.id, "vocab-new");
        assert.strictEqual(result.data.word_jp, "勉強する");
        assert.strictEqual(insertMock.mock.callCount(), 1);

        // Test duplicate
        mock.restoreAll();
        mock.method(vocabulariesRepository, "findByWordAndLevel", async () => ({ id: "existing" }));
        await assert.rejects(
            vocabulariesService.create(adminId, dto),
            /DUPLICATE_VOCABULARY/
        );

        // Test lesson reference invalid
        mock.restoreAll();
        mock.method(vocabulariesRepository, "findByWordAndLevel", async () => null);
        mock.method(vocabulariesRepository, "checkLessonExists", async () => false);
        await assert.rejects(
            vocabulariesService.create(adminId, dto),
            /INVALID_LESSON_REFERENCE/
        );
    });

    await t.test("update - success, validation and not found checks", async () => {
        const adminId = "admin-id";
        const vocabId = "vocab-1";
        const currentItem = { id: vocabId, kanji: "走る", jlpt: "N4" };

        const findByIdMock = mock.method(vocabulariesRepository, "findById", async () => currentItem);
        const updateMock = mock.method(vocabulariesRepository, "update", async () => ({ id: vocabId }));

        const result = await vocabulariesService.update(adminId, vocabId, { meaning_vi: "chạy bộ" });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.id, vocabId);
        assert.strictEqual(updateMock.mock.callCount(), 1);

        // Test empty body update
        await assert.rejects(
            vocabulariesService.update(adminId, vocabId, {}),
            /EMPTY_UPDATE/
        );

        // Test not found
        mock.restoreAll();
        mock.method(vocabulariesRepository, "findById", async () => null);
        await assert.rejects(
            vocabulariesService.update(adminId, vocabId, { meaning_vi: "chạy bộ" }),
            /VOCABULARY_NOT_FOUND/
        );
    });

    await t.test("delete - soft-deletes entry successfully", async () => {
        const adminId = "admin-id";
        const vocabId = "vocab-1";
        const currentItem = { id: vocabId, kanji: "走る", jlpt: "N4" };

        const findByIdMock = mock.method(vocabulariesRepository, "findById", async () => currentItem);
        const softDeleteMock = mock.method(vocabulariesRepository, "softDelete", async () => ({}));

        const result = await vocabulariesService.delete(adminId, vocabId);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, "Vocabulary deleted successfully.");
        assert.strictEqual(softDeleteMock.mock.callCount(), 1);

        // Test not found
        mock.restoreAll();
        mock.method(vocabulariesRepository, "findById", async () => null);
        await assert.rejects(
            vocabulariesService.delete(adminId, vocabId),
            /VOCABULARY_NOT_FOUND/
        );
    });
});
