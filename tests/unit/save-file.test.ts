import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSqlite } from "@/lib/db";
import { createSaveFile, importSaveFile } from "@/lib/db/save-file";

const previousDataDirectory = process.env.KYUBOARD_DATA_DIR;
const testDataDirectory = mkdtempSync(path.join(tmpdir(), "kyuboard-test-"));

describe("SQLite save files", () => {
    beforeAll(() => {
        process.env.KYUBOARD_DATA_DIR = testDataDirectory;
    });

    afterAll(() => {
        getSqlite().close();
        delete (globalThis as typeof globalThis & { kyuboardDatabase?: unknown }).kyuboardDatabase;
        if (previousDataDirectory === undefined) delete process.env.KYUBOARD_DATA_DIR;
        else process.env.KYUBOARD_DATA_DIR = previousDataDirectory;
        rmSync(testDataDirectory, { recursive: true, force: true });
    });

    it("exports a consistent SQLite snapshot and restores it transactionally", async () => {
        const sqlite = getSqlite();
        sqlite.prepare("UPDATE boards SET title = ? WHERE board_id = 1").run("Saved board");
        sqlite.prepare(`
            INSERT INTO memos (board_id, content, x, y, z, width, height, color)
            VALUES (1, 'Saved memo', 1, 2, 3, 300, 200, '#fffadc')
        `).run();

        const saveFile = await createSaveFile();
        expect(saveFile.subarray(0, 16).toString("utf8")).toBe("SQLite format 3\0");

        sqlite.prepare("UPDATE boards SET title = ? WHERE board_id = 1").run("Changed board");
        sqlite.prepare("DELETE FROM memos").run();
        importSaveFile(saveFile);

        const board = sqlite.prepare("SELECT title FROM boards WHERE board_id = 1").get() as { title: string };
        const memo = sqlite.prepare("SELECT content FROM memos").get() as { content: string };
        expect(board.title).toBe("Saved board");
        expect(memo.content).toBe("Saved memo");
    });

    it("rejects files that are not SQLite databases", () => {
        expect(() => importSaveFile(Buffer.from("not a database"))).toThrow(/not a SQLite database/i);
    });
});
