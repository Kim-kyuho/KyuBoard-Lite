import { NextRequest, NextResponse } from "next/server";
import { aiSessionCookieName, isAiPasswordConfigured, verifyAiSessionToken } from "@/lib/ai/passcode";

// 어시스턴트를 쓸 수 있는 상태인지 알려준다. 버튼 단계에서 막기 위한 용도라 키나 비밀번호
// 값 자체는 다루지 않는다.
//
// 잠금 쿠키는 HttpOnly라서 클라이언트 JS가 읽을 수 없다. "지금 잠금이 풀렸는지"를 이 경로가
// 대신 알려준다.
export async function GET(request: NextRequest) {
    try {
        const configured = Boolean(process.env.AI_API_KEY) && isAiPasswordConfigured();
        const unlocked =
            configured && verifyAiSessionToken(request.cookies.get(aiSessionCookieName)?.value);

        return NextResponse.json({
            ok: true,
            configured,
            unlocked,
            message: configured ? null : "The AI assistant is not configured on this server.",
        });
    } catch (error) {
        console.error("Error fetching AI status:", error);
        return NextResponse.json(
            { ok: false, message: "An error occurred while checking the AI assistant." },
            { status: 500 },
        );
    }
}
