CREATE TABLE "translation_cache" (
    "id" UUID NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "target_language" VARCHAR(2) NOT NULL,
    "source_language" VARCHAR(16),
    "source_text" TEXT NOT NULL,
    "translated_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "translation_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "translation_cache_content_hash_target_language_key"
ON "translation_cache"("content_hash", "target_language");

CREATE TABLE "translation_monthly_usage" (
    "month" VARCHAR(7) NOT NULL,
    "character_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "translation_monthly_usage_pkey" PRIMARY KEY ("month")
);
