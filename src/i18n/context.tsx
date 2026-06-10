import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import enTranslations from "./locales/en.json";
import noTranslations from "./locales/no.json";
import { formatCurrency } from "@/lib/currency";

type Language = "en" | "no";
const LANG_KEY = "app_language";

const translations = { en: enTranslations, no: noTranslations };

const getNestedValue = (obj: any, path: string): string => {
  const keys = path.split(".");
  let value = obj;
  for (const key of keys) {
    if (value && typeof value === "object" && key in value) value = value[key];
    else return path;
  }
  return typeof value === "string" ? value : path;
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  formatPrice: (amount: number) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then(saved => {
      if (saved === "en" || saved === "no") setLanguageState(saved);
    }).catch(() => {});
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem(LANG_KEY, lang).catch(() => {});
  };

  const t = (key: string): string => getNestedValue(translations[language], key);
  const formatPrice = (amount: number): string => formatCurrency(amount, language);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, formatPrice }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
};
