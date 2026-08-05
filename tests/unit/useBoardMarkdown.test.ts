import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBoardMarkdown } from "@/hooks/useBoardMarkdown";
import { createEmptyBoardSnapshot, type BoardSnapshot } from "@/lib/board-state";

function markdownSnapshot(): BoardSnapshot {
    return {
        ...createEmptyBoardSnapshot(),
        memos: [{
            id: 1, boardId: 1, content: "<h1>Title</h1><p>End</p>",
            x: 10, y: 10, z: 1, width: 100, height: 100, color: "#fffadc",
        }],
        mermaids: [{
            id: 1, boardId: 1, source: "flowchart LR\nA-->B",
            x: 0, y: 0, z: 2, width: 50, height: 50,
        }],
    };
}

describe("useBoardMarkdown", () => {
    it("compiles local board state and separates Mermaid source blocks", () => {
        const { result } = renderHook(() => useBoardMarkdown(markdownSnapshot()));
        expect(result.current.loading).toBe(false);
        expect(result.current.errorMessage).toBe("");
        expect(result.current.markdown).toContain("# Title");
        expect(result.current.markdown).toContain("```mermaid");
        expect(result.current.markdownSections).toContain("flowchart LR\nA-->B\n");
    });

    it("compiles overlapping URL images without a server request", () => {
        const snapshot = markdownSnapshot();
        snapshot.mermaids = [];
        snapshot.images = [{
            imageId: 1, boardId: 1, url: "https://example.com/a.png", label: "A",
            x: 0, y: 0, z: 2, width: 50, height: 50,
        }];
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const { result } = renderHook(() => useBoardMarkdown(snapshot));
        expect(result.current.markdown).toContain("![A](https://example.com/a.png)");
        expect(fetchMock).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });

    it("downloads the generated markdown and revokes the object URL", () => {
        const createObjectURL = vi.fn().mockReturnValue("blob:test");
        const revokeObjectURL = vi.fn();
        Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
        Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

        const { result } = renderHook(() => useBoardMarkdown(markdownSnapshot()));
        act(() => result.current.handleMarkdownDownload());

        expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
        expect(click).toHaveBeenCalledOnce();
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
    });
});
