import React from 'react';
import { useTranslation } from 'react-i18next';
import SearchBox from '../ui/SearchBox.jsx';
import { compName } from '../config/components.js';

// The cave panel left of the map in the map editor (SPEC §5.1): what a cave
// looks like – the usual one (the first cave drawing), any cave drawing, or a
// decoration used as a cave (searchable) – and its size. With a cave selected
// on the map, picking a shape changes that cave.
export default function CavePanel({ query, onQuery, caves, decorations, usual, asset, onAsset, scale, onScale, selected, onDelete }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const tile = (id, name, src) => (
    <button key={id ?? 'usual'} type="button" className={`decor-tile ${asset === id ? 'on' : ''}`} aria-pressed={asset === id} onClick={() => onAsset(id)} title={name}>
      {src ? <img src={src} alt="" /> : <span className="decor-emoji" aria-hidden="true">🕳️</span>}
      <span>{name}</span>
    </button>
  );
  return (
    <aside className="sketch-card decor-side" aria-label={t('maps.cave_shape')} data-testid="cave-panel">
      <b className="small">🕳️ {t('maps.cave_shape')}</b>
      <span className="small muted">{t(selected ? 'maps.cave_shape_selected' : 'maps.cave_shape_new')}</span>
      <SearchBox value={query} onChange={onQuery} />
      <div className="decor-list">
        <div className="decor-group">
          <div className="small muted">{t('maps.cave_drawings')}</div>
          {tile(null, t('maps.cave_usual'), usual)}
          {caves.map((c) => tile(c.id, compName(c, lang), c.images[0]))}
        </div>
        {decorations.length > 0 && (
          <div className="decor-group">
            <div className="small muted">{t('maps.cave_from_decor')}</div>
            {decorations.map((d) => tile(d.id, compName(d, lang), d.images[0]))}
          </div>
        )}
      </div>
      <label className="small">{t('maps.decor_size')} <input type="range" min={0.5} max={3} step={0.1} value={scale} onChange={(e) => onScale(+e.target.value)} /></label>
      {selected && <button type="button" className="btn danger" onClick={onDelete}>🗑 {t('maps.cave_delete')}</button>}
    </aside>
  );
}
