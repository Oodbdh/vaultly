import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addBillingCycle,
  addDays,
  addDuration,
  addMonths,
  addYears,
  daysInMonth,
  daysUntil,
  diffCalendarDays,
  isLeapYear,
  isValidISODate,
  parseISODate,
  todayISO,
} from './dateMath.ts';

describe('warranty durations from a mid-month purchase', () => {
  const bought = '2026-01-15';

  it('1 month', () => assert.equal(addMonths(bought, 1), '2026-02-15'));
  it('3 months', () => assert.equal(addMonths(bought, 3), '2026-04-15'));
  it('6 months', () => assert.equal(addMonths(bought, 6), '2026-07-15'));
  it('1 year', () => assert.equal(addYears(bought, 1), '2027-01-15'));
  it('2 years', () => assert.equal(addYears(bought, 2), '2028-01-15'));

  it('1 month is ~31 days, never ~184 — the reported bug', () => {
    const days = diffCalendarDays(bought, addMonths(bought, 1));
    assert.equal(days, 31);
    assert.ok(days < 40, `1 month should not span ${days} days`);
  });

  it('each preset lands a distinct, increasing distance away', () => {
    const spans = [1, 3, 6, 12, 24].map((m) => diffCalendarDays(bought, addMonths(bought, m)));
    assert.deepEqual(spans, [31, 90, 181, 365, 730]);
    for (let i = 1; i < spans.length; i++) assert.ok(spans[i]! > spans[i - 1]!);
  });
});

describe('custom durations', () => {
  it('custom days', () => {
    assert.equal(addDuration('2026-03-01', 45, 'day'), '2026-04-15');
    assert.equal(addDuration('2026-01-01', 1, 'day'), '2026-01-02');
    assert.equal(addDuration('2026-12-31', 1, 'day'), '2027-01-01');
  });

  it('custom months', () => {
    assert.equal(addDuration('2026-03-10', 5, 'month'), '2026-08-10');
    assert.equal(addDuration('2026-11-30', 2, 'month'), '2027-01-30');
    assert.equal(addDuration('2026-01-01', 18, 'month'), '2027-07-01');
  });

  it('custom years', () => {
    assert.equal(addDuration('2026-06-30', 3, 'year'), '2029-06-30');
    assert.equal(addDuration('2026-06-30', 10, 'year'), '2036-06-30');
  });

  it('crosses year boundaries by months', () => {
    assert.equal(addMonths('2026-11-15', 3), '2027-02-15');
    assert.equal(addMonths('2026-12-31', 1), '2027-01-31');
  });
});

describe('end-of-month clamping', () => {
  // The classic setMonth bug: 31 Jan + 1 month used to roll to 2/3 March.
  it('31 Jan + 1 month clamps to the end of February', () => {
    assert.equal(addMonths('2026-01-31', 1), '2026-02-28'); // 2026 is not a leap year
    assert.equal(addMonths('2028-01-31', 1), '2028-02-29'); // 2028 is
  });

  it('31st into 30-day months', () => {
    assert.equal(addMonths('2026-03-31', 1), '2026-04-30');
    assert.equal(addMonths('2026-05-31', 1), '2026-06-30');
    assert.equal(addMonths('2026-08-31', 1), '2026-09-30');
    assert.equal(addMonths('2026-10-31', 1), '2026-11-30');
  });

  it('clamping does not compound — it re-reads the original day each time', () => {
    // 31 Jan + 1 + 1 would give 28 Mar if you clamped then re-added.
    assert.equal(addMonths('2026-01-31', 2), '2026-03-31');
    assert.equal(addMonths('2026-01-31', 3), '2026-04-30');
  });

  it('30 Apr + 1 month stays the 30th, it does not stretch to the 31st', () => {
    assert.equal(addMonths('2026-04-30', 1), '2026-05-30');
  });
});

describe('leap years', () => {
  it('identifies leap years by the full Gregorian rule', () => {
    assert.equal(isLeapYear(2024), true);
    assert.equal(isLeapYear(2026), false);
    assert.equal(isLeapYear(2028), true);
    assert.equal(isLeapYear(1900), false); // divisible by 100
    assert.equal(isLeapYear(2000), true);  // but also by 400
    assert.equal(isLeapYear(2100), false);
  });

  it('February length follows', () => {
    assert.equal(daysInMonth(2024, 2), 29);
    assert.equal(daysInMonth(2026, 2), 28);
    assert.equal(daysInMonth(2000, 2), 29);
    assert.equal(daysInMonth(1900, 2), 28);
  });

  it('29 Feb + 1 year clamps, + 4 years returns', () => {
    assert.equal(addYears('2024-02-29', 1), '2025-02-28');
    assert.equal(addYears('2024-02-29', 4), '2028-02-29');
  });

  it('a 1-year warranty spanning a leap day is 366 days', () => {
    assert.equal(diffCalendarDays('2023-06-01', addYears('2023-06-01', 1)), 366);
    assert.equal(diffCalendarDays('2026-06-01', addYears('2026-06-01', 1)), 365);
  });

  it('day arithmetic steps through 29 Feb', () => {
    assert.equal(addDays('2024-02-28', 1), '2024-02-29');
    assert.equal(addDays('2024-02-29', 1), '2024-03-01');
    assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  });
});

describe('manually selected expiration dates', () => {
  it('accepts real dates and rejects impossible ones', () => {
    assert.equal(isValidISODate('2026-07-29'), true);
    assert.equal(isValidISODate('2024-02-29'), true);
    assert.equal(isValidISODate('2026-02-29'), false); // not a leap year
    assert.equal(isValidISODate('2026-02-30'), false);
    assert.equal(isValidISODate('2026-13-01'), false);
    assert.equal(isValidISODate('2026-00-10'), false);
    assert.equal(isValidISODate('26-07-29'), false);
    assert.equal(isValidISODate('2026/07/29'), false);
    assert.equal(isValidISODate(''), false);
  });

  it('parses into calendar fields', () => {
    assert.deepEqual(parseISODate('2026-07-29'), { y: 2026, m: 7, d: 29 });
  });

  it('an exact date is used verbatim — no rounding through a duration', () => {
    const exact = '2027-03-03';
    assert.equal(diffCalendarDays('2026-07-29', exact), 217);
  });
});

describe('remaining-days countdown', () => {
  it('counts calendar days regardless of clock time', () => {
    const lateNight = new Date(2026, 6, 29, 23, 59, 59); // 29 Jul 2026 local
    const earlyAM = new Date(2026, 6, 29, 0, 0, 1);
    assert.equal(daysUntil('2026-08-29', lateNight), 31);
    assert.equal(daysUntil('2026-08-29', earlyAM), 31);
  });

  it('today is 0 and yesterday is negative', () => {
    const now = new Date(2026, 6, 29, 12, 0, 0);
    assert.equal(daysUntil('2026-07-29', now), 0);
    assert.equal(daysUntil('2026-07-28', now), -1);
    assert.equal(daysUntil('2026-07-30', now), 1);
  });

  it('a 1-month warranty bought today reads ~30 days, not ~184', () => {
    const now = new Date(2026, 6, 29, 9, 0, 0);
    const expiry = addMonths(todayISO(now), 1);
    assert.equal(expiry, '2026-08-29');
    assert.equal(daysUntil(expiry, now), 31);
  });

  it('diff is symmetric', () => {
    assert.equal(diffCalendarDays('2026-01-01', '2026-12-31'), 364);
    assert.equal(diffCalendarDays('2026-12-31', '2026-01-01'), -364);
  });
});

describe('timezone safety', () => {
  it('never shifts a day, whatever the host offset', () => {
    // The old implementation parsed as UTC then read local fields, landing a
    // day early west of Greenwich. These are pure string operations now.
    assert.equal(addMonths('2026-01-01', 0), '2026-01-01');
    assert.equal(addDays('2026-01-01', 0), '2026-01-01');
    assert.equal(addYears('2026-01-01', 0), '2026-01-01');
  });

  it('round-trips across a DST boundary without gaining or losing a day', () => {
    // Europe/US DST transitions fall in these windows; UTC arithmetic ignores them.
    assert.equal(diffCalendarDays('2026-03-01', '2026-04-01'), 31);
    assert.equal(diffCalendarDays('2026-10-01', '2026-11-01'), 31);
  });
});

describe('negative and zero amounts', () => {
  it('subtracts months across a year boundary', () => {
    assert.equal(addMonths('2026-01-15', -1), '2025-12-15');
    assert.equal(addMonths('2026-01-15', -13), '2024-12-15');
  });

  it('subtracts days across a year boundary', () => {
    assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  });

  it('zero is identity', () => {
    assert.equal(addDuration('2026-07-29', 0, 'month'), '2026-07-29');
  });
});

describe('subscription renewal cycles', () => {
  it('each cycle advances by the right calendar amount', () => {
    assert.equal(addBillingCycle('2026-07-29', 'weekly'), '2026-08-05');
    assert.equal(addBillingCycle('2026-07-29', 'monthly'), '2026-08-29');
    assert.equal(addBillingCycle('2026-07-29', 'quarterly'), '2026-10-29');
    assert.equal(addBillingCycle('2026-07-29', 'yearly'), '2027-07-29');
  });

  it('a monthly cycle billed on the 31st clamps instead of skipping a month', () => {
    // Naive +1 month would land in March and the customer would be billed
    // "monthly" only 11 times a year.
    assert.equal(addBillingCycle('2026-01-31', 'monthly'), '2026-02-28');
    assert.equal(addBillingCycle('2028-01-31', 'monthly'), '2028-02-29');
    assert.equal(addBillingCycle('2026-03-31', 'monthly'), '2026-04-30');
  });

  it('weekly is always exactly 7 days, including across months and leap days', () => {
    assert.equal(diffCalendarDays('2026-07-29', addBillingCycle('2026-07-29', 'weekly')), 7);
    assert.equal(diffCalendarDays('2024-02-26', addBillingCycle('2024-02-26', 'weekly')), 7);
    assert.equal(addBillingCycle('2024-02-26', 'weekly'), '2024-03-04'); // through 29 Feb
  });

  it('a yearly cycle starting on 29 Feb clamps to 28 Feb', () => {
    assert.equal(addBillingCycle('2024-02-29', 'yearly'), '2025-02-28');
  });

  it('a manually entered date is stored verbatim, not re-derived', () => {
    // What the "Set manually" option must guarantee: the countdown and the
    // reminders are built from exactly the date the user typed.
    const typed = '2026-09-15';
    assert.equal(isValidISODate(typed), true);
    assert.equal(diffCalendarDays('2026-07-29', typed), 48);
  });

  it('an incomplete manual entry is not a usable date', () => {
    for (const partial of ['', '2026', '2026-0', '2026-09-', '15/09/2026']) {
      assert.equal(isValidISODate(partial), false, `"${partial}" should be rejected`);
    }
  });
});

describe('invalid input is rejected loudly', () => {
  it('throws rather than silently producing a wrong date', () => {
    assert.throws(() => addMonths('not-a-date', 1), RangeError);
    assert.throws(() => addDays('2026-02-30', 1), RangeError);
    assert.throws(() => diffCalendarDays('2026-01-01', 'nope'), RangeError);
  });
});
