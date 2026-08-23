import "dotenv/config";
import { prisma } from "../src/config/prisma.js";
import crypto from "node:crypto";
import bcrypt from "bcrypt";

async function main() {
    console.log("🌱 Bắt đầu seed dữ liệu bảng xếp hạng...");

    // 1. Tạo danh sách người dùng demo
    const usersData: any[] = [];
    const passwordHash = await bcrypt.hash("Password123", 10);

    for (let i = 1; i <= 15; i++) {
        const email = `user_demo_${i}@example.com`;
        let user = await prisma.users.findUnique({ where: { email } });

        if (!user) {
            user = await prisma.users.create({
                data: {
                    id: crypto.randomUUID(),
                    email,
                    password_hash: passwordHash,
                    display_name: `Người Chơi ${i}`,
                    avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=user${i}`,
                    role: "user",
                    status: "active",
                    email_verified: true,
                }
            });
            console.log(`✅ Đã tạo user: ${user.display_name}`);
        } else {
             console.log(`✅ Đã tìm thấy user: ${user.display_name}`);
        }
        usersData.push(user);
    }

    // 2. Tính toán Period Keys dựa trên thời gian thực
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    
    // Tính số tuần ISO 8601
    const getWeekNumber = (d: Date) => {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay()||7));
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
        const weekNo = Math.ceil(( ( (date.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
        return String(weekNo).padStart(2, '0');
    };

    const dailyKey = `${yyyy}-${mm}-${dd}`;
    const weeklyKey = `${yyyy}-W${getWeekNumber(now)}`;
    const monthlyKey = `${yyyy}-${mm}`;
    const allTimeKey = "ALL_TIME";

    const periods = [
        { type: "daily", key: dailyKey, maxXP: 500 },
        { type: "weekly", key: weeklyKey, maxXP: 3000 },
        { type: "monthly", key: monthlyKey, maxXP: 10000 },
        { type: "all_time", key: allTimeKey, maxXP: 50000 }
    ] as const;

    // 3. Thêm dữ liệu xếp hạng cho từng loại chu kỳ
    for (const period of periods) {
        // Xóa dữ liệu cũ nếu muốn làm sạch
        await prisma.leaderboard_snapshots.deleteMany({
            where: { period_type: period.type, period_key: period.key }
        });

        // Tạo EXP ngẫu nhiên cho từng user và sắp xếp giảm dần
        const userStats = usersData.map(user => ({
            user,
            xp: Math.floor(Math.random() * period.maxXP) + 50
        })).sort((a, b) => b.xp - a.xp); // Rank 1 có xp cao nhất

        for (let index = 0; index < userStats.length; index++) {
            const { user, xp } = userStats[index];
            await prisma.leaderboard_snapshots.create({
                data: {
                    id: crypto.randomUUID(),
                    period_type: period.type,
                    period_key: period.key,
                    rank: index + 1,
                    user_id: user.id,
                    display_name: user.display_name,
                    avatar_url: user.avatar,
                    xp_total: xp,
                }
            });
        }
        console.log(`🏆 Đã seed ${userStats.length} bản ghi xếp hạng [${period.type}] (${period.key})`);
    }

    console.log("🎉 Hoàn tất seed dữ liệu Leaderboard!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
