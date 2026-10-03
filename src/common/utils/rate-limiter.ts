interface RateLimitEntry {
    count: number;
    resetAt: number;
}

export class InMemoryRateLimiter {
    private store = new Map<string, RateLimitEntry>();

    /**
     * Checks if the key is within the rate limit.
     * Increments the count if it's within the limit.
     * Returns true if allowed, false if limit exceeded.
     */
    public checkLimit(key: string, limit: number, windowMs: number): boolean {
        const now = Date.now();
        const entry = this.store.get(key);

        if (!entry || now > entry.resetAt) {
            this.store.set(key, {
                count: 1,
                resetAt: now + windowMs,
            });
            return true;
        }

        if (entry.count >= limit) {
            return false;
        }

        entry.count += 1;
        return true;
    }

    /**
     * Cleans up expired rate limit entries to prevent memory leaks.
     */
    public cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (now > entry.resetAt) {
                this.store.delete(key);
            }
        }
    }
}

export const rateLimiter = new InMemoryRateLimiter();

// Run cleanup every 10 minutes (unref to not block tests or process exits)
if (typeof setInterval !== "undefined") {
    setInterval(() => {
        rateLimiter.cleanup();
    }, 10 * 60 * 1000).unref();
}
