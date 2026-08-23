-- CreateEnum
CREATE TYPE "LeaderboardPeriodType" AS ENUM ('daily', 'weekly', 'monthly', 'all_time');

-- CreateTable
CREATE TABLE "leaderboard_snapshots" (
    "id" UUID NOT NULL,
    "period_type" "LeaderboardPeriodType" NOT NULL,
    "period_key" VARCHAR NOT NULL,
    "rank" INTEGER NOT NULL,
    "user_id" UUID NOT NULL,
    "display_name" VARCHAR,
    "avatar_url" VARCHAR,
    "xp_total" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leaderboard_snapshots_period_type_period_key_rank_idx" ON "leaderboard_snapshots"("period_type", "period_key", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_snapshots_period_type_period_key_user_id_key" ON "leaderboard_snapshots"("period_type", "period_key", "user_id");

-- AddForeignKey
ALTER TABLE "leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
