import { act, renderHook } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBoardImages, type BoardImage } from "@/hooks/useBoardImages";
import { useBoardMemos, type BoardMemo } from "@/hooks/useBoardMemos";
import { useBoardMermaids, type BoardMermaid } from "@/hooks/useBoardMermaids";
import { useBoardTables, type BoardTable } from "@/hooks/useBoardTables";

const locationRef = createRef<HTMLDivElement>();

function setLocation() {
    const element = document.createElement("div");
    Object.defineProperties(element, {
        scrollLeft: { configurable: true, value: 400 },
        scrollTop: { configurable: true, value: 200 },
        clientWidth: { configurable: true, value: 800 },
        clientHeight: { configurable: true, value: 600 },
    });
    locationRef.current = element;
}

const memo: BoardMemo = {
    id: 1, boardId: 5, content: "memo", x: 10, y: 20, z: 1,
    width: 300, height: 200, color: "#fffadc",
};
const image: BoardImage = {
    imageId: 2, boardId: 5, url: "https://example.com/image.png", label: "image.png",
    x: 10, y: 20, z: 2, width: 400, height: 300,
};
const mermaid: BoardMermaid = {
    id: 3, boardId: 5, source: "flowchart LR", x: 10, y: 20, z: 3,
    width: 480, height: 360,
};
const table: BoardTable = {
    id: 4, boardId: 5,
    source: { columns: [{ id: "c", name: "C" }], rows: [] },
    x: 10, y: 20, z: 4, width: 560, height: 360,
};

describe("board card collection hooks", () => {
    beforeEach(() => {
        setLocation();
        vi.spyOn(Date, "now").mockReturnValue(1000);
    });

    afterEach(() => vi.unstubAllGlobals());

    it("creates and persists memos without an authentication gate", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const { result } = renderHook(() => useBoardMemos({
            initialMemos: [memo], boardId: 5, boardZoom: 2,
            cardLocationRef: locationRef,
        }));

        act(() => result.current.handleCreateTempMemo());
        expect(result.current.memos[1]).toMatchObject({ id: -1000, x: 250, y: 150 });
        await act(async () => result.current.handleInsertMemo(-1000, 5, "created", 1, 2, 3, 300, 200, "#fff"));
        expect(result.current.memos.some((item) => item.id === 2 && item.content === "created")).toBe(true);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("creates Mermaid and table drafts in the visible center", () => {
        const mermaids = renderHook(() => useBoardMermaids({
            initialMermaids: [mermaid], boardId: 5, boardZoom: 2,
            cardLocationRef: locationRef,
        }));
        const tables = renderHook(() => useBoardTables({
            initialTables: [table], boardId: 5, boardZoom: 2,
            cardLocationRef: locationRef,
        }));

        act(() => mermaids.result.current.handleCreateTempMermaid());
        act(() => tables.result.current.handleCreateTempTable());
        expect(mermaids.result.current.mermaids[1]).toMatchObject({ id: -1000, x: 160, y: 70 });
        expect(tables.result.current.tables[1]).toMatchObject({ id: -1000, x: 120, y: 70 });
    });

    it("creates an image card from a URL and uses the remote aspect ratio", async () => {
        class MockImage {
            naturalWidth = 800;
            naturalHeight = 600;
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            set src(_value: string) {
                queueMicrotask(() => this.onload?.());
            }
        }
        vi.stubGlobal("Image", MockImage);
        const { result } = renderHook(() => useBoardImages({
            initialImages: [], boardId: 5, boardZoom: 2,
            cardLocationRef: locationRef,
        }));

        let created = false;
        await act(async () => {
            created = await result.current.handleCreateImage(image.url, "image.png");
        });
        expect(created).toBe(true);
        expect(result.current.images).toEqual([{
            ...image, imageId: 1, x: 200, y: 100, z: 1,
        }]);
        expect(result.current.editingImageId).toBe(1);
    });

    it("updates and deletes a persisted URL image", async () => {
        const { result } = renderHook(() => useBoardImages({
            initialImages: [image], boardId: 5, boardZoom: 2,
            cardLocationRef: locationRef,
        }));

        await act(async () => result.current.handleUpdateImage(2, 5, "https://example.com/new.png", "new", 1, 2, 3, 4, 5));
        expect(result.current.images[0]).toMatchObject({ url: "https://example.com/new.png", label: "new", z: 3 });
        await act(async () => result.current.handleDeleteImage(2));
        expect(result.current.images).toEqual([]);
    });
});
