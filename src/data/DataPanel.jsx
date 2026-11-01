import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Screen from '../ui/Screen.jsx';
import { COLLECTIONS } from './saveFile.js';
import { purgeAll, saveCollection } from './store.js';
import { CATEGORY_IDS } from '../assets/categories.js';
import { fetchDefaultData } from './defaultData.js';
import SafetyCard from './SafetyCard.jsx';
import LoadFile from './LoadFile.jsx';
import { importNote } from './useImporter.jsx';
import Toast from '../ui/Toast.jsx';
import ResetDefaults from './ResetDefaults.jsx';

// Export everything to one JSON file (components with their pictures and
// animations, maps, themes, rules, settings incl. the language), import a file
// from the computer or an address (LoadFile → data/useImporter.jsx: changed
// elements are reviewed), the class pack, back to the game's own components
// (SPEC §13d), purge (SPEC §13a).
export default function DataPanel({ db, onReplaceDb, onBackup, onImport }) {
  const { t } = useTranslation();
  const [message, setMessage] = useState(null);
  const [purgeCat, setPurgeCat] = useState('');

  const mergeIn = async (file) => {
    const r = await onImport(file);
    setMessage(importNote(r, t));
  };

  const doClassPack = async () => {
    const pack = await fetchDefaultData();
    if (pack) await mergeIn(pack);
    else setMessage({ ok: false, text: t('data.pack_none') });
  };

  const doPurgeAll = async () => {
    if (!confirm(t('data.confirm_purge_all'))) return;
    await purgeAll();
    // the built-in components come back (the game needs a Town Hall, enemies…)
    const next = { ...db, settings: { ...db.settings, builtInsSeeded: [], themesSeeded: false } };
    for (const c of COLLECTIONS) next[c] = [];
    onReplaceDb(next);
    setMessage({ ok: true, text: t('data.purged') });
  };

  const doPurgeCategory = async () => {
    if (!purgeCat) return;
    if (!confirm(t('data.confirm_purge_cat', { cat: t(`cat.${purgeCat}`) }))) return;
    // the kids' own components of this kind go; built-in ones only lose their drawings
    const assets = db.assets
      .filter((a) => a.category !== purgeCat || a.builtIn)
      .map((a) => (a.category === purgeCat && a.builtIn ? { ...a, images: [], updatedAt: new Date().toISOString() } : a));
    await saveCollection('assets', assets);
    onReplaceDb({ ...db, assets });
    setMessage({ ok: true, text: t('data.purged') });
  };

  const sizeKb = Math.round(JSON.stringify(db).length / 1024);

  return (
    <Screen title={t('data.title')} head={<p className="muted" style={{ margin: 0 }}>{t('data.summary', { assets: db.assets.length, maps: db.maps.length, kb: sizeKb })}</p>}>

      <SafetyCard settings={db.settings} onBackup={onBackup} />


      <div className="sketch-card" style={{ marginBottom: 20 }}>
        <h2>{t('data.import_title')}</h2>
        <p className="small muted">{t('data.import_hint')}</p>
        <LoadFile label={t('data.import')} title={t('data.import_title')} hint={t('data.import_hint')} onImport={onImport} testId="data-load" />
      </div>

      <div className="sketch-card" style={{ marginBottom: 20 }}>
        <h2>{t('data.pack_title')}</h2>
        <p className="small muted">{t('data.pack_hint')}</p>
        <button className="btn" onClick={doClassPack}>🎒 {t('data.pack_load')}</button>
        <details className="small" style={{ marginTop: 8 }}>
          <summary>{t('data.pack_teacher')}</summary>
          <p className="muted">{t('data.pack_howto')}</p>
        </details>
      </div>

      <div className="sketch-card" style={{ marginBottom: 20 }}>
        <h2>{t('reset.title')}</h2>
        <p className="small muted">{t('reset.card_hint')}</p>
        <ResetDefaults db={db} onReplaceDb={onReplaceDb} onDone={(text) => setMessage({ ok: true, text })} />
      </div>

      <div className="sketch-card">
        <h2>{t('data.purge_title')}</h2>
        <p className="small muted">{t('data.purge_hint')}</p>
        <div className="row">
          <select value={purgeCat} onChange={(e) => setPurgeCat(e.target.value)} aria-label={t('data.pick_category')}>
            <option value="">{t('data.pick_category')}</option>
            {CATEGORY_IDS.map((c) => <option key={c} value={c}>{t(`cat.${c}`)}</option>)}
          </select>
          <button className="btn danger" onClick={doPurgeCategory} disabled={!purgeCat}>{t('data.purge_category')}</button>
          <span className="spacer" />
          <button className="btn danger" onClick={doPurgeAll}>🗑 {t('data.purge_all')}</button>
        </div>
      </div>

      {message && (
        <Toast error={!message.ok} onClose={() => setMessage(null)}>{message.text}</Toast>
      )}
    </Screen>
  );
}
