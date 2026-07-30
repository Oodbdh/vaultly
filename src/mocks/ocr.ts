import type { ExtractionResult } from '@/services/ocr';
import { isoDay } from './seed';

/**
 * Canned extraction response, so the scan → review → save flow is testable
 * without any AI provider key. It returns a *product* purchase with no warranty term stated,
 * which is the interesting branch: it triggers both the "We detected a product"
 * sheet and the warranty-duration chips on the review step.
 */
export function mockExtractReceipt(): Promise<ExtractionResult> {
  return new Promise((resolve) =>
    // Long enough that the "Reading your receipt…" state is actually seen.
    setTimeout(
      () =>
        resolve({
          ok: true,
          data: {
            purchaseType: 'product',
            serviceName: null,
            billingCycle: null,
            nextRenewal: null,
            productName: 'Samsung 55" TV',
            merchantName: 'Jarir Bookstore',
            totalAmount: 2499,
            currency: 'SAR',
            purchaseDate: isoDay(0),
            warrantyExpiry: null,
            warrantyMonths: null,
            category: 'Electronics',
            lineItemCount: 3,
            confidence: 0.92,
          },
        }),
      1400,
    ),
  );
}
