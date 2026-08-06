import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { getBoardMenuButton, gotoHydratedPage } from "./helpers";

test.describe("KyuBoard Lite home", () => {
    test.beforeEach(async ({ page }) => {
        await gotoHydratedPage(page, "/");
    });

    test("opens the single board directly without authentication controls", async ({ page }) => {
        await expect(page).toHaveTitle(/KyuBoard Lite/i);
        await expect(page.locator(".board-scroll-layer")).toBeVisible();
        await expect(page.getByRole("link", { name: "•kyu.board lite" })).toBeVisible();

        await getBoardMenuButton(page).click();
        await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Import" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Compile to Markdown" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Sign-in" })).toHaveCount(0);
        await expect(page.locator('input[type="file"]')).not.toHaveAttribute("accept");
    });

    test("exports and imports an actual SQLite save file", async ({ page }) => {
        await getBoardMenuButton(page).click();
        const downloadPromise = page.waitForEvent("download");
        await page.getByRole("button", { name: "Export" }).click();
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toBe("kyuboard-lite.sqlite");
        const savePath = await download.path();
        expect(savePath).not.toBeNull();
        const bytes = await readFile(savePath!);
        expect(bytes.subarray(0, 16).toString("utf8")).toBe("SQLite format 3\0");

        await getBoardMenuButton(page).click();
        const chooserPromise = page.waitForEvent("filechooser");
        await page.getByRole("button", { name: "Import" }).click();
        const chooser = await chooserPromise;
        page.once("dialog", (dialog) => dialog.accept());
        const reloaded = page.waitForEvent("load");
        await chooser.setFiles(savePath!);
        await reloaded;
        await expect(page.locator(".board-scroll-layer")).toBeVisible();
    });

    test("disables Export while a card is being edited", async ({ page }) => {
        await page.locator(".board-toolbar button").filter({
            has: page.locator("svg.lucide-square-pen"),
        }).click();
        await getBoardMenuButton(page).click();
        await expect(page.getByRole("button", { name: "Export" })).toBeDisabled();
        await expect(page.getByText("Finish editing before exporting.")).toBeVisible();
    });
});
