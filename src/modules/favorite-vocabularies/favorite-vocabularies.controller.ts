import type { FastifyReply, FastifyRequest } from "fastify";
import { favoriteVocabulariesService } from "./favorite-vocabularies.service.js";
import type { ListFavoritesQuery, AddFavoriteBody, RemoveFavoriteParams } from "./favorite-vocabularies.types.js";
import { log } from "../../common/utils/log.js";

function resolveLanguage(acceptLanguageHeader?: string): string {
    if (!acceptLanguageHeader) return "vi";
    const primary = acceptLanguageHeader.split(",")[0]?.split("-")[0]?.trim().toLowerCase();
    return primary || "vi";
}

export async function listFavoritesHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    try {
        const userId = request.user!.id;
        const acceptLanguageHeader = request.headers["accept-language"] as string | undefined;
        const language = resolveLanguage(acceptLanguageHeader);
        const { page = 1, limit = 30 } = (request.query as ListFavoritesQuery) || {};

        const result = await favoriteVocabulariesService.listFavorites(
            userId,
            language,
            page,
            limit
        );

        return reply.code(200).send(result);
    } catch (error: any) {
        log.error(error);
        return reply.code(500).send({
            success: false,
            error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred. Please try again later.",
            },
        });
    }
}

export async function addFavoriteHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    try {
        const userId = request.user!.id;
        const { vocabulary_id } = request.body as AddFavoriteBody;

        const result = await favoriteVocabulariesService.addFavorite(userId, vocabulary_id);

        return reply.code(201).send(result);
    } catch (error: any) {
        log.error(error);

        if (error.message === "INVALID_VOCABULARY_REFERENCE") {
            return reply.code(422).send({
                success: false,
                error: {
                    code: "INVALID_VOCABULARY_REFERENCE",
                    message: "Vocabulary not found.",
                },
            });
        }

        if (error.message === "ALREADY_FAVORITED") {
            return reply.code(409).send({
                success: false,
                error: {
                    code: "ALREADY_FAVORITED",
                    message: "Vocabulary is already in favorites.",
                },
            });
        }

        return reply.code(500).send({
            success: false,
            error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred. Please try again later.",
            },
        });
    }
}

export async function removeFavoriteHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    try {
        const userId = request.user!.id;
        const { vocabularyId } = request.params as RemoveFavoriteParams;

        const result = await favoriteVocabulariesService.removeFavorite(userId, vocabularyId);

        return reply.code(200).send(result);
    } catch (error: any) {
        log.error(error);

        return reply.code(500).send({
            success: false,
            error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred. Please try again later.",
            },
        });
    }
}
