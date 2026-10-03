import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { authGuard } from "../../common/middlewares/auth.guard.js";
import { srsController } from "./srs.controller.js";
import {
    getDueCardsQuerySchema,
    getDueCardsResponseSchema,
    reviewBodySchema,
    reviewResponseSchema,
    addItemBodySchema
} from "./srs.schema.js";

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const looseUuid = z.string().regex(uuidRegex, "Invalid UUID format.");

export async function srsRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    // Secure all routes with authGuard
    router.addHook("preHandler", authGuard);

    // 1. Get Due Cards
    router.get(
        "/api/v1/srs/due",
        {
            schema: {
                tags: ["SRS"],
                summary: "Get Due Cards",
                description: "Returns the cards due or overdue for study.",
                querystring: getDueCardsQuerySchema,
                response: {
                    200: getDueCardsResponseSchema,
                    401: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) }),
                    500: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) })
                }
            }
        },
        srsController.getDue
    );

    // 2. Submit Review
    router.post(
        "/api/v1/srs/cards/:cardId/review",
        {
            schema: {
                tags: ["SRS"],
                summary: "Submit Review",
                description: "Updates interval and repetitions for a card.",
                params: z.object({ cardId: looseUuid }),
                body: reviewBodySchema,
                response: {
                    200: reviewResponseSchema,
                    401: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) }),
                    404: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) }),
                    500: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) })
                }
            }
        },
        srsController.submitReview
    );

    // 3. Add Item to SRS
    router.post(
        "/api/v1/srs/items",
        {
            schema: {
                tags: ["SRS"],
                summary: "Add Item to SRS",
                description: "Enrolls an item in the SRS queue.",
                body: addItemBodySchema,
                response: {
                    201: z.object({
                        success: z.boolean(),
                        data: z.object({
                            card_id: looseUuid,
                            item_type: z.enum(["vocabulary", "kanji", "grammar"]),
                            item_id: looseUuid,
                            state: z.enum(["new", "learning", "review", "relearning"]),
                            due_at: z.string().datetime().or(z.date()).or(z.any())
                        }),
                        message: z.string()
                    }),
                    401: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) }),
                    409: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) }),
                    422: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) }),
                    500: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) })
                }
            }
        },
        srsController.addItem
    );
}
