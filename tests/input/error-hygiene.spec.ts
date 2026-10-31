/**
 * Error responses must not leak internals. Before finance_app#4, a bad `year` on /api/summary
 * threw inside Prisma and the route returned error.message in a `details` field, exposing the
 * ORM query and the schema (BUG-8). Local only: it sends bad input on purpose, which shouldn't
 * be aimed at production.
 */
import { test, expect } from "../../src/fixtures";

test("BUG-8: the summary error does not leak the ORM query or schema", async ({ owner }) => {
  const res = await owner.api.get("/api/summary?period=month&year=abc");
  const body = await res.text();
  expect(body, "response leaks ORM internals").not.toMatch(/prisma\.|invocation|_sum/i);
});
