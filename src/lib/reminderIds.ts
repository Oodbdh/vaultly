import type { ReminderKind } from './types';

/**
 * The identifier scheme for scheduled local reminders: `<kind>:<entityId>:<days>`.
 *
 * Deriving identifiers rather than storing them is what makes re-scheduling
 * idempotent — writing an item again replaces its reminders instead of adding a
 * second set. Three separate operations now depend on being able to take that
 * apart again: cancel one item's reminders, cancel one *kind* across the whole
 * vault (the Settings toggles), and re-schedule a kind. A change to the format
 * that missed one of them would fail silently, leaving reminders firing for a
 * switch the user had turned off.
 *
 * So the format lives here, parsed structurally rather than by substring, with
 * no app imports — the same rule `dateMath.ts` follows, so the bare test runner
 * can import it directly.
 *
 * `entityId` is the **vault item** id for both kinds, including renewals.
 */

const SEPARATOR = ':';

export function reminderId(kind: ReminderKind, entityId: string, days: number): string {
  return [kind, entityId, days].join(SEPARATOR);
}

type ParsedReminder = { kind: ReminderKind; entityId: string; days: number };

/**
 * Returns null for anything that is not one of our reminders — the scheduled
 * list belongs to the whole app, so it can hold identifiers this module did not
 * write, and those must never be cancelled by accident.
 */
export function parseReminderId(identifier: string): ParsedReminder | null {
  const parts = identifier.split(SEPARATOR);
  if (parts.length !== 3) return null;

  const [kind, entityId, rawDays] = parts as [string, string, string];
  if (kind !== 'warranty' && kind !== 'renewal') return null;
  if (!entityId) return null;

  // `Number('')` is 0 and `Number('3x')` is NaN — both must be rejected, or a
  // malformed identifier would round-trip as a valid reminder.
  const days = Number(rawDays);
  if (!rawDays || !Number.isInteger(days)) return null;

  return { kind, entityId, days };
}

/** Every reminder belonging to one item, whatever its kind or lead time. */
export function isReminderFor(identifier: string, entityId: string): boolean {
  return parseReminderId(identifier)?.entityId === entityId;
}

/** Every reminder of one kind, across every item. */
export function isReminderOfKind(identifier: string, kind: ReminderKind): boolean {
  return parseReminderId(identifier)?.kind === kind;
}
