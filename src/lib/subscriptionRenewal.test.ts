import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  RENEWAL_GRACE_HOURS,
  expiryInstant,
  graceRemaining,
  renewalWindow,
} from './subscriptionRenewal.ts';

/** Local-time helper, matching how the window is computed. */
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe('subscription renewal window', () => {
  const renewal = '2026-03-10';

  it('is not expired before the renewal date', () => {
    assert.deepEqual(renewalWindow(renewal, at(2026, 3, 1, 12)), {
      expired: false,
      renewable: false,
      msLeft: 0,
    });
  });

  it('is still active during the renewal day itself', () => {
    // Cover runs through the whole of 10 March.
    const w = renewalWindow(renewal, at(2026, 3, 10, 23, 59));
    assert.equal(w.expired, false);
    assert.equal(w.renewable, false);
  });

  it('expires at midnight opening the following day', () => {
    const w = renewalWindow(renewal, at(2026, 3, 11, 0, 0));
    assert.equal(w.expired, true);
    assert.equal(w.renewable, true);
    assert.equal(w.msLeft, RENEWAL_GRACE_HOURS * 3_600_000);
  });

  it('stays renewable one minute before the 48h deadline', () => {
    const w = renewalWindow(renewal, at(2026, 3, 12, 23, 59));
    assert.equal(w.renewable, true);
    assert.ok(w.msLeft > 0);
  });

  it('closes exactly 48 hours after expiry', () => {
    const w = renewalWindow(renewal, at(2026, 3, 13, 0, 0));
    assert.equal(w.expired, true);
    assert.equal(w.renewable, false, 'renewal must not survive the deadline');
    assert.equal(w.msLeft, 0);
  });

  it('stays closed long after the window', () => {
    const w = renewalWindow(renewal, at(2026, 4, 1));
    assert.equal(w.expired, true);
    assert.equal(w.renewable, false);
    assert.equal(w.msLeft, 0);
  });

  it('treats a missing or malformed date as never renewable', () => {
    for (const bad of [null, undefined, '', 'not-a-date', '2026-13-45']) {
      const w = renewalWindow(bad as string | null, at(2026, 3, 11));
      assert.equal(w.expired, false, `${bad} should not be expired`);
      assert.equal(w.renewable, false, `${bad} should not be renewable`);
    }
  });

  it('anchors expiry to local midnight, not UTC', () => {
    const e = expiryInstant('2026-03-10')!;
    assert.equal(e.getFullYear(), 2026);
    assert.equal(e.getMonth(), 2); // March
    assert.equal(e.getDate(), 11);
    assert.equal(e.getHours(), 0);
    assert.equal(e.getMinutes(), 0);
  });

  it('survives a month boundary', () => {
    const w = renewalWindow('2026-01-31', at(2026, 2, 1, 6));
    assert.equal(w.renewable, true);
    assert.equal(renewalWindow('2026-01-31', at(2026, 2, 3, 0, 0)).renewable, false);
  });

  it('survives a leap day', () => {
    assert.equal(renewalWindow('2028-02-29', at(2028, 3, 1, 1)).renewable, true);
    assert.equal(renewalWindow('2028-02-29', at(2028, 3, 2, 23)).renewable, true);
    assert.equal(renewalWindow('2028-02-29', at(2028, 3, 3, 0, 0)).renewable, false);
  });
});

describe('grace countdown formatting', () => {
  it('splits the full window into days and hours', () => {
    assert.deepEqual(graceRemaining(48 * 3_600_000), { days: 2, hours: 0 });
  });

  it('produces the example from the spec', () => {
    // 1 day 12 hours
    assert.deepEqual(graceRemaining(36 * 3_600_000), { days: 1, hours: 12 });
  });

  it('rounds down so it never over-promises', () => {
    // 119 minutes is one hour and change, not two.
    assert.deepEqual(graceRemaining(119 * 60_000), { days: 0, hours: 1 });
  });

  it('reports zero at and below the deadline', () => {
    assert.deepEqual(graceRemaining(0), { days: 0, hours: 0 });
    assert.deepEqual(graceRemaining(-5000), { days: 0, hours: 0 });
  });
});
