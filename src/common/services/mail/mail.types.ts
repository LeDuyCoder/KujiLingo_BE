export interface SendMailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
}

export interface IMailService {
    sendMail(options: SendMailOptions): Promise<void>;
}
