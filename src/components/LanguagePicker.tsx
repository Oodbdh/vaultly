import { FlatList, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';
import { useLanguage } from '@/hooks/useLanguage';
import type { LanguageMeta } from '@/i18n/languages';

/**
 * Bottom-sheet language picker. Driven entirely by the LANGUAGES list, so a new
 * locale needs no change here — and it scrolls, so the list can grow past the
 * five we ship today.
 */
export function LanguagePicker({
  open,
  onClose,
  languages,
  currentCode,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  languages: LanguageMeta[];
  currentCode: string;
  onSelect: (code: LanguageMeta['code']) => void;
}) {
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);
  const { height } = useWindowDimensions();

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        accessibilityLabel={t('common.close')}
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}
      >
        {/* stopPropagation: taps inside the sheet must not dismiss it */}
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.bg,
            borderTopStartRadius: 24,
            borderTopEndRadius: 24,
            paddingTop: spacing.md,
            paddingBottom: spacing.xxl,
            maxHeight: height * 0.7,
          }}
        >
          <View
            style={{
              width: 42,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: colors.border,
              alignSelf: 'center',
              marginBottom: spacing.md,
            }}
          />
          <Text
            style={[
              type.heading,
              { color: colors.text, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, textAlign },
            ]}
          >
            {t('settings.chooseLanguage')}
          </Text>

          <FlatList
            data={languages}
            keyExtractor={(l) => l.code}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md }}
            ItemSeparatorComponent={() => (
              <View style={{ height: 1, backgroundColor: colors.border }} />
            )}
            renderItem={({ item }) => {
              const selected = item.code === currentCode;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => onSelect(item.code)}
                  style={({ pressed }) => ({
                    minHeight: 60,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.lg,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: radius.sm,
                      backgroundColor: selected ? colors.primary : colors.surface,
                      borderWidth: selected ? 0 : 1,
                      borderColor: colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: selected ? colors.primaryText : colors.textMuted,
                        fontWeight: '700',
                        fontSize: 13,
                      }}
                    >
                      {item.code === 'ar' ? 'ع' : item.code.toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flex: 1, gap: 1 }}>
                    <Text
                      style={[type.body, { color: colors.text, fontWeight: '600', textAlign }]}
                      // native script, never transliterated
                    >
                      {item.nativeName}
                    </Text>
                    <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
                      {item.englishName}
                      {item.rtl ? ' · RTL' : ''}
                    </Text>
                  </View>

                  {selected ? <Ionicons name="checkmark" size={21} color={colors.primary} /> : null}
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Header pill: shows the active language code and opens the sheet. */
export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { flipIcon } = useDirection();
  const { languages, current, currentLabel, change, pickerOpen, openPicker, closePicker } =
    useLanguage();

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('settings.language')}: ${current.nativeName}`}
        onPress={openPicker}
        style={({ pressed }) => ({
          height: 44,
          paddingHorizontal: spacing.md,
          borderRadius: radius.pill,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Ionicons name="language-outline" size={17} color={colors.primary} />
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13, letterSpacing: 0.3 }}>
          {currentLabel}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.textMuted} style={flipIcon} />
      </Pressable>

      <LanguagePicker
        open={pickerOpen}
        onClose={closePicker}
        languages={languages}
        currentCode={current.code}
        onSelect={(code) => void change(code)}
      />
    </>
  );
}
