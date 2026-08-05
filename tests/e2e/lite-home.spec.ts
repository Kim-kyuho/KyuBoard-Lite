import { expect, test } from "@playwright/test";
import { getBoardMenuButton, gotoHydratedPage } from "./helpers";

test.describe("KyuBoard Lite home", () => {
    test.beforeEach(async ({ page }) => {
        await gotoHydratedPage(page, "/");
    });

    test("opens the single board directly without authentication controls", async ({ page }) => {
        await expect(page).toHaveTitle(/KyuBoard Lite/i);
        await expect(page.locator(".board-scroll-layer")).toBeVisible();
        await expect(page.getByRole("link", { name: "•kyu.board" })).toBeVisible();

        await getBoardMenuButton(page).click();
        await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Import" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Compile to Markdown" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Sign-in" })).toHaveCount(0);
    });

    test("downloads the board as a SQLite save file", async ({ page }) => {
        await getBoardMenuButton(page).click();
        const downloadPromise = page.waitForEvent("download");
        await page.getByRole("button", { name: "Export" }).click();
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toBe("kyuboard-lite.sqlite");
    });
});
