/**
 * Registration, login and session handling. Runs against the local app only, because some
 * tests send many login attempts in a row.
 */
import { test, expect } from "@playwright/test";
import { register, signIn, loginTestUser, PASSWORD } from "../../src/users";

test.describe("registration", () => {
  test("rejects a short password", async ({ request }) => {
    // registerSchema requires 6+ chars; this is the guard that works.
    const res = await register(request, `short-${Date.now()}@example.com`, "123");
    expect(res.status()).toBe(400);
  });

  test("rejects an invalid email", async ({ request }) => {
    const res = await register(request, "not-an-email", PASSWORD);
    expect(res.status()).toBe(400);
  });

  test.fail("BUG-11: register reveals whether an email already exists", async ({ request }) => {
    // An account-enumeration oracle: the message names the condition instead of a neutral
    // "registration failed". The test asserts the response does NOT disclose existence.
    const email = `enum-${Date.now()}@example.com`;
    await register(request, email, PASSWORD);
    const again = await register(request, email, PASSWORD);
    const body = (await again.json()).error ?? "";
    expect(body.toLowerCase()).not.toContain("already exists");
  });

  test.fail("BUG-12: a trivially weak password is accepted", async ({ request }) => {
    // 6 chars with no complexity: "123456" is in every breach list. The test wants it rejected.
    const res = await register(request, `weak-${Date.now()}@example.com`, "123456");
    expect(res.status()).toBe(400);
  });
});

test.describe("login", () => {
  test("accepts the right password and rejects the wrong one", async ({ playwright, baseURL }) => {
    const u = await loginTestUser(baseURL!, "login-happy");
    // Fresh contexts so a session cookie from one attempt can't leak into the next.
    const goodCtx = await playwright.request.newContext({ baseURL });
    expect((await signIn(goodCtx, u.email, PASSWORD)).ok).toBe(true);
    await goodCtx.dispose();
    const badCtx = await playwright.request.newContext({ baseURL });
    expect((await signIn(badCtx, u.email, "definitely-wrong")).ok).toBe(false);
    await badCtx.dispose();
  });

  test.fail("BUG-9: there is no rate limit on failed logins", async ({ request, baseURL }) => {
    // Register and auth endpoints are rate-limited; the credentials callback is not, so a
    // password can be brute-forced. The test wants the burst to be throttled (a 429 appears).
    const u = await loginTestUser(baseURL!, "login-brute");
    let throttled = false;
    for (let i = 0; i < 25 && !throttled; i++) {
      const r = await signIn(request, u.email, `wrong-${i}`);
      if (r.res.status() === 429) throttled = true;
    }
    expect(throttled, "25 wrong passwords, none throttled").toBe(true);
  });
});

test.describe("session", () => {
  test.fail("BUG-10: signing out does not invalidate the session token", async ({ playwright, baseURL }) => {
    // JWT sessions are stateless: signout clears the browser cookie but the token stays valid
    // until expiry, so a captured token still works. The test wants the old token rejected.
    const u = await loginTestUser(baseURL!, "session-revoke");
    const ctx = await playwright.request.newContext({ baseURL, storageState: u.storageState });
    const { csrfToken } = await (await ctx.get("/api/auth/csrf")).json();
    await ctx.post("/api/auth/signout", { form: { csrfToken, callbackUrl: "/" }, maxRedirects: 0 });
    await ctx.dispose();
    // Replay the originally captured token in a fresh context.
    const replay = await playwright.request.newContext({ baseURL, storageState: u.storageState });
    const res = await replay.get("/api/expenses");
    await replay.dispose();
    expect(res.status(), "old token still accepted after signout").toBe(401);
  });
});
