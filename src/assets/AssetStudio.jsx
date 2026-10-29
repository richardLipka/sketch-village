import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CATEGORY_IDS } from './categories.js';
import AssetEditor, { emptyAsset } from './AssetEditor.jsx';
import { newId } from '../data/saveFile.js';

// Library of all drawings, one tab per category.
export default function AssetStudio({ assets, onChange }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState(() => {
    try { return sessionStorage.getItem('sv:studioTab') || 'hero'; } catch { return 'hero'; }
  });
  const [editing, setEditing] = useState(null); // { asset, isNew }

  const pickCategory = (c) => {
    setCategory(c);
    try { sessionStorage.setItem('sv:studioTab', c); } catch { /* ignore */ }
  };

  const list = assets.filter((a) => a.category === category);
  const countOf = (c) => assets.filter((a) => a.category === c).length;

  const save = (asset) => {
    const exists = assets.some((a) => a.id === asset.id);
    onChange(exists ? assets.map((a) => (a.id === asset.id ? asset : a)) : [...assets, asset]);
    setEditing(null);
  };

  const remove = (id) => {
    onChange(assets.filter((a) => a.id !== id));
    setEditing(null);
  };

  const duplicate = (asset) => {
    const now = new Date().toISOString();
    onChange([...assets, { ...asset, id: newId(), name: `${asset.name} 2`, createdAt: now, updatedAt: now }]);
  };

  return (
    <section>
      <h1>{t('studio.title')}</h1>
      <div className="tabs">
        {CATEGORY_IDS.map((c) => (
          <button key={c} className={`tab ${c === category ? 'on' : ''}`} onClick={() => pickCategory(c)}>
            {t(`cat.${c}`)} <span className="muted small">({countOf(c)})</span>
          </button>
        ))}
      </div>
      <p className="muted small">{t(`catHint.${category}`)}</p>

      <div className="grid">
        <button className="asset-tile new btn" onClick={() => setEditing({ asset: emptyAsset(category), isNew: true })} title={t('studio.add')}>
          +
        </button>
        {list.map((a) => {
          const filled = a.images.filter(Boolean).length;
          return (
            <div key={a.id} className="asset-tile" onClick={() => setEditing({ asset: a, isNew: false })}>
              <div className="checker" style={{ borderRadius: 6 }}>
                <img src={a.images.filter(Boolean).at(-1)} alt={a.name} />
              </div>
              <div className="name">{a.name}</div>
              <div className="author">{a.author && `✎ ${a.author}`}</div>
              {a.images.length > 1 && <div className="small muted">{t('studio.levels_done', { n: filled, total: a.images.length })}</div>}
              <button className="btn icon small" onClick={(e) => { e.stopPropagation(); duplicate(a); }} title={t('studio.duplicate')}>⧉</button>
            </div>
          );
        })}
      </div>

      {editing && (
        <AssetEditor
          asset={editing.asset}
          isNew={editing.isNew}
          onSave={save}
          onDelete={remove}
          onCancel={() => setEditing(null)}
        />
      )}
    </section>
  );
}
