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