/**
 * Configuration and response hygiene. Every test here is read-only — it sends ordinary,
 * well-formed requests and inspects the responses — so it is safe to run against production
 * (npm run test:prod). No attack traffic, no data written.
 */
import { test, expect } from "@playwright/test";

test.describe("security headers", () => {
  test("HSTS is set on an app page", async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/en/login`);
    expect(res.headers()["strict-transport-security"]).toContain("max-age=");
  });

  // The app sets HSTS but none of the other baseline headers. Each is a separate finding so
  // the report shows exactly which one is missing; they turn green one by one as they're added.
  for (const [header, bug] of [
    ["content-security-policy", "BUG-13"],
    ["x-frame-options", "BUG-14"],
    ["x-content-type-options", "BUG-15"],
    ["referrer-policy", "BUG-16"],
  ] as const) {
    test.fail(`${bug}: ${header} is present`, async ({ request, baseURL }) => {
      const res = await request.get(`${baseURL}/en/login`);
      expect(res.headers()[header], `${header} missing`).toBeTruthy();
    });
  }
});

test.describe("CORS (regression guard)", () => {
  test("a cross-origin request gets no Access-Control-Allow-Origin", async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/api/expenses`, { headers: { origin: "https://evil.example" } });
    expect(res.headers()["access-control-allow-origin"]).toBeFalsy();
  });
});
