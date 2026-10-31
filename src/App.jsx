import React, { useEffect, useState, useCallback, useMemo, useRef, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import Screen from './ui/Screen.jsx';
import Modal from './ui/Modal.jsx';
import { loadDb, saveCollection, saveSettings, saveDb } from './data/store.js';
import { mergeSaveFile } from './data/saveFile.js';
import { fetchDefaultData } from './data/defaultData.js';
import { migrateDb } from './data/migrate.js';
import useImporter from './data/useImporter.jsx';
import { dataParam, withoutDataParam, resolveDataUrl, isOwnSite, fetchSaveFile } from './data/library.js';
import LanguageSwitcher from './ui/LanguageSwitcher.jsx';
import FullscreenButton from './ui/FullscreenButton.jsx';
import PlaySetup from './game/PlaySetup.jsx';
import { rulesOf } from './config/rules.js';
import { buildingsOf, enemyTypesOf, itemsOf } from './config/components.js';
import { starterMap } from './maps/mapRuntime.js';
import { uiIconsOf } from './config/uiIcons.js';
import { UiIconContext } from './ui/UiIcon.jsx';
import { useDevice } from './ui/device.js';
import { backupDue, noteChange, noteBackup, snoozeBackup, downloadSaveFile, storageStatus } from './data/safety.js';
import { BackupReminder } from './data/SafetyCard.jsx';
import UpdateToast from './ui/UpdateToast.jsx';

// The editors and other screens load when they are first opened, so the menu
// (and a game) starts with less to download.
const AssetStudio = lazy(() => import('./assets/AssetStudio.jsx'));
const MapList = lazy(() => import('./maps/MapList.jsx'));
const RulesEditor = lazy(() => import('./game/RulesEditor.jsx'));
const Chronicle = lazy(() => import('./game/Chronicle.jsx'));
const DataPanel = lazy(() => import('./data/DataPanel.jsx'));
const Library = lazy(() => import('./data/Library.jsx'));

// Screens: menu · components (studio) · maps · rules · play · library · save & load.
// Everything the game uses is derived from the components (db.assets) and the
// global rules, memoized so a running game isn't restarted by unrelated renders.
export default function App() {
  const { t, i18n } = useTranslation();
  const [db, setDb] = useState(null);
  const [screen, setScreen] = useState('menu');
  const [loadError, setLoadError] = useState(null);
  const [playMap, setPlayMap] = useState(null); // a map to have picked when the play screen opens
  const [link, setLink] = useState(null); // a ?data= file: { url, asking?, loading?, error? }
  const { device } = useDevice(); // phone: the lists show one thing per line (sketch.css)

  useEffect(() => {
    loadDb()
      .then(async (first) => {
        let loaded = first;
        // very first start: load the class pack shipped with the website, or
        // add a ready-to-play sample map (only once, so deleted maps don't come back)
        const fresh = !loaded.maps.length && !loaded.settings.starterAdded;
        if (fresh) {
          const pack = await fetchDefaultData();
          if (pack) loaded = mergeSaveFile(loaded, pack).db;
          if (!loaded.maps.length) loaded.maps = [starterMap(t('maps.sample_name'))];
          loaded.settings = { ...loaded.settings, starterAdded: true };
        }
        // data from older versions → components; built-in components on first start
        const m = migrateDb(loaded);
        if (fresh || m.changed) await saveDb(m.db);
        setDb(m.db);
      })
      .catch((e) => setLoadError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const storedRules = db?.rules, assets = db?.assets;
  const rules = useMemo(() => rulesOf({ rules: storedRules }), [storedRules]);
  const buildings = useMemo(() => buildingsOf(assets), [assets]);
  const enemyTypes = useMemo(() => enemyTypesOf(assets), [assets]);
  const items = useMemo(() => itemsOf(assets), [assets]);
  const uiIcons = useMemo(() => uiIconsOf(assets), [assets]);

  // The latest settings, kept outside React's state updates: those must stay pure
  // (React may run an updater twice), so saving happens here, not inside them.
  const settingsRef = useRef({});
  useEffect(() => { if (db) settingsRef.current = db.settings; }, [db]);

  const updateSettings = useCallback((patch) => {
    const settings = { ...settingsRef.current, ...patch };
    settingsRef.current = settings;
    setDb((cur) => ({ ...cur, settings }));
    saveSettings(settings);
  }, []);

  // Replace one collection in memory and persist it. The kid made something:
  // note it for the backup reminder and ask the browser to keep the data.
  const updateCollection = useCallback(async (name, records) => {
    setDb((cur) => ({ ...cur, [name]: records }));
    const patch = noteChange(settingsRef.current);
    if (patch) {
      updateSettings(patch);
      storageStatus({ ask: true });
    }
    await saveCollection(name, records);
  }, [updateSettings]);

  const backupNow = useCallback(() => {
    downloadSaveFile(db, i18n.language);
    updateSettings(noteBackup());
  }, [db, i18n.language, updateSettings]);

  // after an import or a purge: bring old data into components, store everything
  const replaceDb = useCallback(async (next) => {
    const m = migrateDb(next);
    setDb(m.db);
    await saveDb(m.db);
  }, []);

  const { importFile, reviewModal } = useImporter(db, replaceDb);

  const play = useCallback((mapId) => {
    setPlayMap(mapId ?? null);
    setScreen('play');
  }, []);

  const loadLink = useCallback(async (url) => {
    setLink({ url, loading: true });
    try {
      const r = await importFile(await fetchSaveFile(url));
      setLink(null);
      if (r?.maps.length) play(r.maps[0]);
    } catch (e) {
      setLink({ url, error: e.message });
    }
  }, [importFile, play]);

  // A link with ?data=<file> opens the game with that file loaded (SPEC §13c):
  // from the game's own website at once, from anywhere else after asking.
  const linkChecked = useRef(false);
  useEffect(() => {
    if (!db || linkChecked.current) return;
    linkChecked.current = true;
    const value = dataParam();
    if (value === null) return;
    history.replaceState(history.state, '', withoutDataParam(location.href)); // a reload doesn't load it again
    const url = resolveDataUrl(value);
    if (!url) setLink({ error: 'library.error_link' });
    else if (isOwnSite(url)) loadLink(url);
    else setLink({ url, asking: true });
  }, [db, loadLink]);

  if (loadError) return <div className="page error-text">{t('app.load_error')} {loadError}</div>;
  if (!db) return <div className="page">{t('app.loading')}</div>;

  return (
    <UiIconContext.Provider value={uiIcons}>
    <div className={`page device-${device}`}>
      <header className="row" style={{ marginBottom: 16 }}>
        {screen !== 'menu' && (
          <button className="btn" onClick={() => setScreen('menu')}>← {t('app.back')}</button>
        )}
        <span className="spacer" />
        <FullscreenButton />
        <LanguageSwitcher />
      </header>

      <div className="page-main">
      {screen === 'menu' && (
        <main style={{ textAlign: 'center' }}>
          <h1>{t('app.title')}</h1>
          <p className="muted">{t('app.subtitle')}</p>
          {backupDue(db.settings) && <BackupReminder settings={db.settings} onBackup={backupNow} onLater={() => updateSettings(snoozeBackup())} />}
          <div className="sketch-card" style={{ display: 'inline-flex', flexDirection: 'column', gap: 16, padding: 32, marginTop: 24 }}>
            <button className="btn big primary" onClick={() => setScreen('play')}>▶ {t('menu.play')}</button>
            <button className="btn big" onClick={() => setScreen('studio')}>🧩 {t('menu.studio')}</button>
            <button className="btn big" onClick={() => setScreen('maps')}>🗺️ {t('menu.maps')}</button>
            <button className="btn big" onClick={() => setScreen('library')}>📚 {t('menu.library')}</button>
            <button className="btn big" onClick={() => setScreen('chronicle')}>📖 {t('menu.chronicle')}</button>
            <button className="btn big" onClick={() => setScreen('rules')}>⚙️ {t('menu.rules')}</button>
            <button className="btn big" onClick={() => setScreen('data')}>💾 {t('menu.data')}</button>
          </div>
        </main>
      )}

      <Suspense fallback={<p className="muted">{t('app.loading')}</p>}>
      {screen === 'studio' && (
        <AssetStudio
          assets={db.assets} heroRules={rules.hero} buildingTypes={buildings.types} enemyTypes={enemyTypes} themes={db.themes} maps={db.maps}
          onChange={(a) => updateCollection('assets', a)} onThemes={(th) => updateCollection('themes', th)}
        />
      )}

      {screen === 'maps' && (
        <MapList maps={db.maps} assets={db.assets} enemyTypes={enemyTypes} themes={db.themes} balance={rules.balance} buildingTypes={buildings.types} rules={rules} items={items} onChange={(m) => updateCollection('maps', m)} />
      )}

      {screen === 'chronicle' && (
        <Screen title={`📖 ${t('chronicle.title')}`} fill>
          <Chronicle enemies={enemyTypes} themes={db.themes} intro={t('chronicle.intro')} />
        </Screen>
      )}

      {screen === 'rules' && <RulesEditor rules={rules} onSave={(r) => updateCollection('rules', [r])} />}

      {screen === 'play' && (
        <PlaySetup
          maps={db.maps} assets={db.assets} enemyTypes={enemyTypes} buildings={buildings} rules={rules} weapons={items} themes={db.themes}
          settings={db.settings} onSettings={updateSettings} onExit={() => setScreen('menu')} initialMapId={playMap}
        />
      )}

      {screen === 'library' && <Library onImport={importFile} onPlay={play} />}

      {screen === 'data' && <DataPanel db={db} onReplaceDb={replaceDb} onBackup={backupNow} onImport={importFile} />}
      </Suspense>
      </div>

      {reviewModal}

      {link?.asking && (
        <Modal onClose={() => setLink(null)}
          header={<h2>🔗 {t('library.link_title')}</h2>}
          footer={<div className="row">
            <button className="btn primary" onClick={() => loadLink(link.url)}>⬇ {t('library.load')}</button>
            <button className="btn" onClick={() => setLink(null)}>{t('common.cancel')}</button>
          </div>}
        >
          <p>{t('library.link_ask', { host: new URL(link.url).host })}</p>
          <p className="small muted" style={{ wordBreak: 'break-all' }}>{link.url}</p>
        </Modal>
      )}
      {(link?.loading || link?.error) && (
        <div className={`toast sketch-card ${link.error ? 'error-text' : ''}`} role="status" style={link.error ? { background: 'var(--hl-red)' } : undefined} onClick={() => link.error && setLink(null)}>
          {link.loading ? t('library.link_loading') : t(link.error, { defaultValue: t('import.error_generic') })}
        </div>
      )}

      {screen !== 'play' && <UpdateToast />}
    </div>
    </UiIconContext.Provider>
  );
}
