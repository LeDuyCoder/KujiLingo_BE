import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { userVocabularyService } from "../../src/modules/user-vocabularies/user-vocabularies.service.js";
import { userVocabularyRepository } from "../../src/modules/user-vocabularies/user-vocabularies.repository.js";

test("User Vocabulary Service - Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
    });

    afterEach(() => {
        mock.restoreAll();
    });

    await t.test("list - returns items and pagination metadata", async () => {
        const userId = "test-user-id";
        const mockItems = [
            { id: "1", kanji: "日本語", hiragana: "にほんご", romaji: "nihongo", meaning: "Japanese", note: "Note", created_at: new Date() }
        ];

        const findByUserMock = mock.method(userVocabularyRepository, "findByUser", async () => ({
            items: mockItems,
            total: 1
        }));

        const result = await userVocabularyService.list(userId, { search: "test", page: 1, limit: 30 });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.length, 1);
        assert.deepStrictEqual(result.data, mockItems);
        assert.deepStrictEqual(result.meta, {
            page: 1,
            limit: 30,
            total: 1,
            total_pages: 1
        });
        assert.strictEqual(findByUserMock.mock.callCount(), 1);
        assert.deepStrictEqual(findByUserMock.mock.calls[0].arguments, [userId, "test", 1, 30]);
    });

    await t.test("create - inserts entry and returns success message", async () => {
        const userId = "test-user-id";
        const dto = {
            kanji: "日本語",
            meaning: "Japanese"
        };
        const mockCreated = {
            id: "new-vocab-id",
            user_id: userId,
            kanji: "日本語",
            hiragana: null,
            romaji: null,
            meaning: "Japanese",
            note: null,
            image: null,
            audio: null,
            created_at: new Date()
        };

        const insertMock = mock.method(userVocabularyRepository, "insert", async () => mockCreated);

        const result = await userVocabularyService.create(userId, dto);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.id, "new-vocab-id");
        assert.strictEqual(result.data.kanji, "日本語");
        assert.strictEqual(result.data.meaning, "Japanese");
        assert.strictEqual(result.message, "Word added successfully.");
        assert.strictEqual(insertMock.mock.callCount(), 1);
        assert.deepStrictEqual(insertMock.mock.calls[0].arguments, [userId, dto]);
    });

    await t.test("update - updates owned entry successfully", async () => {
        const userId = "test-user-id";
        const vocabId = "vocab-id";
        const dto = {
            meaning: "Updated Meaning"
        };
        const mockExisting = { id: vocabId, user_id: userId, kanji: "日本語", meaning: "Japanese" };
        const mockUpdated = { id: vocabId, user_id: userId, kanji: "日本語", meaning: "Updated Meaning" };

        const findByIdAndUserMock = mock.method(userVocabularyRepository, "findByIdAndUser", async () => mockExisting);
        const updateMock = mock.method(userVocabularyRepository, "update", async () => mockUpdated);

        const result = await userVocabularyService.update(userId, vocabId, dto);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.id, vocabId);
        assert.strictEqual(result.data.meaning, "Updated Meaning");
        assert.strictEqual(result.message, "Word updated successfully.");
        assert.strictEqual(findByIdAndUserMock.mock.callCount(), 1);
        assert.strictEqual(updateMock.mock.callCount(), 1);
    });

    await t.test("update - throws error when entry is not found/owned", async () => {
        const userId = "test-user-id";
        const vocabId = "vocab-id";

        mock.method(userVocabularyRepository, "findByIdAndUser", async () => null);

        await assert.rejects(
            userVocabularyService.update(userId, vocabId, { meaning: "hi" }),
            /USER_VOCABULARY_NOT_FOUND/
        );
    });

    await t.test("update - throws error when body is empty", async () => {
        const userId = "test-user-id";
        const vocabId = "vocab-id";
        const mockExisting = { id: vocabId, user_id: userId, kanji: "日本語", meaning: "Japanese" };

        mock.method(userVocabularyRepository, "findByIdAndUser", async () => mockExisting);

        await assert.rejects(
            userVocabularyService.update(userId, vocabId, {}),
            /EMPTY_UPDATE/
        );
    });

    await t.test("delete - deletes owned entry successfully", async () => {
        const userId = "test-user-id";
        const vocabId = "vocab-id";
        const mockExisting = { id: vocabId, user_id: userId, kanji: "日本語", meaning: "Japanese" };

        const findByIdAndUserMock = mock.method(userVocabularyRepository, "findByIdAndUser", async () => mockExisting);
        const deleteMock = mock.method(userVocabularyRepository, "delete", async () => mockExisting);

        const result = await userVocabularyService.delete(userId, vocabId);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, "Word deleted successfully.");
        assert.strictEqual(findByIdAndUserMock.mock.callCount(), 1);
        assert.strictEqual(deleteMock.mock.callCount(), 1);
    });

    await t.test("delete - throws error when entry is not found/owned", async () => {
        const userId = "test-user-id";
        const vocabId = "vocab-id";

        mock.method(userVocabularyRepository, "findByIdAndUser", async () => null);

        await assert.rejects(
            userVocabularyService.delete(userId, vocabId),
            /USER_VOCABULARY_NOT_FOUND/
        );
    });
});
