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
- Digits stay Latin in every language (`INTL_LOCALE` forces this for Bengali).
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

## Not translated yet

- PDFs (receipts, results, salary slips). The PDF libraries do not join Devanagari or Bengali letters correctly.
- Error messages from sms-backend (shown as the server sends them).

Date pickers are translated: month and day names come from dayjs, button text from MUI (Bengali) and `mui-pickers-hi.ts` (Hindi).
