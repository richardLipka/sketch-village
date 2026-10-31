import React from 'react';
import { useTranslation } from 'react-i18next';

// The map editor's tool bars (maps/MapPainter.jsx): paint tools with their
// sizes and colours, place tools, and the terrain panel (a texture per colour).

export const DECOR_COLORS = ['#1f2937', '#78350f', '#166534', '#2563eb', '#dc2626', '#ffffff'];
export const ROAD_SIZES = [24, 40, 64];
export const PENCIL_SIZES = [3, 6, 12];
const PAINT_TOOLS = [['road', '🟨'], ['grass', '🟩'], ['pencil', '✏️'], ['fill', '🪣']];
const PLACE_TOOLS = [['centre', '🏛️'], ['spot', '⬚'], ['cave', '🕳️'], ['decoration', '🌳'], ['erase', '✕']];

export function PainterTools({ mode, map, tool, onTool, roadSize, onRoadSize, pencilSize, onPencilSize, color, onColor, placeTool, onPlaceTool }) {
  const { t } = useTranslation();
  return (
    <div className="row" style={{ marginBottom: 8, minHeight: mode === 'terrain' ? 0 : 44 }}>
      {mode === 'terrain' ? null : mode === 'paint' ? (
        <>
          {PAINT_TOOLS.map(([id, icon]) => (
            <button key={id} className={`btn icon ${tool === id ? 'active' : ''}`} onClick={() => onTool(id)}>{icon} {t(`maps.tool_${id}`)}</button>
          ))}
          <span className="muted">|</span>
          {(tool === 'road' || tool === 'grass') && ROAD_SIZES.map((s) => (
            <button key={s} className={`btn icon ${roadSize === s ? 'active' : ''}`} onClick={() => onRoadSize(s)}>
              <span style={{ display: 'inline-block', width: s / 3, height: s / 3, borderRadius: '50%', background: tool === 'road' ? map.palette.path : map.palette.grass, border: '1px solid var(--ink)' }} />
            </button>
          ))}
          {(tool === 'pencil' || tool === 'fill') && (
            <>
              {tool === 'pencil' && PENCIL_SIZES.map((s) => (
                <button key={s} className={`btn icon ${pencilSize === s ? 'active' : ''}`} onClick={() => onPencilSize(s)}>
                  <span style={{ display: 'inline-block', width: s + 2, height: s + 2, borderRadius: '50%', background: 'var(--ink)' }} />
                </button>
              ))}
              {[...DECOR_COLORS, map.palette.path, map.palette.grass].map((c) => (
                <button key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => onColor(c)} aria-label={c} />
              ))}
            </>
          )}
        </>
      ) : (
        <>
          {PLACE_TOOLS.map(([id, icon]) => (
            <button key={id} className={`btn icon ${placeTool === id ? 'active' : ''}`} onClick={() => onPlaceTool(id)}>
              {icon} {t(`maps.place_${id}`)}{id === 'spot' ? ` (${map.spots.length})` : ''}
            </button>
          ))}
        </>
      )}
    </div>
  );
}

/** Terrain: which texture covers each painted colour in the game. */
export function TerrainPanel({ map, colours, choices, onTexture }) {
  const { t } = useTranslation();
  const colourLabel = (c) => (c === map.palette.path ? t('maps.tool_road') : c === map.palette.grass ? t('maps.tool_grass') : c);
  return (
    <div className="sketch-card terrain-panel" style={{ marginBottom: 8 }}>
      <p className="small muted" style={{ margin: '0 0 6px' }}>{t('maps.terrain_hint')}</p>
      {!colours.length && <span className="small muted">{t('maps.terrain_none')}</span>}
      {colours.map((c) => {
        const chosen = choices.find((x) => x.id === map.textures?.[c]);
        return (
          <div key={c} className="row terrain-row">
            <span className="swatch on" style={{ background: c }} title={c} />
            <span className="small" style={{ minWidth: 70 }}>{colourLabel(c)}</span>
            <span>→</span>
            {chosen ? <img className="tex-swatch" src={chosen.swatch} alt="" /> : <span className="tex-swatch" style={{ background: c }} />}
            <select value={map.textures?.[c] ?? ''} onChange={(e) => onTexture(c, e.target.value)}>
              <option value="">{t('maps.texture_none')}</option>
              {choices.filter((x) => !x.mine).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              {choices.some((x) => x.mine) && (
                <optgroup label={t('maps.my_textures')}>
                  {choices.filter((x) => x.mine).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </optgroup>
              )}
            </select>
          </div>
        );
      })}
    </div>
  );
}
