import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal.jsx';
import { newId } from '../data/saveFile.js';
import { themeName } from '../config/themes.js';

// Edit the themes (worlds): rename, change the sign (an emoji), add, delete.
// Built-in themes keep a name per language; kids' themes have one name.
// Deleting a theme leaves the things and maps that used it, without it.

const SIGNS = ['🌾', '🌲', '🪦', '💀', '🏔️', '🏜️', '❄️', '🌋', '🏰', '🌊', '🍄', '🐉'];

export default function ThemesEditor({ themes, assets = [], maps = [], onSave, onCancel }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [list, setList] = useState(() => themes.map((th) => ({ ...th })));

  const uses = (id) => assets.filter((a) => a.themes?.includes(id)).length + maps.filter((m) => m.theme === id).length;
  const set = (id, patch) => setList((l) => l.map((th) => (th.id === id ? { ...th, ...patch, updatedAt: new Date().toISOString() } : th)));
  const setName = (th, v) => set(th.id, { name: typeof th.name === 'string' ? v : { ...th.name, [lang]: v } });
  const add = () => {
    const now = new Date().toISOString();
    setList((l) => [...l, { id: newId(), icon: SIGNS[l.length % SIGNS.length], name: t('themes.new_name'), createdAt: now, updatedAt: now }]);
  };
  const remove = (th) => {
    if (confirm(t('themes.confirm_delete', { name: themeName(th, lang) }))) setList((l) => l.filter((x) => x.id !== th.id));
  };
  const valid = list.every((th) => themeName(th, lang).trim());

  return (
    <Modal onClose={onCancel}>
      <h2>🏷️ {t('themes.title')}</h2>
      <p className="small muted">{t('themes.hint')}</p>
      {list.map((th) => (
        <div key={th.id} className="row" style={{ gap: 8, marginBottom: 6 }}>
          <select value={th.icon ?? ''} onChange={(e) => set(th.id, { icon: e.target.value })} aria-label={t('themes.icon')} style={{ fontSize: '1.3em' }}>
            {[...new Set([th.icon, ...SIGNS].filter(Boolean))].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="text" value={themeName(th, lang)} onChange={(e) => setName(th, e.target.value)} style={{ flex: 1, minWidth: 140 }} />
          <span className="small muted">{t('themes.used', { n: uses(th.id) })}</span>
          <button className="btn icon" onClick={() => remove(th)} title={t('common.delete')}>🗑</button>
        </div>
      ))}
      <button className="btn" onClick={add}>+ {t('themes.add')}</button>
      <div className="row" style={{ marginTop: 16 }}>
        <span className="spacer" />
        <button className="btn" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!valid} onClick={() => onSave(list)}>✓ {t('common.save')}</button>
      </div>
    </Modal>
  );
}
