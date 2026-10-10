import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { adminGuard } from "../../common/middlewares/admin.guard.js";

const idParams = z.object({ id: z.string().uuid() });
const pageQuery = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50), search: z.string().max(100).optional() });
const optionalText = z.string().max(1000).nullable().optional();

const shopItemBody = z.object({
    name: z.string().trim().min(1).max(160),
    description: optionalText,
    image: z.string().max(500).nullable().optional(),
    preview_image: z.string().max(500).nullable().optional(),
    item_type: z.enum(["AVATAR", "BACKGROUND", "FRAME"]),
    rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY"]),
    price: z.number().int().min(0),
    currency: z.enum(["COIN", "GEM"]),
    status: z.enum(["ACTIVE", "HIDDEN"]).default("ACTIVE"),
    is_limited: z.boolean().default(false),
    stock: z.number().int().min(0).nullable().optional(),
});
const gemPackageBody = z.object({
    title: z.string().trim().min(1).max(160),
    description: optionalText,
    gem_amount: z.number().int().positive(),
    bonus_gem: z.number().int().min(0).default(0),
    price: z.number().positive(),
    image: z.string().max(500).nullable().optional(),
    is_popular: z.boolean().default(false),
    is_best_value: z.boolean().default(false),
    sort_order: z.number().int().min(0).default(0),
    is_active: z.boolean().default(true),
});
const promotionBody = z.object({
    title: z.string().trim().min(1).max(160),
    description: optionalText,
    bonus_percent: z.number().int().min(0).max(500),
    start_at: z.coerce.date().nullable().optional(),
    end_at: z.coerce.date().nullable().optional(),
    is_active: z.boolean().default(true),
});
const bannerBody = z.object({
    title: z.string().trim().min(1).max(160),
    description: optionalText,
    image: z.string().max(500).nullable().optional(),
    shop_item_id: z.string().uuid().nullable().optional(),
    start_at: z.coerce.date().nullable().optional(),
    end_at: z.coerce.date().nullable().optional(),
    is_active: z.boolean().default(true),
});
const transactionQuery = pageQuery.extend({ payment_status: z.enum(["PENDING", "SUCCESS", "FAILED", "CANCELLED", "EXPIRED", "REFUNDED"]).optional() });

type AuditJson = Prisma.InputJsonValue;
function auditJson(value: unknown): AuditJson {
    return JSON.parse(JSON.stringify(value)) as AuditJson;
}

export async function adminCommerceRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();
    router.addHook("preHandler", adminGuard);

    router.get("/api/v1/admin/shop/transactions", { schema: { querystring: transactionQuery } }, async (request) => {
        const { page, limit, search, payment_status } = request.query;
        const where: Prisma.payment_transactionsWhereInput = {
            ...(payment_status ? { payment_status } : {}),
            ...(search ? { OR: [
                { transaction_code: { contains: search, mode: "insensitive" } },
                { users: { is: { email: { contains: search, mode: "insensitive" } } } },
                { users: { is: { display_name: { contains: search, mode: "insensitive" } } } },
            ] } : {}),
        };
        const [rows, total] = await Promise.all([
            prisma.payment_transactions.findMany({
                where,
                include: { users: { select: { id: true, email: true, display_name: true } }, gem_packages: { select: { title: true } } },
                orderBy: { created_at: "desc" }, skip: (page - 1) * limit, take: limit,
            }),
            prisma.payment_transactions.count({ where }),
        ]);
        const data = rows.map((row) => ({ ...row, amount: row.amount == null ? null : Number(row.amount), order_code: row.order_code?.toString() ?? null }));
        return { success: true, data, meta: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) } };
    });

    router.get("/api/v1/admin/shop/purchases", { schema: { querystring: pageQuery } }, async (request) => {
        const { page, limit, search } = request.query;
        const where: Prisma.purchase_historiesWhereInput = search ? { OR: [
            { users: { is: { email: { contains: search, mode: "insensitive" } } } },
            { users: { is: { display_name: { contains: search, mode: "insensitive" } } } },
            { shop_items: { is: { name: { contains: search, mode: "insensitive" } } } },
        ] } : {};
        const [data, total] = await Promise.all([
            prisma.purchase_histories.findMany({
                where,
                include: { users: { select: { id: true, email: true, display_name: true } }, shop_items: { select: { name: true, item_type: true, image: true } } },
                orderBy: { purchased_at: "desc" }, skip: (page - 1) * limit, take: limit,
            }),
            prisma.purchase_histories.count({ where }),
        ]);
        return { success: true, data, meta: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) } };
    });

    router.get("/api/v1/admin/shop/items", { schema: { querystring: pageQuery } }, async (request) => {
        const { page, limit, search } = request.query;
        const where = search ? { name: { contains: search, mode: "insensitive" as const } } : {};
        const [data, total] = await Promise.all([
            prisma.shop_items.findMany({ where, orderBy: [{ created_at: "desc" }, { name: "asc" }], skip: (page - 1) * limit, take: limit }),
            prisma.shop_items.count({ where }),
        ]);
        return { success: true, data, meta: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) } };
    });

    router.post("/api/v1/admin/shop/items", { schema: { body: shopItemBody } }, async (request, reply) => {
        const id = randomUUID();
        const data = JSON.parse(JSON.stringify(request.body)) as Omit<Prisma.shop_itemsUncheckedCreateInput, "id">;
        const item = await prisma.$transaction(async (tx) => {
            const created = await tx.shop_items.create({ data: { id, ...data, created_at: new Date() } });
            await tx.admin_audit_logs.create({ data: { id: randomUUID(), admin_id: request.user!.id, action: "shop.item_created", entity_id: id, after_state: auditJson(data) } });
            return created;
        });
        return reply.code(201).send({ success: true, data: item });
    });

    router.patch("/api/v1/admin/shop/items/:id", { schema: { params: idParams, body: shopItemBody.partial() } }, async (request, reply) => {
        const item = await prisma.$transaction(async (tx) => {
            const before = await tx.shop_items.findUnique({ where: { id: request.params.id } });
            if (!before) return null;
            const updateData = JSON.parse(JSON.stringify(request.body)) as Prisma.shop_itemsUncheckedUpdateInput;
            const updated = await tx.shop_items.update({ where: { id: request.params.id }, data: updateData });
            await tx.admin_audit_logs.create({ data: { id: randomUUID(), admin_id: request.user!.id, action: "shop.item_updated", entity_id: request.params.id, before_state: auditJson(before), after_state: auditJson(updated) } });
            return updated;
        });
        if (!item) return reply.code(404).send({ success: false, error: { code: "ITEM_NOT_FOUND", message: "Shop item not found." } });
        return { success: true, data: item };
    });

    router.delete("/api/v1/admin/shop/items/:id", { schema: { params: idParams } }, async (request, reply) => {
        const item = await prisma.$transaction(async (tx) => {
            const before = await tx.shop_items.findUnique({ where: { id: request.params.id } });
            if (!before) return null;
            const updated = await tx.shop_items.update({ where: { id: request.params.id }, data: { status: "HIDDEN" } });
            await tx.admin_audit_logs.create({ data: { id: randomUUID(), admin_id: request.user!.id, action: "shop.item_hidden", entity_id: request.params.id, before_state: auditJson(before), after_state: auditJson(updated) } });
            return updated;
        });
        if (!item) return reply.code(404).send({ success: false, error: { code: "ITEM_NOT_FOUND", message: "Shop item not found." } });
        return { success: true, data: item };
    });

    router.get("/api/v1/admin/shop/gem-packages", { schema: { querystring: pageQuery } }, async (request) => {
        const { page, limit, search } = request.query;
        const where = search ? { title: { contains: search, mode: "insensitive" as const } } : {};
        const [data, total] = await Promise.all([
            prisma.gem_packages.findMany({ where, orderBy: [{ sort_order: "asc" }, { created_at: "desc" }], skip: (page - 1) * limit, take: limit }),
            prisma.gem_packages.count({ where }),
        ]);
        return { success: true, data, meta: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) } };
    });

    router.post("/api/v1/admin/shop/gem-packages", { schema: { body: gemPackageBody } }, async (request, reply) => {
        const id = randomUUID(); const data = JSON.parse(JSON.stringify(request.body)) as Omit<Prisma.gem_packagesUncheckedCreateInput, "id">;
        const item = await prisma.$transaction(async (tx) => {
            const created = await tx.gem_packages.create({ data: { id, ...data, created_at: new Date() } });
            await tx.admin_audit_logs.create({ data: { id: randomUUID(), admin_id: request.user!.id, action: "shop.gem_package_created", entity_id: id, after_state: auditJson(data) } });
            return created;
        });
        return reply.code(201).send({ success: true, data: item });
    });

    router.patch("/api/v1/admin/shop/gem-packages/:id", { schema: { params: idParams, body: gemPackageBody.partial() } }, async (request, reply) => {
        const item = await prisma.$transaction(async (tx) => {
            const before = await tx.gem_packages.findUnique({ where: { id: request.params.id } });
            if (!before) return null;
            const updateData = JSON.parse(JSON.stringify(request.body)) as Prisma.gem_packagesUncheckedUpdateInput;
            const updated = await tx.gem_packages.update({ where: { id: request.params.id }, data: updateData });
            await tx.admin_audit_logs.create({ data: { id: randomUUID(), admin_id: request.user!.id, action: "shop.gem_package_updated", entity_id: request.params.id, before_state: auditJson(before), after_state: auditJson(updated) } });
            return updated;
        });
        if (!item) return reply.code(404).send({ success: false, error: { code: "PACKAGE_NOT_FOUND", message: "Gem package not found." } });
        return { success: true, data: item };
    });

    router.delete("/api/v1/admin/shop/gem-packages/:id", { schema: { params: idParams } }, async (request, reply) => {
        const item = await prisma.$transaction(async (tx) => {
            const before = await tx.gem_packages.findUnique({ where: { id: request.params.id } });
            if (!before) return null;
            const updated = await tx.gem_packages.update({ where: { id: request.params.id }, data: { is_active: false } });
            await tx.admin_audit_logs.create({ data: { id: randomUUID(), admin_id: request.user!.id, action: "shop.gem_package_disabled", entity_id: request.params.id, before_state: auditJson(before), after_state: auditJson(updated) } });
            return updated;
        });
        if (!item) return reply.code(404).send({ success: false, error: { code: "PACKAGE_NOT_FOUND", message: "Gem package not found." } });
        return { success: true, data: item };
    });

    router.get("/api/v1/admin/shop/promotions", async () => ({ success: true, data: await prisma.gem_promotions.findMany({ orderBy: { created_at: "desc" } }) }));
    router.post("/api/v1/admin/shop/promotions", { schema: { body: promotionBody } }, async (request, reply) => {
        const id = randomUUID(); const data = JSON.parse(JSON.stringify(request.body)) as Omit<Prisma.gem_promotionsUncheckedCreateInput, "id">;
        const result = await prisma.$transaction(async (tx) => {
            const row = await tx.gem_promotions.create({ data: { id, ...data, created_at: new Date() } });
            await tx.admin_audit_logs.create({ data: { id: randomUUID(), admin_id: request.user!.id, action: "shop.promotion_created", entity_id: id, after_state: auditJson(data) } });
            return row;
        });
        return reply.code(201).send({ success: true, data: result });
    });
    router.patch("/api/v1/admin/shop/promotions/:id", { schema: { params: idParams, body: promotionBody.partial() } }, async (request, reply) => {
        const result = await prisma.$transaction(async (tx) => {
            const before = await tx.gem_promotions.findUnique({ where: { id: request.params.id } }); if (!before) return null;
            const updateData = JSON.parse(JSON.stringify(request.body)) as Prisma.gem_promotionsUncheckedUpdateInput;
            const row = await tx.gem_promotions.update({ where: { id: request.params.id }, data: updateData });
            await tx.admin_audit_logs.create({ data: { id: randomUUID(), admin_id: request.user!.id, action: "shop.promotion_updated", entity_id: request.params.id, before_state: auditJson(before), after_state: auditJson(row) } }); return row;
        });
        if (!result) return reply.code(404).send({ success: false, error: { code: "PROMOTION_NOT_FOUND", message: "Promotion not found." } });
        return { success: true, data: result };
    });
    router.delete("/api/v1/admin/shop/promotions/:id", { schema: { params: idParams } }, async (request, reply) => {
        const result = await prisma.$transaction(async (tx) => {
            const before = await tx.gem_promotions.findUnique({ where: { id: request.params.id } }); if (!before) return null;
            const row = await tx.gem_promotions.update({ where: { id: request.params.id }, data: { is_active: false } });
            await tx.admin_audit_logs.create({ data: { id: randomUUID(), admin_id: request.user!.id, action: "shop.promotion_disabled", entity_id: request.params.id, before_state: auditJson(before), after_state: auditJson(row) } }); return row;
        });
        if (!result) return reply.code(404).send({ success: false, error: { code: "PROMOTION_NOT_FOUND", message: "Promotion not found." } });
        return { success: true, data: result };
    });

    router.get("/api/v1/admin/shop/banners", async () => ({ success: true, data: await prisma.shop_banners.findMany({ orderBy: { start_at: "desc" } }) }));
    router.post("/api/v1/admin/shop/banners", { schema: { body: bannerBody } }, async (request, reply) => {
        const id = randomUUID(); const data = JSON.parse(JSON.stringify(request.body)) as Omit<Prisma.shop_bannersUncheckedCreateInput, "id">;
        const result = await prisma.$transaction(async (tx) => {
            const row = await tx.shop_banners.create({ data: { id, ...data } });
            await tx.admin_audit_logs.create({ data: { id: randomUUID(), admin_id: request.user!.id, action: "shop.banner_created", entity_id: id, after_state: auditJson(data) } }); return row;
        });
        return reply.code(201).send({ success: true, data: result });
    });
    router.patch("/api/v1/admin/shop/banners/:id", { schema: { params: idParams, body: bannerBody.partial() } }, async (request, reply) => {
        const result = await prisma.$transaction(async (tx) => {
            const before = await tx.shop_banners.findUnique({ where: { id: request.params.id } }); if (!before) return null;
            const updateData = JSON.parse(JSON.stringify(request.body)) as Prisma.shop_bannersUncheckedUpdateInput;
            const row = await tx.shop_banners.update({ where: { id: request.params.id }, data: updateData });
            await tx.admin_audit_logs.create({ data: { id: randomUUID(), admin_id: request.user!.id, action: "shop.banner_updated", entity_id: request.params.id, before_state: auditJson(before), after_state: auditJson(row) } }); return row;
        });
        if (!result) return reply.code(404).send({ success: false, error: { code: "BANNER_NOT_FOUND", message: "Shop banner not found." } });
        return { success: true, data: result };
    });
    router.delete("/api/v1/admin/shop/banners/:id", { schema: { params: idParams } }, async (request, reply) => {
        const result = await prisma.$transaction(async (tx) => {
            const before = await tx.shop_banners.findUnique({ where: { id: request.params.id } }); if (!before) return null;
            const row = await tx.shop_banners.update({ where: { id: request.params.id }, data: { is_active: false } });
            await tx.admin_audit_logs.create({ data: { id: randomUUID(), admin_id: request.user!.id, action: "shop.banner_disabled", entity_id: request.params.id, before_state: auditJson(before), after_state: auditJson(row) } }); return row;
        });
        if (!result) return reply.code(404).send({ success: false, error: { code: "BANNER_NOT_FOUND", message: "Shop banner not found." } });
        return { success: true, data: result };
    });
}
