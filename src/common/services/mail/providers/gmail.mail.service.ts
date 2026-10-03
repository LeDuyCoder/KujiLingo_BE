import { google } from "googleapis";
import type { IMailService, SendMailOptions } from "../mail.types.js";
import { env } from "../../../../config/env.js";
import { MailServiceError } from "../../../errors/mail.error.js";
import { log } from "../../../utils/log.js";

export class GmailMailService implements IMailService {
    private oauth2Client;

    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            env.GOOGLE_CLIENT_ID,
            env.GOOGLE_CLIENT_SECRET,
            env.GOOGLE_REDIRECT_URI
        );

        if (env.GOOGLE_REFRESH_TOKEN) {
            this.oauth2Client.setCredentials({
                refresh_token: env.GOOGLE_REFRESH_TOKEN,
            });
        }
    }

    /**
     * Sends an email through the configured Google Gmail API.
     *
     * @param options - Email message options.
     * @returns A promise resolved when the provider accepts the message.
     * @throws MailServiceError When email delivery fails.
     */
    async sendMail(options: SendMailOptions): Promise<void> {
        try {
            if (!env.GOOGLE_REFRESH_TOKEN) {
                throw new Error("GOOGLE_REFRESH_TOKEN is not configured.");
            }

            const gmail = google.gmail({
                version: "v1",
                auth: this.oauth2Client,
            });

            const rawMessage = this.buildMimeMessage(options);
            const encodedMessage = Buffer.from(rawMessage)
                .toString("base64")
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=+$/, ""); // Base64URL encoding

            await gmail.users.messages.send({
                userId: "me",
                requestBody: {
                    raw: encodedMessage,
                },
            });
        } catch (error: any) {
            log.error(`[MailService] Failed to send email to ${options.to}:`, error);
            throw new MailServiceError(
                error.message || "Failed to send email through Gmail provider.",
                error
            );
        }
    }

    /**
     * Builds a valid MIME email message.
     */
    private buildMimeMessage(options: SendMailOptions): string {
        const toHeader = Array.isArray(options.to) ? options.to.join(", ") : options.to;
        const fromHeader = `"${env.MAIL_FROM_NAME}" <${env.MAIL_FROM_EMAIL}>`;
        
        // Encode subject with UTF-8 base64 format for non-ASCII support
        const subjectEncoded = `=?utf-8?B?${Buffer.from(options.subject).toString("base64")}?=`;

        const boundary = `----=_Part_${Math.random().toString(36).substring(2)}`;
        
        let mime = [
            `From: ${fromHeader}`,
            `To: ${toHeader}`,
            `Subject: ${subjectEncoded}`,
            `MIME-Version: 1.0`,
            `Content-Type: multipart/alternative; boundary="${boundary}"`,
            ``,
            `--${boundary}`,
            `Content-Type: text/plain; charset="UTF-8"`,
            `Content-Transfer-Encoding: base64`,
            ``,
            Buffer.from(options.text || "").toString("base64"),
            ``,
            `--${boundary}`,
            `Content-Type: text/html; charset="UTF-8"`,
            `Content-Transfer-Encoding: base64`,
            ``,
            Buffer.from(options.html).toString("base64"),
            ``,
            `--${boundary}--`
        ].join("\r\n");

        return mime;
    }
}
