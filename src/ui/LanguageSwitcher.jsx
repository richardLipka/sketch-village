import React from 'react';
import { useTranslation } from 'react-i18next';

const LANGS = [['cs', 'Čeština'], ['en', 'English']];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <div className="row" style={{ gap: 4 }}>
      {LANGS.map(([code, label]) => (
        <button
          key={code}
          className={`tab ${i18n.language === code ? 'on' : ''}`}
          onClick={() => i18n.changeLanguage(code)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
