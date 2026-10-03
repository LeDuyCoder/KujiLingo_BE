/*
  Warnings:

  - The values [VNPAY] on the enum `PaymentMethod` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[order_code]` on the table `payment_transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "SRSItemType" AS ENUM ('vocabulary', 'kanji', 'grammar');

-- CreateEnum
CREATE TYPE "SRSState" AS ENUM ('new', 'learning', 'review', 'relearning');

-- CreateEnum
CREATE TYPE "SRSRating" AS ENUM ('again', 'hard', 'good', 'easy');

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentMethod_new" AS ENUM ('MOMO', 'PAYOS');
ALTER TABLE "payment_transactions" ALTER COLUMN "payment_method" TYPE "PaymentMethod_new" USING ("payment_method"::text::"PaymentMethod_new");
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "public"."PaymentMethod_old";
COMMIT;

-- AlterTable
ALTER TABLE "payment_transactions" ADD COLUMN     "order_code" BIGINT,
ADD COLUMN     "qr_code" TEXT;

-- AlterTable
ALTER TABLE "user_statistics_daily" ADD COLUMN     "words_reviewed" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "vocabularies" ADD COLUMN     "deleted_at" TIMESTAMP(6);

-- CreateTable
CREATE TABLE "srs_cards" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "item_type" "SRSItemType" NOT NULL,
    "item_id" UUID NOT NULL,
    "ease_factor" DECIMAL(4,2) NOT NULL DEFAULT 2.5,
    "interval_days" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "due_at" TIMESTAMP(6) NOT NULL,
    "state" "SRSState" NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "srs_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "srs_review_histories" (
    "id" UUID NOT NULL,
    "srs_card_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rating" "SRSRating" NOT NULL,
    "interval_before_days" INTEGER NOT NULL,
    "interval_after_days" INTEGER NOT NULL,
    "ease_factor_before" DECIMAL(4,2) NOT NULL,
    "ease_factor_after" DECIMAL(4,2) NOT NULL,
    "reviewed_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "srs_review_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "srs_cards_user_id_due_at_idx" ON "srs_cards"("user_id", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "srs_cards_user_id_item_type_item_id_key" ON "srs_cards"("user_id", "item_type", "item_id");

-- CreateIndex
CREATE INDEX "srs_review_histories_user_id_idx" ON "srs_review_histories"("user_id");

-- CreateIndex
CREATE INDEX "srs_review_histories_srs_card_id_idx" ON "srs_review_histories"("srs_card_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_order_code_key" ON "payment_transactions"("order_code");

-- CreateIndex
CREATE INDEX "payment_transactions_order_code_idx" ON "payment_transactions"("order_code");

-- CreateIndex
CREATE INDEX "vocabularies_deleted_at_idx" ON "vocabularies"("deleted_at");

-- AddForeignKey
ALTER TABLE "srs_cards" ADD CONSTRAINT "srs_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "srs_review_histories" ADD CONSTRAINT "srs_review_histories_srs_card_id_fkey" FOREIGN KEY ("srs_card_id") REFERENCES "srs_cards"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "srs_review_histories" ADD CONSTRAINT "srs_review_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
