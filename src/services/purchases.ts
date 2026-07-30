/**
 * RevenueCat. Like AdMob this is a native module absent from Expo Go, so it is
 * required lazily — a top-level import would crash the bundle before the first
 * screen renders. Every function degrades to "not configured", which the UI
 * already handles: the paywall falls back to the static price label and
 * `isPremium` stays false.
 */
import { Platform } from 'react-native';
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';

import { MONETIZATION, env } from '@/constants/config';

type PurchasesModule = typeof import('react-native-purchases');

let cached: PurchasesModule | null | undefined;

function purchasesModule(): PurchasesModule | null {
  if (cached !== undefined) return cached;
  try {
    cached = require('react-native-purchases') as PurchasesModule;
  } catch {
    if (__DEV__) console.log('[vaultly] RevenueCat unavailable (Expo Go) — purchases disabled.');
    cached = null;
  }
  return cached;
}

export function purchasesAvailable(): boolean {
  return purchasesModule() !== null;
}

/** True only when the SDK exists *and* has been configured with a key. */
let configured = false;

export async function configurePurchases(appUserId?: string | null): Promise<void> {
  const mod = purchasesModule();
  if (!mod) return;
  const Purchases = mod.default;

  const apiKey = Platform.select({
    ios: env.revenueCatIosKey,
    android: env.revenueCatAndroidKey,
    default: '',
  });
  if (!apiKey) {
    if (__DEV__) console.warn('[vaultly] RevenueCat key missing — purchases disabled.');
    return;
  }
  if (!configured) {
    Purchases.setLogLevel(__DEV__ ? mod.LOG_LEVEL.DEBUG : mod.LOG_LEVEL.ERROR);
    // Use the Supabase user id as the RevenueCat App User ID so entitlements
    // follow the account across devices and webhooks map back to a profile row.
    await Purchases.configure({ apiKey, appUserID: appUserId ?? null });
    configured = true;
    return;
  }
  if (appUserId) await Purchases.logIn(appUserId);
}

export async function logOutPurchases(): Promise<void> {
  const mod = purchasesModule();
  if (!mod || !configured) return;
  try {
    await mod.default.logOut();
  } catch {
    /* anonymous user — nothing to do */
  }
}

export function hasPremium(info: CustomerInfo | null | undefined): boolean {
  return !!info?.entitlements.active[MONETIZATION.entitlementId];
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  const mod = purchasesModule();
  if (!mod || !configured) return null;
  return mod.default.getCustomerInfo();
}

export function onCustomerInfoChange(cb: (info: CustomerInfo) => void): () => void {
  const mod = purchasesModule();
  if (!mod) return () => {};
  const Purchases = mod.default;
  Purchases.addCustomerInfoUpdateListener(cb);
  return () => Purchases.removeCustomerInfoUpdateListener(cb);
}

export async function getMonthlyPackage(): Promise<{
  offering: PurchasesOffering | null;
  pkg: PurchasesPackage | null;
}> {
  const mod = purchasesModule();
  if (!mod || !configured) return { offering: null, pkg: null };

  const offerings = await mod.default.getOfferings();
  const offering =
    offerings.all[MONETIZATION.defaultOfferingId] ?? offerings.current ?? null;
  const pkg =
    offering?.monthly ??
    offering?.availablePackages.find((p) => p.product.subscriptionPeriod === 'P1M') ??
    offering?.availablePackages[0] ??
    null;
  return { offering, pkg };
}

export type PurchaseOutcome =
  | { status: 'purchased'; info: CustomerInfo }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export async function purchasePremium(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  const mod = purchasesModule();
  if (!mod) return { status: 'error', message: 'Purchases unavailable' };

  try {
    const { customerInfo } = await mod.default.purchasePackage(pkg);
    return { status: 'purchased', info: customerInfo };
  } catch (e) {
    const err = e as { userCancelled?: boolean; message?: string };
    if (err.userCancelled) return { status: 'cancelled' };
    return { status: 'error', message: err.message ?? 'unknown' };
  }
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  const mod = purchasesModule();
  if (!mod || !configured) return null;
  return mod.default.restorePurchases();
}
