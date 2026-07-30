import type { Session, User } from '@supabase/supabase-js';

import { MOCK_USER_ID, mockProfile } from './seed';

/**
 * A signed-in session for mock mode, so the auth gate in `app/_layout.tsx`
 * lands on Home instead of the sign-in screen. Shaped as the real thing rather
 * than special-cased in the gate, which keeps the redirect logic identical in
 * both modes.
 */

export const mockUser = {
  id: MOCK_USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'demo@vaultly.app',
  app_metadata: { provider: 'mock' },
  user_metadata: { display_name: mockProfile.display_name },
  created_at: mockProfile.created_at,
} as unknown as User;

export const mockSession = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: mockUser,
} as unknown as Session;

export { mockProfile };
