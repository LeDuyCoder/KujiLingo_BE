import "dotenv/config";
import { prisma } from "../src/config/prisma.js";
import crypto from "node:crypto";

async function seedGemsFullMock() {
    console.log("=== SEEDING FULL MOCK DATA FOR GEMS & WALLET MODULE ===");

    // 0. Ensure Dev User Exists
    const userId = "00000000-0000-0000-0000-000000000001";
    let devUser = await prisma.users.findUnique({ where: { id: userId } });
    if (!devUser) {
        devUser = await prisma.users.create({
            data: {
                id: userId,
                email: "postman_dev@kujilingo.com",
                password_hash: "hashed",
                display_name: "Minh Khánh (Postman Dev)",
                role: "USER",
                status: "active",
            },
        });
        console.log("✅ Created dev user: postman_dev@kujilingo.com");
    }

    // Clear existing mock gem data safely
    await prisma.wallet_histories.deleteMany({ where: { user_id: userId } }).catch(() => {});
    await prisma.payment_transactions.deleteMany({ where: { user_id: userId } }).catch(() => {});
    await prisma.user_wallets.deleteMany({ where: { user_id: userId } }).catch(() => {});
    await prisma.gem_packages.deleteMany({}).catch(() => {});
    await prisma.gem_promotions.deleteMany({}).catch(() => {});

    // 1. Seed Gem Packages
    const starterPkg = await prisma.gem_packages.create({
        data: {
            id: crypto.randomUUID(),
            title: "Starter Pack",
            description: "Gói khởi đầu tiết kiệm 100 Gem + 10 Gem tặng kèm",
            gem_amount: 100,
            bonus_gem: 10,
            price: 29000 as any,
            image: "https://cdn.kujilingo.com/gems/starter.png",
            is_popular: false,
            is_best_value: false,
            sort_order: 1,
            is_active: true,
            created_at: new Date(),
        },
    });

    const popularPkg = await prisma.gem_packages.create({
        data: {
            id: crypto.randomUUID(),
            title: "Popular Pack",
            description: "Gói Gem phổ biến 500 Gem + 60 Gem tặng kèm",
            gem_amount: 500,
            bonus_gem: 60,
            price: 129000 as any,
            image: "https://cdn.kujilingo.com/gems/popular.png",
            is_popular: true,
            is_best_value: false,
            sort_order: 2,
            is_active: true,
            created_at: new Date(),
        },
    });

    const masterPkg = await prisma.gem_packages.create({
        data: {
            id: crypto.randomUUID(),
            title: "Master Pack",
            description: "Gói cao cấp siêu ưu đãi 1200 Gem + 200 Gem tặng kèm",
            gem_amount: 1200,
            bonus_gem: 200,
            price: 299000 as any,
            image: "https://cdn.kujilingo.com/gems/master.png",
            is_popular: false,
            is_best_value: true,
            sort_order: 3,
            is_active: true,
            created_at: new Date(),
        },
    });

    console.log("✅ Seeded 3 Gem packages.");

    // 2. Seed Active Gem Promotion
    const promo = await prisma.gem_promotions.create({
        data: {
            id: crypto.randomUUID(),
            title: "Khuyến Mãi Hè +10% Gem",
            description: "Tặng thêm 10% Gem cho tất cả các đơn nạp trong tuần này!",
            bonus_percent: 10,
            start_at: new Date("2026-08-01T00:00:00Z"),
            end_at: new Date("2026-12-31T23:59:59Z"),
            is_active: true,
            created_at: new Date(),
        },
    });

    console.log("✅ Seeded active promotion:", promo.title);

    // 3. Seed User Wallet
    await prisma.user_wallets.create({
        data: {
            user_id: userId,
            coins: 1500,
            gems: 620,
            updated_at: new Date(),
        },
    });
    console.log("✅ Seeded user wallet (620 Gems, 1500 Coins).");

    // 4. Seed Payment Transactions
    const txSuccess = await prisma.payment_transactions.create({
        data: {
            id: crypto.randomUUID(),
            user_id: userId,
            package_id: popularPkg.id,
            promotion_id: promo.id,
            payment_method: "PAYOS",
            payment_status: "SUCCESS",
            amount: 129000 as any,
            gem_amount: 500,
            bonus_gem: 110,
            total_gem: 610,
            transaction_code: "KL-20260824-PO129K",
            order_code: 1735000000123n,
            provider_transaction_id: "link_payos_mock_123",
            payment_url: "https://pay.payos.vn/web/6c3392a824ba4297b6d1417e28f30f0a",
            qr_code: "00020101021238570010A00000072701270006970422011300000123456789020208QRIBFTTA53037045802VN...",
            provider_response: "FT26082412345",
            paid_at: new Date(Date.now() - 3600 * 1000), // 1 hour ago
            created_at: new Date(Date.now() - 3700 * 1000),
            updated_at: new Date(Date.now() - 3600 * 1000),
        },
    });

    const txPending = await prisma.payment_transactions.create({
        data: {
            id: crypto.randomUUID(),
            user_id: userId,
            package_id: starterPkg.id,
            promotion_id: promo.id,
            payment_method: "PAYOS",
            payment_status: "PENDING",
            amount: 29000 as any,
            gem_amount: 100,
            bonus_gem: 20,
            total_gem: 120,
            transaction_code: "KL-20260824-ST29K",
            order_code: 1735000000456n,
            provider_transaction_id: "link_payos_mock_456",
            payment_url: "https://pay.payos.vn/web/8a4492a824ba4297b6d1417e28f30f0b",
            qr_code: "00020101021238570010A00000072701270006970422011300000987654321020208QRIBFTTA53037045802VN...",
            expired_at: new Date(Date.now() + 15 * 60 * 1000), // 15 mins from now
            created_at: new Date(),
            updated_at: new Date(),
        },
    });

    console.log("✅ Seeded sample transactions (1 SUCCESS, 1 PENDING).");

    // 5. Seed Wallet History
    const histories = [
        {
            id: crypto.randomUUID(),
            user_id: userId,
            transaction_type: "RECHARGE" as const,
            coin_change: 0,
            gem_change: 610,
            balance_coin: 1500,
            balance_gem: 620,
            payment_transaction_id: txSuccess.id,
            note: "Purchased Popular Pack (+610 Gems)",
            created_at: new Date(Date.now() - 3600 * 1000),
        },
        {
            id: crypto.randomUUID(),
            user_id: userId,
            transaction_type: "REWARD" as const,
            coin_change: 200,
            gem_change: 10,
            balance_coin: 1500,
            balance_gem: 10,
            note: "Daily Streak Milestone Reward (+10 Gems)",
            created_at: new Date(Date.now() - 86400 * 1000),
        },
        {
            id: crypto.randomUUID(),
            user_id: userId,
            transaction_type: "ADMIN" as const,
            coin_change: 1000,
            gem_change: 0,
            balance_coin: 1300,
            balance_gem: 0,
            note: "Welcome Bonus (+1000 Coins)",
            created_at: new Date(Date.now() - 172800 * 1000),
        },
    ];

    for (const h of histories) {
        await prisma.wallet_histories.create({ data: h });
    }

    console.log("✅ Seeded wallet history list.");
    console.log("\n=======================================================");
    console.log("🎉 ALL MOCK DATA SEEDED SUCCESSFULLY FOR POSTMAN!");
    console.log("Sample IDs for testing:");
    console.log("- Starter Package ID: ", starterPkg.id);
    console.log("- Popular Package ID: ", popularPkg.id);
    console.log("- Master Package ID:  ", masterPkg.id);
    console.log("- Pending Transaction ID:", txPending.id);
    console.log("- Success Transaction ID:", txSuccess.id);
    console.log("- OrderCode PayOS Webhook:", "1735000000456");
    console.log("=======================================================");
}

seedGemsFullMock()
    .catch((e) => {
        console.error("Full mock seed error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
