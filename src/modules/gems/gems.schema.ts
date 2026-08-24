import { z } from "zod";

export const createTransactionBodySchema = z.object({
    package_id: z.string().uuid("package_id must be a valid UUID"),
    payment_method: z.enum(["PAYOS", "MOMO"]).optional().default("PAYOS"),
    buyer_email: z.string().email("Invalid buyer_email format").optional(),
});

export const getTransactionParamsSchema = z.object({
    transactionId: z.string().uuid("transactionId must be a valid UUID"),
});

export const walletHistoryQuerySchema = z.object({
    transaction_type: z.enum(["RECHARGE", "PURCHASE", "REWARD", "REFUND", "ADMIN"]).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
