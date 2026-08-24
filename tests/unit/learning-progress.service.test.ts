import { test, mock, beforeEach } from "node:test";
import assert from "node:assert";
import { learningProgressService } from "../../src/modules/learning-progress/learning-progress.service.js";
import { learningProgressRepository } from "../../src/modules/learning-progress/learning-progress.repository.js";

test("Learning Progress Service - Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
    });

    await t.test("getOverview - aggregates data and total platform count correctly", async () => {
        const mockProgressItems = [
            { status: "LEARNING", vocabularies: { jlpt: "N5" } },
            { status: "REVIEWING", vocabularies: { jlpt: "N4" } },
            { status: "REVIEWING", vocabularies: { jlpt: "N5" } },
            { status: "MASTERED", vocabularies: { jlpt: "N3" } },
            { status: "NEW", vocabularies: { jlpt: "N2" } }
        ];

        mock.method(learningProgressRepository, "getOverviewData", async () => mockProgressItems);
        mock.method(learningProgressRepository, "countPlatformVocabularies", async () => 1500);

        const result = await learningProgressService.getOverview("user-123");

        assert.strictEqual(result.success, true);
        assert.deepStrictEqual(result.data.by_status, { NEW: 1, LEARNING: 1, REVIEWING: 2, MASTERED: 1 });
        assert.deepStrictEqual(result.data.by_jlpt, { N5: 2, N4: 1, N3: 1, N2: 1, N1: 0 });
        assert.strictEqual(result.data.total_started, 5);
        assert.strictEqual(result.data.total_mastered, 1);
        assert.strictEqual(result.data.platform_total_vocabulary, 1500);
    });

    await t.test("getDueQueue - sorts due items correctly (LEARNING > REVIEWING > NEW > MASTERED, then oldest review date first)", async () => {
        const now = new Date();
        const mockDueItems = [
            {
                id: "lp-1",
                vocabulary_id: "v-1",
                status: "REVIEWING",
                mastery: 0.6,
                correct_count: 3,
                wrong_count: 1,
                next_review: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours overdue
                vocabularies: {
                    kanji: "水",
                    hiragana: "mizu",
                    jlpt: "N5",
                    vocabulary_meanings: [
                        { language: "vi", meaning: "nước", display_order: 1 },
                        { language: "en", meaning: "water", display_order: 2 }
                    ]
                }
            },
            {
                id: "lp-2",
                vocabulary_id: "v-2",
                status: "LEARNING",
                mastery: 0.2,
                correct_count: 1,
                wrong_count: 0,
                next_review: new Date(now.getTime() - 1000), // just now
                vocabularies: {
                    kanji: "火",
                    hiragana: "hi",
                    jlpt: "N5",
                    vocabulary_meanings: [
                        { language: "en", meaning: "fire", display_order: 1 }
                    ]
                }
            },
            {
                id: "lp-3",
                vocabulary_id: "v-3",
                status: "LEARNING",
                mastery: 0.2,
                correct_count: 1,
                wrong_count: 0,
                next_review: new Date(now.getTime() - 5 * 60 * 60 * 1000), // 5 hours overdue (older than lp-2)
                vocabularies: {
                    kanji: "木",
                    hiragana: "ki",
                    jlpt: "N5",
                    vocabulary_meanings: []
                }
            },
            {
                id: "lp-4",
                vocabulary_id: "v-4",
                status: "MASTERED",
                mastery: 0.9,
                correct_count: 10,
                wrong_count: 0,
                next_review: new Date(now.getTime() - 10 * 60 * 1000),
                vocabularies: {
                    kanji: "金",
                    hiragana: "kane",
                    jlpt: "N4",
                    vocabulary_meanings: [
                        { language: "vi", meaning: "tiền", display_order: 1 }
                    ]
                }
            }
        ];

        mock.method(learningProgressRepository, "findDue", async () => mockDueItems);
        mock.method(learningProgressRepository, "countDue", async () => 4);

        const result = await learningProgressService.getDueQueue("user-123", { limit: 10 }, "vi");

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.meta.total_due, 4);
        assert.strictEqual(result.data.length, 4);

        // Sorting check:
        // Position 0: lp-3 (LEARNING, 5 hours overdue)
        // Position 1: lp-2 (LEARNING, just now)
        // Position 2: lp-1 (REVIEWING)
        // Position 3: lp-4 (MASTERED)
        assert.strictEqual(result.data[0].progress_id, "lp-3");
        assert.strictEqual(result.data[0].meaning, null); // no meanings at all
        
        assert.strictEqual(result.data[1].progress_id, "lp-2");
        assert.strictEqual(result.data[1].meaning, "fire"); // fallback to first meaning since no vi is available

        assert.strictEqual(result.data[2].progress_id, "lp-1");
        assert.strictEqual(result.data[2].meaning, "nước"); // matched lang="vi"

        assert.strictEqual(result.data[3].progress_id, "lp-4");
    });

    await t.test("submitReview - throws error if vocabulary does not exist", async () => {
        mock.method(learningProgressRepository, "checkVocabularyExists", async () => false);

        await assert.rejects(
            learningProgressService.submitReview("user-123", { vocabulary_id: "non-existent", correct: true }),
            (err: any) => {
                assert.strictEqual(err.message, "INVALID_VOCABULARY_REFERENCE");
                return true;
            }
        );
    });

    await t.test("submitReview - correct review on NEW progress seeds row and sets LEARNING status", async () => {
        mock.method(learningProgressRepository, "checkVocabularyExists", async () => true);
        mock.method(learningProgressRepository, "findProgress", async () => null); // mock NEW
        
        const saveMock = mock.method(learningProgressRepository, "saveReviewResult", async (userId: string, vocabId: string, progressData: any) => {
            return {
                vocabulary_id: vocabId,
                status: progressData.status,
                mastery: progressData.mastery,
                next_review: progressData.next_review
            };
        });

        const result = await learningProgressService.submitReview("user-123", { vocabulary_id: "vocab-id", correct: true, duration: 5 });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.new_status, "LEARNING");
        assert.strictEqual(result.data.new_mastery, 0.15); // 0.0 + 0.15
        assert.strictEqual(saveMock.mock.callCount(), 1);

        const callArgs = saveMock.mock.calls[0].arguments;
        assert.strictEqual(callArgs[0], "user-123");
        assert.strictEqual(callArgs[1], "vocab-id");
        assert.deepStrictEqual(callArgs[2].status, "LEARNING");
        assert.strictEqual(callArgs[2].correct_count, 1);
        assert.strictEqual(callArgs[2].wrong_count, 0);
        assert.strictEqual(callArgs[3].correct, true);
        assert.strictEqual(callArgs[3].duration, 5);
    });

    await t.test("submitReview - correct review updates status to REVIEWING and MASTERED correctly", async () => {
        mock.method(learningProgressRepository, "checkVocabularyExists", async () => true);

        // Scenario 1: Transition to REVIEWING (mastery goes from 0.3 to 0.45)
        mock.method(learningProgressRepository, "findProgress", async () => ({
            status: "LEARNING",
            mastery: 0.3,
            correct_count: 2,
            wrong_count: 0
        }));

        let saveMock = mock.method(learningProgressRepository, "saveReviewResult", async (userId: string, vocabId: string, progressData: any) => {
            return {
                vocabulary_id: vocabId,
                status: progressData.status,
                mastery: progressData.mastery,
                next_review: progressData.next_review
            };
        });

        let result = await learningProgressService.submitReview("user-123", { vocabulary_id: "vocab-id", correct: true });
        assert.strictEqual(result.data.new_status, "REVIEWING");
        assert.strictEqual(result.data.new_mastery, 0.45);
        assert.strictEqual(saveMock.mock.calls[0].arguments[2].correct_count, 3);

        // Scenario 2: Transition to MASTERED (mastery goes from 0.8 to 0.95)
        mock.restoreAll();
        mock.method(learningProgressRepository, "checkVocabularyExists", async () => true);
        mock.method(learningProgressRepository, "findProgress", async () => ({
            status: "REVIEWING",
            mastery: 0.8,
            correct_count: 6,
            wrong_count: 1
        }));

        saveMock = mock.method(learningProgressRepository, "saveReviewResult", async (userId: string, vocabId: string, progressData: any) => {
            return {
                vocabulary_id: vocabId,
                status: progressData.status,
                mastery: progressData.mastery,
                next_review: progressData.next_review
            };
        });

        result = await learningProgressService.submitReview("user-123", { vocabulary_id: "vocab-id", correct: true });
        assert.strictEqual(result.data.new_status, "MASTERED");
        assert.strictEqual(result.data.new_mastery, 0.95);
        assert.strictEqual(saveMock.mock.calls[0].arguments[2].correct_count, 7);
    });

    await t.test("submitReview - wrong review regresses status and sets short intervals correctly", async () => {
        mock.method(learningProgressRepository, "checkVocabularyExists", async () => true);

        // Scenario 1: MASTERED regresses to REVIEWING (mastery goes from 0.85 to 0.65)
        mock.method(learningProgressRepository, "findProgress", async () => ({
            status: "MASTERED",
            mastery: 0.85,
            correct_count: 10,
            wrong_count: 0
        }));

        const saveMock = mock.method(learningProgressRepository, "saveReviewResult", async (userId: string, vocabId: string, progressData: any) => {
            return {
                vocabulary_id: vocabId,
                status: progressData.status,
                mastery: progressData.mastery,
                next_review: progressData.next_review
            };
        });

        let result = await learningProgressService.submitReview("user-123", { vocabulary_id: "vocab-id", correct: false });
        assert.strictEqual(result.data.new_status, "REVIEWING");
        assert.strictEqual(result.data.new_mastery, 0.65);
        assert.strictEqual(saveMock.mock.calls[0].arguments[2].wrong_count, 1);

        // Scenario 2: REVIEWING regresses to LEARNING (mastery goes from 0.45 to 0.25)
        mock.restoreAll();
        mock.method(learningProgressRepository, "checkVocabularyExists", async () => true);
        mock.method(learningProgressRepository, "findProgress", async () => ({
            status: "REVIEWING",
            mastery: 0.45,
            correct_count: 3,
            wrong_count: 1
        }));

        const saveMock2 = mock.method(learningProgressRepository, "saveReviewResult", async (userId: string, vocabId: string, progressData: any) => {
            return {
                vocabulary_id: vocabId,
                status: progressData.status,
                mastery: progressData.mastery,
                next_review: progressData.next_review
            };
        });

        result = await learningProgressService.submitReview("user-123", { vocabulary_id: "vocab-id", correct: false });
        assert.strictEqual(result.data.new_status, "LEARNING");
        assert.strictEqual(result.data.new_mastery, 0.25);
    });

    await t.test("getHistory - returns gap-filled statistics correctly", async () => {
        const mockHistories = [
            { reviewed_at: new Date("2026-08-03T05:00:00Z"), correct: true },
            { reviewed_at: new Date("2026-08-03T18:00:00Z"), correct: false },
            { reviewed_at: new Date("2026-08-05T12:00:00Z"), correct: true }
        ];

        mock.method(learningProgressRepository, "getReviewHistory", async () => mockHistories);

        const result = await learningProgressService.getHistory("user-123", {
            start_date: "2026-08-02",
            end_date: "2026-08-05"
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.length, 4);

        // 2026-08-02 (gap)
        assert.deepStrictEqual(result.data[0], { date: "2026-08-02", total: 0, correct: 0, wrong: 0 });
        // 2026-08-03 (2 reviews: 1 correct, 1 wrong)
        assert.deepStrictEqual(result.data[1], { date: "2026-08-03", total: 2, correct: 1, wrong: 1 });
        // 2026-08-04 (gap)
        assert.deepStrictEqual(result.data[2], { date: "2026-08-04", total: 0, correct: 0, wrong: 0 });
        // 2026-08-05 (1 correct review)
        assert.deepStrictEqual(result.data[3], { date: "2026-08-05", total: 1, correct: 1, wrong: 0 });
    });

    await t.test("getHistory - throws error if range exceeds 366 days", async () => {
        await assert.rejects(
            learningProgressService.getHistory("user-123", {
                start_date: "2026-01-01",
                end_date: "2027-01-05"
            }),
            (err: any) => {
                assert.strictEqual(err.message, "RANGE_TOO_LARGE");
                return true;
            }
        );
    });
});
