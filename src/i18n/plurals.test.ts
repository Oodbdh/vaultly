import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import i18next, { type i18n as I18n } from 'i18next';

/**
 * Regression tests for the warranty-duration labels.
 *
 * The reported "1 month shows 184 days" bug was not date arithmetic at all:
 * `warranty.months` shipped no Arabic plural forms, so i18next fell back to the
 * base key — a hardcoded "شهر واحد" ("one month") with no {{count}} — and the
 * SIX-month chip was labelled "one month". Tapping it stored 6 months.
 *
 * Arabic under compatibilityJSON v3 needs all six CLDR forms
 * (_0 zero, _1 one, _2 two, _3 few 3-10, _4 many 11-99, _5 other).
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const load = (code: string) =>
  JSON.parse(fs.readFileSync(path.join(here, 'locales', `${code}.json`), 'utf8'));

const LOCALES = ['en', 'ar', 'es', 'fr', 'de'] as const;

async function makeI18n(lng: string): Promise<I18n> {
  const inst = i18next.createInstance();
  await inst.init({
    lng,
    fallbackLng: 'en',
    resources: Object.fromEntries(LOCALES.map((c) => [c, { translation: load(c) }])),
    compatibilityJSON: 'v3', // matches src/i18n/index.ts
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return inst;
}

/** Arabic-Indic digits, so a count can be found in a localised string. */
function toArabicDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);
}

function containsCount(text: string, n: number): boolean {
  return text.includes(String(n)) || text.includes(toArabicDigits(n));
}

describe('warranty duration labels carry their count', () => {
  for (const lng of LOCALES) {
    it(`${lng}: every month count renders its own number`, async () => {
      const t = (await makeI18n(lng)).t;
      // 1 and 2 are exempt: languages with singular and dual forms express
      // those in words — Arabic's "شهران" (two months) carries no numeral, and
      // that is correct grammar, not a missing interpolation.
      for (const count of [3, 6, 12, 18, 24, 36]) {
        const label = t('warranty.months', { count });
        assert.ok(
          containsCount(label, count),
          `${lng} warranty.months count=${count} rendered "${label}" without the number`,
        );
      }
    });

    it(`${lng}: 1, 2 and 6 months are three different labels`, async () => {
      const t = (await makeI18n(lng)).t;
      const labels = [1, 2, 6].map((count) => t('warranty.months', { count }));
      assert.equal(
        new Set(labels).size,
        3,
        `${lng}: expected three distinct labels, got ${JSON.stringify(labels)}`,
      );
    });

    it(`${lng}: distinct counts produce distinct labels`, async () => {
      const t = (await makeI18n(lng)).t;
      const six = t('warranty.months', { count: 6 });
      const one = t('warranty.months', { count: 1 });
      assert.notEqual(six, one, `${lng}: 6 months and 1 month render identically ("${six}")`);
    });
  }

  it('ar: the exact bug — 6 months must not read as "one month"', async () => {
    const t = (await makeI18n('ar')).t;
    const six = t('warranty.months', { count: 6 });
    assert.notEqual(six, 'شهر واحد');
    assert.ok(containsCount(six, 6), `expected the numeral 6, got "${six}"`);
  });

  it('ar: ships all six CLDR plural forms for every duration unit', () => {
    const ar = load('ar');
    for (const unit of ['days', 'months', 'years']) {
      for (let form = 0; form <= 5; form++) {
        assert.ok(
          `${unit}_${form}` in ar.warranty,
          `ar.json is missing warranty.${unit}_${form}`,
        );
      }
    }
  });

  it('ar: no duration key falls back to a bare singular without {{count}}', () => {
    const ar = load('ar');
    // The few/many/other forms describe more than one, so each must interpolate.
    for (const unit of ['days', 'months', 'years']) {
      for (const form of [3, 4, 5]) {
        const value = ar.warranty[`${unit}_${form}`] as string;
        assert.ok(
          value.includes('{{count}}'),
          `ar warranty.${unit}_${form} = "${value}" has no {{count}} placeholder`,
        );
      }
    }
  });
});

describe('day and year units exist in every locale', () => {
  for (const lng of LOCALES) {
    it(`${lng}: days and years resolve`, async () => {
      const t = (await makeI18n(lng)).t;
      for (const count of [1, 5, 30]) {
        for (const unit of ['days', 'years']) {
          const label = t(`warranty.${unit}`, { count });
          assert.ok(label && !label.startsWith('warranty.'), `${lng} warranty.${unit} unresolved`);
        }
      }
    });
  }
});
