export class MailServiceError extends Error {
    constructor(message: string, public readonly originalError?: any) {
        super(message);
        this.name = "MailServiceError";
        Object.setPrototypeOf(this, MailServiceError.prototype);
    }
}
