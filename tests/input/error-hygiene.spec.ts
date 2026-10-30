/**
 * Error responses must not leak internals. A bad `year` on /api/summary throws inside Prisma
 * and the route returns error.message in a `details` field, exposing the ORM query and the
 * schema. Local only: it triggers a 500 on purpose, which shouldn't be aimed at production.
 */
import { test, expect } from "../../src/fixtures";

test.fail("BUG-8: the summary error leaks the ORM query and schema", async ({ owner }) => {
  const res = await owner.api.get("/api/summary?period=month&year=abc");
  const body = await res.text();
  // Wanted: a neutral error. Today the body contains the Prisma invocation and column names.
  expect(body, "response leaks ORM internals").not.toMatch(/prisma\.|invocation|_sum/i);
});
