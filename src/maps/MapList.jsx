import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import MapPainter from './MapPainter.jsx';
import WaveEditor from './WaveEditor.jsx';
import { drawSampleMap } from './mapRuntime.js';
import { emptyMap } from '../logic/mapModel.js';
import { newId } from '../data/saveFile.js';

// All maps (= levels): create blank or sample, edit, duplicate, delete.
export default function MapList({ maps, assets, enemyTypes, onChange }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(null);
  const [wavesFor, setWavesFor] = useState(null);

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

  const remove = (m) => {
    if (confirm(t('maps.confirm_delete', { name: m.name }))) onChange(maps.filter((x) => x.id !== m.id));
  };

  if (wavesFor) {
    return (
      <WaveEditor
        map={wavesFor}
        enemyTypes={enemyTypes}
        onCancel={() => setWavesFor(null)}
        onSave={(waves) => { save({ ...wavesFor, waves, updatedAt: new Date().toISOString() }); setWavesFor(null); }}
      />
    );
  }

  if (editing) {
    return <MapPainter key={editing.id} map={editing} assets={assets} onSave={save} onCancel={() => setEditing(null)} />;
  }

  return (
    <section>
      <h1>{t('maps.title')}</h1>
      <div className="row" style={{ marginBottom: 16 }}>
        <button className="btn primary" onClick={() => setEditing(emptyMap(''))}>+ {t('maps.new_blank')}</button>
        <button className="btn" onClick={createSample}>✨ {t('maps.new_sample')}</button>
      </div>
      {maps.length === 0 && <p className="muted">{t('maps.empty')}</p>}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {maps.map((m) => (
          <div key={m.id} className="asset-tile" onClick={() => setEditing(m)}>
            {m.background && <img src={m.background} alt="" style={{ maxWidth: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 4 }} />}
            <div className="name">{m.name}</div>
            <div className="author">{m.author && `✎ ${m.author}`}</div>
            <div className="small">{m.valid ? `✓ ${t('maps.ready')}` : `⚠ ${t('maps.not_ready')}`}</div>
            <div className="row" style={{ justifyContent: 'center', gap: 4 }}>
              <button className="btn icon" onClick={(e) => { e.stopPropagation(); setWavesFor(m); }} title={t('waves.edit')}>🌊 {t('waves.edit')}</button>
              <button className="btn icon" onClick={(e) => { e.stopPropagation(); duplicate(m); }} title={t('studio.duplicate')}>⧉</button>
              <button className="btn icon danger" onClick={(e) => { e.stopPropagation(); remove(m); }} title={t('common.delete')}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
