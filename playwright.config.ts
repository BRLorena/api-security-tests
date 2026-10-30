import { defineConfig } from "@playwright/test";

// Local app under test by default (scripts/start-app.sh). Production is only ever
// targeted by the read-only `config` project (npm run test:prod).
const baseURL = process.env.BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "reports/playwright-report" }],
    ["json", { outputFile: "reports/results.json" }],
  ],
  // No global content-type: an object `data` already gets application/json, and forcing it
  // would corrupt the form-encoded login/signout posts. String bodies set it per-request.
  use: { baseURL },
  projects: [
    // CRUD and response schemas for every resource.
    { name: "api", testDir: "tests/api" },
    // One user trying to reach another user's data.
    { name: "authz", testDir: "tests/authz" },
    // Validation and fuzzing: bad input must be 400, never 500 or saved.
    { name: "input", testDir: "tests/input" },
    // Login, registration and session handling.
    { name: "auth", testDir: "tests/auth" },
    // Headers, CORS, cookies, error hygiene. Read-only: safe against production.
    { name: "config", testDir: "tests/config" },
  ],
});
