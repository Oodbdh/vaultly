import { Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

import { SUPPORT_EMAIL } from '@/constants/config';

/**
 * Contact actions for Profile → Help & Support.
 *
 * Every action degrades rather than dead-ends: if no mail client can handle the
 * link — common on emulators, tablets with mail removed, and Expo Go on some
 * Android builds — the composed message is copied to the clipboard and the
 * caller is told the address, so the option is never a button that does
 * nothing.
 */

export type SupportTopic = 'contact' | 'bug' | 'feature';

export type SupportOutcome =
  | { status: 'opened' }
  | { status: 'copied'; email: string }
  | { status: 'failed'; email: string };

export const APP_VERSION = (Constants.expoConfig?.version as string | undefined) ?? '0.1.0';

/**
 * Facts a support reply almost always needs. Deliberately excludes anything
 * identifying beyond the account id — no email, no item contents.
 */
export function diagnostics(locale: string, userId?: string | null): string {
  return [
    `App: Vaultly ${APP_VERSION}`,
    `Platform: ${Platform.OS} ${Device.osVersion ?? ''}`.trim(),
    `Device: ${Device.modelName ?? 'unknown'}`,
    `Language: ${locale}`,
    userId ? `Account: ${userId.slice(0, 8)}…` : 'Account: signed out',
  ].join('\n');
}

/** Body scaffolding per topic — a blank email gets a slower, vaguer answer. */
function template(topic: SupportTopic, t: (k: string) => string): string {
  switch (topic) {
    case 'bug':
      return [
        t('support.tplWhatHappened'),
        '',
        t('support.tplSteps'),
        '1. ',
        '2. ',
        '3. ',
        '',
        t('support.tplExpected'),
        '',
      ].join('\n');
    case 'feature':
      return [t('support.tplIdea'), '', t('support.tplWhy'), ''].join('\n');
    case 'contact':
      return [t('support.tplHowCanWeHelp'), '', ''].join('\n');
  }
}

function subjectFor(topic: SupportTopic, t: (k: string) => string): string {
  const key =
    topic === 'bug' ? 'support.subjectBug'
      : topic === 'feature' ? 'support.subjectFeature'
        : 'support.subjectContact';
  return `${t(key)} — Vaultly ${APP_VERSION}`;
}

export function composeSupportMessage(
  topic: SupportTopic,
  t: (k: string) => string,
  locale: string,
  userId?: string | null,
): { subject: string; body: string } {
  const body = [
    template(topic, t),
    '',
    '---',
    t('support.diagnosticsNote'),
    diagnostics(locale, userId),
  ].join('\n');
  return { subject: subjectFor(topic, t), body };
}

export async function openSupportEmail(
  topic: SupportTopic,
  t: (k: string) => string,
  locale: string,
  userId?: string | null,
): Promise<SupportOutcome> {
  const { subject, body } = composeSupportMessage(topic, t, locale, userId);
  const url =
    `mailto:${SUPPORT_EMAIL}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  try {
    // canOpenURL is unreliable for mailto on Android, so try the open and let
    // it throw rather than pre-checking and refusing a link that would work.
    await Linking.openURL(url);
    return { status: 'opened' };
  } catch {
    try {
      await Clipboard.setStringAsync(`${SUPPORT_EMAIL}\n\n${subject}\n\n${body}`);
      return { status: 'copied', email: SUPPORT_EMAIL };
    } catch {
      return { status: 'failed', email: SUPPORT_EMAIL };
    }
  }
}
