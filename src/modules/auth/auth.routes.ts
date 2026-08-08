import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { 
    registerHandler, 
    verifyEmailHandler,
    googleAuthHandler,
    googleAuthCallbackHandler
} from "./auth.controller.js";
import { registerSchema, verifyEmailSchema } from "./auth.schema.js";

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
    router.post(
        "/auth/verify-email",
        {
            schema: {
                tags: ["Auth"],
                summary: "Verify user email",
                description: "Confirms ownership of the email address supplied at registration.",
                body: verifyEmailSchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.object({
                            email: z.string(),
                            status: z.string(),
                            email_verified_at: z.string().datetime(),
                        }),
                        message: z.string(),
                    }),
                    404: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.string(), message: z.string() })
                    }),
                    409: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.string(), message: z.string() })
                    }),
                    410: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.string(), message: z.string() })
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.string(), message: z.string() })
                    }),
                },
            },
        },
        verifyEmailHandler
    );

    // ========================================================
    // [DEVELOPMENT ONLY] Google OAuth Setup endpoints
    // ========================================================
    router.get(
        "/auth/google",
        {
            schema: {
                tags: ["Auth"],
                summary: "[Dev Only] Khởi tạo luồng xin quyền Google OAuth",
                description: "Tạo link authorize và redirect người dùng tới Google (chỉ dùng để lấy Refresh Token).",
            },
        },
        googleAuthHandler
    );

    router.get(
        "/auth/google/callback",
        {
            schema: {
                tags: ["Auth"],
                summary: "[Dev Only] Nhận Authorization Code",
                description: "Nhận code từ Google, đổi lấy Refresh Token và hiển thị ra màn hình.",
            },
        },
        googleAuthCallbackHandler
    );
}
