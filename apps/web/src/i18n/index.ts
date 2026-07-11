import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import enAdmin from './locales/en/admin.json';
import enAuth from './locales/en/auth.json';
import enCommon from './locales/en/common.json';
import enRanking from './locales/en/ranking.json';
import enScoring from './locales/en/scoring.json';
import enWorkspace from './locales/en/workspace.json';
import viAdmin from './locales/vi/admin.json';
import viAuth from './locales/vi/auth.json';
import viCommon from './locales/vi/common.json';
import viRanking from './locales/vi/ranking.json';
import viScoring from './locales/vi/scoring.json';
import viWorkspace from './locales/vi/workspace.json';

export const supportedLanguages = ['vi', 'en'] as const;
export type AppLanguage = (typeof supportedLanguages)[number];

export const defaultNS = 'common';
export const namespaces = ['common', 'auth', 'workspace', 'scoring', 'ranking', 'admin'] as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      vi: {
        common: viCommon,
        auth: viAuth,
        workspace: viWorkspace,
        scoring: viScoring,
        ranking: viRanking,
        admin: viAdmin,
      },
      en: {
        common: enCommon,
        auth: enAuth,
        workspace: enWorkspace,
        scoring: enScoring,
        ranking: enRanking,
        admin: enAdmin,
      },
    },
    fallbackLng: 'vi',
    supportedLngs: [...supportedLanguages],
    defaultNS,
    ns: [...namespaces],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'tadscore_lang',
      caches: ['localStorage'],
    },
  });

i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
  }
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language || 'vi';
}

export default i18n;
