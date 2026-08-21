import { GmailMailService } from "./providers/gmail.mail.service.js";
import type { IMailService, SendMailOptions } from "./mail.types.js";

export class MockMailService implements IMailService {
    async sendMail(_options: SendMailOptions): Promise<void> {
        return Promise.resolve();
    }
}

// Trong môi trường test, sử dụng MockMailService để không gọi API Gmail thật
export const mailService: IMailService =
    process.env.NODE_ENV === "test" ? new MockMailService() : new GmailMailService();

export type * from "./mail.types.js";
