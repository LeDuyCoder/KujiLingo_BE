import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { google } from "googleapis";
import { GmailMailService } from "../../src/common/services/mail/providers/gmail.mail.service.js";
import { buildVerificationEmail } from "../../src/modules/auth/templates/verification-email.template.js";
import { MailServiceError } from "../../src/common/errors/mail.error.js";
import { env } from "../../src/config/env.js";

test("Mail Service & Template Unit Tests", async (t) => {

    await t.test("buildVerificationEmail should generate valid HTML and text with correct URL", () => {
        const result = buildVerificationEmail({
            displayName: "Nguyen Van A",
            token: "sample-token-12345",
        });

        assert.ok(result.html.includes(`${env.FRONTEND_URL}/verify-email?token=sample-token-12345`));
        assert.ok(result.html.includes("Nguyen Van A"));
        assert.ok(result.text.includes(`${env.FRONTEND_URL}/verify-email?token=sample-token-12345`));
        assert.ok(result.text.includes("Nguyen Van A"));
    });

    await t.test("GmailMailService should send email with userId 'me' and valid Base64URL raw message", async () => {
        // Setup mock environment refresh token
        const originalRefreshToken = env.GOOGLE_REFRESH_TOKEN;
        (env as any).GOOGLE_REFRESH_TOKEN = "mock-refresh-token";

        let capturedPayload: any = null;

        // Mock google.gmail
        const gmailMock = mock.method(google, "gmail", () => {
            return {
                users: {
                    messages: {
                        send: async (params: any) => {
                            capturedPayload = params;
                            return { data: { id: "msg-123" } };
                        },
                    },
                },
            } as any;
        });

        const service = new GmailMailService();
        await service.sendMail({
            to: "recipient@example.com",
            subject: "Tiêu đề Tiếng Việt có dấu 🚀",
            html: "<h1>Xin chào KujiLingo</h1>",
            text: "Xin chao KujiLingo",
        });

        assert.strictEqual(gmailMock.mock.callCount(), 1);
        assert.strictEqual(capturedPayload.userId, "me");
        assert.ok(capturedPayload.requestBody.raw);

        // Verify Base64URL: does not contain +, /, =
        const raw = capturedPayload.requestBody.raw;
        assert.strictEqual(raw.includes("+"), false);
        assert.strictEqual(raw.includes("/"), false);
        assert.strictEqual(raw.includes("="), false);

        // Cleanup
        gmailMock.mock.restore();
        (env as any).GOOGLE_REFRESH_TOKEN = originalRefreshToken;
    });

    await t.test("GmailMailService should throw MailServiceError when Gmail API fails", async () => {
        const originalRefreshToken = env.GOOGLE_REFRESH_TOKEN;
        (env as any).GOOGLE_REFRESH_TOKEN = "mock-refresh-token";

        const gmailMock = mock.method(google, "gmail", () => {
            return {
                users: {
                    messages: {
                        send: async () => {
                            throw new Error("Invalid OAuth Credentials");
                        },
                    },
                },
            } as any;
        });

        const service = new GmailMailService();

        await assert.rejects(
            async () => {
                await service.sendMail({
                    to: "test@example.com",
                    subject: "Test",
                    html: "<p>Test</p>",
                });
            },
            (err: any) => {
                assert.ok(err instanceof MailServiceError);
                assert.strictEqual(err.message, "Invalid OAuth Credentials");
                return true;
            }
        );

        gmailMock.mock.restore();
        (env as any).GOOGLE_REFRESH_TOKEN = originalRefreshToken;
    });

    await t.test("GmailMailService should throw MailServiceError when GOOGLE_REFRESH_TOKEN is missing", async () => {
        const originalRefreshToken = env.GOOGLE_REFRESH_TOKEN;
        (env as any).GOOGLE_REFRESH_TOKEN = "";

        const service = new GmailMailService();

        await assert.rejects(
            async () => {
                await service.sendMail({
                    to: "test@example.com",
                    subject: "Test",
                    html: "<p>Test</p>",
                });
            },
            (err: any) => {
                assert.ok(err instanceof MailServiceError);
                assert.ok(err.message.includes("GOOGLE_REFRESH_TOKEN is not configured"));
                return true;
            }
        );

        (env as any).GOOGLE_REFRESH_TOKEN = originalRefreshToken;
    });
});
