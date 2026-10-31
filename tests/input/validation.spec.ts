/**
 * Fixed-case input validation. The rule under test: a bad request is answered with 400,
 * never 500 and never a saved record. A 500 means an unhandled exception reached the user;
 * a 201 on junk means invalid data entered the database.
 *
 * BUG-1..BUG-5 were fixed in finance_app#4 and are now regression guards. Open bugs are
 * marked with test.fail(): it turns red when the bug is fixed, so the marker is removed
 * together with the fix.
 */
import { test, expect } from "../../src/fixtures";
import { expenseBody, invoiceBody } from "../../src/data";
import { safeError } from "../../src/schemas";

const rejects = (status: number) => status === 400;

test.describe("amount", () => {
  test("BUG-1: a non-numeric amount is a 400, not a 500", async ({ owner }) => {
    const res = await owner.api.post("/api/expenses", { data: expenseBody({ amount: "abc" }) });
    expect(res.status(), await res.text()).toBe(400);
  });

  test("BUG-2: an out-of-range amount (1e400 -> Infinity) is rejected", async ({ owner }) => {
    const res = await owner.api.post("/api/expenses", { data: expenseBody({ amount: "1e400" }) });
    expect(rejects(res.status())).toBe(true);
  });

  test("BUG-3: a negative amount is rejected", async ({ owner }) => {
    // Before the fix, -500 was saved and flipped a no-income account's net income positive.
    const res = await owner.api.post("/api/expenses", { data: expenseBody({ amount: "-500" }) });
    expect(res.status(), `saved ${res.status()}`).toBe(400);
  });
});

test.describe("date", () => {
  test("BUG-4: an unparseable date is a 400, not a 500", async ({ owner }) => {
    const res = await owner.api.post("/api/expenses", { data: expenseBody({ date: "not-a-date" }) });
    expect(res.status(), await res.text()).toBe(400);
  });
});

test.describe("length", () => {
  test("BUG-5: an unbounded description is rejected", async ({ owner }) => {
    const res = await owner.api.post("/api/expenses", { data: expenseBody({ description: "x".repeat(100_000) }) });
    expect(rejects(res.status())).toBe(true);
  });
});

test.describe("well-handled cases (regression guards)", () => {
  test("a missing required field is a 400", async ({ owner }) => {
    const res = await owner.api.post("/api/expenses", { data: { amount: "10" } });
    expect(res.status()).toBe(400);
    safeError.parse({ error: (await res.json()).error });
  });

  const asJson = { headers: { "content-type": "application/json" } };

  test("a non-object JSON body is a 400", async ({ owner }) => {
    const res = await owner.api.post("/api/expenses", { ...asJson, data: "\"just a string\"" });
    expect(res.status()).toBe(400);
  });

  test("a malformed JSON body does not crash the route", async ({ owner }) => {
    const res = await owner.api.post("/api/expenses", { ...asJson, data: "{not valid json" });
    expect([400, 500]).toContain(res.status()); // documented: see README
  });

  test("an invalid invoice status is a 400", async ({ owner }) => {
    const res = await owner.api.post("/api/invoices", { data: invoiceBody({ status: "GIFT" }) });
    expect(res.status()).toBe(400);
  });
});

test.describe("cross-resource constraints", () => {
  test.fail("BUG-7: an invoice number already used by another user causes a 500", async ({ owner, intruder }) => {
    // invoiceNumber is globally unique. One user reusing another's number hits a DB
    // constraint that surfaces as a 500 and confirms the number exists (enumeration).
    const number = `COLLIDE-${Date.now()}`;
    const first = await owner.api.post("/api/invoices", { data: invoiceBody({ invoiceNumber: number }) });
    expect(first.status()).toBe(201);
    const clash = await intruder.api.post("/api/invoices", { data: invoiceBody({ invoiceNumber: number }) });
    // Wanted: a clean 409/400, not a 500 that doubles as an existence oracle.
    expect(clash.status(), `got ${clash.status()}`).not.toBe(500);
  });
});
