import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { registerHandler } from "./auth.controller.js";
import { registerSchema } from "./auth.schema.js";

export async function authRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    router.post(
        "/auth/register",
        {
            schema: {
                tags: ["Auth"],
                summary: "Register a new user",
                description:
                    "Create a new user account. Returns user info and email verification token.",
                body: registerSchema,
                response: {
                    201: z.object({
                        code: z.literal("REGISTER_SUCCESS"),
                        user: z.object({
                            id: z.string().uuid(),
                            email: z.string().email(),
                            display_name: z.string(),
                            jlpt_target_level: z.enum(["N5", "N4", "N3", "N2", "N1"]).nullable(),
                            email_verified: z.boolean(),
                            created_at: z.date(),
                        }),
                        verificationToken: z.string(),
                    }),
                    409: z.object({
                        code: z.literal("REGISTER_DUPLICATE_EMAIL"),
                    }),
                    500: z.object({
                        code: z.literal("REGISTER_INTERNAL_SERVER_ERROR"),
                    }),
                },
            },
        },
        registerHandler
    );
}
