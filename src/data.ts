/**
 * Valid request bodies. Tests override only the field they are about.
 * The API takes amounts and dates as strings, the way the app's forms send them.
 */
const today = () => new Date().toISOString().slice(0, 10);
const tag = () => `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const expenseBody = (o: Record<string, unknown> = {}) => ({
  amount: "42.50",
  description: `Groceries ${tag()}`,
  category: "foodDining",
  date: today(),
  ...o,
});

export const incomeBody = (o: Record<string, unknown> = {}) => ({
  amount: "3000",
  description: `Salary ${tag()}`,
  category: "Salary",
  date: today(),
  recurring: false,
  ...o,
});

export const invoiceBody = (o: Record<string, unknown> = {}) => ({
  invoiceNumber: tag().toUpperCase(),
  clientName: "Acme Ltd",
  clientEmail: "billing@acme.example",
  amount: "1200",
  description: "Consulting",
  issueDate: today(),
  dueDate: today(),
  status: "PENDING",
  ...o,
});

/** One entry per resource with an /api/<name> and /api/<name>/[id] route. */
export const RESOURCES = [
  { name: "expenses", body: expenseBody },
  { name: "incomes", body: incomeBody },
  { name: "invoices", body: invoiceBody },
] as const;
