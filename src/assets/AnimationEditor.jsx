import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AnimPreview from './AnimPreview.jsx';
import PasteButton from './PasteButton.jsx';
import ImageSlot from './ImageSlot.jsx';
import {
  ANIM_KINDS, MIN_FRAMES, MAX_FRAMES, MIN_FPS, MAX_FPS, DEFAULT_FPS, sliceStrip, guessStripFrames, loadFrames, hasAnim,
  insertFrame, replaceFrame, duplicateFrame, moveFrame,
} from './animation.js';

// Animations of one component (walking / attacking / reloading), next to its
// still picture. The sequence is a row of frame PANELS side by side, each made
// with the same tools as any picture – draw (over the previous frame, shown
// faded), photo, upload or paste, then crop and remove paper. Panels can be
// copied (the flip-book way: copy, then change a little), moved and removed;
// "+" adds one. A ready strip of 4–12 frames can still be opened (file or
// clipboard): it is cut into panels (frame count guessed from the paper gaps).
// Then line the frames up: the selected frame is drawn over the previous one
// (faded) and can be nudged or dragged. Set the speed and watch the preview.
// No animation = the still picture is used.

const VIEW = 224; // px of the alignment view

export default function AnimationEditor({ kinds, anims = {}, size = 128, removeBg = true, onChange }) {
  const { t } = useTranslation();
  const [kind, setKind] = useState(kinds[0]);
  const [raw, setRaw] = useState(null); // the strip just opened (can be cut again with another frame count)
  const [count, setCount] = useState(6);
  const [dir, setDir] = useState(null); // null = automatic
  const [paper, setPaper] = useState(removeBg);
  const [sel, setSel] = useState(0);
  const [onion, setOnion] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const anim = anims[kind];

  const setAnim = (a) => {
    const next = { ...anims };
    if (a) next[kind] = a; else delete next[kind];
    onChange(next);
  };

  // cut the strip again whenever the frame count / direction / paper option changes
  useEffect(() => {
    if (!raw) return;
    let alive = true;
    setBusy(true);
    sliceStrip(raw, count, { size, dir: dir ?? undefined, removeBg: paper }).then((frames) => {
      if (!alive) return;
      setBusy(false);
      setSel(0);
      setAnim({ frames, fps: anim?.fps ?? DEFAULT_FPS, offsets: frames.map(() => [0, 0]) });
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, count, dir, paper]);

  // a strip from a file or the clipboard: guess the frame count, then cut it
  const openStrip = async (src) => {
    const guess = await guessStripFrames(src).catch(() => null);
    setDir(null);
    if (guess) setCount(guess);
    setRaw(src);
  };
  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => openStrip(reader.result);
    reader.readAsDataURL(file);
  };

  const pickKind = (k) => { setKind(k); setRaw(null); setSel(0); };
  // a change made on the panels: the strip just opened is no longer re-cut
  const apply = (next, select = sel) => {
    setRaw(null);
    setAnim(next);
    setSel(Math.max(0, Math.min(select, (next?.frames.length ?? 1) - 1)));
  };
  const cat = { size, removeBg };
  const frames = anim?.frames ?? [];
  const full = frames.length >= MAX_FRAMES;
  const offsetOf = (i) => anim.offsets?.[i] ?? [0, 0];
  const placeAt = (pos) => {
    const offsets = anim.frames.map((_, i) => offsetOf(i));
    offsets[sel] = pos;
    setAnim({ ...anim, offsets });
  };
  const nudge = (dx, dy) => (dx === null ? placeAt([0, 0]) : placeAt([offsetOf(sel)[0] + dx, offsetOf(sel)[1] + dy]));

  return (
    <div className="sketch-card anim-editor" style={{ padding: 10 }}>
      <h3 style={{ margin: '0 0 6px' }}>🎞️ {t('anim.title')}</h3>
      <div className="row" style={{ gap: 6, marginBottom: 6 }}>
        {kinds.map((k) => (
          <button key={k} type="button" className={`btn chip ${k === kind ? 'active' : ''}`} onClick={() => pickKind(k)}>
            {ANIM_KINDS[k]} {t(`anim.kind_${k}`)} {hasAnim(anims[k]) && '✓'}
          </button>
        ))}
      </div>
      <p className="small muted" style={{ margin: '0 0 6px' }}>{t('anim.hint')}</p>

      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn" onClick={() => fileRef.current.click()}>📁 {t('anim.open_strip')}</button>
        <PasteButton className="btn" label={t('paste.short')} onImage={openStrip} />
        {hasAnim(anim) && <button type="button" className="btn danger" onClick={() => { setRaw(null); setAnim(null); }}>🗑 {t('anim.remove')}</button>}
        {busy && <span className="small muted">⏳</span>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />

      {raw && (
        <div className="row small" style={{ gap: 12, marginTop: 8 }}>
          <label>{t('anim.frames')}{' '}
            <select value={count} onChange={(e) => setCount(+e.target.value)}>
              {Array.from({ length: MAX_FRAMES - MIN_FRAMES + 1 }, (_, i) => MIN_FRAMES + i).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label>{t('anim.direction')}{' '}
            <select value={dir ?? ''} onChange={(e) => setDir(e.target.value || null)}>
              <option value="">{t('anim.dir_auto')}</option>
              <option value="h">↔ {t('anim.dir_h')}</option>
              <option value="v">↕ {t('anim.dir_v')}</option>
            </select>
          </label>
          <label><input type="checkbox" checked={paper} onChange={(e) => setPaper(e.target.checked)} /> {t('anim.remove_paper')}</label>
        </div>
      )}

      <div className="frame-panels">
        {frames.map((f, i) => (
          <ImageSlot
            key={i} compact label={String(i + 1)} image={f} category={cat}
            underlay={frames[i - 1] ?? null} selected={i === sel} onSelect={() => setSel(i)}
            removeTitle={t('anim.frame_remove')}
            onChange={(img) => apply(replaceFrame(anim, i, img), i)}
          >
            <div className="frame-ops">
              <button type="button" className="btn icon" title={t('anim.frame_left')} disabled={i === 0} onClick={() => apply(moveFrame(anim, i, -1), i - 1)}>◀</button>
              <button type="button" className="btn icon" title={t('anim.frame_copy')} disabled={full} onClick={() => apply(duplicateFrame(anim, i), i + 1)}>⧉</button>
              <button type="button" className="btn icon" title={t('anim.frame_right')} disabled={i === frames.length - 1} onClick={() => apply(moveFrame(anim, i, 1), i + 1)}>▶</button>
            </div>
          </ImageSlot>
        ))}
        {!full && (
          <div className="add-frame-wrap">
            <ImageSlot
              compact adder label={`+ ${t('anim.frame_new')}`} image={null} category={cat} underlay={frames.at(-1) ?? null}
              onChange={(img) => img && apply(insertFrame(anim, img), frames.length)}
            >
              {frames.length > 0 && (
                <div className="frame-ops">
                  <button type="button" className="btn" title={t('anim.frame_copy_last_hint')} onClick={() => apply(duplicateFrame(anim, frames.length - 1), frames.length)}>⧉ {t('anim.frame_copy_last')}</button>
                </div>
              )}
            </ImageSlot>
          </div>
        )}
      </div>
      {frames.length > 0 && <p className="small muted" style={{ margin: '4px 0 0' }}>{t('anim.panels_hint', { n: frames.length, max: MAX_FRAMES })}</p>}

      {hasAnim(anim) && (
        <>
          <div className="row" style={{ gap: 16, alignItems: 'flex-start', marginTop: 10 }}>
            <div>
              <div className="small muted">{t('anim.align')}</div>
              <OnionView anim={anim} sel={sel} onion={onion} size={size} onDragTo={placeAt} />
              <div className="row" style={{ gap: 4, marginTop: 4 }}>
                <button type="button" className="btn icon" onClick={() => nudge(-1, 0)} aria-label="←">←</button>
                <button type="button" className="btn icon" onClick={() => nudge(0, -1)} aria-label="↑">↑</button>
                <button type="button" className="btn icon" onClick={() => nudge(0, 1)} aria-label="↓">↓</button>
                <button type="button" className="btn icon" onClick={() => nudge(1, 0)} aria-label="→">→</button>
                <button type="button" className="btn icon" onClick={() => nudge(null)} title={t('anim.reset')}>⟲</button>
                <span className="small muted">{(anim.offsets?.[sel] ?? [0, 0]).join(', ')}</span>
              </div>
              <label className="small"><input type="checkbox" checked={onion} onChange={(e) => setOnion(e.target.checked)} /> {t('anim.show_previous')}</label>
            </div>
            <div>
              <div className="small muted">{t('anim.preview')}</div>
              <AnimPreview anim={anim} size={128} />
              <label className="small" style={{ display: 'block', marginTop: 6 }}>
                {t('anim.speed')}: {anim.fps ?? DEFAULT_FPS} {t('anim.fps')}
                <br />
                <input type="range" min={MIN_FPS} max={MAX_FPS} value={anim.fps ?? DEFAULT_FPS} onChange={(e) => setAnim({ ...anim, fps: +e.target.value })} />
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// The selected frame drawn over the previous one (faded) – drag it to line it up.
function OnionView({ anim, sel, onion, size, onDragTo }) {
  const ref = useRef(null);
  const [frames, setFrames] = useState([]);
  const drag = useRef(null);
  useEffect(() => { let alive = true; loadFrames(anim).then((f) => alive && setFrames(f)); return () => { alive = false; }; }, [anim]);

  useEffect(() => {
    const c = ref.current;
    // right after frames were added / removed the loaded pictures lag behind – wait for them
    if (!c || !frames.length || frames.length !== anim.frames.length || !frames[sel]) return;
    const ctx = c.getContext('2d');
    const k = VIEW / size;
    ctx.clearRect(0, 0, VIEW, VIEW);
    // a light cross to line things up against
    ctx.strokeStyle = 'rgba(30,58,138,0.25)';
    ctx.beginPath(); ctx.moveTo(VIEW / 2, 0); ctx.lineTo(VIEW / 2, VIEW); ctx.moveTo(0, VIEW * 0.85); ctx.lineTo(VIEW, VIEW * 0.85); ctx.stroke();
    const draw = (i, alpha) => {
      const [dx, dy] = anim.offsets?.[i] ?? [0, 0];
      ctx.globalAlpha = alpha;
      ctx.drawImage(frames[i], dx * k, dy * k, VIEW, VIEW);
    };
    const prev = (sel - 1 + frames.length) % frames.length;
    if (onion && frames.length > 1) draw(prev, 0.35);
    draw(sel, onion ? 0.8 : 1);
    ctx.globalAlpha = 1;
  }, [frames, anim, sel, onion, size]);

  // a drag moves the frame by the total distance from where it was grabbed
  const pos = (e) => { const r = ref.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, s: size / r.width }; };
  return (
    <canvas
      ref={ref} width={VIEW} height={VIEW} className="checker onion"
      style={{ width: VIEW, height: VIEW, touchAction: 'none', cursor: 'move' }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); drag.current = { ...pos(e), from: anim.offsets?.[sel] ?? [0, 0] }; }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const p = pos(e);
        const to = [d.from[0] + Math.round((p.x - d.x) * p.s), d.from[1] + Math.round((p.y - d.y) * p.s)];
        const cur = anim.offsets?.[sel] ?? [0, 0];
        if (to[0] !== cur[0] || to[1] !== cur[1]) onDragTo(to);
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
    />
  );
}
