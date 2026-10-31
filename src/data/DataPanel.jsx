import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Screen from '../ui/Screen.jsx';
import { parseSaveFile, COLLECTIONS } from './saveFile.js';
import { purgeAll, saveCollection } from './store.js';
import { CATEGORY_IDS } from '../assets/categories.js';
import { fetchDefaultData } from './defaultData.js';
import SafetyCard from './SafetyCard.jsx';

// Export everything to one JSON file (components with their pictures and
// animations, maps, themes, rules, settings incl. the language), import with a
// review of changed elements (data/useImporter.jsx), purge (SPEC §13a).
export default function DataPanel({ db, onReplaceDb, onBackup, onImport }) {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const [message, setMessage] = useState(null);
  const [purgeCat, setPurgeCat] = useState('');

  const mergeIn = async (file) => {
    const r = await onImport(file);
    setMessage(r ? { ok: true, text: t('import.done_review', r.summary) } : { ok: false, text: t('import.cancelled') });
  };

  const doImport = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      await mergeIn(parseSaveFile(await f.text()));
    } catch (err) {
      setMessage({ ok: false, text: t(err.message, { defaultValue: t('import.error_generic') }) });
    }
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
        <button className="btn" onClick={() => fileRef.current.click()}>⬆ {t('data.import')}</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={doImport} />
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

      <div className="sketch-card">
        <h2>{t('data.purge_title')}</h2>
        <p className="small muted">{t('data.purge_hint')}</p>
        <div className="row">
          <select value={purgeCat} onChange={(e) => setPurgeCat(e.target.value)}>
            <option value="">{t('data.pick_category')}</option>
            {CATEGORY_IDS.map((c) => <option key={c} value={c}>{t(`cat.${c}`)}</option>)}
          </select>
          <button className="btn danger" onClick={doPurgeCategory} disabled={!purgeCat}>{t('data.purge_category')}</button>
          <span className="spacer" />
          <button className="btn danger" onClick={doPurgeAll}>🗑 {t('data.purge_all')}</button>
        </div>
      </div>

      {message && (
        <div className={`toast sketch-card ${message.ok ? '' : 'error-text'}`} style={message.ok ? undefined : { background: 'var(--hl-red)' }} onClick={() => setMessage(null)}>
          {message.text}
        </div>
      )}
    </Screen>
  );
}
