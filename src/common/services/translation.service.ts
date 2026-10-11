import { createHash, randomUUID } from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";

type DisplayLanguage = "vi" | "en";

interface CachedTranslation {
    content_hash: string;
    source_language: string | null;
    translated_text: string;
}

function contentHash(text: string) {
    return createHash("sha256").update(text).digest("hex");
}

async function reserveQuota(characters: number): Promise<boolean> {
    if (characters === 0) return true;
    const month = new Date().toISOString().slice(0, 7);
    const rows = await prisma.$queryRaw<Array<{ character_count: number }>>`
        INSERT INTO "translation_monthly_usage" ("month", "character_count")
        VALUES (${month}, ${characters})
        ON CONFLICT ("month") DO UPDATE
        SET "character_count" = "translation_monthly_usage"."character_count" + EXCLUDED."character_count"
        WHERE "translation_monthly_usage"."character_count" + EXCLUDED."character_count" <= ${env.TRANSLATION_MONTHLY_CHARACTER_LIMIT}
        RETURNING "character_count"
    `;
    return rows.length > 0;
}

async function releaseQuota(characters: number) {
    if (characters === 0) return;
    const month = new Date().toISOString().slice(0, 7);
    await prisma.translation_monthly_usage.updateMany({
        where: { month },
        data: { character_count: { decrement: characters } },
    });
}

async function requestGoogleTranslations(texts: string[], target: DisplayLanguage) {
    const endpoint = new URL("https://translation.googleapis.com/language/translate/v2");
    endpoint.searchParams.set("key", env.GOOGLE_TRANSLATE_API_KEY!);
    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: texts, target, format: "text" }),
        signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`Google Translation returned HTTP ${response.status}`);
    const json = await response.json() as {
        data?: { translations?: Array<{ translatedText?: string; detectedSourceLanguage?: string }> };
    };
    const translations = json.data?.translations;
    if (!translations || translations.length !== texts.length) {
        throw new Error("Google Translation returned an invalid response.");
    }
    return translations.map(item => ({
        text: item.translatedText ?? "",
        sourceLanguage: item.detectedSourceLanguage ?? null,
    }));
}

async function requestGoogleWebTranslation(text: string, target: DisplayLanguage) {
    const endpoint = new URL("https://translate.googleapis.com/translate_a/single");
    endpoint.searchParams.set("client", "gtx");
    endpoint.searchParams.set("sl", "auto");
    endpoint.searchParams.set("tl", target);
    endpoint.searchParams.set("dt", "t");
    endpoint.searchParams.set("q", text);

    const response = await fetch(endpoint, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`Google Translate web returned HTTP ${response.status}`);

    const json = await response.json() as unknown;
    const chunks = Array.isArray(json) && Array.isArray(json[0]) ? json[0] : null;
    const translated = chunks
        ?.filter((chunk): chunk is unknown[] => Array.isArray(chunk))
        .map(chunk => typeof chunk[0] === "string" ? chunk[0] : "")
        .join("")
        .trim();
    if (!translated) throw new Error("Google Translate web returned an invalid response.");

    return translated;
}

async function requestVocabularyTranslations(texts: string[], target: DisplayLanguage) {
    if (env.GOOGLE_TRANSLATE_API_KEY) {
        return requestGoogleTranslations(texts, target);
    }

    // The web endpoint is used only for dictionary and folder vocabulary display.
    // Keep requests modest because this unofficial endpoint may rate-limit traffic.
    const results: Array<{ text: string; sourceLanguage: string | null }> = [];
    for (let index = 0; index < texts.length; index += 5) {
        const batch = texts.slice(index, index + 5);
        const translated = await Promise.all(batch.map(text => requestGoogleWebTranslation(text, target)));
        results.push(...translated.map(text => ({ text, sourceLanguage: null })));
    }
    return results;
}

/** Translates display copy while leaving source content untouched. */
export async function translateDisplayTexts(
    inputTexts: Array<string | null | undefined>,
    target: DisplayLanguage,
    options: { vocabularyFallback?: boolean } = {},
): Promise<Array<string | null | undefined>> {
    const output = [...inputTexts];
    const uniqueTexts = [...new Set(inputTexts.filter((text): text is string => Boolean(text?.trim())))];
    if ((!env.GOOGLE_TRANSLATE_API_KEY && !options.vocabularyFallback) || uniqueTexts.length === 0) return output;

    const hashes = new Map(uniqueTexts.map(text => [text, contentHash(text)]));
    const cached = await prisma.translation_cache.findMany({
        where: {
            content_hash: { in: [...hashes.values()] },
            target_language: target,
        },
        select: { content_hash: true, source_language: true, translated_text: true },
    }) as CachedTranslation[];
    const translatedByHash = new Map(cached.map(item => [item.content_hash, item.translated_text]));
    const missing = uniqueTexts.filter(text => !translatedByHash.has(hashes.get(text)!));
    for (let index = 0; index < missing.length; index += 128) {
        const batch = missing.slice(index, index + 128);
        const characterCount = batch.reduce((sum, text) => sum + Array.from(text).length, 0);
        let reserved = false;
        try {
            reserved = await reserveQuota(characterCount);
            if (!reserved) break;

            const results = options.vocabularyFallback
                ? await requestVocabularyTranslations(batch, target)
                : await requestGoogleTranslations(batch, target);
            await prisma.translation_cache.createMany({
                data: batch.map((source, resultIndex) => ({
                    id: randomUUID(),
                    content_hash: hashes.get(source)!,
                    target_language: target,
                    source_language: results[resultIndex]?.sourceLanguage ?? null,
                    source_text: source,
                    translated_text: results[resultIndex]?.text || source,
                })),
                skipDuplicates: true,
            }).catch(error => console.warn("Could not persist translation cache.", error));
            batch.forEach((source, resultIndex) => translatedByHash.set(hashes.get(source)!, results[resultIndex]?.text || source));
        } catch (error) {
            if (reserved) await releaseQuota(characterCount).catch(() => undefined);
            console.warn("Translation unavailable; showing original content.", error);
            break;
        }
    }

    return output.map(text => {
        if (!text?.trim()) return text;
        return translatedByHash.get(hashes.get(text)!) ?? text;
    });
}

/** Uses the cached translation pipeline for dictionary and saved folder vocabulary. */
export function translateVocabularyTexts(
    inputTexts: Array<string | null | undefined>,
    target: DisplayLanguage,
) {
    return translateDisplayTexts(inputTexts, target, { vocabularyFallback: true });
}
