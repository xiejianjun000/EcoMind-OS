import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './zh-CN.json';
import enUS from './en-US.json';

/**
 * Initialize i18next with Chinese and English support.
 * Language preference is persisted via Zustand store and localStorage.
 */
const getStoredLocale = (): string => {
  try {
    const stored = localStorage.getItem('ecomind-app-storage');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.locale || 'zh-CN';
    }
  } catch {
    // ignore parse errors
  }
  return 'zh-CN';
};

i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
    'en-US': { translation: enUS },
  },
  lng: getStoredLocale(),
  fallbackLng: 'zh-CN',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
