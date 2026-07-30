/**
 * Calendar date arithmetic on `YYYY-MM-DD` strings.
 *
 * Everything here works on the calendar fields directly, never on elapsed
 * milliseconds, because warranty terms are calendar promises: "12 months" ends
 * on the same day-of-month a year later, not 365 days later. Two bugs this
 * avoids, both of which the previous `setMonth` implementation had:
 *
 *   overflow  31 Jan + 1 month must be 28/29 Feb, not 2/3 Mar. `setMonth`
 *             rolls into the next month because 31 Feb does not exist.
 *   timezone  `new Date('2026-01-31')` parses as UTC midnight, then
 *             `setMonth`/`getDate` read *local* fields, and `toISOString()`
 *             converts back — west of UTC that lands a day early.
 *
 * Where a Date is unavoidable, only the UTC accessors are used: UTC has no DST,
 * so day arithmetic can never gain or lose an hour.
 */

export type DateUnit = 'day' | 'month' | 'year';

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Parts = { y: number; m: number; d: number };

/** Proleptic Gregorian, which is what both Postgres `date` and JS use. */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** `month` is 1-12. */
export function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 1: case 3: case 5: case 7: case 8: case 10: case 12: return 31;
    case 4: case 6: case 9: case 11: return 30;
    case 2: return isLeapYear(year) ? 29 : 28;
    default: throw new RangeError(`month out of range: ${month}`);
  }
}

function pad(n: number, width = 2): string {
  return String(Math.abs(n)).padStart(width, '0');
}

function format({ y, m, d }: Parts): string {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

/** Strict parse. Returns null for anything that isn't a real calendar date. */
export function parseISODate(iso: string): Parts | null {
  if (!ISO_DATE_RE.test(iso)) return null;
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > daysInMonth(y, m)) return null; // rejects 2026-02-30
  return { y, m, d };
}

export function isValidISODate(iso: string): boolean {
  return parseISODate(iso) !== null;
}

/** Today in the device's own calendar, not UTC. */
export function todayISO(now: Date = new Date()): string {
  return format({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });
}

export function addDays(iso: string, days: number): string {
  const p = parseISODate(iso);
  if (!p) throw new RangeError(`invalid date: ${iso}`);
  // UTC has no DST, so this can never drift by an hour.
  const t = Date.UTC(p.y, p.m - 1, p.d) + days * 86_400_000;
  const dt = new Date(t);
  return format({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() });
}

/**
 * Adds calendar months, clamping the day to the target month's length — the
 * convention every warranty and billing system uses:
 *   31 Jan + 1 month  → 28 Feb (29 Feb in a leap year)
 *   31 Mar + 1 month  → 30 Apr
 *   30 Apr + 1 month  → 31 May is NOT implied; you get 30 May.
 */
export function addMonths(iso: string, months: number): string {
  const p = parseISODate(iso);
  if (!p) throw new RangeError(`invalid date: ${iso}`);
  const total = p.y * 12 + (p.m - 1) + months;
  const y = Math.floor(total / 12);        // floor, so negatives work too
  const m = total - y * 12 + 1;
  return format({ y, m, d: Math.min(p.d, daysInMonth(y, m)) });
}

/** 29 Feb + 1 year → 28 Feb; + 4 years → 29 Feb again. */
export function addYears(iso: string, years: number): string {
  return addMonths(iso, years * 12);
}

export function addDuration(iso: string, amount: number, unit: DateUnit): string {
  switch (unit) {
    case 'day': return addDays(iso, amount);
    case 'month': return addMonths(iso, amount);
    case 'year': return addYears(iso, amount);
  }
}

/**
 * Whole calendar days from `from` to `to` — positive when `to` is later.
 * Compared as dates, so it never depends on the time of day.
 */
export function diffCalendarDays(fromISO: string, toISO: string): number {
  const a = parseISODate(fromISO);
  const b = parseISODate(toISO);
  if (!a || !b) throw new RangeError(`invalid date: ${!a ? fromISO : toISO}`);
  const ms = Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
  return Math.round(ms / 86_400_000);
}

/** Calendar days from today until `iso`. Negative once it has passed. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return diffCalendarDays(todayISO(now), iso);
}

/**
 * Structurally identical to `BillingPeriod` in database.types, redeclared here
 * so this module stays free of app imports and can run under a bare test
 * runner.
 */
export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * One billing cycle after `iso`. Monthly cycles follow the calendar, so a
 * subscription billed on the 31st falls back to the 30th or to 28/29 February
 * rather than skipping into the following month.
 */
export function addBillingCycle(iso: string, cycle: BillingCycle): string {
  if (cycle === 'weekly') return addDays(iso, 7);
  return addMonths(iso, { monthly: 1, quarterly: 3, yearly: 12 }[cycle]);
}
