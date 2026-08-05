import { useMemo } from "react";
import { compileBoardMarkdown } from "@/lib/board-markdown";
import type { BoardSnapshot } from "@/lib/board-state";

export function useBoardMarkdown(snapshot: BoardSnapshot) {
    const markdown = useMemo(() => compileBoardMarkdown(snapshot), [snapshot]);
    const markdownSections = useMemo(
        () => markdown.split(/```mermaid\s*\r?\n([\s\S]*?)```/g),
        [markdown],
    );

    const handleMarkdownDownload = () => {
        const file = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
        const fileUrl = URL.createObjectURL(file);
        const downloadLink = document.createElement("a");
        downloadLink.href = fileUrl;
        downloadLink.download = `board-${snapshot.board.boardId}.md`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        URL.revokeObjectURL(fileUrl);
    };

    return {
        markdown,
        markdownSections,
        errorMessage: "",
        loading: false,
        handleMarkdownDownload,
    };
}
