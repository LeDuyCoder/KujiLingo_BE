ALTER TABLE "learning_progress"
ADD COLUMN "user_vocabulary_id" UUID;

ALTER TABLE "review_histories"
ADD COLUMN "user_vocabulary_id" UUID;

ALTER TABLE "learning_progress"
ADD CONSTRAINT "learning_progress_user_vocabulary_id_fkey"
FOREIGN KEY ("user_vocabulary_id") REFERENCES "user_vocabularies"("id")
ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "review_histories"
ADD CONSTRAINT "review_histories_user_vocabulary_id_fkey"
FOREIGN KEY ("user_vocabulary_id") REFERENCES "user_vocabularies"("id")
ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE UNIQUE INDEX "learning_progress_user_id_user_vocabulary_id_idx"
ON "learning_progress"("user_id", "user_vocabulary_id");

CREATE INDEX "review_histories_user_id_user_vocabulary_id_idx"
ON "review_histories"("user_id", "user_vocabulary_id");

ALTER TABLE "learning_progress"
ADD CONSTRAINT "learning_progress_exactly_one_vocabulary_source_check"
CHECK ("vocabulary_id" IS NULL OR "user_vocabulary_id" IS NULL);

ALTER TABLE "review_histories"
ADD CONSTRAINT "review_histories_exactly_one_vocabulary_source_check"
CHECK ("vocabulary_id" IS NULL OR "user_vocabulary_id" IS NULL);
