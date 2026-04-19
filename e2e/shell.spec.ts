import { test, expect, type Page } from "@playwright/test"

async function preparePage(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" })
}

test.describe("shell (no event)", () => {
  test("desktop: title and screenshot", async ({ page }) => {
    await preparePage(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/")
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveTitle(/live timing/i)
    await expect(page).toHaveScreenshot("desktop.png", { maxDiffPixels: 200 })
  })

  test("mobile: title and screenshot", async ({ page }) => {
    await preparePage(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveTitle(/live timing/i)
    await expect(page).toHaveScreenshot("mobile.png", { maxDiffPixels: 500 })
  })
})
