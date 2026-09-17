/** Display-only number formatting. Money stays integer cents everywhere else. */

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usdFormatterPrecise = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const intFormatter = new Intl.NumberFormat("en-US");

/** Integer cents -> whole-dollar display string, e.g. "$939,101,800" -> "$939,101,800". */
export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return usdFormatter.format(cents / 100);
}

export function formatCentsPrecise(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return usdFormatterPrecise.format(cents / 100);
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatInt(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return intFormatter.format(value);
}

export function formatPercent(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatShareOfBudget(cents: number, budgetCents: number): string {
  if (budgetCents <= 0) return "—";
  return formatPercent(cents / budgetCents);
}
