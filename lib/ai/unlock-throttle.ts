export const maxFailedAttempts = 5;
export const lockoutWindowMs = 5 * 60 * 1000;

export type AttemptRecord = { failures: number; firstFailureAt: number };

export type AttemptStore = Map<string, AttemptRecord>;

export const failedAttempts: AttemptStore = new Map();

const getLiveRecord = (key: string, now: number, store: AttemptStore) => {
    const record = store.get(key);

    if (!record) {
        return undefined;
    }

    if (now - record.firstFailureAt >= lockoutWindowMs) {
        store.delete(key);
        return undefined;
    }

    return record;
};

export function isThrottled(key: string, now = Date.now(), store: AttemptStore = failedAttempts) {
    return (getLiveRecord(key, now, store)?.failures ?? 0) >= maxFailedAttempts;
}

export function recordFailure(key: string, now = Date.now(), store: AttemptStore = failedAttempts) {
    const record = getLiveRecord(key, now, store);

    if (record) {
        record.failures += 1;
        return record.failures;
    }

    store.set(key, { failures: 1, firstFailureAt: now });

    return 1;
}

export function clearFailures(key: string, store: AttemptStore = failedAttempts) {
    store.delete(key);
}

export const getAttemptKey = (headers: Headers) =>
    headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
