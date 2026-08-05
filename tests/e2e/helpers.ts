import { expect, Page } from "@playwright/test";

export async function gotoHydratedPage(page: Page, path: string) {
    await page.goto(path);
    await expect(page.locator(".board-scroll-layer")).toBeVisible();
}

export async function openTestBoard(page: Page) {
    await gotoHydratedPage(page, "/");
    return true;
}

export function getBoardMenuButton(page: Page) {
    return page.getByRole("button", { name: "Open board menu" });
}

export function getBoardToolButton(page: Page, iconClassName: string) {
    return page.locator(".board-toolbar button").filter({
        has: page.locator(`svg.${iconClassName}`),
    }).first();
}
