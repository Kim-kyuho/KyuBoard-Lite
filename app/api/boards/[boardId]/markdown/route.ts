import { getDb } from "@/lib/db";
import { db_boards, db_images, db_memos, db_mermaids, db_tables } from "@/lib/db/schema";
import { tableSourceSchema, tableSourceToMarkdown } from "@/lib/table-card";
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import TurndownService from "turndown";

type BoardCard = {
    type: "image" | "mermaid" | "table";
    id: number;
    content: string;
    label: string | null;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
};

const typeOrder: Record<BoardCard["type"], number> = { image: 1, mermaid: 2, table: 3 };
const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
});

turndown.addRule("strikethrough", {
    filter: ["del", "s"],
    replacement: (content) => `~~${content}~~`,
});

const escapeImageLabel = (label: string) => label.replaceAll("[", "\\[").replaceAll("]", "\\]");

function renderCard(card: BoardCard) {
    if (card.type === "image") {
        return `![${escapeImageLabel(card.label?.trim() || "Image")}](${card.content})`;
    }
    if (card.type === "mermaid") {
        return `\`\`\`mermaid\n${card.content.trim()}\n\`\`\``;
    }

    const parsedSource = tableSourceSchema.safeParse(JSON.parse(card.content));
    return parsedSource.success ? tableSourceToMarkdown(parsedSource.data) : "";
}

function compileMarkdown(
    memos: Array<typeof db_memos.$inferSelect>,
    cards: BoardCard[],
) {
    const markdownParts: string[] = [];
    const renderedCards = new Set<string>();

    memos.forEach((memo) => {
        const memoMarkdown = turndown.turndown(memo.content).trim();
        if (memoMarkdown) markdownParts.push(memoMarkdown);

        const corners = [
            [memo.x, memo.y],
            [memo.x + memo.width, memo.y],
            [memo.x, memo.y + memo.height],
            [memo.x + memo.width, memo.y + memo.height],
        ];

        corners.forEach(([cornerX, cornerY]) => {
            const card = cards
                .filter((candidate) =>
                    candidate.x < cornerX && cornerX < candidate.x + candidate.width &&
                    candidate.y < cornerY && cornerY < candidate.y + candidate.height)
                .sort((a, b) => b.z - a.z || typeOrder[a.type] - typeOrder[b.type] || a.id - b.id)[0];
            if (!card) return;

            const key = `${card.type}:${card.id}`;
            if (renderedCards.has(key)) return;
            renderedCards.add(key);

            const rendered = renderCard(card);
            if (rendered) markdownParts.push(rendered);
        });
    });

    return markdownParts.join("\n\n");
}

export async function GET(_request: Request, { params }: { params: Promise<{ boardId: string }> }) {
    try {
        const boardId = Number((await params).boardId);
        if (!Number.isInteger(boardId) || boardId <= 0) {
            return NextResponse.json({ ok: false, message: "Invalid board id." }, { status: 400 });
        }

        const db = getDb();
        const [board, memos, images, mermaids, tables] = await Promise.all([
            db.select({ boardId: db_boards.boardId }).from(db_boards).where(eq(db_boards.boardId, boardId)).limit(1),
            db.select().from(db_memos).where(eq(db_memos.boardId, boardId)).orderBy(asc(db_memos.id)),
            db.select().from(db_images).where(eq(db_images.boardId, boardId)),
            db.select().from(db_mermaids).where(eq(db_mermaids.boardId, boardId)),
            db.select().from(db_tables).where(eq(db_tables.boardId, boardId)),
        ]);

        if (!board[0]) {
            return NextResponse.json({ ok: false, message: "This board does not exist." }, { status: 404 });
        }

        const cards: BoardCard[] = [
            ...images.map((image) => ({
                type: "image" as const,
                id: image.imageId,
                content: image.url,
                label: image.label,
                x: image.x,
                y: image.y,
                z: image.z,
                width: image.width,
                height: image.height,
            })),
            ...mermaids.map((mermaid) => ({
                type: "mermaid" as const,
                id: mermaid.mermaidId,
                content: mermaid.source,
                label: null,
                x: mermaid.x,
                y: mermaid.y,
                z: mermaid.z,
                width: mermaid.width,
                height: mermaid.height,
            })),
            ...tables.map((table) => ({
                type: "table" as const,
                id: table.tableId,
                content: JSON.stringify(table.source),
                label: null,
                x: table.x,
                y: table.y,
                z: table.z,
                width: table.width,
                height: table.height,
            })),
        ];

        return NextResponse.json({ ok: true, markdown: compileMarkdown(memos, cards) });
    } catch (error) {
        console.error("Error compiling board markdown:", error);
        return NextResponse.json(
            { ok: false, message: "Markdown document could not be generated." },
            { status: 500 },
        );
    }
}
