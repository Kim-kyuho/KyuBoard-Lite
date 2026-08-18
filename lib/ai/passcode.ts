import { createHmac, timingSafeEqual } from "node:crypto";

export const aiSessionCookieName = "kyuboard_ai";

export const aiSessionMaxAgeSeconds = 12 * 60 * 60;

const tokenVersion = "v1";

const getSigningKey = (password: string) => createHmac("sha256", "kyuboard-lite-ai").update(password).digest();

const sign = (payload: string, password: string) =>
    createHmac("sha256", getSigningKey(password)).update(payload).digest("base64url");

const equals = (left: string, right: string) => {
    const digest = (value: string) => createHmac("sha256", "kyuboard-lite-compare").update(value).digest();

    return timingSafeEqual(digest(left), digest(right));
};

export const isAiPasswordConfigured = (password = process.env.AI_PASSWORD) =>
    typeof password === "string" && password.length > 0;

export function verifyAiPassword(candidate: unknown, password = process.env.AI_PASSWORD) {
    if (!isAiPasswordConfigured(password) || typeof candidate !== "string" || candidate.length === 0) {
        return false;
    }

    return equals(candidate, password as string);
}

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
