const timestamp = () => new Date().toISOString();

export const log = {
    info(message: string, ...args: unknown[]) {
        console.log(
            `\x1b[36m[INFO]\x1b[0m ${timestamp()} - ${message}`,
            ...args
        );
    },

    success(message: string, ...args: unknown[]) {
        console.log(
            `\x1b[32m[SUCCESS]\x1b[0m ${timestamp()} - ${message}`,
            ...args
        );
    },

    warn(message: string, ...args: unknown[]) {
        console.warn(
            `\x1b[33m[WARN]\x1b[0m ${timestamp()} - ${message}`,
            ...args
        );
    },

    error(message: string, ...args: unknown[]) {
        console.error(
            `\x1b[31m[ERROR]\x1b[0m ${timestamp()} - ${message}`,
            ...args
        );
    },

    debug(message: string, ...args: unknown[]) {
        console.debug(
            `\x1b[35m[DEBUG]\x1b[0m ${timestamp()} - ${message}`,
            ...args
        );
    },
};