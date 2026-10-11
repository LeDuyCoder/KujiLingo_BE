import "dotenv/config";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/config/prisma.js";

type CsvRow = Record<string, string>;
type DataRow = Record<string, unknown>;
type UpsertDelegate = {
    upsert(args: { where: Record<string, unknown>; create: DataRow; update: DataRow }): Promise<unknown>;
};

const seedDataRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../prisma/seed-data");
const curriculumFolders = ["curriculum_n5_25_bai", "curriculum_n4_tu_vung"] as const;
const placeholderCourseIds = [
    "11111111-1111-4111-b111-111111111111",
    "22222222-2222-4222-b222-222222222222",
    "33333333-3333-4333-b333-333333333333",
    "44444444-4444-4444-b444-444444444444",
];

function parseCsv(source: string, fileName: string): CsvRow[] {
    const text = source.replace(/^\uFEFF/, "");
    const records: string[][] = [];
    let record: string[] = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (char === '"') {
            if (quoted && text[index + 1] === '"') {
                field += '"';
                index += 1;
            } else {
                quoted = !quoted;
            }
        } else if (!quoted && char === ",") {
            record.push(field);
            field = "";
        } else if (!quoted && (char === "\n" || char === "\r")) {
            if (char === "\r" && text[index + 1] === "\n") index += 1;
            record.push(field);
            if (record.some((cell) => cell.trim() !== "")) records.push(record);
            record = [];
            field = "";
        } else {
            field += char;
        }
    }

    if (quoted) throw new Error(`${fileName} contains an unterminated quoted field.`);
    if (field || record.length > 0) {
        record.push(field);
        if (record.some((cell) => cell.trim() !== "")) records.push(record);
    }

    const headers = records.shift()?.map((header) => header.trim());
    if (!headers?.length) throw new Error(`${fileName} is empty or has no header row.`);

    return records.map((cells, rowIndex) => {
        if (cells.length !== headers.length) {
            throw new Error(`${fileName} row ${rowIndex + 2} has ${cells.length} columns; expected ${headers.length}.`);
        }
        return Object.fromEntries(headers.map((header, index) => [header, cells[index].trim()]));
    });
}

async function loadCsv(folder: string, fileName: string): Promise<CsvRow[]> {
    const filePath = path.join(seedDataRoot, folder, fileName);
    return parseCsv(await readFile(filePath, "utf8"), `${folder}/${fileName}`);
}

function required(row: CsvRow, key: string, fileName: string): string {
    const value = row[key]?.trim();
    if (!value) throw new Error(`${fileName} has an empty ${key} value.`);
    return value;
}

function optional(value: string | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
}

function integer(value: string | undefined, fieldName: string): number | null {
    if (!value?.trim()) return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) throw new Error(`${fieldName} must be an integer: ${value}`);
    return parsed;
}

function date(value: string | undefined, fieldName: string): Date | null {
    if (!value?.trim()) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new Error(`${fieldName} is not a valid date: ${value}`);
    return parsed;
}

function json(value: string | undefined, fieldName: string): unknown {
    if (!value?.trim()) return null;
    try {
        return JSON.parse(value);
    } catch {
        throw new Error(`${fieldName} contains invalid JSON.`);
    }
}

function stableUuid(value: string): string {
    const bytes = crypto.createHash("sha1").update(`kujilingo-curriculum:${value}`).digest().subarray(0, 16);
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function assertUnique(rows: DataRow[], label: string, keyFields: string[]): void {
    const seen = new Set<string>();
    for (const row of rows) {
        const key = keyFields.map((field) => String(row[field])).join(":");
        if (seen.has(key)) throw new Error(`${label} contains duplicate key ${key}.`);
        seen.add(key);
    }
}

function assertReferences(rows: DataRow[], keyField: string, targets: Set<string>, label: string): void {
    for (const row of rows) {
        const key = String(row[keyField] ?? "");
        if (!targets.has(key)) throw new Error(`${label} references missing ${keyField} ${key}.`);
    }
}

async function upsertRows(delegate: UpsertDelegate, rows: DataRow[]): Promise<void> {
    const batchSize = 25;
    for (let offset = 0; offset < rows.length; offset += batchSize) {
        const batch = rows.slice(offset, offset + batchSize);
        await Promise.all(batch.map((row) => {
            const id = row.id;
            if (typeof id !== "string") throw new Error("Seed row is missing a string id.");
            const update = Object.fromEntries(Object.entries(row).filter(([field]) => field !== "id"));
            return delegate.upsert({ where: { id }, create: row, update });
        }));
    }
}

async function upsertTopicVocabularies(rows: DataRow[]): Promise<void> {
    for (let offset = 0; offset < rows.length; offset += 25) {
        const batch = rows.slice(offset, offset + 25);
        await Promise.all(batch.map((row) => prisma.topic_vocabularies.upsert({
            where: {
                topic_id_vocabulary_id: {
                    topic_id: String(row.topic_id),
                    vocabulary_id: String(row.vocabulary_id),
                },
            },
            create: row as { topic_id: string; vocabulary_id: string },
            update: {},
        })));
    }
}

async function seedCurriculum(folder: typeof curriculumFolders[number]) {
    const files = {
        courses: await loadCsv(folder, "Courses.csv"),
        lessons: await loadCsv(folder, "Lessons.csv"),
        topics: await loadCsv(folder, "Topics.csv"),
        vocabularies: await loadCsv(folder, "Vocabularies.csv"),
        meanings: await loadCsv(folder, "VocabularyMeanings.csv"),
        topicVocabularies: await loadCsv(folder, "TopicVocabularies.csv"),
        vocabularyExamples: await loadCsv(folder, "VocabularyExamples.csv"),
        grammarPoints: await loadCsv(folder, "GrammarPoints.csv"),
        grammarExamples: await loadCsv(folder, "GrammarExamples.csv"),
        quizzes: await loadCsv(folder, "Quizzes.csv"),
        quizQuestions: await loadCsv(folder, "QuizQuestions.csv"),
        quizAnswers: await loadCsv(folder, "QuizAnswers.csv"),
    };

    const courseRows = files.courses.map((row) => ({
        id: required(row, "id", "Courses.csv"),
        title: optional(row.title),
        description: optional(row.description),
        image: optional(row.image),
        order_no: integer(row.order_no, "Courses.order_no"),
        deleted_at: date(row.deleted_at, "Courses.deleted_at"),
    }));
    const lessonRows = files.lessons.map((row) => ({
        id: required(row, "id", "Lessons.csv"),
        course_id: required(row, "course_id", "Lessons.csv"),
        title: optional(row.title),
        description: optional(row.description),
        order_no: integer(row.order_no, "Lessons.order_no"),
    }));
    const topicRows = files.topics.map((row) => ({
        id: required(row, "id", "Topics.csv"),
        lesson_id: required(row, "lesson_id", "Topics.csv"),
        title: optional(row.title),
        description: optional(row.description),
        image: optional(row.image),
        order_no: integer(row.order_no, "Topics.order_no"),
    }));
    const vocabularyRows = files.vocabularies.map((row) => ({
        id: required(row, "id", "Vocabularies.csv"),
        kanji: optional(row.kanji),
        hiragana: optional(row.hiragana),
        romaji: optional(row.romaji),
        word_type: optional(row.word_type),
        jlpt: optional(row.jlpt),
        frequency: integer(row.frequency, "Vocabularies.frequency"),
        audio: optional(row.audio),
        image: optional(row.image),
        created_at: date(row.created_at, "Vocabularies.created_at"),
        deleted_at: date(row.deleted_at, "Vocabularies.deleted_at"),
    }));
    const meaningRows = files.meanings.map((row) => ({
        id: required(row, "id", "VocabularyMeanings.csv"),
        vocabulary_id: required(row, "vocabulary_id", "VocabularyMeanings.csv"),
        language: optional(row.language),
        meaning: optional(row.meaning),
        display_order: integer(row.display_order, "VocabularyMeanings.display_order"),
    }));
    const topicVocabularyRows = files.topicVocabularies.map((row) => ({
        topic_id: required(row, "topic_id", "TopicVocabularies.csv"),
        vocabulary_id: required(row, "vocabulary_id", "TopicVocabularies.csv"),
    }));
    const vocabularyExampleRows = files.vocabularyExamples.map((row, index) => ({
        id: optional(row.id) ?? stableUuid(`${folder}:vocabulary-example:${row.vocabulary_id}:${index + 1}`),
        vocabulary_id: required(row, "vocabulary_id", "VocabularyExamples.csv"),
        japanese: optional(row.japanese),
        hiragana: optional(row.hiragana),
        translation: optional(row.translation),
    }));
    const grammarPointRows = files.grammarPoints.map((row) => ({
        id: required(row, "id", "GrammarPoints.csv"),
        lesson_id: optional(row.lesson_id),
        title: optional(row.title),
        structure: optional(row.structure),
        meaning: optional(row.meaning),
        usage: optional(row.usage),
        jlpt: optional(row.jlpt),
        topic_id: optional(row.topic_id),
        title_jp: optional(row.title_jp),
        meaning_vi: optional(row.meaning_vi),
        explanation: optional(row.explanation),
        jlpt_level: optional(row.jlpt_level),
        example_sentences: json(row.example_sentences, "GrammarPoints.example_sentences"),
        audio_url: optional(row.audio_url),
        created_by: optional(row.created_by),
        created_at: date(row.created_at, "GrammarPoints.created_at"),
        updated_at: date(row.updated_at, "GrammarPoints.updated_at"),
        deleted_at: date(row.deleted_at, "GrammarPoints.deleted_at"),
    }));
    const grammarExampleRows = files.grammarExamples.map((row) => ({
        id: required(row, "id", "GrammarExamples.csv"),
        grammar_id: required(row, "grammar_id", "GrammarExamples.csv"),
        japanese: optional(row.japanese),
        translation: optional(row.translation),
    }));
    const quizRows = files.quizzes.map((row) => ({
        id: required(row, "id", "Quizzes.csv"),
        topic_id: required(row, "topic_id", "Quizzes.csv"),
        title: optional(row.title),
    }));
    const quizQuestionRows = files.quizQuestions.map((row) => ({
        id: required(row, "id", "QuizQuestions.csv"),
        quiz_id: required(row, "quiz_id", "QuizQuestions.csv"),
        question: optional(row.question),
        audio: optional(row.audio),
        image: optional(row.image),
    }));
    const quizAnswerRows = files.quizAnswers.map((row) => ({
        id: required(row, "id", "QuizAnswers.csv"),
        question_id: required(row, "question_id", "QuizAnswers.csv"),
        answer: optional(row.answer),
        is_correct: row.is_correct.trim().toLowerCase() === "true",
    }));

    assertUnique(courseRows, `${folder}/Courses.csv`, ["id"]);
    assertUnique(lessonRows, `${folder}/Lessons.csv`, ["id"]);
    assertUnique(topicRows, `${folder}/Topics.csv`, ["id"]);
    assertUnique(vocabularyRows, `${folder}/Vocabularies.csv`, ["id"]);
    assertUnique(meaningRows, `${folder}/VocabularyMeanings.csv`, ["id"]);
    assertUnique(topicVocabularyRows, `${folder}/TopicVocabularies.csv`, ["topic_id", "vocabulary_id"]);
    assertUnique(vocabularyExampleRows, `${folder}/VocabularyExamples.csv`, ["id"]);
    assertUnique(grammarPointRows, `${folder}/GrammarPoints.csv`, ["id"]);
    assertUnique(grammarExampleRows, `${folder}/GrammarExamples.csv`, ["id"]);
    assertUnique(quizRows, `${folder}/Quizzes.csv`, ["id"]);
    assertUnique(quizQuestionRows, `${folder}/QuizQuestions.csv`, ["id"]);
    assertUnique(quizAnswerRows, `${folder}/QuizAnswers.csv`, ["id"]);

    const ids = (rows: DataRow[]) => new Set(rows.map((row) => String(row.id)));
    assertReferences(lessonRows, "course_id", ids(courseRows), `${folder}/Lessons.csv`);
    assertReferences(topicRows, "lesson_id", ids(lessonRows), `${folder}/Topics.csv`);
    assertReferences(meaningRows, "vocabulary_id", ids(vocabularyRows), `${folder}/VocabularyMeanings.csv`);
    assertReferences(vocabularyExampleRows, "vocabulary_id", ids(vocabularyRows), `${folder}/VocabularyExamples.csv`);
    assertReferences(topicVocabularyRows, "topic_id", ids(topicRows), `${folder}/TopicVocabularies.csv`);
    assertReferences(topicVocabularyRows, "vocabulary_id", ids(vocabularyRows), `${folder}/TopicVocabularies.csv`);
    assertReferences(grammarPointRows.filter((row) => row.lesson_id), "lesson_id", ids(lessonRows), `${folder}/GrammarPoints.csv`);
    assertReferences(grammarPointRows.filter((row) => row.topic_id), "topic_id", ids(topicRows), `${folder}/GrammarPoints.csv`);
    assertReferences(grammarExampleRows, "grammar_id", ids(grammarPointRows), `${folder}/GrammarExamples.csv`);
    assertReferences(quizRows, "topic_id", ids(topicRows), `${folder}/Quizzes.csv`);
    assertReferences(quizQuestionRows, "quiz_id", ids(quizRows), `${folder}/QuizQuestions.csv`);
    assertReferences(quizAnswerRows, "question_id", ids(quizQuestionRows), `${folder}/QuizAnswers.csv`);

    const answerCounts = new Map<string, { total: number; correct: number }>();
    for (const answer of quizAnswerRows) {
        const questionId = String(answer.question_id);
        const count = answerCounts.get(questionId) ?? { total: 0, correct: 0 };
        count.total += 1;
        if (answer.is_correct) count.correct += 1;
        answerCounts.set(questionId, count);
    }
    if (quizQuestionRows.some((question) => {
        const count = answerCounts.get(String(question.id));
        return count?.total !== 4 || count.correct !== 1;
    })) {
        throw new Error(`${folder} quiz data must have four answers and one correct answer per question.`);
    }

    await upsertRows(prisma.courses as unknown as UpsertDelegate, courseRows);
    await upsertRows(prisma.lessons as unknown as UpsertDelegate, lessonRows);
    await upsertRows(prisma.topics as unknown as UpsertDelegate, topicRows);
    await upsertRows(prisma.vocabularies as unknown as UpsertDelegate, vocabularyRows);
    await upsertRows(prisma.vocabulary_meanings as unknown as UpsertDelegate, meaningRows);
    await upsertTopicVocabularies(topicVocabularyRows);
    await upsertRows(prisma.example_sentences as unknown as UpsertDelegate, vocabularyExampleRows);
    await upsertRows(prisma.grammar_points as unknown as UpsertDelegate, grammarPointRows);
    await upsertRows(prisma.grammar_examples as unknown as UpsertDelegate, grammarExampleRows);
    await upsertRows(prisma.quizzes as unknown as UpsertDelegate, quizRows);
    await upsertRows(prisma.quiz_questions as unknown as UpsertDelegate, quizQuestionRows);
    await upsertRows(prisma.quiz_answers as unknown as UpsertDelegate, quizAnswerRows);

    console.log(
        `${folder}: ${courseRows.length} course, ${lessonRows.length} lessons, ${topicRows.length} topics, ` +
        `${vocabularyRows.length} vocabulary, ${grammarPointRows.length} grammar points, ` +
        `${quizRows.length} quizzes, ${quizQuestionRows.length} questions, ${quizAnswerRows.length} answers imported.`,
    );
}

async function main() {
    if (process.env.NODE_ENV === "production") {
        throw new Error("Course test seed is disabled in production.");
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl || !["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(databaseUrl).hostname)) {
        throw new Error("Course test seed only runs against a local database.");
    }

    for (const folder of curriculumFolders) await seedCurriculum(folder);

    await prisma.courses.updateMany({
        where: { id: { in: placeholderCourseIds }, deleted_at: null },
        data: { deleted_at: new Date() },
    });
    console.log("Curriculum seed completed. Legacy placeholder courses are hidden from course listings.");
}

main()
    .catch((error) => {
        console.error("Curriculum seed error:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
