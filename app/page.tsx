import BoardClient from "@/components/BoardClient";
import { defaultBoardId, getDb } from "@/lib/db";
import { db_boards, db_drawings, db_images, db_memos, db_mermaids, db_tables } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function Home() {
    const db = getDb();

    const [currentBoard, allMemos, allImages, allMermaids, allTables, boardDrawings] = await Promise.all([
        db.select().from(db_boards).where(eq(db_boards.boardId, defaultBoardId)).limit(1),
        db.select().from(db_memos).where(eq(db_memos.boardId, defaultBoardId)),
        db.select().from(db_images).where(eq(db_images.boardId, defaultBoardId)),
        db.select().from(db_mermaids).where(eq(db_mermaids.boardId, defaultBoardId)),
        db.select().from(db_tables).where(eq(db_tables.boardId, defaultBoardId)),
        db.select({ source: db_drawings.source }).from(db_drawings).where(eq(db_drawings.boardId, defaultBoardId)).limit(1),
    ]);

    const board = currentBoard[0];
    if (!board) {
        throw new Error("The default board could not be initialized.");
    }

    return (
        <BoardClient
            currentBoard={{
                boardId: board.boardId,
                title: board.title,
                width: board.width,
                height: board.height,
            }}
            mappedImages={allImages.map((image) => ({
                imageId: image.imageId,
                boardId: image.boardId,
                url: image.url,
                label: image.label,
                x: image.x,
                y: image.y,
                z: image.z,
                width: image.width,
                height: image.height,
            }))}
            mappedMemos={allMemos.map((memo) => ({
                id: memo.id,
                boardId: memo.boardId,
                content: memo.content,
                x: memo.x,
                y: memo.y,
                z: memo.z,
                width: memo.width,
                height: memo.height,
                color: memo.color,
            }))}
            mappedMermaids={allMermaids.map((mermaid) => ({
                id: mermaid.mermaidId,
                boardId: mermaid.boardId,
                source: mermaid.source,
                x: mermaid.x,
                y: mermaid.y,
                z: mermaid.z,
                width: mermaid.width,
                height: mermaid.height,
            }))}
            mappedTables={allTables.map((table) => ({
                id: table.tableId,
                boardId: table.boardId,
                source: table.source,
                x: table.x,
                y: table.y,
                z: table.z,
                width: table.width,
                height: table.height,
            }))}
            mappedStrokes={boardDrawings[0]?.source ?? []}
        />
    );
}
