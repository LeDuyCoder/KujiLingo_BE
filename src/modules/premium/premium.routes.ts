import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { authGuard } from "../../common/middlewares/auth.guard.js";
import { premiumService } from "./premium.service.js";

export async function premiumRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    router.post(
        "/api/v1/premium/purchase",
        {
            preHandler: [authGuard],
            schema: {
                tags: ["Premium"],
                summary: "Purchase a Pro membership using Gems",
                body: z.object({ plan: z.enum(["monthly", "yearly"]) }),
            },
        },
        async (request, reply) => {
            try {
                const result = await premiumService.purchase(request.user!.id, request.body.plan);
                return reply.code(200).send({ success: true, data: result });
            } catch (error: any) {
                if (error.message === "INSUFFICIENT_GEMS") {
                    return reply.code(422).send({ success: false, error: { code: "INSUFFICIENT_GEMS", message: "You need more Gems to purchase this Pro plan." } });
                }
                if (error.message === "USER_NOT_FOUND") {
                    return reply.code(404).send({ success: false, error: { code: "USER_NOT_FOUND", message: "User not found." } });
                }
                request.log.error(error);
                return reply.code(500).send({ success: false, error: { code: "INTERNAL_ERROR", message: "Could not complete the Pro purchase." } });
            }
        },
    );
}
