import z, { email } from "zod";

export const registerSchema = z.object({
    email: z
        .string()
        .trim()
        .email(),

    password: z
        .string()
        .min(8)
        .regex(/[A-Za-z]/, "Password must contain at least one letter")
        .regex(/\d/, "Password must contain at least one digit"),

    password_confirmation: z
        .string(),

    display_name: z
        .string()
        .trim()
        .min(1)
        .max(100),

    accepted_terms: z
        .boolean()
        .refine(value => value === true),

    jlpt_target_level: z
        .enum(["N5", "N4", "N3", "N2", "N1"])
        .optional(),
}).superRefine((data, ctx) => {
    if (data.password !== data.password_confirmation) {
        ctx.addIssue({
            code: "custom",
            path: ["password_confirmation"],
            message: "PASSWORD_CONFIRMATION_MISMATCH",
        });
    }
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const verifyEmailSchema = z.object({
    token: z
        .string()
        .trim()
        .min(1)
        .max(256),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const loginSchema = z.object({
    email: z
        .string()
        .trim()
        .email("Invalid email format")
        .max(255),

    password: z
        .string()
        .min(1, "Password cannot be empty")
        .max(72),

    device_name: z
        .string()
        .max(100)
        .optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const resendVerificationSchema = z.object({
    email: z
        .string()
        .trim()
        .email("Invalid email format")
        .max(255),
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const logoutSchema = z.object({
    refresh_token: z
        .string()
        .trim()
        .min(1)
        .optional(),
    all_devices: z
        .boolean()
        .default(false)
        .optional(),
}).superRefine((data, ctx) => {
    if (!data.all_devices && !data.refresh_token) {
        ctx.addIssue({
            code: "custom",
            path: ["refresh_token"],
            message: "refresh_token is required when all_devices is false.",
        });
    }
});

export type LogoutInput = z.infer<typeof logoutSchema>;

export const forgotPasswordSchema = z.object({
    email: z
        .string()
        .trim()
        .email("A valid email is required.")
        .max(255, "A valid email is required."),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;