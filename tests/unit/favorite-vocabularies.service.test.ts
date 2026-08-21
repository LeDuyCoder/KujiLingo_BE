import { test, mock, beforeEach } from "node:test";
import assert from "node:assert";
import { favoriteVocabulariesService } from "../../src/modules/favorite-vocabularies/favorite-vocabularies.service.js";
import { favoriteVocabulariesRepository } from "../../src/modules/favorite-vocabularies/favorite-vocabularies.repository.js";

test("Favorite Vocabularies Service - Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
    });

    await t.test("listFavorites - success and mapping DTO", async () => {
        const mockFavorites = [
            {
                user_id: "user-1",
                vocabulary_id: "vocab-1",
                vocabularies: {
                    id: "vocab-1",
                    kanji: "食べる",
                    hiragana: "たべる",
                    jlpt: "N5",
                    vocabulary_meanings: [{ meaning: "ăn" }],
                },
            },
        ];

        mock.method(favoriteVocabulariesRepository, "findByUser", async () => ({
            favorites: mockFavorites as any,
            total: 1,
        }));

        const result = await favoriteVocabulariesService.listFavorites("user-1", "vi", 1, 30);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.length, 1);
        assert.strictEqual(result.data[0].vocabulary_id, "vocab-1");
        assert.strictEqual(result.data[0].kanji, "食べる");
        assert.strictEqual(result.data[0].meaning, "ăn");
        assert.strictEqual(result.meta.total, 1);
        assert.strictEqual(result.meta.total_pages, 1);
    });

    await t.test("addFavorite - success", async () => {
        mock.method(favoriteVocabulariesRepository, "existsVocabulary", async () => true);
        mock.method(favoriteVocabulariesRepository, "addFavorite", async () => ({
            user_id: "user-1",
            vocabulary_id: "vocab-1",
        }));

        const result = await favoriteVocabulariesService.addFavorite("user-1", "vocab-1");

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, "Added to favorites.");
    });

    await t.test("addFavorite - throws INVALID_VOCABULARY_REFERENCE when vocab does not exist", async () => {
        mock.method(favoriteVocabulariesRepository, "existsVocabulary", async () => false);

        await assert.rejects(
            favoriteVocabulariesService.addFavorite("user-1", "invalid-vocab-id"),
            /INVALID_VOCABULARY_REFERENCE/
        );
    });

    await t.test("addFavorite - throws ALREADY_FAVORITED on unique constraint violation (P2002)", async () => {
        mock.method(favoriteVocabulariesRepository, "existsVocabulary", async () => true);
        mock.method(favoriteVocabulariesRepository, "addFavorite", async () => {
            const err: any = new Error("Unique constraint failed");
            err.code = "P2002";
            throw err;
        });

        await assert.rejects(
            favoriteVocabulariesService.addFavorite("user-1", "vocab-1"),
            /ALREADY_FAVORITED/
        );
    });

    await t.test("removeFavorite - success", async () => {
        const removeMock = mock.method(favoriteVocabulariesRepository, "removeFavorite", async () => ({ count: 1 }));

        const result = await favoriteVocabulariesService.removeFavorite("user-1", "vocab-1");

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, "Removed from favorites.");
        assert.strictEqual(removeMock.mock.callCount(), 1);
    });
});
