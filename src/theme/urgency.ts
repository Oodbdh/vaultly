import { colors } from './index';
import type { CountdownTone } from '@/i18n/relativeTime';

/**
 * Urgency palette for countdowns — green / orange / red, plus the tinted
 * surface each badge sits on. Derived from the brand palette rather than new
 * hues so warranty and subscription cards stay in the Vaultly family.
 */
export const URGENCY: Record<CountdownTone, { fg: string; bg: string; border: string }> = {
  ok: { fg: colors.success, bg: '#EAF4EF', border: '#CFE5DA' },
  soon: { fg: '#B98200', bg: '#FCF3E2', border: '#F0E1C0' },
  urgent: { fg: '#C1452F', bg: '#FDF0EC', border: '#F3D6CC' },
  expired: { fg: colors.danger, bg: '#FDF0EF', border: '#F2D6D4' },
};
