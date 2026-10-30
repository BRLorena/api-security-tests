/**
 * The happy path for each resource, with every response checked against a strict schema.
 * A strict schema also catches over-exposure: a field the API shouldn't return (a password
 * hash, another user's id) would fail the parse.
 */
import { test, expect } from "../../src/fixtures";
import { RESOURCES } from "../../src/data";
import { ITEM, list, safeError } from "../../src/schemas";

for (const { name, body } of RESOURCES) {
  test.describe(name, () => {
    test(`create, read, list, update and delete a ${name} record`, async ({ owner }) => {
      const created = await owner.api.post(`/api/${name}`, { data: body() });
      expect(created.status(), await created.text()).toBe(201);
      const item = ITEM[name].parse(await created.json());

      const read = await owner.api.get(`/api/${name}/${item.id}`);
      expect(read.status()).toBe(200);
      ITEM[name].parse(await read.json());

      const listed = await owner.api.get(`/api/${name}`);
      expect(listed.status()).toBe(200);
      const page = list(name, ITEM[name]).parse(await listed.json());
      expect(page[name].some((r: { id: string }) => r.id === item.id)).toBe(true);

      const updated = await owner.api.put(`/api/${name}/${item.id}`, { data: body({ description: "Updated" }) });
      expect(updated.status()).toBe(200);
      expect((await updated.json()).description).toBe("Updated");

      const removed = await owner.api.delete(`/api/${name}/${item.id}`);
      expect(removed.status()).toBe(200);

      const gone = await owner.api.get(`/api/${name}/${item.id}`);
      expect(gone.status()).toBe(404);
      safeError.parse(await gone.json());
    });
  });
}

test.describe("summary", () => {
  test("returns a well-formed summary", async ({ owner }) => {
    const { summary } = await import("../../src/schemas");
    const res = await owner.api.get("/api/summary");
    expect(res.status()).toBe(200);
    summary.parse(await res.json());
  });
});
