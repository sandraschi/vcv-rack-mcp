import { test, expect } from "@playwright/test";

const BE = "http://127.0.0.1:10916";
const FE = "http://127.0.0.1:10917";

test.describe("VCV Rack MCP E2E Audit", () => {
    test("Backend status returns 200 and matches metadata", async ({ request }) => {
        const resp = await request.get(`${BE}/api/status`);
        expect(resp.status()).toBe(200);
        const body = await resp.json();
        expect(body.success).toBe(true);
        expect(body.server).toBe("vcv-rack-mcp");
        expect(typeof body.catalog_size).toBe("number");
        expect(body.catalog_size).toBeGreaterThan(0);
    });

    test("Backend catalog returns modules list", async ({ request }) => {
        const resp = await request.get(`${BE}/api/catalog`);
        expect(resp.status()).toBe(200);
        const body = await resp.json();
        expect(body.success).toBe(true);
        expect(Array.isArray(body.modules)).toBe(true);
        expect(body.modules.length).toBeGreaterThan(0);
    });

    test("Frontend SPA loads successfully", async ({ page }) => {
        await page.goto("/", { timeout: 15000 });
        await page.waitForTimeout(1000);
        await expect(page.locator("text=VCV Rack MCP")).toBeVisible();
    });

    test("No console errors or unhandled exceptions on load", async ({ page }) => {
        const errors: string[] = [];
        page.on("console", msg => {
            if (msg.type() === "error") {
                errors.push(msg.text());
            }
        });
        page.on("pageerror", err => {
            errors.push(err.message);
        });

        await page.goto("/", { timeout: 15000 });
        await page.waitForTimeout(2000);
        expect(errors).toEqual([]);
    });

    test("Sidebar navigation transitions pages", async ({ page }) => {
        await page.goto("/", { timeout: 15000 });
        await page.waitForTimeout(1000);

        // Depot page (default)
        await expect(page.locator("text=Patch Depot").first()).toBeVisible();

        // Navigate to Modules Catalog
        await page.click("text=Modules Catalog");
        await page.waitForTimeout(500);
        await expect(page.locator("text=Curated set of 49 free VCV community library modules")).toBeVisible();

        // Navigate to VCV Library & Sideloads
        await page.click("text=VCV Library");
        await page.waitForTimeout(500);
        await expect(page.locator("text=Sideload VCV Plugin")).toBeVisible();

        // Navigate to Agentic Jobs
        await page.click("text=Agentic Jobs");
        await page.waitForTimeout(500);
        await expect(page.locator("text=Agentic Workflows")).toBeVisible();
        await expect(page.locator("text=Start Autonomous Synthesis")).toBeVisible();
    });
});
