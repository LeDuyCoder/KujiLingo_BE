import crypto from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { achievementsRepository } from "./achievements.repository.js";
import type {
    GetCatalogQuery,
    GetMyAchievementsQuery,
    CreateAchievementBody,
    UpdateAchievementBody,
    UpdateShowcaseBody
} from "./achievements.types.js";

export async function evaluateProgressAndUnlock(userId: string) {
    return prisma.$transaction(async (tx) => {
        const user = await tx.users.findUnique({
            where: { id: userId },
            select: { exp: true, streak: true }
        });
        if (!user) return;

        const masteredCount = await tx.learning_progress.count({
            where: { user_id: userId, status: "MASTERED" }
        });

        const perfectQuizCount = 0;

        const allAchievements = await tx.achievements.findMany();
        const unlocked = await tx.user_achievements.findMany({
            where: { user_id: userId }
        });
        const unlockedIds = new Set(unlocked.map(ua => ua.achievement_id));

        let currentExp = user.exp ?? 0;

        for (const ach of allAchievements) {
            if (unlockedIds.has(ach.id)) {
                continue;
            }

            let currentValue = 0;
            if (ach.type === "STREAK") {
                currentValue = user.streak ?? 0;
            } else if (ach.type === "EXP") {
                currentValue = currentExp;
            } else if (ach.type === "VOCAB_MASTER") {
                currentValue = masteredCount;
            } else if (ach.type === "QUIZ_PERFECT") {
                currentValue = perfectQuizCount;
            }

            if (currentValue >= ach.condition_value) {
                await tx.user_achievements.create({
                    data: {
                        user_id: userId,
                        achievement_id: ach.id,
                        unlocked_at: new Date()
                    }
                });

                const reward = ach.reward_exp ?? 0;
                if (reward > 0) {
                    currentExp += reward;
                    await tx.users.update({
                        where: { id: userId },
                        data: { exp: currentExp }
                    });
                }
            }
        }
    });
}

export const achievementsService = {
    async getCatalog(userId: string, filters: GetCatalogQuery) {
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 20;

        // 1. Evaluate and auto-unlock achievements
        await evaluateProgressAndUnlock(userId);

        // 2. Fetch catalog list
        const { items, total } = await achievementsRepository.findCatalog({ ...filters, page, limit });

        // 3. Fetch user stats to calculate progress values
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { exp: true, streak: true }
        });
        const exp = user?.exp ?? 0;
        const streak = user?.streak ?? 0;
        const masteredCount = await prisma.learning_progress.count({
            where: { user_id: userId, status: "MASTERED" }
        });
        const perfectQuizCount = 0;

        // Fetch unlocked map
        const unlockedList = await achievementsRepository.findUnlockedByIds(userId, items.map(i => i.id));
        const unlockedMap = new Map(unlockedList.map(ua => [ua.achievement_id, ua.unlocked_at]));

        const resultItems = items.map(item => {
            const isUnlocked = unlockedMap.has(item.id);
            const unlockedAt = unlockedMap.get(item.id) || null;

            let currentValue = 0;
            if (item.type === "STREAK") {
                currentValue = streak;
            } else if (item.type === "EXP") {
                currentValue = exp;
            } else if (item.type === "VOCAB_MASTER") {
                currentValue = masteredCount;
            } else if (item.type === "QUIZ_PERFECT") {
                currentValue = perfectQuizCount;
            }

            const progressPercent = item.condition_value > 0
                ? Math.min(Math.round((currentValue / item.condition_value) * 100), 100)
                : 100;

            return {
                id: item.id,
                title: item.title,
                description: item.description,
                icon: item.icon,
                type: item.type,
                condition_value: item.condition_value,
                reward_exp: item.reward_exp ?? 0,
                is_unlocked: isUnlocked,
                unlocked_at: unlockedAt ? unlockedAt.toISOString() : null,
                current_value: isUnlocked ? item.condition_value : currentValue,
                progress_percent: progressPercent
            };
        });

        return {
            success: true as const,
            data: {
                items: resultItems,
                pagination: {
                    page,
                    limit,
                    total
                }
            }
        };
    },

    async getMyAchievements(userId: string, filters: GetMyAchievementsQuery) {
        // 1. Evaluate and auto-unlock achievements
        await evaluateProgressAndUnlock(userId);

        // 2. Fetch all achievements
        const allItems = await achievementsRepository.findAll();

        // 3. Fetch user stats to calculate progress values
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { exp: true, streak: true }
        });
        const exp = user?.exp ?? 0;
        const streak = user?.streak ?? 0;
        const masteredCount = await prisma.learning_progress.count({
            where: { user_id: userId, status: "MASTERED" }
        });
        const perfectQuizCount = 0;

        // Fetch unlocked map
        const unlockedList = await achievementsRepository.findUnlocked(userId);
        const unlockedMap = new Map(unlockedList.map(ua => [ua.achievement_id, ua.unlocked_at]));

        let totalAchievements = 0;
        let unlockedCount = 0;
        let inProgressCount = 0;
        let notStartedCount = 0;

        let items = allItems.map(item => {
            const isUnlocked = unlockedMap.has(item.id);
            const unlockedAt = unlockedMap.get(item.id) || null;

            let currentValue = 0;
            if (item.type === "STREAK") {
                currentValue = streak;
            } else if (item.type === "EXP") {
                currentValue = exp;
            } else if (item.type === "VOCAB_MASTER") {
                currentValue = masteredCount;
            } else if (item.type === "QUIZ_PERFECT") {
                currentValue = perfectQuizCount;
            }

            const progressPercent = item.condition_value > 0
                ? Math.min(Math.round((currentValue / item.condition_value) * 100), 100)
                : 100;

            let status: "unlocked" | "in_progress" | "not_started" = "not_started";
            if (isUnlocked) {
                status = "unlocked";
                unlockedCount++;
            } else if (progressPercent > 0) {
                status = "in_progress";
                inProgressCount++;
            } else {
                status = "not_started";
                notStartedCount++;
            }
            totalAchievements++;

            return {
                id: item.id,
                title: item.title,
                description: item.description,
                icon: item.icon,
                type: item.type,
                condition_value: item.condition_value,
                reward_exp: item.reward_exp ?? 0,
                status,
                is_unlocked: isUnlocked,
                unlocked_at: unlockedAt ? unlockedAt.toISOString() : null,
                current_value: isUnlocked ? item.condition_value : currentValue,
                progress_percent: progressPercent
            };
        });

        // Apply filters
        if (filters.type) {
            items = items.filter(item => item.type === filters.type);
        }

        if (filters.unlocked_only) {
            items = items.filter(item => item.status === "unlocked");
        }

        // Sort: unlocked first, then in_progress, then not_started
        const statusOrder = { unlocked: 1, in_progress: 2, not_started: 3 };
        items.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

        return {
            success: true as const,
            data: {
                summary: {
                    total_achievements: totalAchievements,
                    unlocked_count: unlockedCount,
                    in_progress_count: inProgressCount,
                    not_started_count: notStartedCount
                },
                items
            }
        };
    },

    async getMyAchievementDetail(userId: string, achievementId: string) {
        // 1. Evaluate and auto-unlock achievements
        await evaluateProgressAndUnlock(userId);

        // 2. Fetch achievement definition
        const item = await achievementsRepository.findById(achievementId);
        if (!item) {
            throw new Error("ACHIEVEMENT_NOT_FOUND");
        }

        // 3. Fetch user stats
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { exp: true, streak: true }
        });
        const exp = user?.exp ?? 0;
        const streak = user?.streak ?? 0;
        const masteredCount = await prisma.learning_progress.count({
            where: { user_id: userId, status: "MASTERED" }
        });
        const perfectQuizCount = 0;

        // Fetch unlocked status
        const unlockedRecord = await prisma.user_achievements.findUnique({
            where: {
                user_id_achievement_id: {
                    user_id: userId,
                    achievement_id: achievementId
                }
            }
        });

        const isUnlocked = !!unlockedRecord;
        const unlockedAt = unlockedRecord?.unlocked_at || null;

        let currentValue = 0;
        if (item.type === "STREAK") {
            currentValue = streak;
        } else if (item.type === "EXP") {
            currentValue = exp;
        } else if (item.type === "VOCAB_MASTER") {
            currentValue = masteredCount;
        } else if (item.type === "QUIZ_PERFECT") {
            currentValue = perfectQuizCount;
        }

        const progressPercent = item.condition_value > 0
            ? Math.min(Math.round((currentValue / item.condition_value) * 100), 100)
            : 100;

        const remainingValue = Math.max(0, item.condition_value - currentValue);

        let status: "unlocked" | "in_progress" | "not_started" = "not_started";
        if (isUnlocked) {
            status = "unlocked";
        } else if (progressPercent > 0) {
            status = "in_progress";
        }

        return {
            success: true as const,
            data: {
                id: item.id,
                title: item.title,
                description: item.description,
                icon: item.icon,
                type: item.type,
                condition_value: item.condition_value,
                reward_exp: item.reward_exp ?? 0,
                is_unlocked: isUnlocked,
                unlocked_at: unlockedAt ? unlockedAt.toISOString() : null,
                current_value: isUnlocked ? item.condition_value : currentValue,
                progress_percent: progressPercent,
                remaining_value: isUnlocked ? 0 : remainingValue,
                status
            }
        };
    },

    async createAchievement(data: CreateAchievementBody) {
        // Check uniqueness
        const existing = await achievementsRepository.findByTitleTypeThreshold(
            data.title,
            data.type,
            data.condition_value
        );
        if (existing) {
            throw new Error("DUPLICATE_ACHIEVEMENT");
        }

        const created = await achievementsRepository.create({
            id: crypto.randomUUID(),
            title: data.title,
            description: data.description,
            icon: data.icon,
            type: data.type,
            condition_value: data.condition_value,
            reward_exp: data.reward_exp ?? 0
        });

        return {
            success: true as const,
            data: {
                id: created.id,
                title: created.title,
                description: created.description,
                icon: created.icon,
                type: created.type,
                condition_value: created.condition_value,
                reward_exp: created.reward_exp ?? 0,
                created_at: created.created_at ? created.created_at.toISOString() : new Date().toISOString()
            }
        };
    },

    async updateAchievement(id: string, data: UpdateAchievementBody) {
        const existing = await achievementsRepository.findById(id);
        if (!existing) {
            throw new Error("ACHIEVEMENT_NOT_FOUND");
        }

        if (data.title !== undefined) {
            if (data.title !== existing.title) {
                const dup = await achievementsRepository.findByTitleTypeThreshold(
                    data.title,
                    existing.type,
                    existing.condition_value
                );
                if (dup) {
                    throw new Error("DUPLICATE_ACHIEVEMENT");
                }
            }
        }

        const updated = await achievementsRepository.update(id, {
            title: data.title,
            description: data.description,
            icon: data.icon,
            reward_exp: data.reward_exp
        });

        return {
            success: true as const,
            data: {
                id: updated.id,
                title: updated.title,
                description: updated.description,
                icon: updated.icon,
                type: updated.type,
                condition_value: updated.condition_value,
                reward_exp: updated.reward_exp ?? 0,
                updated_at: new Date().toISOString()
            }
        };
    },

    async getMyShowcase(userId: string, limit: number = 3) {
        const showcase = await prisma.user_achievement_showcase.findMany({
            where: { user_id: userId },
            take: limit,
            orderBy: { slot: "asc" },
            include: {
                achievements: true
            }
        });
        const achievementIds = showcase.map(s => s.achievement_id);
        const unlocked = await prisma.user_achievements.findMany({
            where: {
                user_id: userId,
                achievement_id: { in: achievementIds }
            }
        });
        const unlockedMap = new Map(unlocked.map(ua => [ua.achievement_id, ua.unlocked_at]));

        const items = showcase.map(s => {
            const ach = s.achievements;
            const unlockedAt = unlockedMap.get(s.achievement_id) || null;
            return {
                id: ach.id,
                title: ach.title,
                description: ach.description,
                icon: ach.icon,
                type: ach.type,
                reward_exp: ach.reward_exp ?? 0,
                unlocked_at: unlockedAt ? unlockedAt.toISOString() : null,
                slot: s.slot
            };
        });

        return {
            success: true as const,
            data: {
                items,
                count: items.length
            }
        };
    },

    async getUserShowcase(userId: string) {
        const targetUser = await prisma.users.findUnique({
            where: { id: userId },
            select: { display_name: true }
        });
        if (!targetUser) {
            throw new Error("USER_NOT_FOUND");
        }

        let showcase = await prisma.user_achievement_showcase.findMany({
            where: { user_id: userId, is_public: true },
            orderBy: { slot: "asc" },
            include: {
                achievements: true
            }
        });

        let items: any[] = [];
        if (showcase.length > 0) {
            const achievementIds = showcase.map(s => s.achievement_id);
            const unlocked = await prisma.user_achievements.findMany({
                where: {
                    user_id: userId,
                    achievement_id: { in: achievementIds }
                }
            });
            const unlockedMap = new Map(unlocked.map(ua => [ua.achievement_id, ua.unlocked_at]));

            items = showcase.map(s => {
                const ach = s.achievements;
                const unlockedAt = unlockedMap.get(s.achievement_id) || null;
                return {
                    id: ach.id,
                    title: ach.title,
                    description: ach.description,
                    icon: ach.icon,
                    type: ach.type,
                    unlocked_at: unlockedAt ? unlockedAt.toISOString() : null
                };
            });
        } else {
            // Fallback: If no custom showcase is set, auto-populate with up to 6 unlocked achievements
            const unlocked = await prisma.user_achievements.findMany({
                where: { user_id: userId },
                orderBy: { unlocked_at: "desc" },
                take: 6,
                include: {
                    achievements: true
                }
            });
            items = unlocked.map(ua => {
                const ach = ua.achievements;
                return {
                    id: ach.id,
                    title: ach.title,
                    description: ach.description,
                    icon: ach.icon,
                    type: ach.type,
                    unlocked_at: ua.unlocked_at ? ua.unlocked_at.toISOString() : null
                };
            });
        }

        return {
            success: true as const,
            data: {
                user_id: userId,
                display_name: targetUser.display_name || "User",
                items,
                count: items.length
            }
        };
    },

    async updateMyShowcase(userId: string, body: UpdateShowcaseBody) {
        if (body.achievement_ids !== undefined) {
            // Bulk update
            if (body.achievement_ids.length > 3) {
                throw new Error("INVALID_SHOWCASE_SELECTION");
            }
            const unlocked = await prisma.user_achievements.findMany({
                where: {
                    user_id: userId,
                    achievement_id: { in: body.achievement_ids }
                }
            });
            if (unlocked.length !== body.achievement_ids.length) {
                throw new Error("INVALID_SHOWCASE_SELECTION");
            }

            await prisma.$transaction(async (tx) => {
                await tx.user_achievement_showcase.deleteMany({
                    where: { user_id: userId }
                });
                if (body.achievement_ids!.length > 0) {
                    const createData = body.achievement_ids!.map((id: string, index: number) => ({
                        id: crypto.randomUUID(),
                        user_id: userId,
                        achievement_id: id,
                        slot: index + 1,
                        is_public: true
                    }));
                    await tx.user_achievement_showcase.createMany({
                        data: createData
                    });
                }
            });

            return {
                success: true as const,
                data: {
                    updated: true,
                    achievement_ids: body.achievement_ids
                }
            };
        } else if (body.achievement_id !== undefined && body.slot !== undefined) {
            // Single slot update
            const targetAchievementId = body.achievement_id;
            const targetSlot = body.slot;

            if (targetSlot < 1 || targetSlot > 3) {
                throw new Error("INVALID_SHOWCASE_SELECTION");
            }
            const achievementExists = await prisma.achievements.findUnique({
                where: { id: targetAchievementId }
            });
            if (!achievementExists) {
                throw new Error("ACHIEVEMENT_NOT_FOUND");
            }

            const isUnlocked = await prisma.user_achievements.findUnique({
                where: {
                    user_id_achievement_id: {
                        user_id: userId,
                        achievement_id: targetAchievementId
                    }
                }
            });
            if (!isUnlocked) {
                throw new Error("INVALID_SHOWCASE_SELECTION");
            }

            let currentIds: string[] = [];
            await prisma.$transaction(async (tx) => {
                // Clear slot and check duplicates in other slots
                await tx.user_achievement_showcase.deleteMany({
                    where: { user_id: userId, slot: targetSlot }
                });
                await tx.user_achievement_showcase.deleteMany({
                    where: { user_id: userId, achievement_id: targetAchievementId }
                });

                await tx.user_achievement_showcase.create({
                    data: {
                        id: crypto.randomUUID(),
                        user_id: userId,
                        achievement_id: targetAchievementId,
                        slot: targetSlot,
                        is_public: true
                    }
                });

                const currentShowcase = await tx.user_achievement_showcase.findMany({
                    where: { user_id: userId },
                    orderBy: { slot: "asc" }
                });
                currentIds = currentShowcase.map(s => s.achievement_id);
            });

            return {
                success: true as const,
                data: {
                    updated: true,
                    achievement_ids: currentIds
                }
            };
        } else {
            // Clear all
            await prisma.user_achievement_showcase.deleteMany({
                where: { user_id: userId }
            });
            return {
                success: true as const,
                data: {
                    updated: true,
                    achievement_ids: []
                }
            };
        }
    }
};
