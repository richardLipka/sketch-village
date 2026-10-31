import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SearchBox from '../ui/SearchBox.jsx';
import { matchesQuery, searchTexts } from '../ui/search.js';
import Screen from '../ui/Screen.jsx';
import MapPainter from './MapPainter.jsx';
import WaveEditor from './WaveEditor.jsx';
import { drawSampleMap, mapThumbnail } from './mapRuntime.js';
import { emptyMap } from '../logic/mapModel.js';
import { newId } from '../data/saveFile.js';
import { downloadJson } from '../data/safety.js';
import { mapPackage, mapFileName } from './shareMap.js';

// All maps (= levels): create blank or sample, edit, duplicate, delete.
export default function MapList({ maps, assets, enemyTypes, themes = [], balance, buildingTypes, rules, items, onChange }) {
  const { t } = useTranslation();
  const themeIcon = (id) => themes.find((th) => th.id === id)?.icon ?? '';
  const [editing, setEditing] = useState(null);
  const [wavesFor, setWavesFor] = useState(null);
  const [query, setQuery] = useState('');
  const shown = maps.filter((m) => matchesQuery(query, ...searchTexts(m)));

  const createSample = () => {
    const m = emptyMap(t('maps.sample_name'));
    const canvas = drawSampleMap(m);
    m.background = canvas.toDataURL('image/png');
    setEditing(m);
  };

  const save = (m) => {
    const exists = maps.some((x) => x.id === m.id);
    onChange(exists ? maps.map((x) => (x.id === m.id ? m : x)) : [...maps, m]);
    setEditing(null);
  };

  const duplicate = (m) => {
    const now = new Date().toISOString();
    onChange([...maps, { ...m, id: newId(), name: `${m.name} 2`, createdAt: now, updatedAt: now }]);
  };

  // one file with the map and what it uses; its small picture is for the public library
  const share = async (m) => {
    const thumbnail = await mapThumbnail(m, assets).catch(() => null);
    downloadJson(mapPackage(m, { assets, themes }, balance, new Date(), { thumbnail }), mapFileName(m));
  };

  const remove = (m) => {
    if (confirm(t('maps.confirm_delete', { name: m.name }))) onChange(maps.filter((x) => x.id !== m.id));
  };

  if (wavesFor) {
    return (
      <WaveEditor
        map={wavesFor}
        enemyTypes={enemyTypes}
        themes={themes}
        balance={balance}
        buildingTypes={buildingTypes} rules={rules} items={items}
        onCancel={() => setWavesFor(null)}
        onSave={(waves) => { save({ ...wavesFor, waves, updatedAt: new Date().toISOString() }); setWavesFor(null); }}
      />
    );
  }

  if (editing) {
    return <MapPainter key={editing.id} map={editing} assets={assets} themes={themes} onSave={save} onCancel={() => setEditing(null)} />;
  }

  return (
    <Screen title={t('maps.title')} head={
      <div className="row">
        <button className="btn primary" onClick={() => setEditing(emptyMap(''))}>+ {t('maps.new_blank')}</button>
        <button className="btn" onClick={createSample}>✨ {t('maps.new_sample')}</button>
        <SearchBox value={query} onChange={setQuery} count={shown.length} />
      </div>
    }>
      {maps.length === 0 && <p className="muted">{t('maps.empty')}</p>}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {shown.map((m) => (
          <div key={m.id} className="asset-tile" onClick={() => setEditing(m)}>
            {m.background && <img src={m.background} alt="" style={{ maxWidth: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 4 }} />}
            <div className="name">{themeIcon(m.theme)} {m.name}</div>
            <div className="author">{m.author && `✎ ${m.author}`}</div>
            <div className="small">{m.valid ? `✓ ${t('maps.ready')}` : `⚠ ${t('maps.not_ready')}`}</div>
            <div className="row" style={{ justifyContent: 'center', gap: 4 }}>
              <button className="btn icon" onClick={(e) => { e.stopPropagation(); setWavesFor(m); }} title={t('waves.edit')}>🌊 {t('waves.edit')}</button>
              <button className="btn icon" onClick={(e) => { e.stopPropagation(); duplicate(m); }} title={t('studio.duplicate')}>⧉</button>
              <button className="btn icon" onClick={(e) => { e.stopPropagation(); share(m); }} title={t('maps.share')}>📤</button>
              <button className="btn icon danger" onClick={(e) => { e.stopPropagation(); remove(m); }} title={t('common.delete')}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}
