import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "@/lib/db/schema";

const schemaVersion = 1;
const defaultBoardId = 1;

type DatabaseState = {
    sqlite: Database.Database;
    db: ReturnType<typeof drizzle<typeof schema>>;
};

const globalForDatabase = globalThis as typeof globalThis & {
    kyuboardDatabase?: DatabaseState;
};

function getDatabasePath() {
    const configuredDirectory = process.env.KYUBOARD_DATA_DIR;
    const dataDirectory = configuredDirectory
        ? path.resolve(configuredDirectory)
        : path.join(process.cwd(), "data");

    mkdirSync(dataDirectory, { recursive: true });
    return path.join(dataDirectory, "kyuboard.sqlite");
}

function initializeDatabase(sqlite: Database.Database) {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("busy_timeout = 5000");

    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS boards (
            board_id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            width INTEGER NOT NULL CHECK (width > 0),
            height INTEGER NOT NULL CHECK (height > 0),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS memos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            board_id INTEGER NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            x INTEGER NOT NULL DEFAULT 0,
            y INTEGER NOT NULL DEFAULT 0,
            z INTEGER NOT NULL DEFAULT 1,
            width INTEGER NOT NULL CHECK (width > 0),
            height INTEGER NOT NULL CHECK (height > 0),
            color TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS images (
            image_id INTEGER PRIMARY KEY AUTOINCREMENT,
            board_id INTEGER NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
            url TEXT NOT NULL,
            label TEXT,
            x INTEGER NOT NULL DEFAULT 0,
            y INTEGER NOT NULL DEFAULT 0,
            z INTEGER NOT NULL DEFAULT 1,
            width INTEGER NOT NULL DEFAULT 400 CHECK (width > 0),
            height INTEGER NOT NULL DEFAULT 300 CHECK (height > 0),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS mermaids (
            mermaid_id INTEGER PRIMARY KEY AUTOINCREMENT,
            board_id INTEGER NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
            source TEXT NOT NULL,
            x INTEGER NOT NULL DEFAULT 0,
            y INTEGER NOT NULL DEFAULT 0,
            z INTEGER NOT NULL DEFAULT 1,
            width INTEGER NOT NULL CHECK (width > 0),
            height INTEGER NOT NULL CHECK (height > 0),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS drawings (
            drawing_id INTEGER PRIMARY KEY AUTOINCREMENT,
            board_id INTEGER NOT NULL UNIQUE REFERENCES boards(board_id) ON DELETE CASCADE,
            source TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(source)),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tables (
            table_id INTEGER PRIMARY KEY AUTOINCREMENT,
            board_id INTEGER NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
            source TEXT NOT NULL CHECK (json_valid(source)),
            x INTEGER NOT NULL DEFAULT 0,
            y INTEGER NOT NULL DEFAULT 0,
            z INTEGER NOT NULL DEFAULT 1,
            width INTEGER NOT NULL CHECK (width > 0),
            height INTEGER NOT NULL CHECK (height > 0),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        PRAGMA user_version = ${schemaVersion};
    `);

    sqlite.prepare(`
        INSERT OR IGNORE INTO boards (board_id, title, width, height)
        VALUES (?, ?, ?, ?)
    `).run(defaultBoardId, "KyuBoard Lite", 4000, 3000);
}

function createDatabaseState(): DatabaseState {
    const sqlite = new Database(getDatabasePath());
    initializeDatabase(sqlite);

    return {
        sqlite,
        db: drizzle(sqlite, { schema }),
    };
}

function getDatabaseState() {
    if (!globalForDatabase.kyuboardDatabase) {
        globalForDatabase.kyuboardDatabase = createDatabaseState();
    }

    return globalForDatabase.kyuboardDatabase;
}

export function getDb() {
    return getDatabaseState().db;
}

export function getSqlite() {
    return getDatabaseState().sqlite;
}

export { defaultBoardId, schemaVersion };
