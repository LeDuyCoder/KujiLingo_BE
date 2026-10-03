interface CacheEntry {
    value: any;
    expiresAt: number;
}

class MemoryCache {
    private cache = new Map<string, CacheEntry>();

    /**
     * Lấy giá trị từ cache. Nếu hết hạn, tự động xóa và trả về null.
     */
    get<T = any>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return entry.value as T;
    }

    /**
     * Lưu giá trị vào cache với thời hạn tính bằng giây
     */
    set(key: string, value: any, ttlSeconds: number): void {
        const expiresAt = Date.now() + ttlSeconds * 1000;
        this.cache.set(key, { value, expiresAt });
    }

    /**
     * Xóa một key cụ thể khỏi cache
     */
    delete(key: string): void {
        this.cache.delete(key);
    }

    /**
     * Xóa các keys khớp với wildcard pattern (ví dụ: "courses:list:*")
     */
    deletePattern(pattern: string): void {
        // Chuyển đổi wildcard pattern thành regex
        // "courses:list:*" -> /^courses:list:.*$/
        const escapedPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape các ký tự đặc biệt của regex ngoại trừ *
            .replace(/\*/g, ".*");                // Thay thế * bằng .*
        const regex = new RegExp(`^${escapedPattern}$`);

        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Xóa toàn bộ cache
     */
    clear(): void {
        this.cache.clear();
    }
}

export const memoryCache = new MemoryCache();
