import { NextRequest, NextResponse } from "next/server";
import {
    aiSessionCookieName,
    createAiSessionToken,
    isAiPasswordConfigured,
    verifyAiPassword,
} from "@/lib/ai/passcode";
import {
    clearFailures,
    getAttemptKey,
    isThrottled,
    maxFailedAttempts,
    recordFailure,
} from "@/lib/ai/unlock-throttle";

const maxPasswordLength = 200;

// Max-Age를 두지 않으면 브라우저를 닫을 때 사라지는 세션 쿠키가 된다.
const sessionCookie = (token: string) => ({
    name: aiSessionCookieName,
    value: token,
    httpOnly: true,
    // 로컬 개발은 http라서 Secure를 붙이면 쿠키가 아예 저장되지 않는다.
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
});

export async function POST(request: NextRequest) {
    if (!isAiPasswordConfigured() || !process.env.AI_API_KEY) {
        return NextResponse.json(
            { ok: false, message: "The AI assistant is not configured on this server." },
            { status: 503 },
        );
    }

    const attemptKey = getAttemptKey(request.headers);

    if (isThrottled(attemptKey)) {
        return NextResponse.json(
            { ok: false, message: "Too many failed attempts. Please wait a few minutes and try again." },
            { status: 429 },
        );
    }

    let password: unknown;

    try {
        password = (await request.json())?.password;
    } catch {
        return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
    }

    if (typeof password !== "string" || password.length === 0 || password.length > maxPasswordLength) {
        return NextResponse.json({ ok: false, message: "Enter the assistant password." }, { status: 400 });
    }

    if (!verifyAiPassword(password)) {
        const failures = recordFailure(attemptKey);
        const remaining = Math.max(0, maxFailedAttempts - failures);

        return NextResponse.json(
            {
                ok: false,
                message: remaining > 0
                    ? "That password is not correct."
                    : "Too many failed attempts. Please wait a few minutes and try again.",
            },
            { status: 401 },
        );
    }

    clearFailures(attemptKey);

    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookie(createAiSessionToken()));

    return response;
}

export async function DELETE() {
    const response = NextResponse.json({ ok: true });
    response.cookies.set({ ...sessionCookie(""), maxAge: 0 });

    return response;
}
