import Database from "better-sqlite3";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { boardStrokesSchema } from "@/lib/board-stroke";
import { defaultBoardId, getSqlite, schemaVersion } from "@/lib/db";
import { tableSourceSchema } from "@/lib/table-card";

const sqliteHeader = "SQLite format 3\0";
const requiredTables = ["boards", "memos", "images", "mermaids", "drawings", "tables"];

type Row = Record<string, unknown>;

function temporaryDirectory(prefix: string) {
    return mkdtempSync(path.join(tmpdir(), prefix));
}

export async function createSaveFile() {
    const directory = temporaryDirectory("kyuboard-export-");
    const snapshotPath = path.join(directory, "kyuboard-lite.sqlite");

    try {
        await getSqlite().backup(snapshotPath);
        return readFileSync(snapshotPath);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}

function assertInteger(value: unknown, field: string, { positive = false } = {}) {
    if (!Number.isInteger(value) || (positive && Number(value) <= 0)) {
        throw new Error(`Invalid ${field}.`);
    }
}

function assertString(value: unknown, field: string, { allowEmpty = true } = {}) {
    if (typeof value !== "string" || (!allowEmpty && !value.trim())) {
        throw new Error(`Invalid ${field}.`);
    }
}

function assertBoardReference(row: Row) {
    assertInteger(row.board_id, "board reference", { positive: true });
    if (row.board_id !== defaultBoardId) {
        throw new Error("The save file contains data for an unsupported board.");
    }
}

function assertGeometry(row: Row) {
    assertInteger(row.x, "x coordinate");
    assertInteger(row.y, "y coordinate");
    assertInteger(row.z, "z index");
    assertInteger(row.width, "width", { positive: true });
    assertInteger(row.height, "height", { positive: true });
}

function validateRows(data: ReturnType<typeof readRows>) {
    if (data.boards.length !== 1 || data.boards[0].board_id !== defaultBoardId) {
        throw new Error("A save file must contain exactly one KyuBoard Lite board.");
    }

    const board = data.boards[0];
    assertInteger(board.board_id, "board id", { positive: true });
    assertString(board.title, "board title", { allowEmpty: false });
    assertInteger(board.width, "board width", { positive: true });
    assertInteger(board.height, "board height", { positive: true });

    data.memos.forEach((row) => {
        assertInteger(row.id, "memo id", { positive: true });
        assertBoardReference(row);
        assertString(row.content, "memo content");
        assertString(row.color, "memo color", { allowEmpty: false });
        assertGeometry(row);
    });

    data.images.forEach((row) => {
        assertInteger(row.image_id, "image id", { positive: true });
        assertBoardReference(row);
        assertString(row.url, "image URL", { allowEmpty: false });
        const parsedUrl = new URL(String(row.url));
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
            throw new Error("Invalid image URL protocol.");
        }
        if (row.label !== null && typeof row.label !== "string") {
            throw new Error("Invalid image label.");
        }
        assertGeometry(row);
    });

    data.mermaids.forEach((row) => {
        assertInteger(row.mermaid_id, "Mermaid id", { positive: true });
        assertBoardReference(row);
        assertString(row.source, "Mermaid source", { allowEmpty: false });
        assertGeometry(row);
    });

    data.tables.forEach((row) => {
        assertInteger(row.table_id, "table id", { positive: true });
        assertBoardReference(row);
        assertString(row.source, "table JSON", { allowEmpty: false });
        const parsed = tableSourceSchema.safeParse(JSON.parse(String(row.source)));
        if (!parsed.success) throw new Error("Invalid table JSON.");
        assertGeometry(row);
    });

    data.drawings.forEach((row) => {
        assertInteger(row.drawing_id, "drawing id", { positive: true });
        assertBoardReference(row);
        assertString(row.source, "drawing JSON", { allowEmpty: false });
        const parsed = boardStrokesSchema.safeParse(JSON.parse(String(row.source)));
        if (!parsed.success) throw new Error("Invalid drawing JSON.");
    });
}

function readRows(source: Database.Database) {
    return {
        boards: source.prepare("SELECT board_id, title, width, height FROM boards").all() as Row[],
        memos: source.prepare("SELECT id, board_id, content, x, y, z, width, height, color FROM memos").all() as Row[],
        images: source.prepare("SELECT image_id, board_id, url, label, x, y, z, width, height FROM images").all() as Row[],
        mermaids: source.prepare("SELECT mermaid_id, board_id, source, x, y, z, width, height FROM mermaids").all() as Row[],
        drawings: source.prepare("SELECT drawing_id, board_id, source FROM drawings").all() as Row[],
        tables: source.prepare("SELECT table_id, board_id, source, x, y, z, width, height FROM tables").all() as Row[],
    };
}

function replaceCurrentBoard(data: ReturnType<typeof readRows>) {
    const target = getSqlite();
    const insertBoard = target.prepare("INSERT INTO boards (board_id, title, width, height) VALUES (?, ?, ?, ?)");
    const insertMemo = target.prepare("INSERT INTO memos (id, board_id, content, x, y, z, width, height, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const insertImage = target.prepare("INSERT INTO images (image_id, board_id, url, label, x, y, z, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const insertMermaid = target.prepare("INSERT INTO mermaids (mermaid_id, board_id, source, x, y, z, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    const insertDrawing = target.prepare("INSERT INTO drawings (drawing_id, board_id, source) VALUES (?, ?, ?)");
    const insertTable = target.prepare("INSERT INTO tables (table_id, board_id, source, x, y, z, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

    target.transaction(() => {
        target.prepare("DELETE FROM boards").run();

        data.boards.forEach((row) => insertBoard.run(row.board_id, row.title, row.width, row.height));
        data.memos.forEach((row) => insertMemo.run(row.id, row.board_id, row.content, row.x, row.y, row.z, row.width, row.height, row.color));
        data.images.forEach((row) => insertImage.run(row.image_id, row.board_id, row.url, row.label, row.x, row.y, row.z, row.width, row.height));
        data.mermaids.forEach((row) => insertMermaid.run(row.mermaid_id, row.board_id, row.source, row.x, row.y, row.z, row.width, row.height));
        data.drawings.forEach((row) => insertDrawing.run(row.drawing_id, row.board_id, row.source));
        data.tables.forEach((row) => insertTable.run(row.table_id, row.board_id, row.source, row.x, row.y, row.z, row.width, row.height));
    })();
}

export function importSaveFile(buffer: Buffer) {
    if (buffer.subarray(0, sqliteHeader.length).toString("utf8") !== sqliteHeader) {
        throw new Error("The selected file is not a SQLite database.");
    }

    const directory = temporaryDirectory("kyuboard-import-");
    const importPath = path.join(directory, "import.sqlite");
    writeFileSync(importPath, buffer);
    let source: Database.Database | null = null;

    try {
        source = new Database(importPath, { readonly: true, fileMustExist: true });
        const integrity = source.pragma("integrity_check") as Array<{ integrity_check: string }>;
        if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") {
            throw new Error("The SQLite save file failed its integrity check.");
        }

        const version = source.pragma("user_version", { simple: true });
        if (version !== schemaVersion) {
            throw new Error(`Unsupported save file version: ${String(version)}.`);
        }

        const tables = new Set(
            (source.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((row) => row.name),
        );
        if (requiredTables.some((table) => !tables.has(table))) {
            throw new Error("The SQLite file is missing KyuBoard Lite tables.");
        }

        const data = readRows(source);
        validateRows(data);
        replaceCurrentBoard(data);
    } finally {
        source?.close();
        rmSync(directory, { recursive: true, force: true });
    }
}
