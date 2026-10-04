import { prisma } from "../../config/prisma.js";

export function isPremiumActive(
    role: string | null | undefined,
    premiumExpiresAt: Date | null | undefined,
    now = new Date(),
): boolean {
    return role === "admin" || Boolean(premiumExpiresAt && premiumExpiresAt > now);
}

export async function hasActivePremium(userId: string | undefined): Promise<boolean> {
    if (!userId) return false;
    const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { role: true, premium_expires_at: true },
    });
    return isPremiumActive(user?.role, user?.premium_expires_at);
}
