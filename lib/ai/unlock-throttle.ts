// 비밀번호 잠금은 공개 주소에 붙어 있으므로 무차별 대입을 어느 정도는 늦춰야 한다.
//
// 서버리스에는 공유 저장소가 없어 이 카운터는 인스턴스 하나의 메모리에만 있다. 인스턴스가
// 여러 개로 늘어나면 그만큼 시도 횟수도 늘어나고, 인스턴스가 재활용되면 카운터가 지워진다.
// 그래서 이것은 완전한 방어가 아니라 속도 제한이다. 실제 강도는 비밀번호 길이에서 나온다.

export const maxFailedAttempts = 5;
export const lockoutWindowMs = 5 * 60 * 1000;

export type AttemptRecord = { failures: number; firstFailureAt: number };

export type AttemptStore = Map<string, AttemptRecord>;

/** 프로세스 전역 카운터. 라우트가 이걸 그대로 쓰고, 테스트는 자기 Map을 넣는다. */
export const failedAttempts: AttemptStore = new Map();

/** 창이 지났으면 기록을 버린다. 오래된 실패가 영구히 사람을 막지 않게 한다. */
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

/**
 * 시도를 셀 기준. 프록시 뒤에서는 소켓 주소가 늘 같으므로 전달 헤더를 먼저 본다.
 * 헤더는 위조할 수 있지만, 위조하면 자기 몫의 카운터만 새로 만들 뿐이므로 손해는 없다.
 */
export const getAttemptKey = (headers: Headers) =>
    headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
