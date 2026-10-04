import { prisma } from "../../config/prisma.js";

export async function hasActivePremium(userId: string | undefined): Promise<boolean> {
    if (!userId) return false;
    const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { role: true, premium_expires_at: true },
    });
    return user?.role === "admin" || Boolean(user?.premium_expires_at && user.premium_expires_at > new Date());
}
