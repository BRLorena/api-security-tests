/**
 * Response contracts. `.strict()` makes an unexpected field (e.g. a password hash) a failure.
 */
import { z } from "zod";

const id = z.string().min(1);
const isoDateTime = z.string().datetime();
const money = z.number().finite();

export const expense = z
  .object({
    id, amount: money, description: z.string(), category: z.string(), date: isoDateTime,
    userId: id, createdAt: isoDateTime, updatedAt: isoDateTime,
  })
  .strict();

export const income = z
  .object({
    id, amount: money, description: z.string(), category: z.string(), date: isoDateTime,
    recurring: z.boolean(), frequency: z.string().nullable(),
    userId: id, createdAt: isoDateTime, updatedAt: isoDateTime,
  })
  .strict();

export const invoice = z
  .object({
    id, invoiceNumber: z.string().nullable(), clientName: z.string(), clientEmail: z.string().nullable(),
    amount: money, description: z.string(), dueDate: isoDateTime, issueDate: isoDateTime,
    status: z.enum(["PENDING", "PAID", "OVERDUE", "CANCELLED"]), notes: z.string().nullable(),
    userId: id, createdAt: isoDateTime, updatedAt: isoDateTime,
  })
  .strict();

export const pagination = z.object({
  page: z.number().int(), limit: z.number().int(), total: z.number().int(), pages: z.number().int(),
}).strict();

export const list = <K extends string, T extends z.ZodTypeAny>(key: K, item: T) =>
  z.object({ [key]: z.array(item), pagination } as { [P in K]: z.ZodArray<T> } & { pagination: typeof pagination }).strict();

export const ITEM = { expenses: expense, incomes: income, invoices: invoice } as const;

const total = z.object({ amount: money, count: z.number().int() }).strict();
const totals = z.object({ expenses: total, incomes: total, invoices: total, netIncome: money }).strict();

export const summary = z.object({
  totals,
  thisMonth: totals.extend({ monthName: z.string() }),
  breakdown: z.object({
    expensesByCategory: z.array(z.object({ category: z.string(), amount: money, count: z.number() }).strict()),
    incomesByCategory: z.array(z.object({ category: z.string(), amount: money, count: z.number() }).strict()),
    invoicesByStatus: z.array(z.object({ status: z.string(), amount: money, count: z.number() }).strict()),
  }).strict(),
  trends: z.object({
    monthlyExpenses: z.array(z.object({ month: z.string(), total: money, count: z.number() }).strict()),
    monthlyIncomes: z.array(z.object({ month: z.string(), total: money, count: z.number() }).strict()),
    monthlyInvoices: z.array(z.object({ month: z.string(), total: money, count: z.number() }).strict()),
  }).strict(),
  recent: z.object({ expenses: z.array(expense), incomes: z.array(income), invoices: z.array(invoice) }).strict(),
  meta: z.object({
    period: z.string(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    generatedAt: isoDateTime,
  }).strict(),
}).strict();

/** Errors must be a short message: no stack trace, no ORM query, no SQL. */
export const safeError = z.object({ error: z.string().max(200) }).strict();
