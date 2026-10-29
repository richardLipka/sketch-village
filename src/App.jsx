import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { loadDb, saveCollection } from './data/store.js';
import AssetStudio from './assets/AssetStudio.jsx';
import DataPanel from './data/DataPanel.jsx';
import LanguageSwitcher from './ui/LanguageSwitcher.jsx';
import MapList from './maps/MapList.jsx';
import PlaySetup from './game/PlaySetup.jsx';
import EnemyEditor from './game/EnemyEditor.jsx';
import { enemyTypesOf } from './config/enemies.js';
import { buildingTypesOf } from './config/buildings.js';

export default function App() {
  const { t } = useTranslation();
  const [db, setDb] = useState(null);
  const [screen, setScreen] = useState('menu');
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    loadDb().then(setDb).catch((e) => setLoadError(String(e)));
  }, []);

  // Replace one collection in memory and persist it.
  const updateCollection = useCallback(async (name, records) => {
    setDb((cur) => ({ ...cur, [name]: records }));
    await saveCollection(name, records);
  }, []);

  if (loadError) return <div className="page error-text">{t('app.load_error')} {loadError}</div>;
  if (!db) return <div className="page">{t('app.loading')}</div>;

  return (
    <div className="page">
      <header className="row" style={{ marginBottom: 16 }}>
        {screen !== 'menu' && (
          <button className="btn" onClick={() => setScreen('menu')}>← {t('app.back')}</button>
        )}
        <span className="spacer" />
        <LanguageSwitcher />
      </header>

      {screen === 'menu' && (
        <main style={{ textAlign: 'center' }}>
          <h1>{t('app.title')}</h1>
          <p className="muted">{t('app.subtitle')}</p>
          <div className="sketch-card" style={{ display: 'inline-flex', flexDirection: 'column', gap: 16, padding: 32, marginTop: 24 }}>
            <button className="btn big primary" onClick={() => setScreen('play')}>▶ {t('menu.play')}</button>
            <button className="btn big" onClick={() => setScreen('studio')}>✏️ {t('menu.studio')}</button>
            <button className="btn big" onClick={() => setScreen('maps')}>🗺️ {t('menu.maps')}</button>
            <button className="btn big" onClick={() => setScreen('enemies')}>👾 {t('menu.enemies')}</button>
            <button className="btn big" onClick={() => setScreen('data')}>💾 {t('menu.data')}</button>
          </div>
        </main>
      )}

      {screen === 'studio' && (
        <AssetStudio assets={db.assets} onChange={(a) => updateCollection('assets', a)} />
      )}

      {screen === 'maps' && (
        <MapList maps={db.maps} assets={db.assets} enemyTypes={enemyTypesOf(db)} onChange={(m) => updateCollection('maps', m)} />
      )}

      {screen === 'enemies' && (
        <EnemyEditor enemyTypes={enemyTypesOf(db)} assets={db.assets} onChange={(list) => updateCollection('enemyTypes', list)} />
      )}

      {screen === 'play' && <PlaySetup maps={db.maps} assets={db.assets} enemyTypes={enemyTypesOf(db)} buildingTypes={buildingTypesOf(db)} />}

      {screen === 'data' && <DataPanel db={db} onReplaceDb={setDb} />}
    </div>
  );
}
