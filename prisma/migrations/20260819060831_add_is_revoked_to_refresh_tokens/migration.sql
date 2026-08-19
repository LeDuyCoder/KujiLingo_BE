-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM ('STREAK', 'EXP', 'VOCAB_MASTER', 'QUIZ_PERFECT');

-- CreateEnum
CREATE TYPE "CurrencyType" AS ENUM ('COIN', 'GEM');

-- CreateEnum
CREATE TYPE "ItemRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('ACTIVE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('AVATAR', 'BACKGROUND', 'FRAME');

-- CreateEnum
CREATE TYPE "JLPTLevel" AS ENUM ('N5', 'N4', 'N3', 'N2', 'N1');

-- CreateEnum
CREATE TYPE "LearningStatus" AS ENUM ('NEW', 'LEARNING', 'REVIEWING', 'MASTERED');

-- CreateEnum
CREATE TYPE "PVPMatchResult" AS ENUM ('WIN', 'LOSE', 'DRAW');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MOMO', 'VNPAY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('RECHARGE', 'PURCHASE', 'REWARD', 'REFUND', 'ADMIN');

-- CreateEnum
CREATE TYPE "WordType" AS ENUM ('NOUN', 'VERB', 'I_ADJECTIVE', 'NA_ADJECTIVE', 'ADVERB', 'PRONOUN', 'PARTICLE', 'CONJUNCTION', 'EXPRESSION');

-- CreateTable
CREATE TABLE "achievements" (
    "id" UUID NOT NULL,
    "title" VARCHAR NOT NULL,
    "description" TEXT NOT NULL,
    "icon" VARCHAR NOT NULL,
    "type" "AchievementType" NOT NULL,
    "condition_value" INTEGER NOT NULL,
    "reward_exp" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "title" VARCHAR,
    "description" TEXT,
    "image" VARCHAR,
    "order_no" INTEGER,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "example_sentences" (
    "id" UUID NOT NULL,
    "vocabulary_id" UUID,
    "japanese" TEXT,
    "hiragana" TEXT,
    "translation" TEXT,

    CONSTRAINT "example_sentences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite_vocabularies" (
    "user_id" UUID NOT NULL,
    "vocabulary_id" UUID NOT NULL,

    CONSTRAINT "favorite_vocabularies_pkey" PRIMARY KEY ("user_id","vocabulary_id")
);

-- CreateTable
CREATE TABLE "folder_system_vocabularies" (
    "folder_id" UUID NOT NULL,
    "vocabulary_id" UUID NOT NULL,

    CONSTRAINT "folder_system_vocabularies_pkey" PRIMARY KEY ("folder_id","vocabulary_id")
);

-- CreateTable
CREATE TABLE "folder_user_vocabularies" (
    "folder_id" UUID NOT NULL,
    "user_vocabulary_id" UUID NOT NULL,

    CONSTRAINT "folder_user_vocabularies_pkey" PRIMARY KEY ("folder_id","user_vocabulary_id")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "name" VARCHAR,
    "color" VARCHAR,
    "icon" VARCHAR,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gem_packages" (
    "id" UUID NOT NULL,
    "title" VARCHAR,
    "description" TEXT,
    "gem_amount" INTEGER,
    "bonus_gem" INTEGER DEFAULT 0,
    "price" DECIMAL,
    "image" VARCHAR,
    "is_popular" BOOLEAN DEFAULT false,
    "is_best_value" BOOLEAN DEFAULT false,
    "sort_order" INTEGER,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6),

    CONSTRAINT "gem_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gem_promotions" (
    "id" UUID NOT NULL,
    "title" VARCHAR,
    "description" TEXT,
    "bonus_percent" INTEGER,
    "start_at" TIMESTAMP(6),
    "end_at" TIMESTAMP(6),
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6),

    CONSTRAINT "gem_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_examples" (
    "id" UUID NOT NULL,
    "grammar_id" UUID,
    "japanese" TEXT,
    "translation" TEXT,

    CONSTRAINT "grammar_examples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_points" (
    "id" UUID NOT NULL,
    "lesson_id" UUID,
    "title" VARCHAR,
    "structure" TEXT,
    "meaning" TEXT,
    "usage" TEXT,
    "jlpt" "JLPTLevel",

    CONSTRAINT "grammar_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanji_vocabularies" (
    "kanji_id" UUID NOT NULL,
    "vocabulary_id" UUID NOT NULL,

    CONSTRAINT "kanji_vocabularies_pkey" PRIMARY KEY ("kanji_id","vocabulary_id")
);

-- CreateTable
CREATE TABLE "kanjis" (
    "id" UUID NOT NULL,
    "kanji" VARCHAR,
    "meaning" TEXT,
    "onyomi" VARCHAR,
    "kunyomi" VARCHAR,
    "stroke_count" INTEGER,
    "jlpt" "JLPTLevel",

    CONSTRAINT "kanjis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "vocabulary_id" UUID,
    "status" "LearningStatus",
    "mastery" DOUBLE PRECISION,
    "correct_count" INTEGER,
    "wrong_count" INTEGER,
    "last_review" TIMESTAMP(6),
    "next_review" TIMESTAMP(6),

    CONSTRAINT "learning_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL,
    "course_id" UUID,
    "title" VARCHAR,
    "description" TEXT,
    "order_no" INTEGER,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "package_id" UUID,
    "promotion_id" UUID,
    "payment_method" "PaymentMethod",
    "payment_status" "PaymentStatus",
    "amount" DECIMAL,
    "gem_amount" INTEGER,
    "bonus_gem" INTEGER,
    "total_gem" INTEGER,
    "transaction_code" VARCHAR,
    "provider_transaction_id" VARCHAR,
    "payment_url" TEXT,
    "provider_response" TEXT,
    "expired_at" TIMESTAMP(6),
    "paid_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_histories" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "shop_item_id" UUID,
    "price" INTEGER,
    "currency" "CurrencyType",
    "purchased_at" TIMESTAMP(6),

    CONSTRAINT "purchase_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pvp_match_histories" (
    "id" UUID NOT NULL,
    "player1_id" UUID,
    "player2_id" UUID,
    "winner_id" UUID,
    "player1_score" INTEGER,
    "player2_score" INTEGER,
    "player1_correct" INTEGER,
    "player2_correct" INTEGER,
    "player1_time" INTEGER,
    "player2_time" INTEGER,
    "jlpt" "JLPTLevel",
    "question_count" INTEGER,
    "played_at" TIMESTAMP(6),

    CONSTRAINT "pvp_match_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_answers" (
    "id" UUID NOT NULL,
    "question_id" UUID,
    "answer" TEXT,
    "is_correct" BOOLEAN,

    CONSTRAINT "quiz_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" UUID NOT NULL,
    "quiz_id" UUID,
    "question" TEXT,
    "audio" VARCHAR,
    "image" VARCHAR,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" UUID NOT NULL,
    "topic_id" UUID,
    "title" VARCHAR,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_histories" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "vocabulary_id" UUID,
    "reviewed_at" TIMESTAMP(6),
    "correct" BOOLEAN,
    "duration" INTEGER,

    CONSTRAINT "review_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_banners" (
    "id" UUID NOT NULL,
    "title" VARCHAR,
    "description" TEXT,
    "image" VARCHAR,
    "shop_item_id" UUID,
    "start_at" TIMESTAMP(6),
    "end_at" TIMESTAMP(6),
    "is_active" BOOLEAN,

    CONSTRAINT "shop_banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_items" (
    "id" UUID NOT NULL,
    "name" VARCHAR,
    "description" TEXT,
    "image" VARCHAR,
    "preview_image" VARCHAR,
    "item_type" "ItemType",
    "rarity" "ItemRarity",
    "price" INTEGER,
    "currency" "CurrencyType",
    "status" "ItemStatus",
    "is_limited" BOOLEAN,
    "stock" INTEGER,
    "created_at" TIMESTAMP(6),

    CONSTRAINT "shop_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_vocabularies" (
    "topic_id" UUID NOT NULL,
    "vocabulary_id" UUID NOT NULL,

    CONSTRAINT "topic_vocabularies_pkey" PRIMARY KEY ("topic_id","vocabulary_id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" UUID NOT NULL,
    "lesson_id" UUID,
    "title" VARCHAR,
    "description" TEXT,
    "image" VARCHAR,
    "order_no" INTEGER,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "user_id" UUID NOT NULL,
    "achievement_id" UUID NOT NULL,
    "unlocked_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("user_id","achievement_id")
);

-- CreateTable
CREATE TABLE "user_equipped_items" (
    "user_id" UUID NOT NULL,
    "item_type" "ItemType" NOT NULL,
    "shop_item_id" UUID,
    "equipped_at" TIMESTAMP(6),

    CONSTRAINT "user_equipped_items_pkey" PRIMARY KEY ("user_id","item_type")
);

-- CreateTable
CREATE TABLE "user_pvp_statistics" (
    "user_id" UUID NOT NULL,
    "total_matches" INTEGER DEFAULT 0,
    "win_count" INTEGER DEFAULT 0,
    "lose_count" INTEGER DEFAULT 0,
    "draw_count" INTEGER DEFAULT 0,
    "total_score" INTEGER DEFAULT 0,
    "average_score" DOUBLE PRECISION DEFAULT 0,
    "longest_win_streak" INTEGER DEFAULT 0,
    "current_win_streak" INTEGER DEFAULT 0,
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "user_pvp_statistics_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_shop_items" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "shop_item_id" UUID,
    "purchased_at" TIMESTAMP(6),

    CONSTRAINT "user_shop_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_vocabularies" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "kanji" VARCHAR,
    "hiragana" VARCHAR,
    "romaji" VARCHAR,
    "meaning" TEXT,
    "note" TEXT,
    "image" VARCHAR,
    "audio" VARCHAR,
    "created_at" TIMESTAMP(6),

    CONSTRAINT "user_vocabularies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_wallets" (
    "user_id" UUID NOT NULL,
    "coins" INTEGER DEFAULT 0,
    "gems" INTEGER DEFAULT 0,
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "user_wallets_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR,
    "password_hash" VARCHAR,
    "display_name" VARCHAR,
    "avatar" VARCHAR,
    "level" INTEGER,
    "exp" INTEGER,
    "streak" INTEGER,
    "accepted_terms" BOOLEAN DEFAULT false,
    "jlpt_target_level" "JLPTLevel",
    "status" VARCHAR DEFAULT 'pending_verification',
    "email_verified" BOOLEAN DEFAULT false,
    "email_verified_at" TIMESTAMP(6),
    "last_login_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6),
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "consumed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL,
    "email" VARCHAR NOT NULL,
    "ip_address" VARCHAR NOT NULL,
    "succeeded" BOOLEAN NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR NOT NULL,
    "device_id" VARCHAR,
    "device_name" VARCHAR,
    "ip_address" VARCHAR NOT NULL,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabularies" (
    "id" UUID NOT NULL,
    "kanji" VARCHAR,
    "hiragana" VARCHAR,
    "romaji" VARCHAR,
    "word_type" "WordType",
    "jlpt" "JLPTLevel",
    "frequency" INTEGER,
    "audio" VARCHAR,
    "image" VARCHAR,
    "created_at" TIMESTAMP(6),

    CONSTRAINT "vocabularies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary_meanings" (
    "id" UUID NOT NULL,
    "vocabulary_id" UUID,
    "language" VARCHAR,
    "meaning" TEXT,
    "display_order" INTEGER,

    CONSTRAINT "vocabulary_meanings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_histories" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "transaction_type" "WalletTransactionType",
    "coin_change" INTEGER DEFAULT 0,
    "gem_change" INTEGER DEFAULT 0,
    "balance_coin" INTEGER,
    "balance_gem" INTEGER,
    "payment_transaction_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(6),

    CONSTRAINT "wallet_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "achievements_type_idx" ON "achievements"("type");

-- CreateIndex
CREATE INDEX "courses_order_no_idx" ON "courses"("order_no");

-- CreateIndex
CREATE INDEX "example_sentences_vocabulary_id_idx" ON "example_sentences"("vocabulary_id");

-- CreateIndex
CREATE INDEX "favorite_vocabularies_vocabulary_id_idx" ON "favorite_vocabularies"("vocabulary_id");

-- CreateIndex
CREATE INDEX "folder_system_vocabularies_vocabulary_id_idx" ON "folder_system_vocabularies"("vocabulary_id");

-- CreateIndex
CREATE INDEX "folder_user_vocabularies_user_vocabulary_id_idx" ON "folder_user_vocabularies"("user_vocabulary_id");

-- CreateIndex
CREATE INDEX "folders_user_id_idx" ON "folders"("user_id");

-- CreateIndex
CREATE INDEX "gem_packages_is_active_idx" ON "gem_packages"("is_active");

-- CreateIndex
CREATE INDEX "gem_packages_sort_order_idx" ON "gem_packages"("sort_order");

-- CreateIndex
CREATE INDEX "gem_promotions_is_active_idx" ON "gem_promotions"("is_active");

-- CreateIndex
CREATE INDEX "gem_promotions_start_at_end_at_idx" ON "gem_promotions"("start_at", "end_at");

-- CreateIndex
CREATE INDEX "grammar_examples_grammar_id_idx" ON "grammar_examples"("grammar_id");

-- CreateIndex
CREATE INDEX "grammar_points_lesson_id_jlpt_idx" ON "grammar_points"("lesson_id", "jlpt");

-- CreateIndex
CREATE INDEX "kanji_vocabularies_vocabulary_id_idx" ON "kanji_vocabularies"("vocabulary_id");

-- CreateIndex
CREATE INDEX "kanjis_jlpt_idx" ON "kanjis"("jlpt");

-- CreateIndex
CREATE INDEX "kanjis_kanji_idx" ON "kanjis"("kanji");

-- CreateIndex
CREATE INDEX "learning_progress_user_id_next_review_status_idx" ON "learning_progress"("user_id", "next_review", "status");

-- CreateIndex
CREATE UNIQUE INDEX "learning_progress_user_id_vocabulary_id_idx" ON "learning_progress"("user_id", "vocabulary_id");

-- CreateIndex
CREATE INDEX "lessons_course_id_order_no_idx" ON "lessons"("course_id", "order_no");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_transaction_code_key" ON "payment_transactions"("transaction_code");

-- CreateIndex
CREATE INDEX "payment_transactions_created_at_idx" ON "payment_transactions"("created_at");

-- CreateIndex
CREATE INDEX "payment_transactions_package_id_idx" ON "payment_transactions"("package_id");

-- CreateIndex
CREATE INDEX "payment_transactions_payment_status_idx" ON "payment_transactions"("payment_status");

-- CreateIndex
CREATE INDEX "payment_transactions_provider_transaction_id_idx" ON "payment_transactions"("provider_transaction_id");

-- CreateIndex
CREATE INDEX "payment_transactions_transaction_code_idx" ON "payment_transactions"("transaction_code");

-- CreateIndex
CREATE INDEX "payment_transactions_user_id_idx" ON "payment_transactions"("user_id");

-- CreateIndex
CREATE INDEX "purchase_histories_purchased_at_idx" ON "purchase_histories"("purchased_at");

-- CreateIndex
CREATE INDEX "purchase_histories_user_id_idx" ON "purchase_histories"("user_id");

-- CreateIndex
CREATE INDEX "pvp_match_histories_jlpt_idx" ON "pvp_match_histories"("jlpt");

-- CreateIndex
CREATE INDEX "pvp_match_histories_played_at_idx" ON "pvp_match_histories"("played_at");

-- CreateIndex
CREATE INDEX "pvp_match_histories_player1_id_idx" ON "pvp_match_histories"("player1_id");

-- CreateIndex
CREATE INDEX "pvp_match_histories_player2_id_idx" ON "pvp_match_histories"("player2_id");

-- CreateIndex
CREATE INDEX "pvp_match_histories_winner_id_idx" ON "pvp_match_histories"("winner_id");

-- CreateIndex
CREATE INDEX "quiz_answers_question_id_idx" ON "quiz_answers"("question_id");

-- CreateIndex
CREATE INDEX "quiz_questions_quiz_id_idx" ON "quiz_questions"("quiz_id");

-- CreateIndex
CREATE INDEX "quizzes_topic_id_idx" ON "quizzes"("topic_id");

-- CreateIndex
CREATE INDEX "review_histories_user_id_reviewed_at_idx" ON "review_histories"("user_id", "reviewed_at");

-- CreateIndex
CREATE INDEX "review_histories_user_id_vocabulary_id_idx" ON "review_histories"("user_id", "vocabulary_id");

-- CreateIndex
CREATE INDEX "shop_items_item_type_idx" ON "shop_items"("item_type");

-- CreateIndex
CREATE INDEX "shop_items_item_type_rarity_idx" ON "shop_items"("item_type", "rarity");

-- CreateIndex
CREATE INDEX "shop_items_rarity_idx" ON "shop_items"("rarity");

-- CreateIndex
CREATE INDEX "topic_vocabularies_vocabulary_id_idx" ON "topic_vocabularies"("vocabulary_id");

-- CreateIndex
CREATE INDEX "topics_lesson_id_order_no_idx" ON "topics"("lesson_id", "order_no");

-- CreateIndex
CREATE INDEX "user_achievements_user_id_idx" ON "user_achievements"("user_id");

-- CreateIndex
CREATE INDEX "user_pvp_statistics_total_matches_idx" ON "user_pvp_statistics"("total_matches");

-- CreateIndex
CREATE INDEX "user_pvp_statistics_win_count_idx" ON "user_pvp_statistics"("win_count");

-- CreateIndex
CREATE INDEX "user_shop_items_user_id_idx" ON "user_shop_items"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_shop_items_user_id_shop_item_id_idx" ON "user_shop_items"("user_id", "shop_item_id");

-- CreateIndex
CREATE INDEX "user_vocabularies_user_id_created_at_idx" ON "user_vocabularies"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");

-- CreateIndex
CREATE INDEX "email_verification_tokens_token_hash_idx" ON "email_verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "login_attempts_email_created_at_idx" ON "login_attempts"("email", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "vocabularies_hiragana_idx" ON "vocabularies"("hiragana");

-- CreateIndex
CREATE INDEX "vocabularies_jlpt_frequency_idx" ON "vocabularies"("jlpt", "frequency");

-- CreateIndex
CREATE INDEX "vocabularies_jlpt_idx" ON "vocabularies"("jlpt");

-- CreateIndex
CREATE INDEX "vocabularies_kanji_idx" ON "vocabularies"("kanji");

-- CreateIndex
CREATE INDEX "vocabulary_meanings_vocabulary_id_display_order_idx" ON "vocabulary_meanings"("vocabulary_id", "display_order");

-- CreateIndex
CREATE INDEX "wallet_histories_created_at_idx" ON "wallet_histories"("created_at");

-- CreateIndex
CREATE INDEX "wallet_histories_payment_transaction_id_idx" ON "wallet_histories"("payment_transaction_id");

-- CreateIndex
CREATE INDEX "wallet_histories_user_id_idx" ON "wallet_histories"("user_id");

-- AddForeignKey
ALTER TABLE "example_sentences" ADD CONSTRAINT "example_sentences_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "vocabularies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "favorite_vocabularies" ADD CONSTRAINT "favorite_vocabularies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "favorite_vocabularies" ADD CONSTRAINT "favorite_vocabularies_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "vocabularies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "folder_system_vocabularies" ADD CONSTRAINT "folder_system_vocabularies_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "folder_system_vocabularies" ADD CONSTRAINT "folder_system_vocabularies_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "vocabularies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "folder_user_vocabularies" ADD CONSTRAINT "folder_user_vocabularies_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "folder_user_vocabularies" ADD CONSTRAINT "folder_user_vocabularies_user_vocabulary_id_fkey" FOREIGN KEY ("user_vocabulary_id") REFERENCES "user_vocabularies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "grammar_examples" ADD CONSTRAINT "grammar_examples_grammar_id_fkey" FOREIGN KEY ("grammar_id") REFERENCES "grammar_points"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "grammar_points" ADD CONSTRAINT "grammar_points_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "kanji_vocabularies" ADD CONSTRAINT "kanji_vocabularies_kanji_id_fkey" FOREIGN KEY ("kanji_id") REFERENCES "kanjis"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "kanji_vocabularies" ADD CONSTRAINT "kanji_vocabularies_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "vocabularies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "learning_progress" ADD CONSTRAINT "learning_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "learning_progress" ADD CONSTRAINT "learning_progress_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "vocabularies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "gem_packages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "gem_promotions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "purchase_histories" ADD CONSTRAINT "purchase_histories_shop_item_id_fkey" FOREIGN KEY ("shop_item_id") REFERENCES "shop_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "purchase_histories" ADD CONSTRAINT "purchase_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pvp_match_histories" ADD CONSTRAINT "pvp_match_histories_player1_id_fkey" FOREIGN KEY ("player1_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pvp_match_histories" ADD CONSTRAINT "pvp_match_histories_player2_id_fkey" FOREIGN KEY ("player2_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pvp_match_histories" ADD CONSTRAINT "pvp_match_histories_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "review_histories" ADD CONSTRAINT "review_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "review_histories" ADD CONSTRAINT "review_histories_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "vocabularies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shop_banners" ADD CONSTRAINT "shop_banners_shop_item_id_fkey" FOREIGN KEY ("shop_item_id") REFERENCES "shop_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "topic_vocabularies" ADD CONSTRAINT "topic_vocabularies_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "topic_vocabularies" ADD CONSTRAINT "topic_vocabularies_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "vocabularies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_equipped_items" ADD CONSTRAINT "user_equipped_items_shop_item_id_fkey" FOREIGN KEY ("shop_item_id") REFERENCES "shop_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_equipped_items" ADD CONSTRAINT "user_equipped_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_pvp_statistics" ADD CONSTRAINT "user_pvp_statistics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_shop_items" ADD CONSTRAINT "user_shop_items_shop_item_id_fkey" FOREIGN KEY ("shop_item_id") REFERENCES "shop_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_shop_items" ADD CONSTRAINT "user_shop_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_vocabularies" ADD CONSTRAINT "user_vocabularies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_meanings" ADD CONSTRAINT "vocabulary_meanings_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "vocabularies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wallet_histories" ADD CONSTRAINT "wallet_histories_payment_transaction_id_fkey" FOREIGN KEY ("payment_transaction_id") REFERENCES "payment_transactions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wallet_histories" ADD CONSTRAINT "wallet_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
