-- AlterTable
ALTER TABLE "grammar_points" 
  ADD COLUMN IF NOT EXISTS "topic_id" UUID,
  ADD COLUMN IF NOT EXISTS "title_jp" VARCHAR,
  ADD COLUMN IF NOT EXISTS "meaning_vi" TEXT,
  ADD COLUMN IF NOT EXISTS "jlpt_level" "JLPTLevel",
  ADD COLUMN IF NOT EXISTS "example_sentences" JSONB,
  ADD COLUMN IF NOT EXISTS "audio_url" VARCHAR,
  ADD COLUMN IF NOT EXISTS "created_by" UUID,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(6);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "grammar_points_lesson_id_jlpt_level_idx" ON "grammar_points"("lesson_id", "jlpt_level");
CREATE INDEX IF NOT EXISTS "grammar_points_topic_id_idx" ON "grammar_points"("topic_id");
CREATE INDEX IF NOT EXISTS "grammar_points_jlpt_level_idx" ON "grammar_points"("jlpt_level");
CREATE INDEX IF NOT EXISTS "grammar_points_deleted_at_idx" ON "grammar_points"("deleted_at");

-- AddForeignKey
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'grammar_points_topic_id_fkey'
  ) THEN
    ALTER TABLE "grammar_points" ADD CONSTRAINT "grammar_points_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;
