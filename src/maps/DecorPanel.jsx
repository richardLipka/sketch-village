import React from 'react';
import { useTranslation } from 'react-i18next';
import SearchBox from '../ui/SearchBox.jsx';
import { compName } from '../config/components.js';

// The decoration panel left of the map in the map editor (SPEC §5.1): one by one
// or fill an area, the pictures to place (searchable: nature first, then any
// other drawing), size, and for a fill its density and size variety.
export default function DecorPanel({
  mode, onMode, query, onQuery, decorations, otherDrawings, asset, onAsset, scale, onScale,
  density, onDensity, variety, onVariety, corners, onFill, onClearPolygon, selected, onDelete,
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  return (
    <aside className="sketch-card decor-side" aria-label={t('maps.place_decoration')}>
      <div className="row decor-modes" role="radiogroup">
        <button type="button" role="radio" aria-checked={mode === 'place'} className={`btn chip ${mode === 'place' ? 'active' : ''}`} onClick={() => onMode('place')}>🌳 {t('maps.decor_one')}</button>
        <button type="button" role="radio" aria-checked={mode === 'fill'} className={`btn chip ${mode === 'fill' ? 'active' : ''}`} onClick={() => onMode('fill')}>⬠ {t('maps.decor_fill')}</button>
      </div>
      <SearchBox value={query} onChange={onQuery} />
      <div className="decor-list">
        {decorations.length + otherDrawings.length === 0 && <span className="muted small">{t(query ? 'maps.decor_none_found' : 'maps.no_decorations')}</span>}
        {[[decorations, 'maps.decor_nature'], [otherDrawings, 'maps.decor_other']].map(([list, label]) => list.length > 0 && (
          <div key={label} className="decor-group">
            <div className="small muted">{t(label)}</div>
            {list.map((d) => (
              <button key={d.id} type="button" className={`decor-tile ${asset === d.id ? 'on' : ''}`} aria-pressed={asset === d.id} onClick={() => onAsset(d.id)} title={compName(d, lang)}>
                <img src={d.images[0]} alt="" />
                <span>{compName(d, lang)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      <label className="small">{t('maps.decor_size')} <input type="range" min={0.5} max={3} step={0.1} value={scale} onChange={(e) => onScale(+e.target.value)} /></label>
      {mode === 'fill' && (
        <>
          <label className="small">{t('maps.fill_density')} {density} <input type="range" min={1} max={10} step={1} value={density} onChange={(e) => onDensity(+e.target.value)} /></label>
          <label className="small">{t('maps.fill_variety')} {Math.round(variety * 100)} % <input type="range" min={0} max={0.8} step={0.05} value={variety} onChange={(e) => onVariety(+e.target.value)} /></label>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn primary" disabled={corners < 3} onClick={onFill}>⬠ {t('maps.fill_now')}</button>
            <button type="button" className="btn" disabled={!corners} onClick={onClearPolygon}>✕ {t('maps.fill_clear')}</button>
          </div>
          <span className="small muted">{t('maps.fill_corners', { count: corners })}</span>
        </>
      )}
      {selected && (
        <button type="button" className="btn danger" onClick={onDelete}>🗑 {t('maps.decor_delete')}</button>
      )}
    </aside>
  );
}
