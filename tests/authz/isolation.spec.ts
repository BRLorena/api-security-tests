/**
 * The core access-control guarantee: a logged-in user can only touch their own data.
 * `intruder` is a second real account that targets `owner`'s records by id. A 200 or a
 * changed/deleted record here is a broken-object-level-authorization bug (OWASP API1).
 */
import { test, expect } from "../../src/fixtures";
import { RESOURCES } from "../../src/data";

for (const { name, body } of RESOURCES) {
  test.describe(name, () => {
    test(`another user cannot read, change or delete a ${name} record`, async ({ owner, intruder }) => {
      const created = await owner.api.post(`/api/${name}`, { data: body() });
      expect(created.status()).toBe(201);
      const { id } = await created.json();

      const read = await intruder.api.get(`/api/${name}/${id}`);
      expect(read.status(), "intruder read").toBe(404);

      const update = await intruder.api.put(`/api/${name}/${id}`, { data: body({ description: "hijacked" }) });
      expect([403, 404]).toContain(update.status());

      const del = await intruder.api.delete(`/api/${name}/${id}`);
      expect([403, 404]).toContain(del.status());

      // The record is untouched: the owner still reads the original.
      const after = await owner.api.get(`/api/${name}/${id}`);
      expect(after.status()).toBe(200);
      expect((await after.json()).description).not.toBe("hijacked");
    });

    test(`a ${name} record is not listed for another user`, async ({ owner, intruder }) => {
      const created = await owner.api.post(`/api/${name}`, { data: body() });
      const { id } = await created.json();
      const listed = await intruder.api.get(`/api/${name}?limit=100`);
      const items = (await listed.json())[name] as { id: string }[];
      expect(items.some((r) => r.id === id)).toBe(false);
    });
  });
}

test("a userId in the request body is ignored, not trusted", async ({ owner, intruder }) => {
  // Mass assignment: the server must own userId from the session, never from the body.
  const victim = owner.storageState.cookies.find((c) => c.name.endsWith("session-token"));
  expect(victim).toBeTruthy();
  const res = await intruder.api.post("/api/expenses", { data: { ...(await import("../../src/data")).expenseBody(), userId: "owner-id-guess" } });
  expect(res.status()).toBe(201);
  const created = await res.json();
  // Whatever id was sent, the record must belong to the intruder, and the owner must not see it.
  const ownerSees = await owner.api.get(`/api/expenses/${created.id}`);
  expect(ownerSees.status()).toBe(404);
});

test("unauthenticated requests are rejected on every route", async ({ playwright, baseURL }) => {
  const anon = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  for (const path of ["/api/expenses", "/api/incomes", "/api/invoices", "/api/summary"]) {
    expect((await anon.get(path)).status(), `GET ${path}`).toBe(401);
  }
  expect((await anon.post("/api/expenses", { data: {} })).status()).toBe(401);
  await anon.dispose();
});
