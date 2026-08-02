import { addDays, isValidISODate, parseISODate } from './dateMath.ts';

/**
 * The post-expiry renewal window, for subscriptions only.
 *
 * A subscription is good *through* its `next_renewal` date, so it expires at
 * local midnight opening the following day. From that instant the user gets a
 * fixed grace period in which the same subscription can be renewed in place;
 * once it lapses the row is history and a new subscription must be created.
 *
 * Kept free of app imports (same rule as dateMath) so it runs under the bare
 * test runner — the window arithmetic is the part worth testing, and it is not
 * observable from the UI until a real date rolls over.
 *
 * Nothing here is aware of warranties, receipts or RevenueCat entitlements.
 */

export const RENEWAL_GRACE_HOURS = 48;

const HOUR_MS = 3_600_000;

/**
 * The exact moment cover ends: local midnight starting the day after
 * `next_renewal`. Local, not UTC, so it lines up with `calendarDaysUntil`,
 * which flips to negative on that same boundary.
 */
export function expiryInstant(nextRenewal: string): Date | null {
  const p = parseISODate(nextRenewal);
  if (!p) return null;
  const dayAfter = parseISODate(addDays(nextRenewal, 1));
  if (!dayAfter) return null;
  return new Date(dayAfter.y, dayAfter.m - 1, dayAfter.d, 0, 0, 0, 0);
}

export type RenewalWindow = {
  /** Cover has ended. */
  expired: boolean;
  /** Expired *and* still inside the grace period. */
  renewable: boolean;
  /** Milliseconds of grace remaining; 0 once the window has closed. */
  msLeft: number;
};

/**
 * Where a subscription sits relative to its renewal window.
 *
 * `now` is injectable purely so this can be tested across a rollover without
 * waiting two days.
 */
export function renewalWindow(
  nextRenewal: string | null | undefined,
  now: Date = new Date(),
): RenewalWindow {
  const closed: RenewalWindow = { expired: false, renewable: false, msLeft: 0 };
  if (!nextRenewal || !isValidISODate(nextRenewal)) return closed;

  const expiresAt = expiryInstant(nextRenewal);
  if (!expiresAt) return closed;

  const expired = now.getTime() >= expiresAt.getTime();
  if (!expired) return closed;

  const msLeft = expiresAt.getTime() + RENEWAL_GRACE_HOURS * HOUR_MS - now.getTime();
  return { expired: true, renewable: msLeft > 0, msLeft: Math.max(0, msLeft) };
}

/**
 * Grace remaining split for display, e.g. `{days: 1, hours: 12}`.
 *
 * Rounds hours *down*: showing "2 hours" with 119 minutes left would promise
 * time the user does not have.
 */
export function graceRemaining(msLeft: number): { days: number; hours: number } {
  const totalHours = Math.max(0, Math.floor(msLeft / HOUR_MS));
  return { days: Math.floor(totalHours / 24), hours: totalHours % 24 };
}
