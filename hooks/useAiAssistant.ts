import { Dispatch, RefObject, SetStateAction, useCallback, useState } from "react";
import {
    getPlanCapacity,
    memoBlocksToHtml,
    planTableToSource,
    layoutArrangement,
    layoutBoardPlan,
    type BoardArrangement,
    type BoardBounds,
    type BoardDeletion,
    type BoardEdit,
    type BoardPlan,
} from "@/lib/ai/board-plan";
import type { BoardImage } from "@/hooks/useBoardImages";
import type { BoardMemo } from "@/hooks/useBoardMemos";
import type { BoardMermaid } from "@/hooks/useBoardMermaids";
import type { BoardTable } from "@/hooks/useBoardTables";

export type AiChatMessage = {
    role: "user" | "assistant";
    content: string;
};

// AI가 만든 카드는 임시 카드로만 올라간다. 사용자가 저장을 눌러야 보드에 확정된다.
type PendingCards = {
    memoIds: number[];
    mermaidIds: number[];
    tableIds: number[];
};

const emptyPendingCards: PendingCards = { memoIds: [], mermaidIds: [], tableIds: [] };

// 재배치는 이미 저장된 카드를 움직이므로, 취소하면 되돌릴 수 있게 이전 좌표를 들고 있는다.
type MovedCard = { id: number; x: number; y: number; previousX: number; previousY: number };

type PendingMoves = {
    memos: MovedCard[];
    mermaids: MovedCard[];
    tables: MovedCard[];
};

const emptyPendingMoves: PendingMoves = { memos: [], mermaids: [], tables: [] };

// 고치기는 이미 저장된 카드의 내용을 바꾸므로, 취소하면 되돌릴 수 있게 이전 값을 들고 있는다.
type PendingEdits = {
    memos: BoardMemo[];
    mermaids: BoardMermaid[];
    tables: BoardTable[];
};

const emptyPendingEdits: PendingEdits = { memos: [], mermaids: [], tables: [] };

// 삭제는 저장 전까지 화면에서만 지운다. 취소하면 원래 카드를 그대로 되살린다.
type PendingDeletions = {
    memos: BoardMemo[];
    mermaids: BoardMermaid[];
    tables: BoardTable[];
    images: BoardImage[];
};

const emptyPendingDeletions: PendingDeletions = { memos: [], mermaids: [], tables: [], images: [] };

/**
 * 한 시점의 보드 카드 전체. 제안을 적용하는 함수들은 이 값을 기준으로 받아 다음 값을 만든다.
 * 훅 상태를 직접 읽으면 같은 처리 안에서 앞 단계의 결과를 보지 못한다.
 */
type BoardCards = {
    memos: BoardMemo[];
    mermaids: BoardMermaid[];
    tables: BoardTable[];
    images: BoardImage[];
};

// 새 카드 열은 기존 카드들의 오른쪽 끝 바깥에서 시작해 겹치지 않게 한다.
const newColumnGap = 120;

// 재배치는 보드 전체를 다시 정리하는 것이므로 항상 보드 왼쪽 위에서 시작한다.
const boardMarginOrigin = 40;

type UseAiAssistantOptions = {
    boardId: number;
    boardWidth: number;
    boardHeight: number;
    boardZoom: number;
    cardLocationRef: RefObject<HTMLDivElement | null>;
    setMessage: (message: string) => void;
    memos: BoardMemo[];
    mermaids: BoardMermaid[];
    tables: BoardTable[];
    images: BoardImage[];
    setMemos: Dispatch<SetStateAction<BoardMemo[]>>;
    setMermaids: Dispatch<SetStateAction<BoardMermaid[]>>;
    setTables: Dispatch<SetStateAction<BoardTable[]>>;
    setImages: Dispatch<SetStateAction<BoardImage[]>>;
    onInsertMemo: (
        tempId: number, boardId: number, content: string,
        x: number, y: number, z: number, width: number, height: number, color: string,
    ) => Promise<void>;
    onInsertMermaid: (
        tempId: number, boardId: number, source: string,
        x: number, y: number, z: number, width: number, height: number,
    ) => Promise<void>;
    onInsertTable: (table: BoardTable) => Promise<void>;
    onUpdateMemo: (
        id: number, boardId: number, content: string,
        x: number, y: number, z: number, width: number, height: number, color: string,
    ) => Promise<void>;
    onUpdateMermaid: (
        id: number, boardId: number, source: string,
        x: number, y: number, z: number, width: number, height: number,
    ) => Promise<void>;
    onUpdateTable: (table: BoardTable) => Promise<void>;
    onDeleteMemo: (id: number) => Promise<void>;
    onDeleteMermaid: (id: number) => Promise<void>;
    onDeleteTable: (id: number) => Promise<void>;
    onDeleteImage: (imageId: number) => Promise<void>;
};

export function useAiAssistant({
    boardId,
    boardWidth,
    boardHeight,
    boardZoom,
    cardLocationRef,
    setMessage,
    memos,
    mermaids,
    tables,
    images,
    setMemos,
    setMermaids,
    setTables,
    setImages,
    onInsertMemo,
    onInsertMermaid,
    onInsertTable,
    onUpdateMemo,
    onUpdateMermaid,
    onUpdateTable,
    onDeleteMemo,
    onDeleteMermaid,
    onDeleteTable,
    onDeleteImage,
}: UseAiAssistantOptions) {
    const [aiPanelOpen, setAiPanelOpen] = useState(false);
    // 잠금 쿠키는 HttpOnly라서 JS가 읽을 수 없다. 서버에 물어본 결과만 신뢰한다.
    const [unlocked, setUnlocked] = useState(false);
    const [unlocking, setUnlocking] = useState(false);
    const [unlockError, setUnlockError] = useState("");
    const [messages, setMessages] = useState<AiChatMessage[]>([]);
    const [sending, setSending] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pendingCards, setPendingCards] = useState<PendingCards>(emptyPendingCards);
    const [pendingMoves, setPendingMoves] = useState<PendingMoves>(emptyPendingMoves);
    const [pendingEdits, setPendingEdits] = useState<PendingEdits>(emptyPendingEdits);
    const [pendingDeletions, setPendingDeletions] = useState<PendingDeletions>(emptyPendingDeletions);

    const hasPendingCards =
        pendingCards.memoIds.length > 0 ||
        pendingCards.mermaidIds.length > 0 ||
        pendingCards.tableIds.length > 0 ||
        pendingMoves.memos.length > 0 ||
        pendingMoves.mermaids.length > 0 ||
        pendingMoves.tables.length > 0 ||
        pendingEdits.memos.length > 0 ||
        pendingEdits.mermaids.length > 0 ||
        pendingEdits.tables.length > 0 ||
        pendingDeletions.memos.length > 0 ||
        pendingDeletions.mermaids.length > 0 ||
        pendingDeletions.tables.length > 0 ||
        pendingDeletions.images.length > 0;

    const boardBounds: BoardBounds = { width: boardWidth, height: boardHeight };

    const currentCards = (): BoardCards => ({ memos, mermaids, tables, images });

    const commitCards = (cards: BoardCards) => {
        setMemos(cards.memos);
        setMermaids(cards.mermaids);
        setTables(cards.tables);
        setImages(cards.images);
    };

    const clearPending = () => {
        setPendingCards(emptyPendingCards);
        setPendingMoves(emptyPendingMoves);
        setPendingEdits(emptyPendingEdits);
        setPendingDeletions(emptyPendingDeletions);
    };

    /**
     * 아직 저장하지 않은 AI 변경을 모두 되돌린 컬렉션을 계산한다. 화면에는 반영하지 않는다.
     *
     * 값으로 돌려주는 이유가 있다. 새 제안이 오면 이전 제안을 먼저 걷어내야 하는데, 방금
     * setState한 결과는 같은 처리 안에서 memos 같은 closure 값으로 다시 읽을 수 없다. 되돌린
     * 결과를 값으로 들고 다음 단계의 기준으로 넘겨야, 연달아 고친 카드도 맨 처음 값으로
     * 돌아간다.
     */
    const restoreCards = (cards: BoardCards): BoardCards => {
        const restore = <T extends { id: number; x: number; y: number }>(list: T[], moves: MovedCard[]) => {
            if (moves.length === 0) {
                return list;
            }
            const moveById = new Map(moves.map((move) => [move.id, move]));

            return list.map((card) => {
                const move = moveById.get(card.id);
                return move ? { ...card, x: move.previousX, y: move.previousY } : card;
            });
        };

        // 고쳐 놓은 카드는 이전 내용으로, 지운 카드는 원래대로 되살린다.
        const revert = <T extends { id: number }>(list: T[], previous: T[], removed: T[]) => {
            const previousById = new Map(previous.map((card) => [card.id, card]));
            const reverted = list.map((card) => previousById.get(card.id) ?? card);

            return removed.length > 0 ? [...reverted, ...removed] : reverted;
        };

        return {
            memos: revert(
                restore(cards.memos.filter((memo) => !pendingCards.memoIds.includes(memo.id)), pendingMoves.memos),
                pendingEdits.memos,
                pendingDeletions.memos
            ),
            mermaids: revert(
                restore(cards.mermaids.filter((card) => !pendingCards.mermaidIds.includes(card.id)), pendingMoves.mermaids),
                pendingEdits.mermaids,
                pendingDeletions.mermaids
            ),
            tables: revert(
                restore(cards.tables.filter((card) => !pendingCards.tableIds.includes(card.id)), pendingMoves.tables),
                pendingEdits.tables,
                pendingDeletions.tables
            ),
            // 이미지는 어시스턴트가 만들 수 없으므로 되살릴 것만 있다.
            images: pendingDeletions.images.length > 0
                ? [...cards.images, ...pendingDeletions.images]
                : cards.images,
        };
    };

    const discardPendingCards = useCallback(() => {
        commitCards(restoreCards(currentCards()));
        clearPending();
        // restoreCards와 commitCards는 아래 값들만 읽는다. 훅 본문에서 매 렌더 새로 만들어지므로
        // 의존성에는 그 값들을 직접 적는다.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        memos,
        mermaids,
        tables,
        images,
        pendingCards,
        pendingMoves,
        pendingEdits,
        pendingDeletions,
        setMemos,
        setMermaids,
        setTables,
        setImages,
    ]);

    /**
     * 서버에 키와 비밀번호가 설정돼 있는지, 지금 잠금이 풀려 있는지 확인한다.
     * 쿠키가 만료됐을 수 있으므로 패널을 열 때마다 새로 묻는다.
     */
    const refreshAiStatus = useCallback(async () => {
        const response = await fetch("/api/ai/status");
        const data = await response.json();

        if (!data.ok) {
            return null;
        }

        setUnlocked(Boolean(data.unlocked));

        return { configured: Boolean(data.configured), message: data.message as string | null };
    }, []);

    const handleToggleAiPanel = async () => {
        if (aiPanelOpen) {
            // 제안을 남겨 둔 채 닫으면 보드 자동 저장이 멈춘 채로 잊힌다. 먼저 결정하게 한다.
            if (hasPendingCards) {
                setMessage("Save or discard the assistant's changes first.");
                return;
            }

            setAiPanelOpen(false);
            return;
        }

        const status = await refreshAiStatus();

        if (!status?.configured) {
            setMessage(status?.message ?? "The AI assistant is unavailable.");
            return;
        }

        setUnlockError("");
        setAiPanelOpen(true);
    };

    const handleUnlock = async (password: string) => {
        if (!password || unlocking) {
            return;
        }

        setUnlocking(true);

        try {
            const response = await fetch("/api/ai/unlock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            const data = await response.json();

            if (!data.ok) {
                setUnlockError(data.message ?? "The assistant could not be unlocked.");
                return;
            }

            setUnlockError("");
            setUnlocked(true);
        } catch (error) {
            console.error("Error unlocking AI assistant:", error);
            setUnlockError("The assistant could not be unlocked.");
        } finally {
            setUnlocking(false);
        }
    };

    /** 브라우저를 닫기 전에 직접 잠근다. 대화 기록도 함께 버린다. */
    const handleLock = async () => {
        if (hasPendingCards) {
            setMessage("Save or discard the assistant's changes first.");
            return;
        }

        try {
            await fetch("/api/ai/unlock", { method: "DELETE" });
        } catch (error) {
            console.error("Error locking AI assistant:", error);
        }

        setUnlocked(false);
        setMessages([]);
        setAiPanelOpen(false);
    };

    // 기존 카드 오른쪽 바깥에 새 열을 잡고, 현재 보이는 화면 높이에 맞춰 시작점을 정한다.
    const getPlanOrigin = (base: BoardCards) => {
        const rightEdges = [
            ...base.memos.map((memo) => memo.x + memo.width),
            ...base.mermaids.map((mermaid) => mermaid.x + mermaid.width),
            ...base.tables.map((table) => table.x + table.width),
        ];
        const locationElement = cardLocationRef.current;
        const viewportTop = locationElement ? locationElement.scrollTop / boardZoom : 0;

        return {
            x: rightEdges.length > 0 ? Math.max(...rightEdges) + newColumnGap : newColumnGap,
            y: viewportTop + 80,
        };
    };

    const applyPlan = (plan: BoardPlan, base: BoardCards) => {
        const planned = layoutBoardPlan(plan, getPlanOrigin(base), boardBounds);
        // 임시 ID는 증가하도록 만들어, 저장 전에도 메모 탐색 순서가 문서 순서와 같게 유지한다.
        const idBase = -Date.now();
        let idOffset = 0;
        const nextTempId = () => idBase + idOffset++;

        const newMemos: BoardMemo[] = planned.memos.map((memo) => ({
            id: nextTempId(),
            boardId,
            content: memo.content,
            x: memo.x,
            y: memo.y,
            z: 1,
            width: memo.width,
            height: memo.height,
            color: memo.color,
        }));
        const newMermaids: BoardMermaid[] = planned.mermaids.map((mermaid) => ({
            id: nextTempId(),
            boardId,
            source: mermaid.source,
            x: mermaid.x,
            y: mermaid.y,
            z: 1,
            width: mermaid.width,
            height: mermaid.height,
        }));
        const newTables: BoardTable[] = planned.tables.map((table) => ({
            id: nextTempId(),
            boardId,
            source: table.source,
            x: table.x,
            y: table.y,
            z: 1,
            width: table.width,
            height: table.height,
        }));

        const next: BoardCards = {
            memos: [...base.memos, ...newMemos],
            mermaids: [...base.mermaids, ...newMermaids],
            tables: [...base.tables, ...newTables],
            images: base.images,
        };

        commitCards(next);
        setPendingCards({
            memoIds: newMemos.map((memo) => memo.id),
            mermaidIds: newMermaids.map((mermaid) => mermaid.id),
            tableIds: newTables.map((table) => table.id),
        });

        // 새 열이 화면 밖이면 사용자가 결과를 볼 수 없으므로 그쪽으로 이동한다.
        const locationElement = cardLocationRef.current;
        if (locationElement && newMemos[0]) {
            locationElement.scrollTo({
                left: Math.max(0, newMemos[0].x * boardZoom - 120),
                top: Math.max(0, newMemos[0].y * boardZoom - 120),
                behavior: "smooth",
            });
        }

        return { droppedSections: planned.droppedSections, placed: newMemos.length, cards: next };
    };

    // 이미 저장된 카드를 옮긴다. 좌표만 로컬에 반영하고, 이전 좌표는 되돌리기용으로 남긴다.
    const applyArrangement = (arrangement: BoardArrangement, base: BoardCards) => {
        const arranged = layoutArrangement(
            arrangement,
            { memos: base.memos, mermaids: base.mermaids, tables: base.tables },
            { x: boardMarginOrigin, y: boardMarginOrigin },
            boardBounds
        );

        const toMoves = <T extends { id: number; x: number; y: number }>(
            cards: T[],
            moves: { id: number; x: number; y: number }[]
        ): MovedCard[] => {
            const cardById = new Map(cards.map((card) => [card.id, card]));

            return moves.flatMap((move) => {
                const card = cardById.get(move.id);
                if (!card || (card.x === move.x && card.y === move.y)) {
                    return [];
                }
                return [{ ...move, previousX: card.x, previousY: card.y }];
            });
        };

        const memoMoves = toMoves(base.memos, arranged.memos);
        const mermaidMoves = toMoves(base.mermaids, arranged.mermaids);
        const tableMoves = toMoves(base.tables, arranged.tables);

        const applyMoves = <T extends { id: number; x: number; y: number }>(cards: T[], moves: MovedCard[]) => {
            if (moves.length === 0) {
                return cards;
            }
            const moveById = new Map(moves.map((move) => [move.id, move]));

            return cards.map((card) => {
                const move = moveById.get(card.id);
                return move ? { ...card, x: move.x, y: move.y } : card;
            });
        };

        const next: BoardCards = {
            memos: applyMoves(base.memos, memoMoves),
            mermaids: applyMoves(base.mermaids, mermaidMoves),
            tables: applyMoves(base.tables, tableMoves),
            images: base.images,
        };

        commitCards(next);
        setPendingMoves({ memos: memoMoves, mermaids: mermaidMoves, tables: tableMoves });

        const locationElement = cardLocationRef.current;
        if (locationElement && arranged.memos[0]) {
            locationElement.scrollTo({
                left: Math.max(0, arranged.memos[0].x * boardZoom - 120),
                top: Math.max(0, arranged.memos[0].y * boardZoom - 120),
                behavior: "smooth",
            });
        }

        return { droppedSections: arranged.droppedSections, moved: memoMoves.length, cards: next };
    };

    // 모델이 재배치·고치기·지우기 대상을 고를 수 있도록 현재 보드 카드 목록을 요약해 보낸다.
    const getBoardSnapshot = () => {
        const stripHtml = (html: string) =>
            html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

        return {
            memos: memos
                .filter((memo) => memo.id > 0)
                .map((memo) => ({ id: memo.id, summary: stripHtml(memo.content).slice(0, 120) || "(empty memo)" })),
            mermaids: mermaids
                .filter((card) => card.id > 0)
                .map((card) => ({ id: card.id, summary: card.source.split("\n")[0].slice(0, 120) })),
            tables: tables
                .filter((card) => card.id > 0)
                .map((card) => ({
                    id: card.id,
                    summary: card.source.columns.map((column) => column.name).join(", ").slice(0, 120),
                })),
            images: images
                .filter((image) => image.imageId > 0)
                .map((image) => ({
                    id: image.imageId,
                    summary: (image.label ?? image.url).slice(0, 120),
                })),
            capacity: getPlanCapacity(boardBounds),
        };
    };

    // 고치기: 바꾸기 전 카드를 pendingEdits에 남겨 두고 화면을 먼저 갱신한다.
    const applyEdit = (edit: BoardEdit, base: BoardCards) => {
        const memoEdits = new Map((edit.memos ?? []).map((item) => [item.id, item]));
        const mermaidEdits = new Map((edit.mermaids ?? []).map((item) => [item.id, item]));
        const tableEdits = new Map((edit.tables ?? []).map((item) => [item.id, item]));

        const changedMemos = base.memos.filter((memo) => memoEdits.has(memo.id));
        const changedMermaids = base.mermaids.filter((card) => mermaidEdits.has(card.id));
        const changedTables = base.tables.filter((card) => tableEdits.has(card.id));
        const changedCount = changedMemos.length + changedMermaids.length + changedTables.length;

        if (changedCount === 0) {
            return { changed: 0, cards: base };
        }

        const next: BoardCards = {
            memos: base.memos.map((memo) => {
                const change = memoEdits.get(memo.id);

                if (!change) {
                    return memo;
                }

                return {
                    ...memo,
                    content: change.blocks ? memoBlocksToHtml(change.blocks) : memo.content,
                    color: change.color ?? memo.color,
                };
            }),
            mermaids: base.mermaids.map((card) => {
                const change = mermaidEdits.get(card.id);
                return change ? { ...card, source: change.source } : card;
            }),
            tables: base.tables.map((card) => {
                const change = tableEdits.get(card.id);
                return change
                    ? { ...card, source: planTableToSource(change.columns, change.rows) }
                    : card;
            }),
            images: base.images,
        };

        commitCards(next);

        // 같은 카드를 연달아 고쳐도 맨 처음 값으로 되돌아가도록 이미 기록된 카드는 덮지 않는다.
        setPendingEdits((prev) => {
            const keep = <T extends { id: number }>(previous: T[], candidates: T[]) => {
                const known = new Set(previous.map((card) => card.id));
                return [...previous, ...candidates.filter((card) => !known.has(card.id))];
            };

            return {
                memos: keep(prev.memos, changedMemos),
                mermaids: keep(prev.mermaids, changedMermaids),
                tables: keep(prev.tables, changedTables),
            };
        });

        return { changed: changedCount, cards: next };
    };

    // 지우기: 저장 전까지는 화면에서만 사라진다. 원본을 들고 있다가 취소하면 되살린다.
    const applyDeletion = (deletion: BoardDeletion, base: BoardCards) => {
        const memoIds = new Set(deletion.memoIds ?? []);
        const mermaidIds = new Set(deletion.mermaidIds ?? []);
        const tableIds = new Set(deletion.tableIds ?? []);
        const imageIds = new Set(deletion.imageIds ?? []);

        const removedMemos = base.memos.filter((memo) => memoIds.has(memo.id));
        const removedMermaids = base.mermaids.filter((card) => mermaidIds.has(card.id));
        const removedTables = base.tables.filter((card) => tableIds.has(card.id));
        const removedImages = base.images.filter((image) => imageIds.has(image.imageId) && image.imageId > 0);
        const removedCount =
            removedMemos.length + removedMermaids.length + removedTables.length + removedImages.length;

        if (removedCount === 0) {
            return { removed: 0, cards: base };
        }

        const next: BoardCards = {
            memos: base.memos.filter((memo) => !memoIds.has(memo.id)),
            mermaids: base.mermaids.filter((card) => !mermaidIds.has(card.id)),
            tables: base.tables.filter((card) => !tableIds.has(card.id)),
            images: base.images.filter((image) => !imageIds.has(image.imageId)),
        };

        commitCards(next);
        setPendingDeletions((prev) => ({
            memos: [...prev.memos, ...removedMemos],
            mermaids: [...prev.mermaids, ...removedMermaids],
            tables: [...prev.tables, ...removedTables],
            images: [...prev.images, ...removedImages],
        }));

        return { removed: removedCount, cards: next };
    };

    const handleSendMessage = async (text: string) => {
        const content = text.trim();

        if (!content || sending) {
            return;
        }

        const nextMessages: AiChatMessage[] = [...messages, { role: "user", content }];
        setMessages(nextMessages);
        setSending(true);

        try {
            const response = await fetch("/api/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: nextMessages.slice(-20),
                    snapshot: getBoardSnapshot(),
                }),
            });
            const data = await response.json();

            if (!data.ok) {
                // 쿠키가 만료됐으면 다시 비밀번호를 묻는다. 대화 기록은 남겨 둔다.
                if (data.locked) {
                    setUnlocked(false);
                    setUnlockError("The assistant was locked again. Enter the password to continue.");
                } else {
                    setMessage(data.message ?? "The AI assistant could not respond.");
                }

                setMessages(nextMessages);
                return;
            }

            const notes: string[] = [];

            // 각 단계가 다음 단계의 기준을 값으로 넘긴다. setState 결과를 다시 읽으려 하면
            // 같은 처리 안에서는 옛 값이 보이고, 이전 제안을 걷어낸 것이 없던 일이 된다.
            let cards = currentCards();

            if (data.plan || data.arrangement || data.edit || data.deletion) {
                // 이전 제안이 남아 있으면 걷어내고 새 제안만 보여준다.
                if (hasPendingCards) {
                    cards = restoreCards(cards);
                    commitCards(cards);
                    clearPending();
                }
            }

            if (data.plan) {
                const result = applyPlan(data.plan, cards);
                cards = result.cards;

                if (result.droppedSections > 0) {
                    notes.push(
                        `Could not place ${result.droppedSections} section(s) because the board is full. Clear some space first.`
                    );
                }
            }

            if (data.edit) {
                const result = applyEdit(data.edit, cards);
                cards = result.cards;

                if (result.changed === 0) {
                    notes.push("Could not find those cards on this board.");
                }
            }

            if (data.deletion) {
                const result = applyDeletion(data.deletion, cards);
                cards = result.cards;

                if (result.removed === 0) {
                    notes.push("Could not find those cards on this board.");
                }
            }

            if (data.arrangement) {
                const result = applyArrangement(data.arrangement, cards);
                cards = result.cards;

                if (result.moved === 0) {
                    notes.push("There was nothing to move.");
                }
                if (result.droppedSections > 0) {
                    notes.push(`Left ${result.droppedSections} card(s) in place because the board is full.`);
                }
            }

            setMessages([
                ...nextMessages,
                { role: "assistant", content: [data.reply, ...notes].filter(Boolean).join("\n\n") },
            ]);
        } catch (error) {
            console.error("Error sending AI message:", error);
            setMessage("The AI assistant could not respond.");
        } finally {
            setSending(false);
        }
    };

    /**
     * 제안을 보드에 확정한다.
     *
     * 임시 카드에 양수 ID를 붙이는 일이 곧 저장이다. 브라우저 SQLite 파일에 실제로 쓰는 것은
     * BoardClient의 자동 저장인데, 그 자동 저장은 제안이 남아 있는 동안 멈춰 있다. 여기서
     * pending을 비우는 순간 다시 돌면서 파일에 반영된다.
     *
     * 메모는 계획 순서대로 하나씩 처리한다. 메모 ID 순서가 곧 Markdown 문서 순서다.
     */
    const handleSavePendingCards = async () => {
        if (!hasPendingCards || saving) {
            return;
        }

        setSaving(true);

        try {
            for (const memoId of pendingCards.memoIds) {
                const memo = memos.find((item) => item.id === memoId);
                if (!memo) {
                    continue;
                }
                await onInsertMemo(
                    memo.id, memo.boardId, memo.content,
                    memo.x, memo.y, memo.z, memo.width, memo.height, memo.color,
                );
            }

            for (const mermaidId of pendingCards.mermaidIds) {
                const mermaid = mermaids.find((item) => item.id === mermaidId);
                if (!mermaid) {
                    continue;
                }
                await onInsertMermaid(
                    mermaid.id, mermaid.boardId, mermaid.source,
                    mermaid.x, mermaid.y, mermaid.z, mermaid.width, mermaid.height,
                );
            }

            for (const tableId of pendingCards.tableIds) {
                const table = tables.find((item) => item.id === tableId);
                if (!table) {
                    continue;
                }
                await onInsertTable(table);
            }

            // 고친 카드는 현재 화면 값 그대로 확정한다.
            for (const previous of pendingEdits.memos) {
                const memo = memos.find((item) => item.id === previous.id);
                if (!memo) {
                    continue;
                }
                await onUpdateMemo(
                    memo.id, memo.boardId, memo.content,
                    memo.x, memo.y, memo.z, memo.width, memo.height, memo.color,
                );
            }

            for (const previous of pendingEdits.mermaids) {
                const mermaid = mermaids.find((item) => item.id === previous.id);
                if (!mermaid) {
                    continue;
                }
                await onUpdateMermaid(
                    mermaid.id, mermaid.boardId, mermaid.source,
                    mermaid.x, mermaid.y, mermaid.z, mermaid.width, mermaid.height,
                );
            }

            for (const previous of pendingEdits.tables) {
                const table = tables.find((item) => item.id === previous.id);
                if (!table) {
                    continue;
                }
                await onUpdateTable(table);
            }

            // 지우기는 마지막에 확정한다. 앞 단계가 실패해도 원본이 남아 있게 한다.
            for (const memo of pendingDeletions.memos) {
                await onDeleteMemo(memo.id);
            }
            for (const mermaid of pendingDeletions.mermaids) {
                await onDeleteMermaid(mermaid.id);
            }
            for (const table of pendingDeletions.tables) {
                await onDeleteTable(table.id);
            }
            for (const image of pendingDeletions.images) {
                await onDeleteImage(image.imageId);
            }

            // 재배치로 옮긴 기존 카드는 좌표만 갱신한다.
            for (const move of pendingMoves.memos) {
                const memo = memos.find((item) => item.id === move.id);
                if (!memo) {
                    continue;
                }
                await onUpdateMemo(
                    memo.id, memo.boardId, memo.content,
                    move.x, move.y, memo.z, memo.width, memo.height, memo.color,
                );
            }

            for (const move of pendingMoves.mermaids) {
                const mermaid = mermaids.find((item) => item.id === move.id);
                if (!mermaid) {
                    continue;
                }
                await onUpdateMermaid(
                    mermaid.id, mermaid.boardId, mermaid.source,
                    move.x, move.y, mermaid.z, mermaid.width, mermaid.height,
                );
            }

            for (const move of pendingMoves.tables) {
                const table = tables.find((item) => item.id === move.id);
                if (!table) {
                    continue;
                }
                await onUpdateTable({ ...table, x: move.x, y: move.y });
            }

            setPendingCards(emptyPendingCards);
            setPendingMoves(emptyPendingMoves);
            setPendingEdits(emptyPendingEdits);
            setPendingDeletions(emptyPendingDeletions);
        } finally {
            setSaving(false);
        }
    };

    return {
        aiPanelOpen,
        unlocked,
        unlocking,
        unlockError,
        messages,
        sending,
        saving,
        hasPendingCards,
        refreshAiStatus,
        handleToggleAiPanel,
        handleUnlock,
        handleLock,
        handleSendMessage,
        handleSavePendingCards,
        discardPendingCards,
    };
}
