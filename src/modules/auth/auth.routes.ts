import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
    registerHandler,
    verifyEmailHandler,
    googleAuthHandler,
    googleAuthCallbackHandler,
    resendVerificationHandler,
    loginHandler,
    logoutHandler,
    forgotPasswordHandler,
    resetPasswordHandler,
    meHandler,
    refreshTokenHandler,
    changePasswordHandler
} from "./auth.controller.js";
import {
    registerSchema,
    verifyEmailSchema,
    loginSchema,
    resendVerificationSchema,
    logoutSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    refreshTokenSchema,
    changePasswordSchema
} from "./auth.schema.js";
import { authGuard } from "../../common/middlewares/auth.guard.js";

export async function authRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    router.post(
        "/api/v1/auth/register",
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
        "/api/v1/auth/resend-verification",
        {
            schema: {
                tags: ["Auth"],
                summary: "Resend verification email",
                description: "Sends a new verification email to the user.",
                body: resendVerificationSchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        verificationToken: z.string(),
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
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.string(), message: z.string() })
                    }),
                },
            },
        },
        resendVerificationHandler
    );

    router.post(
        "/api/v1/auth/verify-email",
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

    router.post(
        "/api/v1/auth/login",
        {
            schema: {
                tags: ["Auth"],
                summary: "Login",
                description: "Authenticates a user with email and password, issuing a JWT access token and a refresh token.",
                body: loginSchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.object({
                            access_token: z.string(),
                            refresh_token: z.string(),
                            token_type: z.literal("Bearer"),
                            expires_in: z.number(),
                            user: z.object({
                                id: z.string().uuid(),
                                email: z.string(),
                                display_name: z.string(),
                                role: z.string(),
                                is_premium: z.boolean(),
                                jlpt_target_level: z.string().nullable(),
                            }),
                        }),
                    }),
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INVALID_CREDENTIALS"), message: z.string() }),
                    }),
                    403: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.enum(["EMAIL_NOT_VERIFIED", "ACCOUNT_SUSPENDED", "ACCOUNT_BANNED"]),
                            message: z.string(),
                        }),
                    }),
                    429: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("ACCOUNT_TEMPORARILY_LOCKED"), message: z.string() }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        loginHandler
    );

    router.post(
        "/api/v1/auth/logout",
        {
            schema: {
                tags: ["Auth"],
                summary: "Logout",
                description: "Revokes a specific refresh token (single-device logout) or all refresh tokens for the current user.",
                body: logoutSchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        message: z.string(),
                    }),
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() }),
                    }),
                    403: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("TOKEN_OWNERSHIP_MISMATCH"), message: z.string() }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        logoutHandler
    );

    router.post(
        "/api/v1/auth/forgot-password",
        {
            schema: {
                tags: ["Auth"],
                summary: "Forgot Password",
                description: "Initiates the password-reset flow by emailing a single-use reset token.",
                body: forgotPasswordSchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        message: z.string(),
                    }),
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        forgotPasswordHandler
    );

    router.post(
        "/api/v1/auth/reset-password",
        {
            schema: {
                tags: ["Auth"],
                summary: "Reset Password",
                description: "Completes the password-reset flow by validating a reset token and setting a new password.",
                body: resetPasswordSchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        message: z.string(),
                    }),
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() }),
                    }),
                    404: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("TOKEN_NOT_FOUND"), message: z.string() }),
                    }),
                    409: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("TOKEN_ALREADY_USED"), message: z.string() }),
                    }),
                    410: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("TOKEN_EXPIRED"), message: z.string() }),
                    }),
                    422: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("PASSWORD_UNCHANGED"), message: z.string() }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        resetPasswordHandler
    );


    router.get(
        "/api/v1/auth/me",
        {
            schema: {
                tags: ["Auth"],
                summary: "Get Current User (Me)",
                description: "Returns the authenticated user's profile information.",
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.object({
                            id: z.string().uuid(),
                            email: z.string().email(),
                            display_name: z.string().nullable(),
                            avatar_url: z.string().nullable(),
                            role: z.string(),
                            is_premium: z.boolean(),
                            premium_expires_at: z.string().nullable(),
                            jlpt_target_level: z.string().nullable(),
                            status: z.string(),
                            email_verified_at: z.string().nullable(),
                            last_login_at: z.string().nullable(),
                            timezone: z.string(),
                            locale: z.string(),
                            created_at: z.string(),
                        }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.literal("UNAUTHORIZED"),
                            message: z.string(),
                        }),
                    }),
                    403: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.enum(["ACCOUNT_SUSPENDED", "ACCOUNT_BANNED"]),
                            message: z.string(),
                        }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.literal("INTERNAL_ERROR"),
                            message: z.string(),
                        }),
                    }),
                },
            },
        },
        meHandler
    );

    router.post(
        "/api/v1/auth/refresh-token",
        {
            schema: {
                tags: ["Auth"],
                summary: "Refresh Access Token",
                description: "Reissues a new access token and rotates the refresh token.",
                body: refreshTokenSchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.object({
                            access_token: z.string(),
                            refresh_token: z.string(),
                            token_type: z.literal("Bearer"),
                            expires_in: z.number(),
                        }),
                    }),
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() }),
                    }),
                    403: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.enum(["ACCOUNT_SUSPENDED", "ACCOUNT_BANNED"]),
                            message: z.string(),
                        }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        refreshTokenHandler
    );

    router.patch(
        "/api/v1/auth/change-password",
        {
            preHandler: [authGuard],
            schema: {
                tags: ["Auth"],
                summary: "Change Password",
                description: "Allows an authenticated user to change their password.",
                body: changePasswordSchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        message: z.string(),
                    }),
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.literal("VALIDATION_ERROR"),
                            message: z.string(),
                        }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.enum(["UNAUTHORIZED", "INVALID_CURRENT_PASSWORD"]),
                            message: z.string(),
                        }),
                    }),
                    422: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.literal("PASSWORD_UNCHANGED"),
                            message: z.string(),
                        }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.literal("INTERNAL_ERROR"),
                            message: z.string(),
                        }),
                    }),
                },
            },
        },
        changePasswordHandler as any
    );


    // ========================================================
    // [DEVELOPMENT ONLY] Google OAuth Setup endpoints
    // ========================================================
    router.get(
        "/api/v1/auth/google",
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
        "/api/v1/auth/google/callback",
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
