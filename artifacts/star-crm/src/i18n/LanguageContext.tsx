import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { translations, LANGUAGE_CONFIGS, type Language } from "./translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "star_crm_language";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "fr" || stored === "ar") return stored;
    } catch {}
    return "en";
  });

  const config = LANGUAGE_CONFIGS.find((c) => c.code === language)!;
  const dir = config.dir;

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, language); } catch {}
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language, dir]);

  function setLanguage(lang: Language) {
    setLanguageState(lang);
  }

  function t(key: string): string {
    const keys = key.split(".");
    let obj: unknown = translations[language];
    for (const k of keys) {
      if (obj == null || typeof obj !== "object") return key;
      obj = (obj as Record<string, unknown>)[k];
    }
    if (typeof obj !== "string") return key;
    return obj;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useTranslation must be used within LanguageProvider");
  return ctx;
}
