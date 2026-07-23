import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5173",
    url: "http://127.0.0.1:5173/unified",
    reuseExistingServer: true,
    timeout: 30000,
  },
  projects: [
    {
      name: "桌面浏览器",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "移动浏览器",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
