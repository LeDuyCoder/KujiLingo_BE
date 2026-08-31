import type { FastifyReply, FastifyRequest } from "fastify";
import { achievementsService } from "./achievements.service.js";
import type {
    GetCatalogQuery,
    GetMyAchievementsQuery,
    GetAchievementParams,
    CreateAchievementBody,
    UpdateAchievementBody,
    GetMyShowcaseQuery,
    UserShowcaseParam,
    UpdateShowcaseBody
} from "./achievements.types.js";
import { log } from "../../common/utils/log.js";

export const achievementsController = {
    async getCatalog(
        request: FastifyRequest,
        reply: FastifyReply
    ) {
        try {
            const userId = request.user!.id;
            const query = request.query as GetCatalogQuery;
            const result = await achievementsService.getCatalog(userId, query);
            return reply.code(200).send(result);
        } catch (error: any) {
            log.error(error);
            return reply.code(500).send({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "An unexpected error occurred. Please try again later."
                }
            });
        }
    },

    async getMyAchievements(
        request: FastifyRequest,
        reply: FastifyReply
    ) {
        try {
            const userId = request.user!.id;
            const query = request.query as GetMyAchievementsQuery;
            const result = await achievementsService.getMyAchievements(userId, query);
            return reply.code(200).send(result);
        } catch (error: any) {
            log.error(error);
            return reply.code(500).send({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "An unexpected error occurred. Please try again later."
                }
            });
        }
    },

    async getMyAchievementDetail(
        request: FastifyRequest,
        reply: FastifyReply
    ) {
        try {
            const userId = request.user!.id;
            const { achievementId } = request.params as GetAchievementParams;
            const result = await achievementsService.getMyAchievementDetail(userId, achievementId);
            return reply.code(200).send(result);
        } catch (error: any) {
            log.error(error);
            if (error.message === "ACHIEVEMENT_NOT_FOUND") {
                return reply.code(404).send({
                    success: false,
                    error: {
                        code: "ACHIEVEMENT_NOT_FOUND",
                        message: "Achievement not found."
                    }
                });
            }
            return reply.code(500).send({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "An unexpected error occurred. Please try again later."
                }
            });
        }
    },

    async create(
        request: FastifyRequest,
        reply: FastifyReply
    ) {
        try {
            const body = request.body as CreateAchievementBody;
            const result = await achievementsService.createAchievement(body);
            return reply.code(201).send(result);
        } catch (error: any) {
            log.error(error);
            if (error.message === "DUPLICATE_ACHIEVEMENT") {
                return reply.code(400).send({
                    success: false,
                    error: {
                        code: "DUPLICATE_ACHIEVEMENT",
                        message: "An achievement with the same title, type, and threshold already exists."
                    }
                });
            }
            return reply.code(500).send({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "An unexpected error occurred. Please try again later."
                }
            });
        }
    },

    async update(
        request: FastifyRequest,
        reply: FastifyReply
    ) {
        try {
            const { achievementId } = request.params as GetAchievementParams;
            const body = request.body as UpdateAchievementBody;
            const result = await achievementsService.updateAchievement(achievementId, body);
            return reply.code(200).send(result);
        } catch (error: any) {
            log.error(error);
            if (error.message === "ACHIEVEMENT_NOT_FOUND") {
                return reply.code(404).send({
                    success: false,
                    error: {
                        code: "ACHIEVEMENT_NOT_FOUND",
                        message: "Achievement not found."
                    }
                });
            }
            if (error.message === "DUPLICATE_ACHIEVEMENT") {
                return reply.code(400).send({
                    success: false,
                    error: {
                        code: "DUPLICATE_ACHIEVEMENT",
                        message: "An achievement with the same title, type, and threshold already exists."
                    }
                });
            }
            return reply.code(500).send({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "An unexpected error occurred. Please try again later."
                }
            });
        }
    },

    async getMyShowcase(
        request: FastifyRequest,
        reply: FastifyReply
    ) {
        try {
            const userId = request.user!.id;
            const query = request.query as GetMyShowcaseQuery;
            const result = await achievementsService.getMyShowcase(userId, query.limit);
            return reply.code(200).send(result);
        } catch (error: any) {
            log.error(error);
            return reply.code(500).send({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "An unexpected error occurred. Please try again later."
                }
            });
        }
    },

    async getUserShowcase(
        request: FastifyRequest,
        reply: FastifyReply
    ) {
        try {
            const { userId } = request.params as UserShowcaseParam;
            const result = await achievementsService.getUserShowcase(userId);
            return reply.code(200).send(result);
        } catch (error: any) {
            log.error(error);
            if (error.message === "USER_NOT_FOUND") {
                return reply.code(404).send({
                    success: false,
                    error: {
                        code: "USER_NOT_FOUND",
                        message: "User not found."
                    }
                });
            }
            return reply.code(500).send({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "An unexpected error occurred. Please try again later."
                }
            });
        }
    },

    async updateMyShowcase(
        request: FastifyRequest,
        reply: FastifyReply
    ) {
        try {
            const userId = request.user!.id;
            const body = request.body as UpdateShowcaseBody;
            const result = await achievementsService.updateMyShowcase(userId, body);
            return reply.code(200).send(result);
        } catch (error: any) {
            log.error(error);
            if (error.message === "ACHIEVEMENT_NOT_FOUND") {
                return reply.code(404).send({
                    success: false,
                    error: {
                        code: "ACHIEVEMENT_NOT_FOUND",
                        message: "Achievement not found for current user."
                    }
                });
            }
            if (error.message === "INVALID_SHOWCASE_SELECTION") {
                return reply.code(400).send({
                    success: false,
                    error: {
                        code: "INVALID_SHOWCASE_SELECTION",
                        message: "Achievement must be unlocked and max 3 items are allowed."
                    }
                });
            }
            return reply.code(500).send({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "An unexpected error occurred. Please try again later."
                }
            });
        }
    }
};
