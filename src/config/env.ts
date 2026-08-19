import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    DATABASE_URL: z.string().min(1),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GOOGLE_REDIRECT_URI: z.string().url(),
    GOOGLE_REFRESH_TOKEN: z.string().optional(),
    JWT_PRIVATE_KEY: z.string().optional(),
    JWT_PUBLIC_KEY: z.string().optional(),
    ALLOW_LOGIN_BEFORE_VERIFICATION: z.preprocess((val) => val === "true", z.boolean()).optional().default(false),
    MAIL_FROM_EMAIL: z.string().email(),
    MAIL_FROM_NAME: z.string().min(1),
    FRONTEND_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
