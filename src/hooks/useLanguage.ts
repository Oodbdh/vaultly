import { Alert } from 'react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Updates from 'expo-updates';

import { setLocale } from '@/i18n';
import { LANGUAGES, languageMeta, shortLabel } from '@/i18n/languages';
import type { AppLocale } from '@/constants/config';

/**
 * `Updates.reloadAsync()` throws in Expo Go, where expo-updates is inert. The
 * direction flag is already persisted at that point, so the fallback is simply
 * to tell the user to reopen the app rather than to fail silently.
 */
async function reload(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch {
    if (__DEV__) {
      console.log('[vaultly] Reload unavailable — restart the app to apply the new direction.');
    }
  }
}

/**
 * One place that owns language switching. Switching between two LTR languages
 * applies instantly; crossing the LTR↔RTL boundary needs a native reload, so we
 * confirm first instead of leaving a half-mirrored tree on screen.
 */
export function useLanguage() {
  const { t, i18n } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const current = languageMeta(i18n.language);

  const change = useCallback(
    async (next: AppLocale) => {
      setPickerOpen(false);
      if (next === i18n.language) return;
      const { requiresReload } = await setLocale(next);
      if (!requiresReload) return;
      Alert.alert(t('settings.language'), t('settings.restartForRtl'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.continue'), onPress: () => void reload() },
      ]);
    },
    [i18n.language, t],
  );

  return {
    languages: LANGUAGES,
    current,
    currentLabel: shortLabel(current.code),
    change,
    pickerOpen,
    openPicker: () => setPickerOpen(true),
    closePicker: () => setPickerOpen(false),
  };
}
