import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isReminderFor,
  isReminderOfKind,
  parseReminderId,
  reminderId,
} from './reminderIds.ts';

// The ids the app actually schedules are uuids.
const ITEM = '8f1c2b3a-4d5e-6f70-8192-a3b4c5d6e7f8';
const OTHER = '11112222-3333-4444-5555-666677778888';

describe('reminder identifiers', () => {
  it('round-trips every field', () => {
    assert.deepEqual(parseReminderId(reminderId('warranty', ITEM, 30)), {
      kind: 'warranty',
      entityId: ITEM,
      days: 30,
    });
    assert.deepEqual(parseReminderId(reminderId('renewal', ITEM, 1)), {
      kind: 'renewal',
      entityId: ITEM,
      days: 1,
    });
  });

  it('keeps the documented wire format', () => {
    // The scheme is load-bearing: reminders already on a device were written by
    // an older build and must still be found by this one.
    assert.equal(reminderId('warranty', ITEM, 30), `warranty:${ITEM}:30`);
    assert.equal(reminderId('renewal', ITEM, 3), `renewal:${ITEM}:3`);
  });
});

describe('matching one item', () => {
  it('matches every lead time and both kinds for that item', () => {
    for (const id of [
      reminderId('warranty', ITEM, 30),
      reminderId('warranty', ITEM, 7),
      reminderId('warranty', ITEM, 1),
      reminderId('renewal', ITEM, 3),
    ]) {
      assert.equal(isReminderFor(id, ITEM), true, id);
    }
  });

  it('does not match a different item', () => {
    assert.equal(isReminderFor(reminderId('warranty', OTHER, 30), ITEM), false);
  });

  it('will not match an id that merely contains the target', () => {
    // A substring test would be tempting here and wrong: cancelling item `abc`
    // must not take `abcd` with it.
    assert.equal(isReminderFor(reminderId('warranty', 'abcd', 30), 'abc'), false);
    assert.equal(isReminderFor(reminderId('warranty', 'abc', 30), 'abcd'), false);
  });

  it('does not confuse the day count with the item', () => {
    assert.equal(isReminderFor(reminderId('warranty', ITEM, 30), '30'), false);
  });
});

describe('matching one kind', () => {
  it('separates the two kinds', () => {
    const warranty = reminderId('warranty', ITEM, 30);
    const renewal = reminderId('renewal', ITEM, 3);

    assert.equal(isReminderOfKind(warranty, 'warranty'), true);
    assert.equal(isReminderOfKind(warranty, 'renewal'), false);
    assert.equal(isReminderOfKind(renewal, 'renewal'), true);
    assert.equal(isReminderOfKind(renewal, 'warranty'), false);
  });

  it('turning one toggle off leaves the other kind alone', () => {
    // This is the switch-off path: filter the scheduled list by kind and cancel
    // exactly that subset.
    const scheduled = [
      reminderId('warranty', ITEM, 30),
      reminderId('warranty', OTHER, 7),
      reminderId('renewal', ITEM, 3),
      reminderId('renewal', OTHER, 1),
    ];

    assert.deepEqual(
      scheduled.filter((id) => isReminderOfKind(id, 'warranty')),
      [reminderId('warranty', ITEM, 30), reminderId('warranty', OTHER, 7)],
    );
    assert.deepEqual(
      scheduled.filter((id) => !isReminderOfKind(id, 'warranty')),
      [reminderId('renewal', ITEM, 3), reminderId('renewal', OTHER, 1)],
    );
  });
});

describe('identifiers this module did not write', () => {
  it('are never claimed', () => {
    // The scheduled list belongs to the whole app. Anything unrecognised must
    // fall through both matchers rather than be cancelled by accident.
    for (const id of [
      '',
      'warranty',
      'warranty:',
      `warranty:${ITEM}`,
      `warranty:${ITEM}:30:extra`,
      `expiry:${ITEM}:30`,
      `Warranty:${ITEM}:30`,
      `warranty::30`,
      `warranty:${ITEM}:`,
      `warranty:${ITEM}:soon`,
      `warranty:${ITEM}:1.5`,
      'some-unrelated-notification',
    ]) {
      assert.equal(parseReminderId(id), null, id);
      assert.equal(isReminderFor(id, ITEM), false, id);
      assert.equal(isReminderOfKind(id, 'warranty'), false, id);
    }
  });
});
