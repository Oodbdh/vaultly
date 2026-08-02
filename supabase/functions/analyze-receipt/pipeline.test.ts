import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyFloor,
  CONFIDENCE_FLOOR,
  detectCandidates,
  detectDates,
  detectMerchant,
  detectPaymentMethod,
  detectTotals,
  detectWarrantyMonths,
  foldDigits,
  hijriToGregorian,
  parseAmount,
  reconcile,
  validate,
  type TextBlock,
} from './pipeline.ts';

/** Turns a receipt written as lines into the block shape stage 2 expects. */
function blocks(...lines: string[]): TextBlock[] {
  return lines.map((text, i) => ({ i, text }));
}

describe('digit and number normalisation', () => {
  test('folds Arabic-Indic digits and separators', () => {
    assert.equal(foldDigits('١٢٣٤'), '1234');
    assert.equal(foldDigits('۱۲۳'), '123');
    assert.equal(foldDigits('١٢٫٥٠'), '12.50');
    assert.equal(foldDigits('١٬٢٣٤'), '1,234');
  });

  test('resolves decimal and thousands separators both ways', () => {
    assert.equal(parseAmount('1,234.56'), 1234.56); // en
    assert.equal(parseAmount('1.234,56'), 1234.56); // de
    assert.equal(parseAmount('1 234,56'), 1234.56); // fr
    assert.equal(parseAmount('12,50'), 12.5);       // lone comma = decimal
    assert.equal(parseAmount('1,234'), 1234);       // lone comma = thousands
    assert.equal(parseAmount('2499'), 2499);
  });

  test('rejects non-numbers and absurd values rather than guessing', () => {
    assert.equal(parseAmount('abc'), null);
    assert.equal(parseAmount(''), null);
    assert.equal(parseAmount('-5'), null);
    assert.equal(parseAmount('999999999999'), null);
  });
});

describe('amount selection', () => {
  test('prefers a grand-total line over subtotal and VAT', () => {
    const c = detectTotals(blocks(
      'Subtotal        2173.04',
      'VAT 15%          325.96',
      'Grand Total     2499.00',
    ));
    const winner = c.reduce((a, b) => (b.confidence > a.confidence ? b : a));
    assert.equal(winner.value, 2499);
  });

  test('uses subtotal only when no total line exists', () => {
    const v = validate(detectCandidates(blocks('Subtotal 2173.04', 'Thank you')));
    assert.equal(v.totalAmount?.value, 2173.04);
    // Fallback must not masquerade as certain.
    assert.ok((v.totalAmount?.confidence ?? 0) < CONFIDENCE_FLOOR);
  });

  test('ignores the crossed-out price on a was/now line', () => {
    const c = detectTotals(blocks('Was 199.00 now 149.00'));
    assert.equal(c[0].value, 149);
  });

  test('never treats change-due as the total', () => {
    const c = detectTotals(blocks('Change due 51.00'));
    assert.equal(c.length, 0);
  });

  test('promotes the candidate equal to subtotal + VAT', () => {
    const v = validate(detectCandidates(blocks(
      'Subtotal 100.00',
      'VAT 15.00',
      'Total 115.00',
    )));
    assert.equal(v.totalAmount?.value, 115);
    assert.ok((v.totalAmount?.confidence ?? 0) >= 90);
  });

  test('reads an Arabic total line', () => {
    const v = validate(detectCandidates(blocks('الإجمالي شامل الضريبة ٢٤٩٩٫٠٠')));
    assert.equal(v.totalAmount?.value, 2499);
  });
});

describe('dates', () => {
  test('parses unambiguous dd/mm and mm/dd correctly', () => {
    assert.equal(detectDates(blocks('Date: 25/12/2026'))[0].value.iso, '2026-12-25');
    assert.equal(detectDates(blocks('Date: 12/25/2026'))[0].value.iso, '2026-12-25');
  });

  test('flags an ambiguous all-small date instead of asserting it', () => {
    const d = detectDates(blocks('Date: 05/06/2026'))[0];
    assert.equal(d.value.iso, '2026-06-05'); // dd/mm assumed for this market
    assert.ok(d.confidence < CONFIDENCE_FLOOR, 'ambiguous order must stay below the floor');
  });

  test('tags roles from surrounding words', () => {
    const d = detectDates(blocks(
      'Invoice Date: 01/03/2026',
      'Warranty valid until 01/03/2028',
      'Next renewal 01/04/2026',
      'Due date 15/03/2026',
    ));
    assert.equal(d[0].value.role, 'purchase');
    assert.equal(d[1].value.role, 'warrantyExpiry');
    assert.equal(d[2].value.role, 'renewal');
    assert.equal(d[3].value.role, 'due');
  });

  test('converts Hijri but never claims precision', () => {
    const iso = hijriToGregorian(1447, 8, 10);
    assert.ok(iso && /^\d{4}-\d{2}-\d{2}$/.test(iso));
    const d = detectDates(blocks('التاريخ ١٤٤٧/٠٨/١٠ هـ'))[0];
    assert.ok(d.confidence < CONFIDENCE_FLOOR);
  });

  test('an unlabelled date cannot pass the floor on its own', () => {
    const v = validate(detectCandidates(blocks('Jarir Bookstore', '25/12/2026', 'Total 100')));
    assert.ok((v.purchaseDate?.confidence ?? 0) < CONFIDENCE_FLOOR);
  });

  test('rejects impossible dates', () => {
    assert.equal(detectDates(blocks('32/13/2026')).length, 0);
  });
});

describe('merchant', () => {
  test('skips document headers, addresses, contacts and slogans', () => {
    const m = detectMerchant(blocks(
      'TAX INVOICE',
      'Jarir Bookstore',
      'King Fahd Road, Riyadh',
      'Tel: 920000089',
      'VAT No. 300000000000003',
      'Thank you for shopping',
    ));
    const names = m.map((x) => x.value);
    assert.ok(names.includes('Jarir Bookstore'));
    assert.ok(!names.includes('TAX INVOICE'));
    assert.ok(!names.some((n) => n.includes('King Fahd Road')));
    assert.ok(!names.some((n) => n.startsWith('Tel:')));
    assert.ok(!names.some((n) => n.startsWith('VAT No')));
    assert.ok(!names.some((n) => n.startsWith('Thank you')));
  });

  test('skips the Arabic document header', () => {
    const names = detectMerchant(blocks('فاتورة ضريبية', 'مكتبة جرير')).map((x) => x.value);
    assert.ok(names.includes('مكتبة جرير'));
    assert.ok(!names.includes('فاتورة ضريبية'));
  });

  test('ignores mostly-numeric lines', () => {
    const names = detectMerchant(blocks('0123456789', 'Real Shop')).map((x) => x.value);
    assert.deepEqual(names, ['Real Shop']);
  });
});

describe('warranty', () => {
  test('reads a stated duration in either language', () => {
    assert.equal(detectWarrantyMonths(blocks('2 year warranty'))[0].value, 24);
    assert.equal(detectWarrantyMonths(blocks('Warranty: 18 months'))[0].value, 18);
    assert.equal(detectWarrantyMonths(blocks('ضمان 12 شهر'))[0].value, 12);
    assert.equal(detectWarrantyMonths(blocks('ضمان سنتين'))[0].value, 24);
  });

  test('ignores durations on non-warranty lines', () => {
    assert.equal(detectWarrantyMonths(blocks('Netflix 12 months plan')).length, 0);
  });

  test('never produces an expiry without an explicit warranty date', () => {
    const v = validate(detectCandidates(blocks('Jarir', '2 year warranty', 'Date: 01/03/2026')));
    assert.equal(v.warrantyMonths?.value, 24);
    assert.equal(v.warrantyExpiry, null, 'expiry must not be computed here');
  });
});

describe('subscription', () => {
  test('recognises recurrence and its interval', () => {
    const c = detectCandidates(blocks('Netflix', 'Subscription — monthly', 'Total 56.00'));
    assert.equal(c.isSubscription, true);
    const v = validate(c);
    assert.equal(v.purchaseType, 'subscription');
    assert.equal(v.billingCycle?.value, 'monthly');
  });

  test('a bare cycle word without recurrence wording stays weak', () => {
    const c = detectCandidates(blocks('Monthly special offer', 'Total 20'));
    assert.equal(c.isSubscription, false);
    assert.ok(c.billingCycle.every((x) => x.confidence < CONFIDENCE_FLOOR));
  });

  test('picks up the next renewal date', () => {
    const v = validate(detectCandidates(blocks('Spotify subscription', 'Next billing 01/04/2026')));
    assert.equal(v.nextRenewal?.value, '2026-04-01');
  });
});

describe('invoice number, VAT and payment method', () => {
  test('extracts an invoice number but not a bare year', () => {
    const c = detectCandidates(blocks('Invoice No: INV-2026-0042'));
    assert.equal(c.invoiceNumber[0].value, 'INV-2026-0042');
    assert.equal(detectCandidates(blocks('Invoice 2026')).invoiceNumber.length, 0);
  });

  test('separates a VAT amount from a VAT percentage', () => {
    assert.equal(detectCandidates(blocks('VAT 15% 325.96')).vatAmount[0].value, 325.96);
  });

  test('detects the payment method in both languages', () => {
    assert.equal(detectPaymentMethod(blocks('Paid by mada'))[0].value, 'mada');
    assert.equal(detectPaymentMethod(blocks('الدفع نقدا'))[0].value, 'cash');
  });
});

describe('stage 5 reconciliation', () => {
  test('agreement raises confidence above either side', () => {
    const r = reconcile({ value: 100, confidence: 80, block: 0, reason: '' }, 100, 70);
    assert.equal(r.value, 100);
    assert.ok(r.confidence > 80);
  });

  test('disagreement takes the more confident side and docks it', () => {
    const r = reconcile({ value: 100, confidence: 60, block: 0, reason: '' }, 250, 90);
    assert.equal(r.value, 250);
    assert.equal(r.confidence, 75);
  });

  test('the LLM alone is capped below full trust', () => {
    const r = reconcile(null, 500, 99);
    assert.equal(r.value, 500);
    assert.ok(r.confidence <= 75);
  });

  test('neither side means null, never a guess', () => {
    assert.equal(reconcile(null, null, 99).value, null);
  });

  test('the floor turns low confidence into null', () => {
    assert.equal(applyFloor({ value: 'x', confidence: CONFIDENCE_FLOOR - 1 }), null);
    assert.equal(applyFloor({ value: 'x', confidence: CONFIDENCE_FLOOR }), 'x');
  });
});

describe('end to end on a realistic receipt', () => {
  test('mixed Arabic/English Saudi receipt', () => {
    const v = validate(detectCandidates(blocks(
      'مكتبة جرير Jarir Bookstore',
      'فاتورة ضريبية مبسطة',
      'King Fahd Road, Riyadh',
      'VAT No. 300000000000003',
      'Invoice No: INV-2026-0042',
      'التاريخ Invoice Date: 01/03/2026',
      'Samsung 55" TV',
      'Subtotal 2173.04',
      'VAT 15% 325.96',
      'الإجمالي Grand Total 2499.00 ر.س',
      'Paid by mada',
      '2 year warranty',
    )));

    assert.equal(v.totalAmount?.value, 2499);
    assert.equal(v.currency?.value, 'SAR');
    assert.equal(v.purchaseDate?.value, '2026-03-01');
    assert.equal(v.warrantyMonths?.value, 24);
    assert.equal(v.warrantyExpiry, null);
    assert.equal(v.invoiceNumber?.value, 'INV-2026-0042');
    assert.equal(v.paymentMethod?.value, 'mada');
    assert.equal(v.purchaseType, 'product');
    assert.ok(v.merchantName && /Jarir/.test(v.merchantName.value));
    assert.ok((v.totalAmount?.confidence ?? 0) >= CONFIDENCE_FLOOR);
  });

  test('a blank or unreadable transcript yields nothing rather than invention', () => {
    const v = validate(detectCandidates(blocks('', '   ', '???')));
    assert.equal(v.totalAmount, null);
    assert.equal(v.purchaseDate, null);
    assert.equal(v.warrantyMonths, null);
    assert.equal(v.purchaseType, 'unknown');
  });
});
