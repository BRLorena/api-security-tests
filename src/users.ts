/**
 * Test accounts and login over HTTP (NextAuth credentials flow).
 */
import { request, type APIRequestContext } from "@playwright/test";

export type StorageState = Awaited<ReturnType<APIRequestContext["storageState"]>>;

export interface TestUser {
  email: string;
  password: string;
  storageState: StorageState;
}

export const PASSWORD = "sec-tests-password-1";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Registers an account. Registration is limited to 10 per minute per IP, so a 429 is
 * waited out: the tests that register several accounts would otherwise depend on timing.
 */
export async function register(ctx: APIRequestContext, email: string, password = PASSWORD, name = "Security tests") {
  for (let attempt = 0; ; attempt++) {
    const res = await ctx.post("/api/register", { data: { name, email, password } });
    if (res.status() !== 429 || attempt >= 3) return res;
    await sleep(Number(res.headers()["x-ratelimit-reset"] ?? 20) * 1000 + 500);
  }
}

/** Posts credentials to NextAuth. Returns true when a session cookie was issued. */
export async function signIn(ctx: APIRequestContext, email: string, password: string) {
  const { csrfToken } = await (await ctx.get("/api/auth/csrf")).json();
  const res = await ctx.post("/api/auth/callback/credentials", {
    form: { csrfToken, email, password, callbackUrl: "/" },
    maxRedirects: 0,
  });
  const state = await ctx.storageState();
  return { res, ok: state.cookies.some((c) => c.name.endsWith("authjs.session-token")) };
}

/** A fixed account, registered on first use, logged in. */
export async function loginTestUser(baseURL: string, name: string): Promise<TestUser> {
  const email = `sec-${name}@example.com`;
  const ctx = await request.newContext({ baseURL });
  try {
    await register(ctx, email);
    const { ok } = await signIn(ctx, email, PASSWORD);
    if (!ok) throw new Error(`Login failed for ${email}`);
    return { email, password: PASSWORD, storageState: await ctx.storageState() };
  } finally {
    await ctx.dispose();
  }
}
