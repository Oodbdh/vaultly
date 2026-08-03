/**
 * Long-form support content: FAQ, privacy policy and terms.
 *
 * Kept out of `src/i18n/locales/*.json` on purpose — those files are for UI
 * strings, and dropping several thousand words of prose into them makes both
 * the translations and this text harder to maintain. Locales that aren't
 * translated here fall back to English, matching i18next's `fallbackLng`.
 *
 * ⚠️ The legal documents are a good-faith description of what this app
 * actually does — they are NOT a substitute for review by a qualified lawyer,
 * and the bracketed placeholders must be filled in before publishing. See
 * README → "Support content".
 */

export type SupportLocale = 'en' | 'ar';

export type FaqEntry = { q: string; a: string };

export type LegalSection = { heading: string; body: string };

export type LegalDoc = {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
};

/** Narrows any app locale to one we have prose for. */
export function contentLocale(locale: string): SupportLocale {
  return locale.startsWith('ar') ? 'ar' : 'en';
}

/**
 * Filled into the documents so the operator name lives in exactly one place.
 *
 * Vaultly is operated by an individual, not a company, so this is a personal
 * legal name and it reads identically in the English and Arabic documents. If
 * an Arabic form of the name is ever wanted for the `ar` locale, it has to come
 * from the operator — transliterating a legal name is not ours to guess.
 */
export const LEGAL_ENTITY = 'Adi Mousa Alfaifi';
export const LEGAL_JURISDICTION_EN = 'the Kingdom of Saudi Arabia';
export const LEGAL_JURISDICTION_AR = 'المملكة العربية السعودية';
export const LEGAL_UPDATED = '2026-07-29';

// ── FAQ ─────────────────────────────────────────────────────────────────────

export const FAQ: Record<SupportLocale, FaqEntry[]> = {
  en: [
    {
      q: 'What does Vaultly do?',
      a: 'Vaultly keeps your receipts, warranties and subscriptions in one place and tells you before something matters — a warranty about to lapse, a subscription about to renew. Scan a receipt and Vaultly reads the merchant, total, date and warranty term for you.',
    },
    {
      q: 'How does receipt scanning work?',
      a: 'You photograph the receipt, and it is sent to our server, which asks an AI model to read the printed fields. Nothing is saved until you review the result: every field stays editable on the confirmation step, and you can re-scan or type the details in by hand.',
    },
    {
      q: 'How accurate is the scanning?',
      a: 'Usually good on clear, flat, well-lit receipts, and less reliable on faded thermal paper, creases or glare. Vaultly reports its own confidence and warns you when it is low. Always check the total and the dates before saving — treat the scan as a first draft, not a source of truth.',
    },
    {
      q: 'Who can see my receipts?',
      a: 'Only you. Every row and every image is tied to your user id and protected by database-level access rules, so one account cannot read another account\'s data. Receipt images sit in a private storage bucket and are served through short-lived links that expire.',
    },
    {
      q: 'How many items can I store for free?',
      a: 'Four. You can unlock one extra slot for 24 hours by watching a short video, up to two extra slots at a time. Vaultly Premium removes the limit entirely.',
    },
    {
      q: 'What do I get with Vaultly Premium?',
      a: 'Unlimited items and no ads, for SAR 10 per month. It renews monthly through your app store, and you can cancel there at any time — you keep Premium until the end of the period you have paid for.',
    },
    {
      q: 'How do the reminders work?',
      a: 'Vaultly schedules reminders on your device 30 days, 7 days and 1 day before a warranty expires, and 3 days and 1 day before a subscription renews. They are local to your phone, so they work without a network connection.',
    },
    {
      q: 'How is a warranty end date calculated?',
      a: 'By the calendar, not by counting days. A 12-month warranty bought on 31 January ends on 31 January the following year, and a 1-month warranty bought on 31 January ends on 28 February — or 29 February in a leap year. You can also enter an exact end date if the receipt prints one.',
    },
    {
      q: 'Can I use Vaultly in Arabic?',
      a: 'Yes. Vaultly ships in English, Arabic, Spanish, French and German. Arabic runs fully right-to-left — the whole layout mirrors, not just the text. Switch language from Profile, under Preferences.',
    },
    {
      q: 'What happens to my data if I delete my account?',
      a: 'Your items, warranties, subscriptions and receipt images are deleted along with the account. Deletion is permanent and cannot be undone, so export anything you want to keep first.',
    },
  ],
  ar: [
    {
      q: 'ما الذي يقدّمه فولتلي؟',
      a: 'يحفظ فولتلي فواتيرك وضماناتك واشتراكاتك في مكان واحد، وينبّهك قبل أن يفوتك شيء — ضمان يوشك على الانتهاء، أو اشتراك على وشك التجديد. امسح الفاتورة وسيقرأ فولتلي اسم المتجر والمبلغ والتاريخ ومدة الضمان نيابةً عنك.',
    },
    {
      q: 'كيف يعمل مسح الفواتير؟',
      a: 'تلتقط صورة للفاتورة، فتُرسل إلى خادمنا الذي يطلب من نموذج ذكاء اصطناعي قراءة الحقول المطبوعة. لا يُحفظ شيء قبل مراجعتك: تبقى كل الحقول قابلة للتعديل في خطوة التأكيد، ويمكنك إعادة المسح أو إدخال التفاصيل يدويًا.',
    },
    {
      q: 'ما مدى دقة المسح؟',
      a: 'جيدة عادةً مع الفواتير الواضحة والمستوية وذات الإضاءة الجيدة، وأقل موثوقية مع الورق الحراري الباهت أو التجعّد أو انعكاس الضوء. يعرض فولتلي درجة ثقته وينبّهك عندما تكون منخفضة. تحقّق دائمًا من المبلغ والتواريخ قبل الحفظ — اعتبر المسح مسوّدة أولى لا مصدرًا نهائيًا.',
    },
    {
      q: 'من يستطيع الاطلاع على فواتيري؟',
      a: 'أنت فقط. كل سجل وكل صورة مرتبط بمعرّف حسابك ومحمي بقواعد وصول على مستوى قاعدة البيانات، فلا يستطيع حساب قراءة بيانات حساب آخر. تُحفظ صور الفواتير في مساحة تخزين خاصة وتُعرض عبر روابط قصيرة الأجل تنتهي صلاحيتها.',
    },
    {
      q: 'كم عنصرًا يمكنني حفظه مجانًا؟',
      a: 'أربعة. يمكنك فتح خانة إضافية لمدة ٢٤ ساعة بمشاهدة مقطع قصير، بحد أقصى خانتين إضافيتين في الوقت نفسه. أما اشتراك فولتلي بريميوم فيلغي هذا الحد تمامًا.',
    },
    {
      q: 'ماذا أستفيد من فولتلي بريميوم؟',
      a: 'عناصر بلا حدود وبدون إعلانات، مقابل ١٠ ر.س شهريًا. يتجدد شهريًا عبر متجر التطبيقات، ويمكنك الإلغاء من هناك في أي وقت — ويبقى الاشتراك ساريًا حتى نهاية المدة المدفوعة.',
    },
    {
      q: 'كيف تعمل التذكيرات؟',
      a: 'يجدول فولتلي تذكيرات على جهازك قبل ٣٠ يومًا و٧ أيام ويوم واحد من انتهاء الضمان، وقبل ٣ أيام ويوم واحد من تجديد الاشتراك. وهي محلية على هاتفك، فتعمل بدون اتصال بالإنترنت.',
    },
    {
      q: 'كيف يُحتسب تاريخ انتهاء الضمان؟',
      a: 'بالتقويم لا بعدّ الأيام. ضمان ١٢ شهرًا اشتريته في ٣١ يناير ينتهي في ٣١ يناير من العام التالي، وضمان شهر واحد اشتريته في ٣١ يناير ينتهي في ٢٨ فبراير — أو ٢٩ فبراير في السنة الكبيسة. ويمكنك أيضًا إدخال تاريخ انتهاء محدد إذا كان مطبوعًا على الفاتورة.',
    },
    {
      q: 'هل يمكنني استخدام فولتلي بالعربية؟',
      a: 'نعم. يتوفر فولتلي بالإنجليزية والعربية والإسبانية والفرنسية والألمانية. وتعمل العربية من اليمين إلى اليسار بالكامل — إذ ينعكس التصميم كله لا النص وحده. يمكنك تغيير اللغة من الملف الشخصي ضمن التفضيلات.',
    },
    {
      q: 'ماذا يحدث لبياناتي إذا حذفت حسابي؟',
      a: 'تُحذف عناصرك وضماناتك واشتراكاتك وصور فواتيرك مع الحساب. الحذف نهائي ولا يمكن التراجع عنه، لذا صدّر ما تريد الاحتفاظ به أولًا.',
    },
  ],
};

// ── Privacy policy ──────────────────────────────────────────────────────────

export const PRIVACY: Record<SupportLocale, LegalDoc> = {
  en: {
    title: 'Privacy Policy',
    updated: LEGAL_UPDATED,
    intro:
      `This policy explains what Vaultly collects, why, and what you can do about it. It describes the app as it actually works. Vaultly is operated by ${LEGAL_ENTITY}.`,
    sections: [
      {
        heading: 'What we collect',
        body: 'Your email address and password, handled by our authentication provider — we never see the password itself. The items you create: merchant or product name, amounts, purchase and expiry dates, categories and notes. Any receipt images you choose to upload. Your language preference. A device notification token, if you allow reminders.',
      },
      {
        heading: 'What we do not collect',
        body: 'We do not ask for your payment card details, national ID, or address. We do not track your location. We do not read your contacts, photo library, or other apps. The camera is used only when you open the scanner, and only for the frame you capture.',
      },
      {
        heading: 'Where your data is stored',
        body: 'In a managed Postgres database and private object storage. Every table enforces row-level rules tied to your user id, so your rows are unreachable from any other account. Receipt images are stored in a private bucket under a folder keyed to your user id and are retrieved through signed links that expire shortly after they are issued.',
      },
      {
        heading: 'Receipt scanning and AI',
        body: 'When you scan a receipt, the image is sent to our server, which forwards it to an AI provider to extract the printed fields, and returns the result to your device. The API key stays on our server and never ships inside the app. We do not keep a separate copy of the image for this purpose, and the provider we use does not train its models on data submitted through their API. If you would rather not have an image processed this way, enter the details manually instead.',
      },
      {
        heading: 'Purchases and ads',
        body: 'Premium subscriptions are processed by your app store through a subscription management service, which tells us only whether your subscription is active. We never receive your card details. On the free tier, rewarded video ads are supplied by an advertising network; Vaultly requests non-personalised ads. Premium removes advertising entirely.',
      },
      {
        heading: 'How long we keep it',
        body: 'Your data stays until you delete it. Deleting an item removes it and its receipt image. Deleting your account removes your profile and everything attached to it. Deletion is permanent.',
      },
      {
        heading: 'Your rights',
        body: 'You can view and edit everything you have stored from inside the app, and delete any of it at any time. Depending on where you live you may also have the right to request a copy of your data or object to its processing. Write to us and we will help.',
      },
      {
        heading: 'Children',
        body: 'Vaultly is not directed at children under 13, and we do not knowingly collect their data. If you believe a child has created an account, contact us and we will remove it.',
      },
      {
        heading: 'Changes',
        body: 'If this policy changes in a way that materially affects you, we will say so in the app before the change takes effect. The date above always reflects the current version.',
      },
      {
        heading: 'Contact',
        body: 'Questions about privacy, or a request about your data, can be sent to the support address in Profile → Support → Contact support.',
      },
    ],
  },
  ar: {
    title: 'سياسة الخصوصية',
    updated: LEGAL_UPDATED,
    intro:
      `توضّح هذه السياسة ما الذي يجمعه فولتلي ولماذا وما الذي يمكنك فعله حياله، وتصف التطبيق كما يعمل فعليًا. يُشغَّل فولتلي من قِبل ${LEGAL_ENTITY}.`,
    sections: [
      {
        heading: 'ما الذي نجمعه',
        body: 'بريدك الإلكتروني وكلمة المرور، ويتولاهما مزوّد المصادقة لدينا — ولا نطّلع على كلمة المرور نفسها. والعناصر التي تنشئها: اسم المتجر أو المنتج، والمبالغ، وتواريخ الشراء والانتهاء، والفئات والملاحظات. وأي صور فواتير تختار رفعها. وتفضيل اللغة لديك. ورمز إشعارات للجهاز إذا سمحت بالتذكيرات.',
      },
      {
        heading: 'ما الذي لا نجمعه',
        body: 'لا نطلب بيانات بطاقتك البنكية أو هويتك الوطنية أو عنوانك. ولا نتتبّع موقعك. ولا نقرأ جهات اتصالك أو مكتبة صورك أو تطبيقاتك الأخرى. وتُستخدم الكاميرا فقط عند فتحك الماسح، ولللقطة التي تلتقطها وحدها.',
      },
      {
        heading: 'أين تُحفظ بياناتك',
        body: 'في قاعدة بيانات Postgres مُدارة وتخزين خاص للملفات. تفرض كل الجداول قواعد وصول على مستوى الصف مرتبطة بمعرّف حسابك، فتكون سجلاتك غير قابلة للوصول من أي حساب آخر. وتُحفظ صور الفواتير في مساحة خاصة داخل مجلد باسم معرّف حسابك، وتُسترجع عبر روابط موقّعة تنتهي صلاحيتها بعد وقت قصير.',
      },
      {
        heading: 'مسح الفواتير والذكاء الاصطناعي',
        body: 'عند مسح فاتورة، تُرسل الصورة إلى خادمنا الذي يمرّرها إلى مزوّد ذكاء اصطناعي لاستخراج الحقول المطبوعة، ثم يعيد النتيجة إلى جهازك. ويبقى مفتاح الواجهة البرمجية على خادمنا ولا يُشحن داخل التطبيق إطلاقًا. ولا نحتفظ بنسخة منفصلة من الصورة لهذا الغرض، ولا يستخدم المزوّد الذي نتعامل معه البيانات المُرسلة عبر واجهته في تدريب نماذجه. وإذا كنت تفضّل عدم معالجة صورة بهذه الطريقة، فأدخل التفاصيل يدويًا.',
      },
      {
        heading: 'المشتريات والإعلانات',
        body: 'تُعالَج اشتراكات بريميوم عبر متجر التطبيقات من خلال خدمة لإدارة الاشتراكات، تُعلمنا فقط بما إذا كان اشتراكك ساريًا. ولا نستلم بيانات بطاقتك مطلقًا. وفي الباقة المجانية، تُقدَّم إعلانات الفيديو المكافئة عبر شبكة إعلانية، ويطلب فولتلي إعلانات غير مُخصّصة. ويلغي بريميوم الإعلانات تمامًا.',
      },
      {
        heading: 'مدة الاحتفاظ',
        body: 'تبقى بياناتك حتى تحذفها. يؤدي حذف عنصر إلى إزالته مع صورة فاتورته. ويؤدي حذف حسابك إلى إزالة ملفك الشخصي وكل ما يرتبط به. والحذف نهائي.',
      },
      {
        heading: 'حقوقك',
        body: 'يمكنك عرض وتعديل كل ما حفظته من داخل التطبيق، وحذف أي منه في أي وقت. وقد يكون لك أيضًا — بحسب مكان إقامتك — الحق في طلب نسخة من بياناتك أو الاعتراض على معالجتها. راسلنا وسنساعدك.',
      },
      {
        heading: 'الأطفال',
        body: 'فولتلي غير موجّه للأطفال دون سن الثالثة عشرة، ولا نجمع بياناتهم عن علم. وإذا كنت تعتقد أن طفلًا أنشأ حسابًا، فتواصل معنا وسنزيله.',
      },
      {
        heading: 'التغييرات',
        body: 'إذا تغيّرت هذه السياسة بما يؤثر عليك جوهريًا، فسننبّهك داخل التطبيق قبل سريان التغيير. ويعكس التاريخ أعلاه النسخة الحالية دائمًا.',
      },
      {
        heading: 'التواصل',
        body: 'يمكن إرسال الأسئلة المتعلقة بالخصوصية أو طلبات البيانات إلى عنوان الدعم من الملف الشخصي ← المساعدة والدعم ← تواصل مع الدعم.',
      },
    ],
  },
};

// ── Terms of service ────────────────────────────────────────────────────────

export const TERMS: Record<SupportLocale, LegalDoc> = {
  en: {
    title: 'Terms of Service',
    updated: LEGAL_UPDATED,
    intro:
      `These terms govern your use of Vaultly, operated by ${LEGAL_ENTITY}. By creating an account you agree to them.`,
    sections: [
      {
        heading: 'What Vaultly is',
        body: 'A personal record-keeping tool for receipts, warranties and subscriptions. It is not an accounting system, a legal service, or financial advice, and it does not act on your behalf with any merchant, manufacturer or insurer.',
      },
      {
        heading: 'Your account',
        body: 'You need a valid email address, and you are responsible for keeping your credentials secure and for activity under your account. You must be at least 13 years old. Tell us promptly if you believe your account has been accessed by someone else.',
      },
      {
        heading: 'Scanning is assistance, not a guarantee',
        body: 'Vaultly uses automated extraction to read receipts. It can misread amounts, dates and warranty terms, particularly on faded or damaged paper. You are responsible for checking what is saved. Vaultly is not liable for a missed warranty claim, a renewal you did not expect, or any other loss arising from an incorrect or missing reminder — reminders are a convenience, and delivery depends on your device and its settings.',
      },
      {
        heading: 'Free tier and Premium',
        body: 'The free tier stores up to four items, extendable by watching rewarded video. Premium costs SAR 10 per month, removes the limit and removes ads. Billing is handled by your app store and renews automatically until you cancel. Cancel through the store; access continues to the end of the paid period. Refunds follow the policy of the store you purchased through.',
      },
      {
        heading: 'Acceptable use',
        body: 'Do not upload content you have no right to upload, attempt to reach another user\'s data, disrupt or overload the service, probe it for vulnerabilities without permission, or use automated means to extract data in bulk. We may suspend accounts that do.',
      },
      {
        heading: 'Your content',
        body: 'Your receipts and the data you enter remain yours. You grant us only the permission needed to run the service: to store your content, and to transmit receipt images for automated extraction when you ask for a scan. We do not sell your content, and we do not use it to advertise to you.',
      },
      {
        heading: 'Availability',
        body: 'We aim to keep Vaultly running but do not promise uninterrupted service. Features may change, and parts that depend on third parties — the app stores, the AI provider, the advertising network — may be unavailable at times. We may discontinue the service with reasonable notice.',
      },
      {
        heading: 'Ending your use',
        body: 'You may delete your account at any time from Profile. We may suspend or close an account that breaches these terms or that we are legally required to close. On closure, your data is deleted as described in the Privacy Policy.',
      },
      {
        heading: 'Liability',
        body: 'To the extent the law allows, Vaultly is provided as-is, and we are not liable for indirect or consequential loss, lost profits, or loss of data beyond what we can restore. Nothing here limits liability that cannot lawfully be limited.',
      },
      {
        heading: 'Changes to these terms',
        body: 'We may update these terms. If a change materially affects your rights, we will notify you in the app before it takes effect. Continuing to use Vaultly afterwards means you accept the updated terms.',
      },
      {
        heading: 'Governing law',
        body: `These terms are governed by the laws of ${LEGAL_JURISDICTION_EN}, and disputes fall to the courts of that jurisdiction, without affecting any mandatory protection you have under the law of your country of residence.`,
      },
    ],
  },
  ar: {
    title: 'شروط الاستخدام',
    updated: LEGAL_UPDATED,
    intro:
      `تحكم هذه الشروط استخدامك لفولتلي، الذي يُشغَّل من قِبل ${LEGAL_ENTITY}. وبإنشائك حسابًا فإنك توافق عليها.`,
    sections: [
      {
        heading: 'ما هو فولتلي',
        body: 'أداة شخصية لحفظ سجلات الفواتير والضمانات والاشتراكات. وهو ليس نظامًا محاسبيًا ولا خدمة قانونية ولا استشارة مالية، ولا يتصرف نيابةً عنك لدى أي متجر أو مُصنّع أو شركة تأمين.',
      },
      {
        heading: 'حسابك',
        body: 'تحتاج إلى بريد إلكتروني صالح، وأنت مسؤول عن حماية بيانات دخولك وعن النشاط الذي يجري عبر حسابك. ويجب ألا يقل عمرك عن ثلاثة عشر عامًا. أبلغنا فورًا إذا اعتقدت أن شخصًا آخر قد وصل إلى حسابك.',
      },
      {
        heading: 'المسح مساعدة لا ضمان',
        body: 'يستخدم فولتلي استخراجًا آليًا لقراءة الفواتير، وقد يخطئ في المبالغ والتواريخ ومدد الضمان، خصوصًا مع الورق الباهت أو التالف. وأنت المسؤول عن التحقق مما يُحفظ. ولا يتحمل فولتلي مسؤولية مطالبة ضمان فائتة أو تجديد لم تتوقعه أو أي خسارة أخرى ناتجة عن تذكير خاطئ أو غير واصل — فالتذكيرات ميزة مساعدة، ويعتمد وصولها على جهازك وإعداداته.',
      },
      {
        heading: 'الباقة المجانية وبريميوم',
        body: 'تحفظ الباقة المجانية حتى أربعة عناصر، ويمكن توسيعها بمشاهدة فيديو مكافئ. ويكلّف بريميوم ١٠ ر.س شهريًا، ويلغي الحد والإعلانات. وتُدار الفوترة عبر متجر التطبيقات وتتجدد تلقائيًا حتى تلغيها. ويتم الإلغاء من المتجر، ويستمر وصولك حتى نهاية المدة المدفوعة. أما الاستردادات فتخضع لسياسة المتجر الذي اشتريت منه.',
      },
      {
        heading: 'الاستخدام المقبول',
        body: 'لا ترفع محتوى لا تملك حق رفعه، ولا تحاول الوصول إلى بيانات مستخدم آخر، ولا تعطّل الخدمة أو تُثقلها، ولا تفحصها بحثًا عن ثغرات دون إذن، ولا تستخدم وسائل آلية لاستخراج البيانات بالجملة. وقد نوقف الحسابات المخالفة.',
      },
      {
        heading: 'محتواك',
        body: 'تبقى فواتيرك والبيانات التي تدخلها ملكًا لك. وتمنحنا فقط الإذن اللازم لتشغيل الخدمة: حفظ محتواك، ونقل صور الفواتير للاستخراج الآلي عندما تطلب المسح. ولا نبيع محتواك ولا نستخدمه لعرض إعلانات موجّهة إليك.',
      },
      {
        heading: 'توفر الخدمة',
        body: 'نسعى لإبقاء فولتلي يعمل، لكننا لا نَعِد بخدمة دون انقطاع. وقد تتغير الميزات، وقد تتعطل أحيانًا الأجزاء المعتمدة على أطراف أخرى — متاجر التطبيقات، ومزوّد الذكاء الاصطناعي، والشبكة الإعلانية. وقد نوقف الخدمة بإشعار معقول.',
      },
      {
        heading: 'إنهاء الاستخدام',
        body: 'يمكنك حذف حسابك في أي وقت من الملف الشخصي. وقد نوقف أو نغلق حسابًا يخالف هذه الشروط أو يُلزمنا القانون بإغلاقه. وعند الإغلاق تُحذف بياناتك وفق ما هو موضّح في سياسة الخصوصية.',
      },
      {
        heading: 'المسؤولية',
        body: 'بالقدر الذي يسمح به القانون، يُقدَّم فولتلي كما هو، ولا نتحمل المسؤولية عن الخسائر غير المباشرة أو التبعية أو الأرباح الفائتة أو فقدان بيانات يتجاوز ما يمكننا استعادته. ولا يحدّ أي مما ورد هنا من مسؤولية لا يجوز قانونًا الحد منها.',
      },
      {
        heading: 'تعديل الشروط',
        body: 'قد نحدّث هذه الشروط. وإذا أثّر تغيير جوهريًا على حقوقك، فسنُشعرك داخل التطبيق قبل سريانه. ويعني استمرارك في استخدام فولتلي بعد ذلك قبولك للشروط المحدّثة.',
      },
      {
        heading: 'القانون الحاكم',
        body: `تخضع هذه الشروط لأنظمة ${LEGAL_JURISDICTION_AR}، وتختص محاكمها بالنزاعات، دون الإخلال بأي حماية إلزامية تتمتع بها بموجب قانون بلد إقامتك.`,
      },
    ],
  },
};
