import { useCallback, useState } from 'react';

import type { ReminderKind } from '@/lib/types';
import { cancelRemindersOfKind } from '@/services/notifications';
import { updateProfile } from '@/services/profile';
import { rescheduleReminders } from '@/services/receipts';
import { useAuthStore } from '@/store/authStore';

/** The profile column each toggle writes. */
const COLUMN = {
  warranty: 'warranty_reminders',
  renewal: 'renewal_reminders',
} as const;

export type ReminderPreferences = {
  warranty: boolean;
  renewal: boolean;
  /** The kind currently being written, so its row can disable itself. */
  pending: ReminderKind | null;
  /** Resolves `false` if the preference could not be persisted. */
  toggle: (kind: ReminderKind, next: boolean) => Promise<boolean>;
};

/**
 * The Settings reminder switches.
 *
 * A switch that only remembered its position would be a lie — the reminders it
 * claims to control are scheduled on the device, not derived from the column at
 * delivery time. So each toggle does three things, in this order:
 *
 *   1. persists to `profiles`, and stops if that fails;
 *   2. mirrors the new value into `services/notifications`, which gates every
 *      future schedule call;
 *   3. reconciles what is already scheduled — cancelling that kind outright, or
 *      re-scheduling it across the whole vault.
 *
 * Persisting first is deliberate: a failed write must not leave the device's
 * reminders disagreeing with the row. Only step 1 can fail the toggle — step 3
 * touches local notifications alone, and the next write to any item re-derives
 * that item's reminders anyway.
 */
export function useReminderPreferences(): ReminderPreferences {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const [pending, setPending] = useState<ReminderKind | null>(null);

  // Default on, matching the columns, so the switches do not flicker off while
  // the profile is still loading.
  const warranty = profile?.warranty_reminders ?? true;
  const renewal = profile?.renewal_reminders ?? true;

  const toggle = useCallback(
    async (kind: ReminderKind, next: boolean): Promise<boolean> => {
      if (!user || !profile) return false;
      setPending(kind);
      try {
        const result = await updateProfile(user.id, { [COLUMN[kind]]: next });
        if (!result.ok) return false;

        // Cache the row Postgres actually stored. Going through the store is
        // also what re-mirrors the preference into the notification service, so
        // every later schedule call is gated from here on.
        setProfile(result.profile);

        // Reconciling what is already on the device is best-effort, and
        // deliberately does not fail the toggle: the row is saved, future
        // scheduling is gated, and any item written later re-derives its own
        // reminders. Reporting failure here would invite the user to toggle
        // again and re-run the write that already succeeded.
        try {
          if (next) await rescheduleReminders(user.id, kind);
          else await cancelRemindersOfKind(kind);
        } catch (e) {
          if (__DEV__) console.warn('[vaultly] reminder reconcile failed:', e);
        }

        return true;
      } finally {
        setPending(null);
      }
    },
    [user, profile, setProfile],
  );

  return { warranty, renewal, pending, toggle };
}
