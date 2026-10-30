/**
 * Two logged-in accounts per worker: `owner` creates data, `intruder` tries to reach it.
 */
import { test as base, request, type APIRequestContext } from "@playwright/test";
import { loginTestUser, type TestUser } from "./users";

export interface Account extends TestUser {
  api: APIRequestContext;
}

async function account(baseURL: string, name: string, use: (a: Account) => Promise<void>) {
  const user = await loginTestUser(baseURL, name);
  const api = await request.newContext({ baseURL, storageState: user.storageState });
  await use({ ...user, api });
  await api.dispose();
}

export const test = base.extend<{}, { owner: Account; intruder: Account }>({
  owner: [async ({}, use, info) => account(info.project.use.baseURL!, `w${info.parallelIndex}-owner`, use), { scope: "worker" }],
  intruder: [async ({}, use, info) => account(info.project.use.baseURL!, `w${info.parallelIndex}-intruder`, use), { scope: "worker" }],
});

export { expect } from "@playwright/test";
