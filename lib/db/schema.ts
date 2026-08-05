import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { TableSource } from "@/lib/table-card";
import type { BoardStroke } from "@/lib/board-stroke";

export const db_boards = sqliteTable("boards", {
    boardId: integer("board_id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const db_memos = sqliteTable("memos", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    boardId: integer("board_id").notNull().references(() => db_boards.boardId, { onDelete: "cascade" }),
    content: text("content").notNull(),
    x: integer("x").notNull().default(0),
    y: integer("y").notNull().default(0),
    z: integer("z").notNull().default(1),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    color: text("color").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const db_images = sqliteTable("images", {
    imageId: integer("image_id").primaryKey({ autoIncrement: true }),
    boardId: integer("board_id").notNull().references(() => db_boards.boardId, { onDelete: "cascade" }),
    url: text("url").notNull(),
    label: text("label"),
    x: integer("x").notNull().default(0),
    y: integer("y").notNull().default(0),
    z: integer("z").notNull().default(1),
    width: integer("width").notNull().default(400),
    height: integer("height").notNull().default(300),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const db_mermaids = sqliteTable("mermaids", {
    mermaidId: integer("mermaid_id").primaryKey({ autoIncrement: true }),
    boardId: integer("board_id").notNull().references(() => db_boards.boardId, { onDelete: "cascade" }),
    source: text("source").notNull(),
    x: integer("x").notNull().default(0),
    y: integer("y").notNull().default(0),
    z: integer("z").notNull().default(1),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const db_drawings = sqliteTable("drawings", {
    drawingId: integer("drawing_id").primaryKey({ autoIncrement: true }),
    boardId: integer("board_id").notNull().unique().references(() => db_boards.boardId, { onDelete: "cascade" }),
    source: text("source", { mode: "json" }).$type<BoardStroke[]>().notNull().default(sql`'[]'`),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const db_tables = sqliteTable("tables", {
    tableId: integer("table_id").primaryKey({ autoIncrement: true }),
    boardId: integer("board_id").notNull().references(() => db_boards.boardId, { onDelete: "cascade" }),
    source: text("source", { mode: "json" }).$type<TableSource>().notNull(),
    x: integer("x").notNull().default(0),
    y: integer("y").notNull().default(0),
    z: integer("z").notNull().default(1),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
