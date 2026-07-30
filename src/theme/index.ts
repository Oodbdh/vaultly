/** Minimal token set so screens don't hard-code values. Replace when design lands. */
export const colors = {
  bg: '#FAFAF8',
  surface: '#FFFFFF',
  border: '#E7E5E0',
  text: '#14161A',
  textMuted: '#6B7280',
  primary: '#1B2A4A',
  primaryText: '#FFFFFF',
  accent: '#C8A548',
  danger: '#B4322C',
  success: '#2F7D5B',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

/**
 * Arabic needs a slightly larger body size and looser line-height to stay
 * legible at the same optical weight as Latin.
 */
export function typeScale(locale: string) {
  const ar = locale === 'ar';
  return {
    title: { fontSize: ar ? 28 : 26, lineHeight: ar ? 40 : 34, fontWeight: '700' as const },
    heading: { fontSize: ar ? 20 : 19, lineHeight: ar ? 30 : 26, fontWeight: '600' as const },
    body: { fontSize: ar ? 17 : 16, lineHeight: ar ? 28 : 24, fontWeight: '400' as const },
    caption: { fontSize: ar ? 14 : 13, lineHeight: ar ? 22 : 18, fontWeight: '400' as const },
  };
}
