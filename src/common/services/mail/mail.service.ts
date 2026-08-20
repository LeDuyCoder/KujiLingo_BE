import { GmailMailService } from "./providers/gmail.mail.service.js";
import type { IMailService } from "./mail.types.js";

// Sử dụng Singleton pattern để chia sẻ MailService instance toàn cục
export const mailService: IMailService = new GmailMailService();
export type * from "./mail.types.js";
