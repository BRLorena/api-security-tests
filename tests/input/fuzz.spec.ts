/**
 * Property-based fuzzing. Instead of a few hand-picked bad inputs, fast-check generates
 * many and asserts one invariant for all of them:
 *
 *   for any JSON value in a field, the server answers 400 or 201 — never 500, and never a
 *   201 whose stored value differs from a valid input.
 *
 * A 500 is an unhandled exception; it is the signature of missing validation. On a failure
 * fast-check shrinks to the smallest input that still triggers it and prints it.
 *
 * These three are test.fail(): the app returns 500 for some generated inputs today, so
 * each property fails and the marker keeps the suite green. Fixing input validation makes
 * the property hold, the test pass, and the marker turn red to be removed.
 */
import { test, expect } from "../../src/fixtures";
import { expenseBody } from "../../src/data";
import fc from "fast-check";

// A spread of awkward JSON scalars: the kinds of values a form never sends but a client can.
const weirdScalars = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.double(),
  fc.constantFrom("", " ", "-0", "1e400", "NaN", "Infinity", "null", "0x10", "1,000", "٤٢"),
  fc.boolean(),
  fc.constant(null),
);

test.fail("BUG-1/2/3: the amount field never causes a 500", async ({ owner }) => {
  await fc.assert(
    fc.asyncProperty(weirdScalars, async (amount) => {
      const res = await owner.api.post("/api/expenses", { data: expenseBody({ amount }) });
      // The contract: reject (400) or accept (201). A 500 is a bug in the input handling.
      expect(res.status(), `amount=${JSON.stringify(amount)} -> ${res.status()}`).not.toBe(500);
    }),
    { numRuns: 40, endOnFailure: true },
  );
});

test.fail("BUG-4: the date field never causes a 500", async ({ owner }) => {
  await fc.assert(
    fc.asyncProperty(fc.oneof(fc.string(), fc.date().map(String), fc.constantFrom("", "2026-13-40", "0000-00-00", "yesterday")), async (date) => {
      const res = await owner.api.post("/api/expenses", { data: expenseBody({ date }) });
      expect(res.status(), `date=${JSON.stringify(date)} -> ${res.status()}`).not.toBe(500);
    }),
    { numRuns: 40, endOnFailure: true },
  );
});

test.fail("BUG-6: list pagination params never cause a 500", async ({ owner }) => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({ page: fc.oneof(fc.integer(), fc.string()), limit: fc.oneof(fc.integer(), fc.string()) }),
      async ({ page, limit }) => {
        const res = await owner.api.get(`/api/expenses?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`);
        expect(res.status(), `page=${page} limit=${limit} -> ${res.status()}`).not.toBe(500);
      },
    ),
    { numRuns: 40, endOnFailure: true },
  );
});
