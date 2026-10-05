CREATE TABLE "user_lesson_quiz_completions" (
    "user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "completed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_lesson_quiz_completions_pkey" PRIMARY KEY ("user_id", "lesson_id")
);

CREATE INDEX "user_lesson_quiz_completions_lesson_id_idx"
ON "user_lesson_quiz_completions"("lesson_id");

ALTER TABLE "user_lesson_quiz_completions"
ADD CONSTRAINT "user_lesson_quiz_completions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_lesson_quiz_completions"
ADD CONSTRAINT "user_lesson_quiz_completions_lesson_id_fkey"
FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
