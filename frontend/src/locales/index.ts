import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './zh-CN.json';
import enUS from './en-US.json';

/**
 * Initialize i18next with Chinese and English support.
 * Language preference is persisted via Zustand store and localStorage.
 */
i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
    'en-US': { translation: enUS },
  },
  lng: localStorage.getItem('ecomind-app-storage')
    ? JSON.parse(localStorage.getItem('ecomind-app-storage')!).state?.locale || 'zh-CN'
    : 'zh-CN',
  fallbackLng: 'zh-CN',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
