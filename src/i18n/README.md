# Translations (en, hi, bn)

The portal uses [next-intl](https://next-intl.dev) with no language in the URL.

## Which language a page renders in

1. The person's own choice on this device: the `sms_locale` cookie, set from the language picker in the top bar or on the sign-in card.
2. Otherwise, the school's language: `school.defaultLanguage` in sms-backend. The school's super admin sets it in Settings → System, and hub admins set it in the school's profile in Colegio Hub. The server reads it from `GET /school/language` and caches it for 60 seconds (`school-locale.ts`). A save from Settings clears that cache.
3. Otherwise, English.

## Using it

```tsx
const t = useTranslations("fees");          // client component
const t = await getTranslations("fees");    // server component
t("dueOn", { date })                         // "Due on {date}"
t.rich("headline", { em: (c) => <span>{c}</span> })   // "...<em>in one place.</em>"
```

Keys are typed against `messages/en`, so a typo fails `tsc`.

## Adding text

- Add the key to `messages/en/<ns>.json`, then to `hi/` and `bn/`. `tsc` fails until all three have it.
- A new namespace is a new `<ns>.json` in all three folders, listed in each folder's `index.ts`.
- A new sidebar item needs `nav.item.<id>`, because `NavItem.id` is typed against those keys.

## Writing the Hindi and Bengali

- Write whole sentences with `{placeholders}`. Never build a sentence by joining translated pieces: Hindi and Bengali put the verb last, so the word order differs from English.
- Address the reader respectfully: आप (hi), আপনি (bn). Buttons are short imperatives: सहेजें, সংরক্ষণ করুন.
- Keep everyday loanwords people actually use (ऑनलाइन, QR, OTP, AI, HR) rather than inventing a formal word for them.
- Digits stay Latin in every language. In code, format with `INTL_LOCALE[locale]` (never a bare `toLocaleString('bn')`). Inside messages, plural `#`, `{n, number}` and `{d, date}` are safe too: `latin-digits.ts` makes Bengali `Intl` formatters default to Latin digits.
- Content people type (names, circulars, homework) is never translated.

| English | हिन्दी | বাংলা |
|---|---|---|
| Student | विद्यार्थी | ছাত্রছাত্রী |
| Staff | स्टाफ़ | কর্মী |
| Parent | अभिभावक | অভিভাবক |
| Class | कक्षा | শ্রেণি |
| Attendance | उपस्थिति | উপস্থিতি |
| Fees | फ़ीस | ফি |
| Examination | परीक्षा | পরীক্ষা |
| Homework | गृहकार्य | বাড়ির কাজ |
| Leave | छुट्टी | ছুটি |
| Circular | परिपत्र | সার্কুলার |
| Enrollment | नामांकन | ভর্তি |
| Mark sheet | अंक-पत्र | মার্কশিট |
| Receipt | रसीद | রসিদ |
| Principal | प्रधानाचार्य | প্রধান শিক্ষক |
| Section | सेक्शन | সেকশন |
| Roll number | रोल नंबर | রোল নম্বর |
| Admission | प्रवेश | ভর্তি |
| Admission number | प्रवेश संख्या | ভর্তি নম্বর |
| Guardian | संरक्षक | অভিভাবক (গার্জেন) |
| Academic session | शैक्षणिक सत्र | শিক্ষাবর্ষ |
| Term | सत्र | টার্ম |
| Marks | अंक | নম্বর |
| Grade | ग्रेड | গ্রেড |
| Result | परिणाम | ফলাফল |
| Report card | रिपोर्ट कार्ड | রিপোর্ট কার্ড |
| Timetable | समय-सारणी | রুটিন |
| Class teacher | कक्षा शिक्षक | শ্রেণি শিক্ষক |
| Designation | पद | পদবি |
| Department | विभाग | বিভাগ |
| Salary | वेतन | বেতন |
| Salary slip | वेतन पर्ची | বেতন স্লিপ |
| Payroll | पेरोल | পেরোল |
| Deduction | कटौती | কর্তন |
| Allowance | भत्ता | ভাতা |
| Leave balance | शेष छुट्टियाँ | অবশিষ্ট ছুটি |
| Leave request | छुट्टी का अनुरोध | ছুটির আবেদন |
| Check-in / check-out | चेक-इन / चेक-आउट | চেক-ইন / চেক-আউট |
| Due (amount) | बकाया | বকেয়া |
| Due date | देय तिथि | শেষ তারিখ |
| Discount | छूट | ছাড় |
| Late fee | विलंब शुल्क | বিলম্ব ফি |
| Refund | रिफ़ंड | রিফান্ড |
| Payment | भुगतान | পেমেন্ট |
| Fee structure | फ़ीस संरचना | ফি কাঠামো |
| Collect (fees) | फ़ीस जमा करें | ফি জমা নিন |
| Visitor | आगंतुक | দর্শনার্থী |
| Pickup | पिकअप | পিকআপ |
| Gate | गेट | গেট |
| Book (library) | पुस्तक | বই |
| Issue / return (book) | जारी करें / वापस लें | ইস্যু / ফেরত |
| Fine | जुर्माना | জরিমানা |
| Stock | स्टॉक | স্টক |
| Item | वस्तु | আইটেম |
| Sale | बिक्री | বিক্রি |
| Category | श्रेणी | বিভাগ |
| Notice / announcement | सूचना | নোটিশ |
| Activity / event | गतिविधि | কার্যক্রম |
| Winner / participant | विजेता / प्रतिभागी | বিজয়ী / অংশগ্রহণকারী |
| Document | दस्तावेज़ | নথি |
| Upload | अपलोड | আপলোড |

## Not translated (on purpose)

- Documents: PDFs (receipts, results, salary slips, ID cards, exam schedules, AI tool downloads, inventory labels and reports), the printable receipt HTML and the printed face of the ID card. The PDF libraries do not join Devanagari or Bengali letters correctly.
- Text written by sms-backend: error messages and system-generated notifications (holiday announcements, the fee-reminder text sent to parents). They arrive in English.
- Data people enter (names, classes, designations, leave types, circular text) and CSV export headers.

Date pickers are translated: month and day names come from dayjs, button text from MUI (Bengali) and `mui-pickers-hi.ts` (Hindi).

## Helpers in src/lib that produce text

Return a `HelperMessage` (`src/i18n/helper-message.ts`) — a `common.helper` key plus values — instead of English, and show it with `useHelperMessage()`. Examples: `fixErrorMessage` (geolocation), `boundaryProblem` / `areaMessage` (geo-boundary), `attendanceSettingsProblem`, `PhotoError` (photo-pipeline).
