"use client";

import { FormEvent, useState } from "react";
import { Loader2, Lock, X } from "lucide-react";
import PressableButton from "./PressableButton";

type AiUnlockPanelProps = {
    unlocking: boolean;
    errorMessage: string;
    onUnlock: (password: string) => void;
    onClose: () => void;
};

// 잠금 해제 화면. 채팅 패널과 같은 자리·같은 크기로 떠서 두 상태가 오갈 때 창이 튀지 않는다.
//
// 비밀번호는 여기서 검사하지 않는다. 서버가 AI_PASSWORD와 비교하고, 맞으면 HttpOnly 쿠키를
// 내려 준다. 클라이언트는 결과만 받는다.
export default function AiUnlockPanel({ unlocking, errorMessage, onUnlock, onClose }: AiUnlockPanelProps) {
    const [password, setPassword] = useState("");

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();

        if (!password || unlocking) {
            return;
        }

        onUnlock(password);
        setPassword("");
    };

    return (
        <div
            className="ai-chat-panel fixed bottom-5 left-1/2 z-50000 flex w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 flex-col rounded-xl bg-white/95 shadow-lg"
            onPointerDown={(event) => event.stopPropagation()}
        >
            <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3">
                <Lock className="h-4 w-4 shrink-0 text-neutral-900" />
                <span className="text-sm font-semibold text-neutral-900">AI Assistant is locked</span>
                <div className="ml-auto flex items-center gap-1">
                    <PressableButton
                        className="px-2 py-1"
                        onClick={onClose}
                        type="button"
                        aria-label="Close AI assistant"
                    >
                        <X className="h-4 w-4 text-neutral-600" />
                    </PressableButton>
                </div>
            </div>

            <form className="flex flex-col gap-3 px-4 py-4" onSubmit={handleSubmit}>
                <p className="text-sm leading-6 text-neutral-500">
                    KyuBoard Lite has no sign-in, so the assistant is protected by its own password.
                    You stay unlocked until this browser closes.
                </p>
                <input
                    autoFocus
                    type="password"
                    className="h-9 rounded-md bg-neutral-50 px-3 text-sm text-neutral-900 outline-none"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Assistant password"
                    aria-label="Assistant password"
                    autoComplete="current-password"
                    disabled={unlocking}
                />
                {errorMessage && <p className="text-sm font-semibold text-rose-600">{errorMessage}</p>}
                <PressableButton
                    className="flex items-center justify-center gap-2 bg-sky-500 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
                    type="submit"
                    disabled={unlocking || !password}
                >
                    {unlocking && <Loader2 className="h-3 w-3 animate-spin" />}
                    {unlocking ? "Unlocking..." : "Unlock"}
                </PressableButton>
            </form>
        </div>
    );
}
