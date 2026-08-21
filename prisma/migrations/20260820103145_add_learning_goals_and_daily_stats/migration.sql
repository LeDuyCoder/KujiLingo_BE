-- AlterTable
ALTER TABLE "users" ADD COLUMN     "learning_goal_minutes" INTEGER DEFAULT 15,
ADD COLUMN     "longest_streak" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "user_statistics_daily" (
    "user_id" UUID NOT NULL,
    "stat_date" DATE NOT NULL,
    "minutes_studied" INTEGER NOT NULL DEFAULT 0,
    "lessons_completed" INTEGER NOT NULL DEFAULT 0,
    "exp_earned" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_statistics_daily_pkey" PRIMARY KEY ("user_id","stat_date")
);

-- CreateIndex
CREATE INDEX "user_statistics_daily_user_id_stat_date_idx" ON "user_statistics_daily"("user_id", "stat_date");

-- AddForeignKey
ALTER TABLE "user_statistics_daily" ADD CONSTRAINT "user_statistics_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
