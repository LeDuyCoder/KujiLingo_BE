import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { srsService } from "../../src/modules/srs/srs.service.js";
import { srsRepository } from "../../src/modules/srs/srs.repository.js";

test("SRS Service - Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
    });

    afterEach(() => {
    });

    await t.test("getDueCards - sorts by due_at and state priority, caps new cards at 10", async () => {
        const now = new Date();
        const past = new Date(now.getTime() - 5000); // 5 seconds ago

        const mockCards: any[] = [];
        
        // 1. A card that is very overdue
        mockCards.push({ id: "card-old", state: "new", due_at: new Date(now.getTime() - 100000), item_type: "vocabulary", item_id: "v-old" });

        // 2. Cards due at the exact same time but with different states
        mockCards.push({ id: "card-new", state: "new", due_at: past, item_type: "vocabulary", item_id: "v-new" });
        mockCards.push({ id: "card-review", state: "review", due_at: past, item_type: "kanji", item_id: "k-rev" });
        mockCards.push({ id: "card-learning", state: "learning", due_at: past, item_type: "grammar", item_id: "g-learn" });
        mockCards.push({ id: "card-relearning", state: "relearning", due_at: past, item_type: "vocabulary", item_id: "v-relearn" });

        // 3. Add 12 more new cards to test the 10-card cap
        for (let i = 0; i < 12; i++) {
            mockCards.push({ id: `card-new-${i}`, state: "new", due_at: now, item_type: "vocabulary", item_id: `v-n-${i}` });
        }

        mock.method(srsRepository, "findDueCards", async () => mockCards);
        
        // Mock contents
        mock.method(srsRepository, "resolveVocabulariesContent", async (ids: string[]) => ids.map(id => ({ id, kanji: id, hiragana: id, vocabulary_meanings: [] })));
        mock.method(srsRepository, "resolveKanjisContent", async (ids: string[]) => ids.map(id => ({ id, kanji: id })));
        mock.method(srsRepository, "resolveGrammarContent", async (ids: string[]) => ids.map(id => ({ id, title_jp: id })));

        const result = await srsService.getDueCards("user-1", { limit: 50 });

        assert.strictEqual(result.success, true);
        const data = result.data;
        
        // Oldest card should be first despite being "new"
        assert.strictEqual(data[0].card_id, "card-old");

        // Next 4 cards share the same due time, should be sorted by priority: relearning > learning > review > new
        assert.strictEqual(data[1].card_id, "card-relearning");
        assert.strictEqual(data[2].card_id, "card-learning");
        assert.strictEqual(data[3].card_id, "card-review");
        assert.strictEqual(data[4].card_id, "card-new");

        // Total new cards in result should be EXACTLY 10
        const newCardsCount = data.filter(c => c.state === "new").length;
        assert.strictEqual(newCardsCount, 10);
    });

    await t.test("getDueCards - skips soft-deleted (orphaned) content", async () => {
        const now = new Date();
        mock.method(srsRepository, "findDueCards", async () => [
            { id: "c1", state: "review", due_at: now, item_type: "kanji", item_id: "k-deleted" },
            { id: "c2", state: "review", due_at: now, item_type: "kanji", item_id: "k-active" }
        ]);

        mock.method(srsRepository, "resolveVocabulariesContent", async () => []);
        mock.method(srsRepository, "resolveGrammarContent", async () => []);
        // Only resolve one kanji, simulating that "k-deleted" wasn't found (deleted_at IS NOT NULL)
        mock.method(srsRepository, "resolveKanjisContent", async () => [{ id: "k-active", kanji: "日" }]);

        const result = await srsService.getDueCards("user-1", {});
        assert.strictEqual(result.data.length, 1);
        assert.strictEqual(result.data[0].item_id, "k-active");
    });

    await t.test("submitReview - again rating resets repetitions and interval", async () => {
        mock.method(srsRepository, "findCardByIdAndUser", async () => ({
            id: "c1", repetitions: 3, interval_days: 10, ease_factor: 2.5, state: "review"
        }));
        const updateMock = mock.method(srsRepository, "updateCard", async () => ({}));
        mock.method(srsRepository, "insertReviewHistory", async () => ({}));
        mock.method(srsRepository, "upsertDailyStatistics", async () => ({}));

        const result = await srsService.submitReview("u1", "c1", "again");
        assert.strictEqual(result.data.new_state, "relearning");
        assert.strictEqual(result.data.new_interval_days, 1);
        assert.strictEqual(result.data.repetitions, 0);
        
        // Ease drops by 0.2 (2.5 -> 2.3)
        const updateArgs = updateMock.mock.calls[0].arguments[2];
        assert.strictEqual(updateArgs.ease_factor, 2.3);
    });

    await t.test("submitReview - hard rating increments interval by min 1.2x and drops ease", async () => {
        mock.method(srsRepository, "findCardByIdAndUser", async () => ({
            id: "c1", repetitions: 3, interval_days: 10, ease_factor: 2.5, state: "review"
        }));
        const updateMock = mock.method(srsRepository, "updateCard", async () => ({}));
        mock.method(srsRepository, "insertReviewHistory", async () => ({}));
        mock.method(srsRepository, "upsertDailyStatistics", async () => ({}));

        const result = await srsService.submitReview("u1", "c1", "hard");
        assert.strictEqual(result.data.new_state, "review");
        assert.strictEqual(result.data.new_interval_days, 12); // 10 * 1.2 = 12
        assert.strictEqual(result.data.repetitions, 4);
        
        // Ease drops by 0.15 (2.5 -> 2.35)
        const updateArgs = updateMock.mock.calls[0].arguments[2];
        assert.strictEqual(updateArgs.ease_factor, 2.35);
    });

    await t.test("submitReview - good rating computes SM-2 progression", async () => {
        mock.method(srsRepository, "findCardByIdAndUser", async () => ({
            id: "c1", repetitions: 2, interval_days: 6, ease_factor: 2.5, state: "review"
        }));
        const updateMock = mock.method(srsRepository, "updateCard", async () => ({}));
        mock.method(srsRepository, "insertReviewHistory", async () => ({}));
        mock.method(srsRepository, "upsertDailyStatistics", async () => ({}));

        const result = await srsService.submitReview("u1", "c1", "good");
        assert.strictEqual(result.data.new_state, "review");
        // interval = 6 * 2.5 = 15
        assert.strictEqual(result.data.new_interval_days, 15);
        assert.strictEqual(result.data.repetitions, 3);
        
        const updateArgs = updateMock.mock.calls[0].arguments[2];
        assert.strictEqual(updateArgs.ease_factor, 2.5); // Ease remains unchanged
    });

    await t.test("submitReview - easy rating adds 1.3x bonus and increases ease", async () => {
        mock.method(srsRepository, "findCardByIdAndUser", async () => ({
            id: "c1", repetitions: 2, interval_days: 6, ease_factor: 2.5, state: "review"
        }));
        const updateMock = mock.method(srsRepository, "updateCard", async () => ({}));
        mock.method(srsRepository, "insertReviewHistory", async () => ({}));
        mock.method(srsRepository, "upsertDailyStatistics", async () => ({}));

        const result = await srsService.submitReview("u1", "c1", "easy");
        assert.strictEqual(result.data.new_state, "review");
        // interval = round(6 * 2.5 * 1.3) = round(19.5) = 20
        assert.strictEqual(result.data.new_interval_days, 20);
        assert.strictEqual(result.data.repetitions, 3);
        
        // Ease increases by 0.15
        const updateArgs = updateMock.mock.calls[0].arguments[2];
        assert.strictEqual(updateArgs.ease_factor, 2.65);
    });

    await t.test("addItem - inserts valid item into queue", async () => {
        mock.method(srsRepository, "checkKanjiExists", async () => true);
        mock.method(srsRepository, "findCardByUserAndItem", async () => null);
        const insertMock = mock.method(srsRepository, "insertCard", async () => ({ id: "c1", item_type: "kanji", item_id: "k1", state: "new" }));

        const result = await srsService.addItem("u1", "kanji", "k1");
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.state, "new");
        assert.strictEqual(insertMock.mock.callCount(), 1);
    });

    await t.test("addItem - throws ITEM_ALREADY_IN_SRS if duplicated", async () => {
        mock.method(srsRepository, "checkKanjiExists", async () => true);
        mock.method(srsRepository, "findCardByUserAndItem", async () => ({ id: "c1" }));

        await assert.rejects(
            srsService.addItem("u1", "kanji", "k1"),
            (err: any) => {
                assert.strictEqual(err.message, "ITEM_ALREADY_IN_SRS");
                return true;
            }
        );
    });

    await t.test("addItem - throws INVALID_ITEM_REFERENCE if content missing", async () => {
        mock.method(srsRepository, "checkVocabularyExists", async () => false);

        await assert.rejects(
            srsService.addItem("u1", "vocabulary", "v1"),
            (err: any) => {
                assert.strictEqual(err.message, "INVALID_ITEM_REFERENCE");
                return true;
            }
        );
    });
});
