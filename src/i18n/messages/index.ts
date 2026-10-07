import type { Locale } from '../config';
import type { Messages } from './en';

/** Only the active language is loaded on each request. */
const loaders: Record<Locale, () => Promise<{ default: Messages }>> = {
  en: () => import('./en'),
  hi: () => import('./hi'),
  bn: () => import('./bn'),
};

export async function loadMessages(locale: Locale): Promise<Messages> {
  return (await loaders[locale]()).default;
}
