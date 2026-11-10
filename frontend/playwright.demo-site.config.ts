import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests for the public demo site (npm run test:e2e:demo-site): the build used for
 * GitHub Pages (demo data only, no server) served under /MESA/, as on
 * https://ilmeedesilva.github.io/MESA/.
 */
const port = 4174;

export default defineConfig({
  testDir: "e2e/demo-site",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "playwright-report-demo-site" }]]
    : [["list"]],
  outputDir: "test-results-demo-site",
  use: {
    baseURL: `http://localhost:${port}/MESA/`,
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [{ name: "chromium" }],
  webServer: {
    command: `npm run build:demo-site && npm run preview:demo-site -- --port ${port} --strictPort`,
    url: `http://localhost:${port}/MESA/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
