import { test, expect } from "@playwright/test";

const BE = "http://127.0.0.1:10916";

test.describe("VCV Rack MCP SOTA E2E", () => {
    test("Backend status, dashboard, tools, skills, and rack status return 200", async ({ request }) => {
        const statusResp = await request.get(`${BE}/api/status`);
        expect(statusResp.status()).toBe(200);
        const status = await statusResp.json();
        expect(status.success).toBe(true);
        expect(status.server).toBe("vcv-rack-mcp");
        expect(status.catalog_size).toBeGreaterThan(0);

        const dashResp = await request.get(`${BE}/api/dashboard`);
        expect(dashResp.status()).toBe(200);
        const dash = await dashResp.json();
        expect(dash.success).toBe(true);
        expect(dash.kpis.tools_count).toBeGreaterThanOrEqual(8);

        const toolsResp = await request.get(`${BE}/api/tools`);
        expect(toolsResp.status()).toBe(200);
        const tools = await toolsResp.json();
        expect(tools.tools.some((t: any) => t.name === "hub_status")).toBe(true);

        const skillsResp = await request.get(`${BE}/api/skills`);
        expect(skillsResp.status()).toBe(200);
        const skills = await skillsResp.json();
        expect(skills.skills.some((s: any) => s.name === "vcv-rack-mcp")).toBe(true);
    });

    test("No console errors or unhandled exceptions on load", async ({ page }) => {
        const errors: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "error") errors.push(msg.text());
        });
        page.on("pageerror", (err) => errors.push(err.message));

        await page.goto("/", { timeout: 15000 });
        await page.waitForTimeout(1500);
        await expect(page.getByTestId("topbar")).toBeVisible();
        await expect(page.getByTestId("hero-compose-cta")).toBeVisible();
        expect(errors).toEqual([]);
    });

    test("Dashboard detects VCV Rack 2 and sidebar navigates all SOTA pages", async ({ page }) => {
        await page.goto("/", { timeout: 15000 });
        await expect(page.locator("text=VCV Rack 2 Environment")).toBeVisible();
        await expect(page.getByTestId("topbar-rack-start")).toBeVisible();

        // Patch Depot
        await page.click("a[href='/depot']");
        await expect(page.locator("text=Compose Patch")).toBeVisible();

        // Modules Catalog
        await page.click("a[href='/catalog']");
        await expect(page.locator("input[placeholder*='Search by brand']")).toBeVisible();

        // VCV Library
        await page.click("a[href='/library']");
        await expect(page.locator("text=Installed VCV Rack 2 Plugins")).toBeVisible();

        // Agentic Jobs
        await page.click("a[href='/jobs']");
        await expect(page.locator("text=Start Agentic Patch Workflow")).toBeVisible();

        // Tools Hub + run hub_status
        await page.click("a[href='/tools']");
        await expect(page.locator("h2:has-text('MCP Tools Hub')")).toBeVisible();
        await page.click("button:has-text('hub_status')");
        await page.click("button:has-text('Run Tool')");
        await expect(page.locator("text=rack_installed").first()).toBeVisible({ timeout: 5000 });

        // Skills
        await page.click("a[href='/skills']");
        await expect(page.locator("h2:has-text('Agent Skills')")).toBeVisible();

        // AI Chat
        await page.click("a[href='/chat']");
        await expect(page.locator("h2:has-text('AI Patch Assistant')")).toBeVisible();

        // Apps Hub
        await page.click("a[href='/apps']");
        await expect(page.locator("h2:has-text('Fleet Apps Hub')")).toBeVisible();

        // Logs
        await page.click("a[href='/logs']");
        await expect(page.locator("h2:has-text('Server & Tool Call Logs')")).toBeVisible();

        // Settings
        await page.click("a[href='/settings']");
        await expect(page.getByTestId("llm-provider-select")).toBeVisible();
        await expect(page.getByTestId("llm-model-select")).toBeVisible();

        // Help 5-tab contract
        await page.click("a[href='/help']");
        await expect(page.getByTestId("help-tabs")).toBeVisible();
        await page.getByTestId("help-tab-wrappee").click();
        await expect(page.locator("text=RACK_EXE:")).toBeVisible();
        await page.getByTestId("help-tab-api").click();
        await expect(page.getByRole("cell", { name: "10916", exact: true })).toBeVisible();
        await page.getByTestId("help-tab-troubleshoot").click();
        await expect(page.getByTestId("help-search")).toBeVisible();
        await expect(page.getByTestId("help-fixes")).toBeVisible();
        await page.getByTestId("help-tab-faq").click();
        await expect(page.getByTestId("faq-item").first()).toBeVisible();
    });
});
