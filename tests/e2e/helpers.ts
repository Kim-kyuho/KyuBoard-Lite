import { expect, Page } from "@playwright/test";

// playwright.config.ts가 개발 서버에 넣어 주는 어시스턴트 비밀번호.
// 잠금 해제 흐름을 검사하려면 서버와 테스트가 같은 값을 알아야 한다.
export const aiTestPassword = "e2e-assistant-password";

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
