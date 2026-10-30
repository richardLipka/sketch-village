import React from 'react';
import { useTranslation } from 'react-i18next';

// 🔍 a filter for a list: by name and description (ui/search.js).
export default function SearchBox({ value, onChange, count }) {
  const { t } = useTranslation();
  return (
    <label className="search-box">
      <span aria-hidden="true">🔍</span>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={t('search.placeholder')} aria-label={t('search.label')} />
      {value && <button type="button" className="btn icon" onClick={() => onChange('')} title={t('search.clear')}>✕</button>}
      {value && count !== undefined && <span className="small muted">{t('search.found', { count })}</span>}
    </label>
  );
}
