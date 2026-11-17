import React, { createContext, useContext, useMemo } from 'react';
import { AppLanguage, Translations } from './types';
import { getTranslations, loadSavedLanguage, resolveAppLanguage } from './helpers';

interface I18nContextValue {
  lang: AppLanguage;
  t: Translations;
  setLanguage: (lang: AppLanguage) => void;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'es-LA',
  t: getTranslations('es-LA'),
  setLanguage: () => {}
});

interface LanguageProviderProps {
  language: AppLanguage;
  onChangeLanguage: (lang: AppLanguage) => void;
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  language,
  onChangeLanguage,
  children
}) => {
  const resolvedLang = resolveAppLanguage(language, loadSavedLanguage());
  const value = useMemo<I18nContextValue>(() => ({
    lang: resolvedLang,
    t: getTranslations(resolvedLang),
    setLanguage: onChangeLanguage
  }), [resolvedLang, onChangeLanguage]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

export function useTranslation(): I18nContextValue {
  return useContext(I18nContext);
}
