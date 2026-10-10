import z from "zod";

// PostgreSQL's UUID type accepts every 128-bit value; Zod's uuid() also
// enforces RFC version/variant bits, which rejects some valid stored UUIDs.
export const postgresUuidSchema = z.string().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid UUID",
);

export const listUsersQuerySchema = z.object({
    status: z
        .enum(["active", "suspended", "banned", "pending_verification"])
        .optional(),
    role: z
        .enum(["user", "admin"])
        .optional(),
    search: z
        .string()
        .max(100)
        .optional(),
    page: z
        .coerce
        .number()
        .min(1)
        .default(1),
    limit: z
        .coerce
        .number()
        .min(1)
        .max(100)
        .default(50),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const userParamsSchema = z.object({
    id: postgresUuidSchema,
});

export type UserParams = z.infer<typeof userParamsSchema>;

export const updateUserStatusBodySchema = z.object({
    status: z.enum(["active", "suspended", "banned", "pending_verification"]),
    reason: z.string().max(500).optional(),
});

export type UpdateUserStatusBody = z.infer<typeof updateUserStatusBodySchema>;

export const updateUserRoleBodySchema = z.object({
    role: z.enum(["user", "admin"]),
});

export type UpdateUserRoleBody = z.infer<typeof updateUserRoleBodySchema>;

export const listAuditLogsQuerySchema = z.object({
    admin_id: postgresUuidSchema.optional(),
    action: z.string().max(100).optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid ISO 8601 YYYY-MM-DD date format").optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid ISO 8601 YYYY-MM-DD date format").optional(),
    page: z
        .coerce
        .number()
        .min(1)
        .default(1),
    limit: z
        .coerce
        .number()
        .min(1)
        .max(100)
        .default(50),
}).superRefine((data, ctx) => {
    if (data.start_date && data.end_date) {
        if (new Date(data.end_date) < new Date(data.start_date)) {
            ctx.addIssue({
                code: "custom",
                path: ["end_date"],
                message: "End date must not precede start date.",
            });
        }
    }
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
