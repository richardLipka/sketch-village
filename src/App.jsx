import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Screen from './ui/Screen.jsx';
import { loadDb, saveCollection, saveSettings, saveDb } from './data/store.js';
import { mergeSaveFile } from './data/saveFile.js';
import { fetchDefaultData } from './data/defaultData.js';
import { migrateDb } from './data/migrate.js';
import AssetStudio from './assets/AssetStudio.jsx';
import DataPanel from './data/DataPanel.jsx';
import LanguageSwitcher from './ui/LanguageSwitcher.jsx';
import FullscreenButton from './ui/FullscreenButton.jsx';
import MapList from './maps/MapList.jsx';
import PlaySetup from './game/PlaySetup.jsx';
import RulesEditor from './game/RulesEditor.jsx';
import Chronicle from './game/Chronicle.jsx';
import { rulesOf } from './config/rules.js';
import { buildingsOf, enemyTypesOf, itemsOf } from './config/components.js';
import { starterMap } from './maps/mapRuntime.js';
import { uiIconsOf } from './config/uiIcons.js';
import { UiIconContext } from './ui/UiIcon.jsx';
import { useDevice } from './ui/device.js';
import { backupDue, noteChange, noteBackup, snoozeBackup, downloadSaveFile, storageStatus } from './data/safety.js';
import { BackupReminder } from './data/SafetyCard.jsx';
import UpdateToast from './ui/UpdateToast.jsx';

// Screens: menu · components (studio) · maps · rules · play · save & load.
// Everything the game uses is derived from the components (db.assets) and the
// global rules, memoized so a running game isn't restarted by unrelated renders.
export default function App() {
  const { t, i18n } = useTranslation();
  const [db, setDb] = useState(null);
  const [screen, setScreen] = useState('menu');
  const [loadError, setLoadError] = useState(null);
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

  // after an import: merge happened in DataPanel; bring old data into components
  const replaceDb = useCallback(async (next) => {
    const m = migrateDb(next);
    if (m.changed) await saveDb(m.db);
    setDb(m.db);
  }, []);

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
            <button className="btn big" onClick={() => setScreen('chronicle')}>📖 {t('menu.chronicle')}</button>
            <button className="btn big" onClick={() => setScreen('rules')}>⚙️ {t('menu.rules')}</button>
            <button className="btn big" onClick={() => setScreen('data')}>💾 {t('menu.data')}</button>
          </div>
        </main>
      )}

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
          settings={db.settings} onSettings={updateSettings} onExit={() => setScreen('menu')}
        />
      )}

      {screen === 'data' && <DataPanel db={db} onReplaceDb={replaceDb} onBackup={backupNow} />}
      </div>

      {screen !== 'play' && <UpdateToast />}
    </div>
    </UiIconContext.Provider>
  );
}
