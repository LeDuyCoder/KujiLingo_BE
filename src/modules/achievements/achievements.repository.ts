import { prisma } from "../../config/prisma.js";

export const achievementsRepository = {
    async findCatalog(filters: { type?: "STREAK" | "EXP" | "VOCAB_MASTER" | "QUIZ_PERFECT" | undefined; page: number; limit: number }) {
        const offset = (filters.page - 1) * filters.limit;
        const where: any = {};
        if (filters.type) {
            where.type = filters.type;
        }

        const [items, total] = await Promise.all([
            prisma.achievements.findMany({
                where,
                orderBy: [
                    { type: "asc" },
                    { condition_value: "asc" }
                ],
                skip: offset,
                take: filters.limit
            }),
            prisma.achievements.count({ where })
        ]);

        return { items, total };
    },

    async findAll() {
        return prisma.achievements.findMany({
            orderBy: [
                { type: "asc" },
                { condition_value: "asc" }
            ]
        });
    },

    async findUnlocked(userId: string) {
        return prisma.user_achievements.findMany({
            where: { user_id: userId }
        });
    },

    async findUnlockedByIds(userId: string, achievementIds: string[]) {
        return prisma.user_achievements.findMany({
            where: {
                user_id: userId,
                achievement_id: { in: achievementIds }
            }
        });
    },

    async findById(id: string) {
        return prisma.achievements.findUnique({
            where: { id }
        });
    },

    async findByTitleTypeThreshold(title: string, type: "STREAK" | "EXP" | "VOCAB_MASTER" | "QUIZ_PERFECT", conditionValue: number) {
        return prisma.achievements.findFirst({
            where: {
                title,
                type,
                condition_value: conditionValue
            }
        });
    },

    async create(data: {
        id: string;
        title: string;
        description: string;
        icon: string;
        type: "STREAK" | "EXP" | "VOCAB_MASTER" | "QUIZ_PERFECT";
        condition_value: number;
        reward_exp: number;
    }) {
        return prisma.achievements.create({
            data
        });
    },

    async update(id: string, data: {
        title?: string | undefined;
        description?: string | undefined;
        icon?: string | undefined;
        reward_exp?: number | undefined;
    }) {
        const updateData: any = {};
        if (data.title !== undefined) updateData.title = data.title;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.icon !== undefined) updateData.icon = data.icon;
        if (data.reward_exp !== undefined) updateData.reward_exp = data.reward_exp;

        return prisma.achievements.update({
            where: { id },
            data: updateData
        });
    }
};
