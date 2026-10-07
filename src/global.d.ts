import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';

// Types every t('…') key against messages/en, so a typo fails tsc.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
