import { defineConfig } from "@playwright/test";

const BACKEND_PORT = 10916;
const FRONTEND_PORT = 10917;

export default defineConfig({
    testDir: "./e2e",
    timeout: 60000,
    retries: 1,
    use: {
        baseURL: `http://127.0.0.1:${FRONTEND_PORT}`,
        headless: true,
        screenshot: "only-on-failure",
    },
    webServer: {
        command: `uv run python -m vcv_rack_mcp --http --port ${BACKEND_PORT}`,
        port: BACKEND_PORT,
        cwd: "../",
        timeout: 30000,
        reuseExistingServer: true,
    },
});
