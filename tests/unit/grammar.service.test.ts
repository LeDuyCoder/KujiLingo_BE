import { test, mock, beforeEach } from "node:test";
import assert from "node:assert";
import { grammarService } from "../../src/modules/grammar/grammar.service.js";
import { grammarRepository } from "../../src/modules/grammar/grammar.repository.js";

test("Grammar Service - Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
    });

    await t.test("listGrammarPoints - success and pagination meta", async () => {
        const mockItems = [
            {
                id: "g-1",
                title_jp: "〜ば〜ほど",
                structure: "Verb-ば + Verb-る-ほど",
                meaning_vi: "càng... càng...",
                jlpt_level: "N3",
            },
        ];

        mock.method(grammarRepository, "findFiltered", async () => ({
            items: mockItems as any,
            total: 1,
        }));

        const result = await grammarService.listGrammarPoints({ page: 1, limit: 30 });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.length, 1);
        assert.strictEqual(result.data[0].id, "g-1");
        assert.strictEqual(result.data[0].title_jp, "〜ば〜ほど");
        assert.strictEqual(result.meta.total, 1);
    });

    await t.test("getGrammarDetail - success", async () => {
        const mockItem = {
            id: "g-1",
            title_jp: "〜ば〜ほど",
            structure: "Verb-ば + Verb-る-ほど",
            meaning_vi: "càng... càng...",
            explanation: "Diễn tả mối quan hệ tỷ lệ thuận",
            jlpt_level: "N3",
            example_sentences: [{ jp: "Ex JP", vi: "Ex VI" }],
        };

        mock.method(grammarRepository, "findById", async () => mockItem as any);

        const result = await grammarService.getGrammarDetail("g-1");

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.id, "g-1");
        assert.strictEqual(result.data.explanation, "Diễn tả mối quan hệ tỷ lệ thuận");
        assert.strictEqual(result.data.example_sentences.length, 1);
    });

    await t.test("getGrammarDetail - throws 404 when not found", async () => {
        mock.method(grammarRepository, "findById", async () => null);

        await assert.rejects(
            grammarService.getGrammarDetail("non-existent-id"),
            (err: any) => err.code === "GRAMMAR_NOT_FOUND"
        );
    });

    await t.test("createGrammarPoint - success", async () => {
        mock.method(grammarRepository, "findDuplicate", async () => null);
        mock.method(grammarRepository, "create", async () => ({
            id: "g-new",
            title_jp: "〜てはいけない",
            jlpt_level: "N5",
            created_at: new Date(),
        }));

        const result = await grammarService.createGrammarPoint("admin-1", {
            title_jp: "〜てはいけない",
            structure: "Verb-て + はいけない",
            meaning_vi: "không được làm",
            jlpt_level: "N5",
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.id, "g-new");
    });

    await t.test("createGrammarPoint - throws 409 DUPLICATE_GRAMMAR", async () => {
        mock.method(grammarRepository, "findDuplicate", async () => ({ id: "g-exist" }));

        await assert.rejects(
            grammarService.createGrammarPoint("admin-1", {
                title_jp: "〜ば〜ほど",
                structure: "Verb-ば + Verb-る-ほど",
                meaning_vi: "càng... càng...",
                jlpt_level: "N3",
            }),
            (err: any) => err.code === "DUPLICATE_GRAMMAR"
        );
    });

    await t.test("updateGrammarPoint - throws 400 EMPTY_UPDATE", async () => {
        mock.method(grammarRepository, "findById", async () => ({ id: "g-1" }));

        await assert.rejects(
            grammarService.updateGrammarPoint("admin-1", "g-1", {}),
            (err: any) => err.code === "EMPTY_UPDATE"
        );
    });

    await t.test("deleteGrammarPoint - success", async () => {
        mock.method(grammarRepository, "findById", async () => ({ id: "g-1" }));
        const softDeleteMock = mock.method(grammarRepository, "softDelete", async () => ({}));

        const result = await grammarService.deleteGrammarPoint("admin-1", "g-1");

        assert.strictEqual(result.success, true);
        assert.strictEqual(softDeleteMock.mock.callCount(), 1);
    });
});
