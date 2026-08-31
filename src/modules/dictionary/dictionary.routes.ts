import type { FastifyInstance } from "fastify";
import { dictionaryIdParamasSchema, searchQueryParamsSchema } from "./dictionary.schema.js";
import { getDetailHandler, searchHandler } from "./dictionary.controller.js";
import { authGuard } from "../../common/middlewares/auth.guard.js";

export async function dictionaryRoutes(app: FastifyInstance) {
    app.get("/api/v1/dictionary/search", {
        schema: {
            tags: ["Dictionary"],
            querystring: searchQueryParamsSchema,
        }
    }, searchHandler);

    app.get("/api/v1/dictionary/:id", {
        schema: {
            tags: ["Dictionary"],
            params: dictionaryIdParamasSchema
        }
    }, getDetailHandler);
}