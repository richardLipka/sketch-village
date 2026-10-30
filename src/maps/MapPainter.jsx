import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { compName } from '../config/components.js';
import { mapCanvas, gridFromCanvas, ruggedRoads } from './mapRuntime.js';
import { BUILT_IN_IDS, builtInTexture, terrainColours, texturedCanvas, textureSwatch } from './textures.js';
import { themeName } from '../config/themes.js';
import { validateMap, placeCave, MAX_SPOTS, CENTRE_RADIUS } from '../logic/mapModel.js';
import { floodFill, hexToRgba } from '../assets/pixelOps.js';
import { loadImage } from '../assets/imageEncoding.js';
import { newId } from '../data/saveFile.js';

// Map Painter & Map Editor (SPEC §5.1).
//   Paint – yellow road brush, grass brush (erases road), decoration pencil, bucket fill.
//   Place – town hall (village centre), any number of building spots, caves anywhere beside a road, decorations.
//   Terrain – which texture covers each painted colour in the game (with a preview);
//             painting itself stays in plain colours so the bucket fills exactly.
// The map also has a theme (world): it decides which buildings can be built on it.
// Everything is point-and-click; markers can also be dragged.

const DECOR_COLORS = ['#1f2937', '#78350f', '#166534', '#2563eb', '#dc2626', '#ffffff'];
const ROAD_SIZES = [24, 40, 64];
const PENCIL_SIZES = [3, 6, 12];
const UNDO_LIMIT = 15;
const HIT = 28; // px radius for grabbing a marker
const DECOR_BASE = 64; // decoration size at scale 1

export default function MapPainter({ map: initial, assets, themes = [], onSave, onCancel }) {
  const { t, i18n } = useTranslation();
  const baseRef = useRef(null); // the bitmap
  const previewRef = useRef(null); // the bitmap as the game shows it (rugged roads + textures)
  const overRef = useRef(null); // markers, decorations, grid overlay
  const undo = useRef([]);
  const stroke = useRef(null);
  const drag = useRef(null);
  const images = useRef({}); // assetId → HTMLImageElement
  const [map, setMap] = useState(initial);
  const [mode, setMode] = useState('paint');
  const [tool, setTool] = useState('road');
  const [roadSize, setRoadSize] = useState(ROAD_SIZES[1]);
  const [pencilSize, setPencilSize] = useState(PENCIL_SIZES[1]);
  const [color, setColor] = useState(DECOR_COLORS[1]);
  const [placeTool, setPlaceTool] = useState('centre');
  const [decorAsset, setDecorAsset] = useState(null);
  const [decorScale, setDecorScale] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [grid, setGrid] = useState(null);
  const [colours, setColours] = useState([]); // the painted colours (terrain mode)
  const [preview, setPreview] = useState(false);
  const [, force] = useState(0);
  const { width: W, height: H } = map.world;

  // anything already drawn can stand on the grass: decorations (trees, rocks,
  // mountains…) first, then all other drawings
  const decorations = assets.filter((a) => a.category === 'decoration' && a.images?.[0]);
  const otherDrawings = assets.filter((a) => a.category !== 'decoration' && a.images?.[0]);
  const [placeMsg, setPlaceMsg] = useState(null);
  // only on grass: a decoration must not stand on a road cell
  const onRoad = (p) => {
    if (!grid) return false;
    const cx = Math.floor(p.x / grid.cell), cy = Math.floor(p.y / grid.cell);
    return !!grid.walk[cy * grid.cols + cx];
  };
  const firstImage = (cat) => assets.find((a) => a.category === cat)?.images.find(Boolean);
  // the Town Hall picture: the core building component's drawing, or one of its looks
  const core = assets.find((a) => a.category === 'building' && a.stats?.core);
  const townhallImg = [core, ...assets.filter((a) => core && a.stats?.variantOf === core.id)].map((a) => a?.images?.find(Boolean)).find(Boolean);
  const caveImg = firstImage('cave');

  // after every change of the bitmap: walkable grid + the colours it is painted with
  const recomputeGrid = useCallback(() => {
    const c = baseRef.current;
    setGrid(gridFromCanvas(c, map.palette));
    setColours(terrainColours(c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height), map.palette));
  }, [map.palette]);

  // textures to choose from: built-in ones and the kids' texture components
  const textureChoices = useMemo(() => [
    ...BUILT_IN_IDS.map((id) => ({ id, name: t(`maps.tex_${id}`), swatch: textureSwatch(builtInTexture(id, 64)) })),
    ...assets.filter((a) => a.category === 'texture' && a.images?.[0]).map((a) => ({ id: a.id, name: compName(a, i18n.language), swatch: a.images[0], mine: true })),
  ], [assets, t, i18n.language]);

  // the preview: what the game will show (rugged road edges + textures); redrawn after changes
  useEffect(() => {
    if (!preview || !grid) return;
    let alive = true;
    texturedCanvas(ruggedRoads(baseRef.current, map.palette, map.id), map.textures ?? {}, assets).then((shown) => {
      if (!alive || !previewRef.current) return;
      const c = previewRef.current;
      c.width = W; c.height = H;
      c.getContext('2d').drawImage(shown, 0, 0);
    });
    return () => { alive = false; };
  }, [preview, grid, map.textures, map.palette, map.id, assets, W, H]);

  // load the bitmap once
  useEffect(() => {
    let alive = true;
    mapCanvas(initial).then((src) => {
      if (!alive) return;
      const c = baseRef.current;
      c.width = W; c.height = H;
      c.getContext('2d', { willReadFrequently: true }).drawImage(src, 0, 0);
      overRef.current.width = W; overRef.current.height = H;
      recomputeGrid();
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // preload images used on the overlay
  useEffect(() => {
    const want = new Map();
    for (const d of map.decorations) {
      const a = assets.find((x) => x.id === d.asset);
      if (a) want.set(a.id, a.images[0]);
    }
    if (townhallImg) want.set('townhall', townhallImg);
    if (caveImg) want.set('cave', caveImg);
    let changed = false;
    Promise.all([...want].map(async ([k, src]) => {
      if (images.current[k] || !src) return;
      images.current[k] = await loadImage(src);
      changed = true;
    })).then(() => changed && force((n) => n + 1));
  }, [map.decorations, assets, townhallImg, caveImg]);

  // ---------- overlay drawing ----------
  useEffect(() => {
    const c = overRef.current;
    if (!c || c.width !== W) return; // not sized yet (bitmap still loading)
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    if (showGrid && grid) {
      ctx.fillStyle = 'rgba(30,58,138,0.22)';
      for (let y = 0; y < grid.rows; y++) for (let x = 0; x < grid.cols; x++) {
        if (grid.walk[y * grid.cols + x]) ctx.fillRect(x * grid.cell + 1, y * grid.cell + 1, grid.cell - 2, grid.cell - 2);
      }
    }

    for (const d of map.decorations) {
      const img = images.current[d.asset];
      const s = DECOR_BASE * (d.scale ?? 1);
      if (img) ctx.drawImage(img, d.x - s / 2, d.y - s / 2, s, s);
    }

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1e3a8a';
    ctx.fillStyle = '#1e3a8a';
    ctx.font = '22px "Patrick Hand", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (map.centre) {
      ctx.save();
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(map.centre.x, map.centre.y, map.centre.radius ?? CENTRE_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      const img = images.current.townhall;
      if (img) ctx.drawImage(img, map.centre.x - 48, map.centre.y - 48, 96, 96);
      else ctx.fillText(t('maps.marker_centre'), map.centre.x, map.centre.y);
    }

    map.spots.forEach((s, i) => {
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.fillStyle = 'rgba(255,253,247,0.75)';
      ctx.fillRect(s.x - 26, s.y - 26, 52, 52);
      ctx.strokeRect(s.x - 26, s.y - 26, 52, 52);
      ctx.restore();
      ctx.fillText(String(i + 1), s.x, s.y);
    });

    for (const cv of map.caves) {
      const img = images.current.cave;
      if (img) ctx.drawImage(img, cv.x - 32, cv.y - 32, 64, 64);
      else {
        ctx.save();
        ctx.fillStyle = '#3f3f46';
        ctx.beginPath();
        ctx.arc(cv.x, cv.y + 10, 26, Math.PI, 0);
        ctx.lineTo(cv.x + 26, cv.y + 18);
        ctx.lineTo(cv.x - 26, cv.y + 18);
        ctx.fill();
        ctx.restore();
      }
    }
  }, [map, grid, showGrid, W, H, t]);

  // ---------- helpers ----------
  const bctx = () => baseRef.current.getContext('2d', { willReadFrequently: true });
  const toWorld = (e) => {
    const r = overRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const pushUndo = () => {
    undo.current.push({ img: bctx().getImageData(0, 0, W, H), map });
    if (undo.current.length > UNDO_LIMIT) undo.current.shift();
    force((n) => n + 1);
  };
  const doUndo = () => {
    const last = undo.current.pop();
    if (!last) return;
    bctx().putImageData(last.img, 0, 0);
    setMap(last.map);
    recomputeGrid();
  };
  const update = (patch) => setMap((m) => ({ ...m, ...patch }));

  // A cave goes anywhere, right beside the nearest road (null = no road near).
  const caveAt = (p) => (grid ? placeCave(grid, p, { width: W, height: H }) : null);

  // Find a draggable marker under the point.
  const hitTest = (p) => {
    const near = (q, r = HIT) => q && Math.hypot(q.x - p.x, q.y - p.y) <= r;
    for (let i = map.decorations.length - 1; i >= 0; i--) {
      if (near(map.decorations[i], (DECOR_BASE * (map.decorations[i].scale ?? 1)) / 2)) return { kind: 'decorations', i };
    }
    for (let i = 0; i < map.spots.length; i++) if (near(map.spots[i])) return { kind: 'spots', i };
    for (let i = 0; i < map.caves.length; i++) if (near(map.caves[i])) return { kind: 'caves', i };
    if (near(map.centre, 40)) return { kind: 'centre' };
    return null;
  };

  const moveMarker = (hit, p) => {
    if (hit.kind === 'centre') update({ centre: { ...map.centre, x: p.x, y: p.y } });
    else {
      const list = [...map[hit.kind]];
      const pos = hit.kind === 'caves' ? caveAt(p) : p;
      if (!pos) return; // dragged away from every road: the cave stays where it was
      list[hit.i] = { ...list[hit.i], ...pos };
      update({ [hit.kind]: list });
    }
  };

  const removeMarker = (hit) => {
    if (hit.kind === 'centre') update({ centre: null });
    else update({ [hit.kind]: map[hit.kind].filter((_, i) => i !== hit.i) });
  };

  // ---------- painting ----------
  const paintSeg = (a, b) => {
    const c = bctx();
    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    if (tool === 'road') { c.strokeStyle = map.palette.path; c.lineWidth = roadSize; }
    else if (tool === 'grass') { c.strokeStyle = map.palette.grass; c.lineWidth = roadSize; }
    else { c.strokeStyle = color; c.lineWidth = pencilSize; }
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x + 0.01, b.y);
    c.stroke();
    c.restore();
  };

  const onDown = (e) => {
    if (mode === 'terrain') return; // nothing to paint or place here
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toWorld(e);
    if (mode === 'paint') {
      pushUndo();
      if (tool === 'fill') {
        const img = bctx().getImageData(0, 0, W, H);
        floodFill(img.data, W, H, Math.floor(p.x), Math.floor(p.y), hexToRgba(color), 15);
        bctx().putImageData(img, 0, 0);
        recomputeGrid();
        return;
      }
      stroke.current = p;
      paintSeg(p, p);
      return;
    }
    // place mode
    const hit = hitTest(p);
    if (placeTool === 'erase') {
      if (hit) { pushUndo(); removeMarker(hit); }
      return;
    }
    if (hit) { pushUndo(); drag.current = hit; return; }
    pushUndo();
    if (placeTool === 'centre') update({ centre: { x: p.x, y: p.y, radius: CENTRE_RADIUS } });
    else if (placeTool === 'spot' && map.spots.length < MAX_SPOTS) update({ spots: [...map.spots, { id: newId(), ...p }] });
    else if (placeTool === 'cave') {
      const pos = caveAt(p);
      if (!pos) { undo.current.pop(); setPlaceMsg(t('maps.cave_need_road')); return; }
      setPlaceMsg(null);
      update({ caves: [...map.caves, { id: newId(), ...pos }] });
    }
    else if (placeTool === 'decoration' && decorAsset) {
      if (onRoad(p)) { setPlaceMsg(t('maps.decor_on_road')); return; }
      setPlaceMsg(null);
      update({ decorations: [...map.decorations, { id: newId(), asset: decorAsset, x: p.x, y: p.y, scale: decorScale }] });
    }
  };

  const onMove = (e) => {
    const p = toWorld(e);
    if (stroke.current) { paintSeg(stroke.current, p); stroke.current = p; }
    else if (drag.current && !(drag.current.kind === 'decorations' && onRoad(p))) moveMarker(drag.current, p);
  };

  const onUp = () => {
    if (stroke.current) { stroke.current = null; recomputeGrid(); }
    drag.current = null;
  };

  const validation = grid ? validateMap(map, grid) : null;

  const save = () => {
    const background = baseRef.current.toDataURL('image/png');
    onSave({ ...map, background, valid: !!validation?.ok, updatedAt: new Date().toISOString() });
  };

  const setTexture = (colour, id) => {
    const next = { ...(map.textures ?? {}) };
    if (id) next[colour] = id; else delete next[colour];
    update({ textures: next });
  };
  const pickMode = (m) => {
    setMode(m);
    if (m === 'terrain') setPreview(true);
    else if (m === 'paint') setPreview(false); // paint on the real colours
  };
  const colourLabel = (c) => (c === map.palette.path ? t('maps.tool_road') : c === map.palette.grass ? t('maps.tool_grass') : c);

  const PAINT_TOOLS = [['road', '🟨'], ['grass', '🟩'], ['pencil', '✏️'], ['fill', '🪣']];
  const PLACE_TOOLS = [['centre', '🏛️'], ['spot', '⬚'], ['cave', '🕳️'], ['decoration', '🌳'], ['erase', '✕']];

  return (
    <section>
      <div className="row" style={{ marginBottom: 10 }}>
        <label>{t('maps.name')} <input type="text" value={map.name} onChange={(e) => update({ name: e.target.value })} /></label>
        <label>{t('editor.author')} <input type="text" value={map.author ?? ''} onChange={(e) => update({ author: e.target.value })} /></label>
        <label>🏷️ {t('themes.map_theme')}{' '}
          <select value={map.theme ?? ''} onChange={(e) => update({ theme: e.target.value || null })}>
            <option value="">{t('themes.no_theme')}</option>
            {themes.map((th) => <option key={th.id} value={th.id}>{th.icon} {themeName(th, i18n.language)}</option>)}
          </select>
        </label>
        <span className="spacer" />
        <button className="btn" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="btn primary" onClick={save} disabled={!map.name.trim()}>✓ {t('common.save')}</button>
      </div>

      <div className="row" style={{ marginBottom: 8 }}>
        <button className={`tab ${mode === 'paint' ? 'on' : ''}`} onClick={() => pickMode('paint')}>🖌️ {t('maps.mode_paint')}</button>
        <button className={`tab ${mode === 'place' ? 'on' : ''}`} onClick={() => pickMode('place')}>📍 {t('maps.mode_place')}</button>
        <button className={`tab ${mode === 'terrain' ? 'on' : ''}`} onClick={() => pickMode('terrain')}>🧱 {t('maps.mode_terrain')}</button>
        <span className="spacer" />
        <label className="small"><input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} /> {t('maps.preview')}</label>
        <label className="small"><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> {t('maps.show_grid')}</label>
        <button className="btn icon" onClick={doUndo} disabled={!undo.current.length} title={t('sketch.undo')}>↶</button>
      </div>

      {mode === 'terrain' && (
        <div className="sketch-card terrain-panel" style={{ marginBottom: 8 }}>
          <p className="small muted" style={{ margin: '0 0 6px' }}>{t('maps.terrain_hint')}</p>
          {!colours.length && <span className="small muted">{t('maps.terrain_none')}</span>}
          {colours.map((c) => {
            const chosen = textureChoices.find((x) => x.id === map.textures?.[c]);
            return (
              <div key={c} className="row terrain-row">
                <span className="swatch on" style={{ background: c }} title={c} />
                <span className="small" style={{ minWidth: 70 }}>{colourLabel(c)}</span>
                <span>→</span>
                {chosen ? <img className="tex-swatch" src={chosen.swatch} alt="" /> : <span className="tex-swatch" style={{ background: c }} />}
                <select value={map.textures?.[c] ?? ''} onChange={(e) => setTexture(c, e.target.value)}>
                  <option value="">{t('maps.texture_none')}</option>
                  {textureChoices.filter((x) => !x.mine).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  {textureChoices.some((x) => x.mine) && (
                    <optgroup label={t('maps.my_textures')}>
                      {textureChoices.filter((x) => x.mine).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
            );
          })}
        </div>
      )}

      <div className="row" style={{ marginBottom: 8, minHeight: mode === 'terrain' ? 0 : 44 }}>
        {mode === 'terrain' ? null : mode === 'paint' ? (
          <>
            {PAINT_TOOLS.map(([id, icon]) => (
              <button key={id} className={`btn icon ${tool === id ? 'active' : ''}`} onClick={() => setTool(id)}>{icon} {t(`maps.tool_${id}`)}</button>
            ))}
            <span className="muted">|</span>
            {(tool === 'road' || tool === 'grass') && ROAD_SIZES.map((s) => (
              <button key={s} className={`btn icon ${roadSize === s ? 'active' : ''}`} onClick={() => setRoadSize(s)}>
                <span style={{ display: 'inline-block', width: s / 3, height: s / 3, borderRadius: '50%', background: tool === 'road' ? map.palette.path : map.palette.grass, border: '1px solid var(--ink)' }} />
              </button>
            ))}
            {(tool === 'pencil' || tool === 'fill') && (
              <>
                {tool === 'pencil' && PENCIL_SIZES.map((s) => (
                  <button key={s} className={`btn icon ${pencilSize === s ? 'active' : ''}`} onClick={() => setPencilSize(s)}>
                    <span style={{ display: 'inline-block', width: s + 2, height: s + 2, borderRadius: '50%', background: 'var(--ink)' }} />
                  </button>
                ))}
                {[...DECOR_COLORS, map.palette.path, map.palette.grass].map((c) => (
                  <button key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
                ))}
              </>
            )}
          </>
        ) : (
          <>
            {PLACE_TOOLS.map(([id, icon]) => (
              <button key={id} className={`btn icon ${placeTool === id ? 'active' : ''}`} onClick={() => { setPlaceTool(id); setPlaceMsg(null); }}>
                {icon} {t(`maps.place_${id}`)}{id === 'spot' ? ` (${map.spots.length})` : ''}
              </button>
            ))}
          </>
        )}
      </div>

      {mode === 'place' && placeTool === 'decoration' && (
        <div className="sketch-card decor-picker" style={{ marginBottom: 8 }}>
          {decorations.length + otherDrawings.length === 0 && <span className="muted small">{t('maps.no_decorations')}</span>}
          {[[decorations, 'maps.decor_nature'], [otherDrawings, 'maps.decor_other']].map(([list, label]) => list.length > 0 && (
            <div key={label}>
              <div className="small muted">{t(label)}</div>
              <div className="row" style={{ gap: 6 }}>
                {list.map((d) => (
                  <button key={d.id} className={`decor-tile ${decorAsset === d.id ? 'on' : ''}`} onClick={() => setDecorAsset(d.id)} title={compName(d, i18n.language)}>
                    <img src={d.images[0]} alt="" />
                    <span>{compName(d, i18n.language)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <label className="small">{t('maps.decor_size')} <input type="range" min={0.5} max={3} step={0.1} value={decorScale} onChange={(e) => setDecorScale(+e.target.value)} /></label>
        </div>
      )}

      <p className="small muted" style={{ margin: '0 0 6px' }}>
        {mode !== 'terrain' && t(mode === 'paint' ? `maps.hint_${tool}` : `maps.hint_place_${placeTool}`)}
        {mode === 'place' && placeMsg && <b className="error-text"> {placeMsg}</b>}
      </p>

      <div style={{ position: 'relative', width: '100%', aspectRatio: `${W} / ${H}`, border: '2.5px solid var(--ink)', borderRadius: 6, overflow: 'hidden' }}>
        <canvas ref={baseRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <canvas ref={previewRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: preview ? 'block' : 'none' }} />
        <canvas
          ref={overRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', cursor: mode === 'paint' ? 'crosshair' : mode === 'place' ? 'pointer' : 'default' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      </div>

      {validation && (
        <div className="sketch-card" style={{ marginTop: 12, background: validation.ok ? 'var(--hl-green)' : '#fffdf7' }}>
          {validation.ok ? (
            <b>✓ {t('maps.valid')}</b>
          ) : (
            <>
              <b>{t('maps.problems')}</b>
              <ul style={{ margin: '4px 0 0' }}>
                {validation.problems.map((p, i) => <li key={i}>{t(`maps.problem_${p.key}`, p.params)}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
