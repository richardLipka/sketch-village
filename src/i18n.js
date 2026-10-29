import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import cs from './locales/cs.json';
import en from './locales/en.json';

const LANG_KEY = 'sv:language';

function storedLanguage() {
  try {
    return localStorage.getItem(LANG_KEY) || 'cs';
  } catch {
    return 'cs';
  }
}

i18n.use(initReactI18next).init({
  resources: { cs: { translation: cs }, en: { translation: en } },
  lng: storedLanguage(),
  fallbackLng: 'cs',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  try { localStorage.setItem(LANG_KEY, lng); } catch { /* private mode */ }
  document.documentElement.lang = lng;
});

export default i18n;
