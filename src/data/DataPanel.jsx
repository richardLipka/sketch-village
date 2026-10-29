import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildSaveFile, parseSaveFile, mergeSaveFile, COLLECTIONS } from './saveFile.js';
import { saveDb, purgeAll, saveCollection } from './store.js';
import { CATEGORY_IDS } from '../assets/categories.js';

// Export everything to one JSON file, merge-import, purge (SPEC §13a).
export default function DataPanel({ db, onReplaceDb }) {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const [message, setMessage] = useState(null);
  const [purgeCat, setPurgeCat] = useState('');

  const doExport = () => {
    const file = buildSaveFile(db);
    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sketch-village-${file.exportedAt.slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const doImport = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const file = parseSaveFile(await f.text());
      const { db: next, summary } = mergeSaveFile(db, file);
      await saveDb(next);
      onReplaceDb(next);
      setMessage({ ok: true, text: t('import.done', summary) });
    } catch (err) {
      setMessage({ ok: false, text: t(err.message, { defaultValue: t('import.error_generic') }) });
    }
  };

  const doPurgeAll = async () => {
    if (!confirm(t('data.confirm_purge_all'))) return;
    await purgeAll();
    const next = { ...db };
    for (const c of COLLECTIONS) next[c] = [];
    onReplaceDb(next);
    setMessage({ ok: true, text: t('data.purged') });
  };

  const doPurgeCategory = async () => {
    if (!purgeCat) return;
    if (!confirm(t('data.confirm_purge_cat', { cat: t(`cat.${purgeCat}`) }))) return;
    const assets = db.assets.filter((a) => a.category !== purgeCat);
    await saveCollection('assets', assets);
    onReplaceDb({ ...db, assets });
    setMessage({ ok: true, text: t('data.purged') });
  };

  const sizeKb = Math.round(JSON.stringify(db).length / 1024);

  return (
    <section>
      <h1>{t('data.title')}</h1>
      <p className="muted">{t('data.summary', { assets: db.assets.length, maps: db.maps.length, kb: sizeKb })}</p>

      <div className="sketch-card" style={{ marginBottom: 20 }}>
        <h2>{t('data.export_title')}</h2>
        <p className="small muted">{t('data.export_hint')}</p>
        <button className="btn primary" onClick={doExport}>⬇ {t('data.export')}</button>
      </div>

      <div className="sketch-card" style={{ marginBottom: 20 }}>
        <h2>{t('data.import_title')}</h2>
        <p className="small muted">{t('data.import_hint')}</p>
        <button className="btn" onClick={() => fileRef.current.click()}>⬆ {t('data.import')}</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={doImport} />
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
    </section>
  );
}
