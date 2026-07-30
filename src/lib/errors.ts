/**
 * Errors the UI branches on. Kept out of `services/` so the mock backend can
 * throw the same types the Supabase backend does without importing it.
 */

/** The 4-item free limit was hit. The UI answers this by opening the paywall. */
export class QuotaExceededError extends Error {
  constructor() {
    super('VAULTLY_QUOTA_EXCEEDED');
    this.name = 'QuotaExceededError';
  }
}
