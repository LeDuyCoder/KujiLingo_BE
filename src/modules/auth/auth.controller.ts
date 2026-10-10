import type { FastifyReply, FastifyRequest } from "fastify";
import crypto from "node:crypto";
import { google } from "googleapis";
import { env } from "../../config/env.js";
import * as authService from "./auth.service.js";
import type { RegisterInput, VerifyEmailInput, LoginInput, ResendVerificationInput, LogoutInput, ForgotPasswordInput, ResetPasswordInput, RefreshTokenInput, ChangePasswordInput, UpdateProfileInput } from "./auth.schema.js";
import type { RegisterResponse } from "./auth.types.js";
import { log } from "../../common/utils/log.js";
import { verifyToken } from "../../common/utils/jwt.js";

export async function registerHandler(
    request: FastifyRequest<{ Body: RegisterInput }>,
    reply: FastifyReply
) {
    try {
        const result = await authService.register(request.body);
        const response: RegisterResponse = {
            code: "REGISTER_SUCCESS",
            ...result
        };
        return reply.code(201).send(response);
    } catch (error: any) {
        log.error(error);
        if (error.message === "DUPLICATE_EMAIL") {
            return reply.code(409).send({ code: "REGISTER_DUPLICATE_EMAIL" });
        }
        return reply.code(500).send({ code: "REGISTER_INTERNAL_SERVER_ERROR" });
    }
}

export async function verifyEmailHandler(
    request: FastifyRequest<{ Body: VerifyEmailInput }>,
    reply: FastifyReply
) {
    try {
        const { token } = request.body;
        const result = await authService.verifyEmail(token);

        return reply.code(200).send({
            success: true,
            data: {
                email: result.email,
                status: result.status,
                email_verified_at: result.email_verified_at.toISOString(),
            },
            message: "Email verified successfully. You can now log in.",
        });
    } catch (error: any) {
        if (error.message === "TOKEN_NOT_FOUND") {
            return reply.code(404).send({
                success: false,
                error: {
                    code: "TOKEN_NOT_FOUND",
                    message: "This verification link is invalid.",
                },
            });
        }
        if (error.message === "TOKEN_ALREADY_USED") {
            return reply.code(409).send({
                success: false,
                error: {
                    code: "TOKEN_ALREADY_USED",
                    message: "This verification link has already been used.",
                },
            });
        }
        if (error.message === "TOKEN_EXPIRED") {
            return reply.code(410).send({
                success: false,
                error: {
                    code: "TOKEN_EXPIRED",
                    message: "This verification link has expired. Please request a new one.",
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

export async function resendVerificationHandler(
    request: FastifyRequest<{ Body: ResendVerificationInput }>,
    reply: FastifyReply
) {
    try {
        const { email } = request.body;
        const result = await authService.resendVerificationEmail(email);

        return reply.code(200).send({
            success: true,
            verificationToken: result.verificationToken,
            message: "Verification email sent successfully.",
        });
    } catch (error: any) {
        log.error(error);
        if (error.message === "USER_NOT_FOUND") {
            return reply.code(404).send({
                success: false,
                error: {
                    code: "USER_NOT_FOUND",
                    message: "User not found with the provided email.",
                },
            });
        }
        if (error.message === "EMAIL_ALREADY_VERIFIED") {
            return reply.code(409).send({
                success: false,
                error: {
                    code: "EMAIL_ALREADY_VERIFIED",
                    message: "This email address is already verified.",
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

export async function logoutHandler(
    request: FastifyRequest<{ Body: LogoutInput }>,
    reply: FastifyReply
) {
    try {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return reply.code(401).send({
                success: false,
                error: { code: "UNAUTHORIZED", message: "Access token is missing, invalid, or expired." },
            });
        }
        const token = authHeader.split(" ")[1];
        if (!token) {
            return reply.code(401).send({
                success: false,
                error: { code: "UNAUTHORIZED", message: "Access token is missing, invalid, or expired." },
            });
        }
        const decoded = verifyToken(token) as { sub: string };

        await authService.logout(decoded.sub, request.body);
        return reply.code(200).send({ success: true, message: "Logged out successfully." });
    } catch (error: any) {
        log.error(error);
        if (error.message === "TOKEN_OWNERSHIP_MISMATCH") {
            return reply.code(403).send({
                success: false,
                error: {
                    code: "TOKEN_OWNERSHIP_MISMATCH",
                    message: "This refresh token does not belong to the authenticated user.",
                },
            });
        }
        return reply.code(401).send({
            success: false,
            error: {
                code: "UNAUTHORIZED",
                message: "Access token is missing, invalid, or expired.",
            },
        });
    }
}

export async function forgotPasswordHandler(
    request: FastifyRequest<{ Body: ForgotPasswordInput }>,
    reply: FastifyReply
) {
    const ipAddress = request.ip ?? "unknown";
    try {
        const result = await authService.forgotPassword(request.body, ipAddress);
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

export async function resetPasswordHandler(
    request: FastifyRequest<{ Body: ResetPasswordInput }>,
    reply: FastifyReply
) {
    try {
        const result = await authService.resetPassword(request.body);
        return reply.code(200).send(result);
    } catch (error: any) {
        log.error(error);
        if (error.message === "TOKEN_NOT_FOUND") {
            return reply.code(404).send({
                success: false,
                error: { code: "TOKEN_NOT_FOUND", message: "This password reset link is invalid." },
            });
        }
        if (error.message === "TOKEN_ALREADY_USED") {
            return reply.code(409).send({
                success: false,
                error: { code: "TOKEN_ALREADY_USED", message: "This password reset link has already been used." },
            });
        }
        if (error.message === "TOKEN_EXPIRED") {
            return reply.code(410).send({
                success: false,
                error: { code: "TOKEN_EXPIRED", message: "This password reset link has expired. Please request a new one." },
            });
        }
        if (error.message === "PASSWORD_UNCHANGED") {
            return reply.code(422).send({
                success: false,
                error: { code: "PASSWORD_UNCHANGED", message: "New password must be different from your current password." },
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

export async function loginHandler(
    request: FastifyRequest<{ Body: LoginInput }>,
    reply: FastifyReply
) {
    const ipAddress = request.ip ?? "unknown";
    const userAgent = request.headers["user-agent"];
    const deviceId = request.headers["x-device-id"] as string | undefined;

    try {
        const result = await authService.login(request.body, {
            ipAddress,
            userAgent,
            deviceId,
        });

        return reply.code(200).send({
            success: true,
            data: result,
        });
    } catch (error: any) {
        log.error(error);
        if (error.message === "ACCOUNT_TEMPORARILY_LOCKED") {
            return reply.code(429).send({
                success: false,
                error: {
                    code: "ACCOUNT_TEMPORARILY_LOCKED",
                    message: "Too many failed login attempts. Please try again in 15 minutes.",
                },
            });
        }
        if (error.message === "INVALID_CREDENTIALS") {
            return reply.code(401).send({
                success: false,
                error: {
                    code: "INVALID_CREDENTIALS",
                    message: "Incorrect email or password.",
                },
            });
        }
        if (error.message === "EMAIL_NOT_VERIFIED") {
            return reply.code(403).send({
                success: false,
                error: {
                    code: "EMAIL_NOT_VERIFIED",
                    message: "Please verify your email before logging in.",
                },
            });
        }
        if (error.message === "ACCOUNT_SUSPENDED") {
            return reply.code(403).send({
                success: false,
                error: {
                    code: "ACCOUNT_SUSPENDED",
                    message: "Your account has been temporarily suspended.",
                },
            });
        }
        if (error.message === "ACCOUNT_BANNED") {
            return reply.code(403).send({
                success: false,
                error: {
                    code: "ACCOUNT_BANNED",
                    message: "Your account has been permanently banned.",
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

const GOOGLE_STATE_COOKIE = "kujilingo_google_oauth";

function googleSigninRedirectUri() {
    return env.GOOGLE_SIGNIN_REDIRECT_URI
        ?? new URL("/api/v1/auth/google/signin/callback", env.GOOGLE_REDIRECT_URI).toString();
}

function googlePopupResult(reply: FastifyReply, payload: Record<string, unknown>) {
    const targetOrigin = new URL(env.FRONTEND_URL).origin;
    const safePayload = JSON.stringify({ type: "kujilingo:google-auth", ...payload }).replace(/</g, "\\u003c");
    return reply
        .type("text/html; charset=utf-8")
        .header("Cache-Control", "no-store, max-age=0")
        .header("Referrer-Policy", "no-referrer")
        .send(`<!doctype html><html><head><meta charset="utf-8"><title>Google sign-in</title></head><body><p>Returning to KujiLingo…</p><script>if(window.opener){window.opener.postMessage(${safePayload},${JSON.stringify(targetOrigin)});window.close()}else{document.body.textContent="You can close this window."}</script></body></html>`);
}

export async function googleSignInHandler(
    request: FastifyRequest<{ Querystring: { mode?: string } }>,
    reply: FastifyReply,
) {
    const state = crypto.randomBytes(32).toString("hex");
    const cookieOptions = [
        `${GOOGLE_STATE_COOKIE}=${state}`,
        "HttpOnly",
        "Path=/api/v1/auth/google/signin/callback",
        "Max-Age=600",
        "SameSite=Lax",
    ];
    if (process.env.NODE_ENV === "production") cookieOptions.push("Secure");
    reply.header("Set-Cookie", cookieOptions.join("; "));

    const oauth2Client = new google.auth.OAuth2(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        googleSigninRedirectUri(),
    );
    const authorizationUrl = oauth2Client.generateAuthUrl({
        access_type: "online",
        scope: ["openid", "email", "profile"],
        state,
        prompt: "select_account",
    });
    return reply.redirect(authorizationUrl);
}

export async function googleSignInCallbackHandler(
    request: FastifyRequest<{ Querystring: { code?: string; state?: string; error?: string } }>,
    reply: FastifyReply,
) {
    const clearCookie = `${GOOGLE_STATE_COOKIE}=; HttpOnly; Path=/api/v1/auth/google/signin/callback; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
    const cookies = request.headers.cookie ?? "";
    const cookieValue = cookies.split(";").map((part) => part.trim())
        .find((part) => part.startsWith(`${GOOGLE_STATE_COOKIE}=`))?.slice(GOOGLE_STATE_COOKIE.length + 1);
    const cookieState = cookieValue;

    reply.header("Set-Cookie", clearCookie);
    if (request.query.error || !request.query.code || !request.query.state ||
        !/^[a-f0-9]{64}$/.test(request.query.state) || !cookieState ||
        request.query.state.length !== cookieState.length ||
        !crypto.timingSafeEqual(Buffer.from(request.query.state), Buffer.from(cookieState))) {
        return googlePopupResult(reply, { error: "Google sign-in was cancelled or expired. Please try again." });
    }

    try {
        const oauth2Client = new google.auth.OAuth2(
            env.GOOGLE_CLIENT_ID,
            env.GOOGLE_CLIENT_SECRET,
            googleSigninRedirectUri(),
        );
        const { tokens } = await oauth2Client.getToken(request.query.code);
        if (!tokens.id_token) throw new Error("GOOGLE_ID_TOKEN_MISSING");
        const ticket = await oauth2Client.verifyIdToken({ idToken: tokens.id_token, audience: env.GOOGLE_CLIENT_ID });
        const profile = ticket.getPayload();
        const email = profile?.email;
        if (!email || profile?.email_verified !== true) throw new Error("GOOGLE_EMAIL_NOT_VERIFIED");

        const session = await authService.loginWithGoogle({
            email,
            displayName: profile.name?.trim() || email.split("@")[0] || email,
            ...(profile.picture ? { avatar: profile.picture } : {}),
        }, {
            ipAddress: request.ip ?? "unknown",
            ...(request.headers["user-agent"] ? { userAgent: request.headers["user-agent"] } : {}),
            ...(typeof request.headers["x-device-id"] === "string" ? { deviceId: request.headers["x-device-id"] } : {}),
        });
        return googlePopupResult(reply, { session });
    } catch (error: any) {
        log.error("[Auth] Google sign-in failed:", error);
        const message = error.message === "ACCOUNT_SUSPENDED"
            ? "Your account has been temporarily suspended."
            : error.message === "ACCOUNT_BANNED"
                ? "Your account has been permanently banned."
                : "Google sign-in failed. Please try again.";
        return googlePopupResult(reply, { error: message });
    }
}

export async function googleSignInCredentialHandler(
    request: FastifyRequest<{ Body: { credential: string; mode: "login" | "register" } }>,
    reply: FastifyReply,
) {
    try {
        const oauth2Client = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID);
        const ticket = await oauth2Client.verifyIdToken({
            idToken: request.body.credential,
            audience: env.GOOGLE_CLIENT_ID,
        });
        const profile = ticket.getPayload();
        const email = profile?.email;
        if (!email || profile?.email_verified !== true) {
            return reply.code(401).send({
                success: false,
                error: { code: "GOOGLE_EMAIL_NOT_VERIFIED", message: "Google could not verify this email address." },
            });
        }

        const session = await authService.loginWithGoogle({
            email,
            displayName: profile.name?.trim() || email.split("@")[0] || email,
            ...(profile.picture ? { avatar: profile.picture } : {}),
        }, {
            ipAddress: request.ip ?? "unknown",
            ...(request.headers["user-agent"] ? { userAgent: request.headers["user-agent"] } : {}),
            ...(typeof request.headers["x-device-id"] === "string" ? { deviceId: request.headers["x-device-id"] } : {}),
        });

        return reply.code(200).send({ success: true, data: session });
    } catch (error: any) {
        log.error("[Auth] Google credential sign-in failed:", error);
        const status = error.message === "ACCOUNT_SUSPENDED" || error.message === "ACCOUNT_BANNED"
            ? 403
            : 401;
        const message = error.message === "ACCOUNT_SUSPENDED"
            ? "Your account has been temporarily suspended."
            : error.message === "ACCOUNT_BANNED"
                ? "Your account has been permanently banned."
                : "Google sign-in failed. Please try again.";
        return reply.code(status).send({
            success: false,
            error: { code: error.message || "GOOGLE_SIGNIN_FAILED", message },
        });
    }
}

/**
 * [DEVELOPMENT ONLY] Khởi tạo luồng xin quyền Google OAuth để lấy Refresh Token.
 */
export async function googleAuthHandler(request: FastifyRequest, reply: FastifyReply) {
    if (process.env.NODE_ENV === "production") {
        return reply.code(403).send({
            success: false,
            error: "Google OAuth Setup endpoint is only available in development mode."
        });
    }

    const oauth2Client = new google.auth.OAuth2(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        env.GOOGLE_REDIRECT_URI
    );

    const scopes = ["https://www.googleapis.com/auth/gmail.send"];
    const authorizeUrl = oauth2Client.generateAuthUrl({
        access_type: "offline", // Bắt buộc để lấy Refresh Token
        scope: scopes,
        prompt: "select_account consent" // Chọn tài khoản và luôn yêu cầu consent để nhận Refresh Token
    });

    return reply.redirect(authorizeUrl);
}

/**
 * [DEVELOPMENT ONLY] Callback để xử lý mã code và hiển thị Refresh Token.
 */
export async function googleAuthCallbackHandler(
    request: FastifyRequest<{ Querystring: { code?: string } }>,
    reply: FastifyReply
) {
    if (process.env.NODE_ENV === "production") {
        return reply.code(403).send({
            success: false,
            error: "Google OAuth Setup endpoint is only available in development mode."
        });
    }

    const { code } = request.query;
    if (!code) {
        return reply.code(400).send({
            success: false,
            error: "Authorization code is missing."
        });
    }

    try {
        const oauth2Client = new google.auth.OAuth2(
            env.GOOGLE_CLIENT_ID,
            env.GOOGLE_CLIENT_SECRET,
            env.GOOGLE_REDIRECT_URI
        );

        const { tokens } = await oauth2Client.getToken(code);

        if (!tokens.refresh_token) {
            return reply.code(400).type("text/html").send(`
                <h1>Lấy Refresh Token thất bại!</h1>
                <p>Google không trả về Refresh Token. Nguyên nhân có thể do bạn đã cấp quyền trước đó nhưng chưa revoke.</p>
                <p>Hãy truy cập <a href="https://myaccount.google.com/connections">Google Connections</a>, xóa quyền truy cập của KujiLingo và truy cập lại luồng này.</p>
            `);
        }

        return reply.code(200).type("text/html").send(`
            <div style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; line-height: 1.6;">
                <h1 style="color: #4f46e5;">Thành công! 🎉</h1>
                <p>Dưới đây là <strong>GOOGLE_REFRESH_TOKEN</strong> của bạn:</p>
                <textarea readonly style="width: 100%; height: 80px; padding: 12px; font-family: monospace; font-size: 14px; border: 1px solid #ddd; border-radius: 6px; background-color: #f9f9f9; box-sizing: border-box;">${tokens.refresh_token}</textarea>
                <p style="color: #666; font-size: 14px; margin-top: 20px;">
                    <strong>Hướng dẫn tiếp theo:</strong><br>
                    1. Copy chuỗi refresh token trên.<br>
                    2. Dán vào biến <code>GOOGLE_REFRESH_TOKEN</code> trong file <code>.env</code> của bạn.<br>
                    3. Khởi động lại backend server để áp dụng.
                </p>
                <p style="color: #e11d48; font-size: 12px; font-weight: bold;">
                    ⚠️ LƯU Ý BẢO MẬT: Tuyệt đối không commit mã này lên Github!
                </p>
            </div>
        `);
    } catch (error: any) {
        return reply.code(500).send({
            success: false,
            error: "Failed to exchange authorization code for tokens.",
            details: error.message
        });
    }
}

export async function meHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    try {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return reply.code(401).send({
                success: false,
                error: { code: "UNAUTHORIZED", message: "Access token is missing, invalid, or expired." },
            });
        }
        const token = authHeader.split(" ")[1];
        if (!token) {
            return reply.code(401).send({
                success: false,
                error: { code: "UNAUTHORIZED", message: "Access token is missing, invalid, or expired." },
            });
        }

        const decoded = verifyToken(token) as { sub: string };
        const user = await authService.getCurrentUser(decoded.sub);

        return reply.code(200).send({
            success: true,
            data: user,
        });
    } catch (error: any) {
        log.error(error);
        if (error.message === "ACCOUNT_SUSPENDED") {
            return reply.code(403).send({
                success: false,
                error: { code: "ACCOUNT_SUSPENDED", message: "Your account is currently suspended." },
            });
        }
        if (error.message === "ACCOUNT_BANNED") {
            return reply.code(403).send({
                success: false,
                error: { code: "ACCOUNT_BANNED", message: "Your account has been permanently banned." },
            });
        }
        return reply.code(401).send({
            success: false,
            error: { code: "UNAUTHORIZED", message: "Access token is missing, invalid, or expired." },
        });
    }
}

export async function updateProfileHandler(
    request: FastifyRequest<{ Body: UpdateProfileInput }>,
    reply: FastifyReply
) {
    try {
        const user = await authService.updateUserProfile(request.user!.id, request.body);
        return reply.code(200).send({ success: true, data: user });
    } catch (error: any) {
        log.error(error);
        return reply.code(500).send({
            success: false,
            error: { code: "INTERNAL_ERROR", message: "Could not update account settings." },
        });
    }
}

export async function refreshTokenHandler(
    request: FastifyRequest<{ Body: RefreshTokenInput }>,
    reply: FastifyReply
) {
    const ipAddress = request.ip ?? "unknown";
    const userAgent = request.headers["user-agent"];

    try {
        const result = await authService.refreshToken(request.body, {
            ipAddress,
            userAgent,
        });

        return reply.code(200).send({
            success: true,
            data: result,
        });
    } catch (error: any) {
        log.error(error);
        if (error.message === "ACCOUNT_SUSPENDED") {
            return reply.code(403).send({
                success: false,
                error: {
                    code: "ACCOUNT_SUSPENDED",
                    message: "Your account has been temporarily suspended.",
                },
            });
        }
        if (error.message === "ACCOUNT_BANNED") {
            return reply.code(403).send({
                success: false,
                error: {
                    code: "ACCOUNT_BANNED",
                    message: "Your account has been permanently banned.",
                },
            });
        }
        return reply.code(401).send({
            success: false,
            error: {
                code: "UNAUTHORIZED",
                message: "Refresh token is invalid, expired, or revoked.",
            },
        });
    }
}

export async function changePasswordHandler(
    request: FastifyRequest<{ Body: any }>,
    reply: FastifyReply
) {
    try {
        const userId = request.user!.id;
        const body = request.body as ChangePasswordInput;
        const result = await authService.changePassword(userId, body);
        return reply.code(200).send(result);
    } catch (error: any) {
        log.error(error);
        if (error.message === "INVALID_CURRENT_PASSWORD") {
            return reply.code(401).send({
                success: false,
                error: { code: "INVALID_CURRENT_PASSWORD", message: "Invalid current password." },
            });
        }
        if (error.message === "PASSWORD_UNCHANGED") {
            return reply.code(422).send({
                success: false,
                error: {
                    code: "PASSWORD_UNCHANGED",
                    message: "New password must be different from your current password.",
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

