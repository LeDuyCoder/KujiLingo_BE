-- DropIndex
DROP INDEX "grammar_points_lesson_id_jlpt_idx";

-- AlterTable
ALTER TABLE "kanjis" ADD COLUMN     "deleted_at" TIMESTAMP(6),
ADD COLUMN     "examples" JSONB,
ADD COLUMN     "radical" VARCHAR,
ADD COLUMN     "stroke_order_image_url" VARCHAR;
