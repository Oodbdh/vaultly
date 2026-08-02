import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import i18n from '@/i18n';
import { updateProfile } from './profile';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // SDK 54 split the old `shouldShowAlert` into banner + notification-centre
    // list; both are still required alongside it.
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

/**
 * Local reminders work everywhere; the *push* token needs an EAS project id and
 * a dev build, so a failure here must not break sign-in. Everything after the
 * permission prompt is best-effort.
 */
export async function registerForPush(userId: string): Promise<string | null> {
  if (!Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  const status =
    existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!status.granted) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await updateProfile(userId, { push_token: token });
    return token;
  } catch {
    // No EAS project id / Expo Go — local reminders still schedule fine.
    return null;
  }
}

type ScheduleArgs = {
  itemId: string;
  merchant: string;
  expiresOn: string;      // yyyy-mm-dd
  reminderDays?: number[]; // days before expiry
};

/** Local reminders for a warranty. Ids are derived so re-scheduling is idempotent. */
export async function scheduleWarrantyReminders({
  itemId,
  merchant,
  expiresOn,
  reminderDays = [30, 7, 1],
}: ScheduleArgs): Promise<string[]> {
  await cancelRemindersFor(itemId);
  const expiry = new Date(`${expiresOn}T09:00:00`);
  const ids: string[] = [];

  for (const days of reminderDays) {
    const when = new Date(expiry.getTime() - days * 86_400_000);
    if (when.getTime() <= Date.now()) continue;
    ids.push(
      await Notifications.scheduleNotificationAsync({
        identifier: `warranty:${itemId}:${days}`,
        content: {
          title: i18n.t('notifications.warrantyTitle'),
          body: i18n.t('notifications.warrantyBody', { merchant, count: days }),
          data: { itemId, kind: 'warranty' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
      }),
    );
  }
  return ids;
}

export async function scheduleRenewalReminders(args: {
  subscriptionId: string;
  name: string;
  nextRenewal: string;
  amountLabel: string;
  reminderDays?: number[];
}): Promise<string[]> {
  const { subscriptionId, name, nextRenewal, amountLabel, reminderDays = [3, 1] } = args;
  await cancelRemindersFor(subscriptionId);
  const renewal = new Date(`${nextRenewal}T09:00:00`);
  const ids: string[] = [];

  for (const days of reminderDays) {
    const when = new Date(renewal.getTime() - days * 86_400_000);
    if (when.getTime() <= Date.now()) continue;
    ids.push(
      await Notifications.scheduleNotificationAsync({
        identifier: `renewal:${subscriptionId}:${days}`,
        content: {
          title: i18n.t('notifications.renewalTitle'),
          body: i18n.t('notifications.renewalBody', {
            name,
            date: nextRenewal,
            amount: amountLabel,
          }),
          data: { subscriptionId, kind: 'renewal' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
      }),
    );
  }
  return ids;
}

export async function cancelRemindersFor(entityId: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.includes(`:${entityId}:`))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Language change re-renders notification copy — reschedule everything. */
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
