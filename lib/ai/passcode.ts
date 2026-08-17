import { createHmac, timingSafeEqual } from "node:crypto";

// AI 어시스턴트의 비밀번호 잠금.
//
// Lite에는 로그인이 없고 서버 DB도 없다. 그런데 어시스턴트 호출 비용은 AI_API_KEY를 등록한
// 서버 소유자에게 청구되므로, 어시스턴트만은 아무나 쓰지 못하게 막아야 한다.
//
// 세션 테이블을 둘 곳이 없으므로 쿠키에 상태 없는 서명 토큰을 담는다. 서명 키는 AI_PASSWORD
// 자체에서 파생시킨다. 그래서 환경변수가 하나로 끝나고, 비밀번호를 바꾸면 이미 발급된 토큰이
// 전부 한꺼번에 무효가 된다.
//
// 검증은 반드시 서버에서 한다. 비밀번호를 클라이언트로 내려 비교하면 번들에 문자열이 그대로
// 남고, 클라이언트 플래그만 두면 개발자 도구로 우회된다. 둘 다 곧 API 비용으로 돌아온다.

export const aiSessionCookieName = "kyuboard_ai";

/**
 * 토큰의 유효 시간. 쿠키 자체는 Max-Age 없는 세션 쿠키로 내려가 브라우저를 닫으면 사라지지만,
 * 브라우저가 세션을 복원하는 경우(탭 복구 등)가 있으므로 토큰에도 만료를 박아 둔다.
 */
export const aiSessionMaxAgeSeconds = 12 * 60 * 60;

const tokenVersion = "v1";

const getSigningKey = (password: string) => createHmac("sha256", "kyuboard-lite-ai").update(password).digest();

const sign = (payload: string, password: string) =>
    createHmac("sha256", getSigningKey(password)).update(payload).digest("base64url");

/** 길이가 달라도 타이밍이 새지 않도록 해시를 거쳐 같은 길이로 만든 뒤 비교한다. */
const equals = (left: string, right: string) => {
    const digest = (value: string) => createHmac("sha256", "kyuboard-lite-compare").update(value).digest();

    return timingSafeEqual(digest(left), digest(right));
};

/** 서버에 비밀번호가 설정돼 있는지. 없으면 어시스턴트를 아예 열지 않는다. */
export const isAiPasswordConfigured = (password = process.env.AI_PASSWORD) =>
    typeof password === "string" && password.length > 0;

/**
 * 입력한 비밀번호가 맞는지 확인한다.
 *
 * 비밀번호가 설정돼 있지 않으면 어떤 입력도 통과시키지 않는다. 설정을 잊은 서버가 무료
 * 어시스턴트가 되는 것을 막는다.
 */
export function verifyAiPassword(candidate: unknown, password = process.env.AI_PASSWORD) {
    if (!isAiPasswordConfigured(password) || typeof candidate !== "string" || candidate.length === 0) {
        return false;
    }

    return equals(candidate, password as string);
}

/** 만료 시각이 박힌 서명 토큰을 만든다. 쿠키 값으로 그대로 쓴다. */
export function createAiSessionToken(
    password = process.env.AI_PASSWORD,
    now = Date.now(),
    maxAgeSeconds = aiSessionMaxAgeSeconds,
) {
    if (!isAiPasswordConfigured(password)) {
        throw new Error("AI_PASSWORD is not configured.");
    }

    const expiresAt = Math.floor(now / 1000) + maxAgeSeconds;
    const payload = `${tokenVersion}.${expiresAt}`;

    return `${payload}.${sign(payload, password as string)}`;
}

/**
 * 쿠키에서 꺼낸 토큰이 이 서버가 발급한 것이고 아직 살아 있는지 확인한다.
 *
 * 형식 오류, 서명 불일치, 만료를 모두 같은 false로 돌려준다. 호출자가 이유를 구분해 봐야
 * 할 일이 없고, 구분해서 알려주면 공격자에게 힌트만 준다.
 */
export function verifyAiSessionToken(
    token: unknown,
    password = process.env.AI_PASSWORD,
    now = Date.now(),
) {
    if (!isAiPasswordConfigured(password) || typeof token !== "string") {
        return false;
    }

    const parts = token.split(".");

    if (parts.length !== 3) {
        return false;
    }

    const [version, expiresAt, signature] = parts;

    if (version !== tokenVersion || !/^\d+$/.test(expiresAt)) {
        return false;
    }

    if (!equals(signature, sign(`${version}.${expiresAt}`, password as string))) {
        return false;
    }

    return Number(expiresAt) * 1000 > now;
}
