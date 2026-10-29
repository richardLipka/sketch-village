import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_ENEMY_TYPES } from '../config/enemies.js';
import { newId } from '../data/saveFile.js';

// "hsl(h s% l%)" → "#rrggbb" (the colour input only takes hex)
function hslToHex(hsl) {
  const [h, s, l] = hsl.match(/[\d.]+/g).map(Number);
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Edit enemy types: which drawing each one uses and its numbers (SPEC §9, §16.4).
// Saves the whole list into the `enemyTypes` collection.

const FIELDS = [
  ['hp', 1, 2000, 1],
  ['speed', 5, 200, 1],
  ['damage', 0, 200, 1],
  ['cooldown', 0.2, 5, 0.1],
  ['range', 10, 300, 5],
  ['armorPct', 0, 60, 5],
];

const now = () => new Date().toISOString();

export default function EnemyEditor({ enemyTypes, assets, onChange }) {
  const { t, i18n } = useTranslation();
  const [list, setList] = useState(() => enemyTypes.map((e) => ({ ...e })));
  const [dirty, setDirty] = useState(false);
  const drawings = assets.filter((a) => a.category === 'enemy');
  const lang = i18n.language;

  const edit = (i, patch) => {
    setList((l) => l.map((e, j) => (j === i ? { ...e, ...patch, updatedAt: now() } : e)));
    setDirty(true);
  };

  const getField = (e, f) => (f === 'armorPct' ? Math.round((e.armor ?? 0) * 100) : e[f]);
  const setField = (i, f, v) => (f === 'armorPct' ? edit(i, { armor: v / 100 }) : edit(i, { [f]: v }));

  const save = () => { onChange(list); setDirty(false); };

  // kids can invent new monsters; the built-in ones can be changed but not deleted
  // (the default waves use them)
  const builtIn = (id) => DEFAULT_ENEMY_TYPES.some((d) => d.id === id);
  const add = () => {
    const base = DEFAULT_ENEMY_TYPES[0];
    const n = list.filter((e) => !builtIn(e.id)).length + 1;
    const label = `${t('enemies.new_name')} ${n}`;
    const color = `hsl(${Math.floor(Math.random() * 360)} 65% 45%)`;
    setList((l) => [...l, { ...base, id: newId(), name: { cs: label, en: label }, color: hslToHex(color), asset: undefined, createdAt: now(), updatedAt: now() }]);
    setDirty(true);
  };
  const remove = (i) => {
    if (!confirm(t('enemies.confirm_delete', { name: list[i].name?.[lang] ?? list[i].id }))) return;
    setList((l) => l.filter((_, j) => j !== i));
    setDirty(true);
  };
  const setName = (i, v) => {
    const e = list[i];
    const other = lang === 'cs' ? 'en' : 'cs';
    // a new monster gets the same name in both languages until someone translates it
    const keepOther = e.name?.[other] && e.name[other] !== e.name?.[lang];
    edit(i, { name: { ...e.name, [lang]: v, ...(keepOther ? {} : { [other]: v }) } });
  };
  const reset = () => {
    if (!confirm(t('enemies.confirm_reset'))) return;
    setList(DEFAULT_ENEMY_TYPES.map((e) => ({ ...e })));
    setDirty(true);
  };

  return (
    <section>
      <h1>{t('enemies.title')}</h1>
      <p className="muted small">{t('enemies.hint')}</p>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn primary" onClick={save} disabled={!dirty}>✓ {t('common.save')}</button>
        <button className="btn" onClick={add}>+ {t('enemies.add')}</button>
        <button className="btn" onClick={reset}>↺ {t('enemies.reset')}</button>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {list.map((e, i) => {
          const pic = drawings.find((d) => d.id === e.asset)?.images[0];
          return (
            <div key={e.id} className="sketch-card" style={{ padding: 12 }}>
              <div className="row">
                <div className="checker" style={{ width: 64, height: 64, borderRadius: 6, display: 'grid', placeItems: 'center' }}>
                  {pic ? <img src={pic} alt="" style={{ width: 60, height: 60, objectFit: 'contain' }} /> : <span style={{ width: 36, height: 36, borderRadius: '50%', background: e.color, border: '2px solid #111' }} />}
                </div>
                <input
                  value={e.name?.[lang] ?? ''} onChange={(ev) => setName(i, ev.target.value)} aria-label={t('enemies.name')}
                  style={{ fontSize: 22, width: 150, fontWeight: 'bold' }}
                />
                <input type="color" value={e.color ?? '#16a34a'} onChange={(ev) => edit(i, { color: ev.target.value })} title={t('enemies.color')} style={{ width: 40, height: 32 }} />
                <span className="row small" style={{ gap: 8 }}>
                  {[['flying', '🪽'], ['ranged', '🏹'], ['boss', '👑']].map(([k, icon]) => (
                    <label key={k}><input type="checkbox" checked={!!e[k]} onChange={(ev) => edit(i, { [k]: ev.target.checked })} /> {icon} {t(`enemies.${k}`)}</label>
                  ))}
                </span>
                <span className="spacer" />
                {!builtIn(e.id) && <button className="btn icon danger" onClick={() => remove(i)} title={t('common.delete')}>🗑</button>}
                <label className="small">{t('enemies.drawing')}
                  <select value={e.asset ?? ''} onChange={(ev) => edit(i, { asset: ev.target.value || undefined })}>
                    <option value="">{t('enemies.no_drawing')}</option>
                    {drawings.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="row small" style={{ marginTop: 8, gap: 14 }}>
                {FIELDS.map(([f, min, max, step]) => (
                  <label key={f}>
                    {t(`enemies.f_${f}`)}
                    <input
                      type="number" min={min} max={max} step={step} value={getField(e, f)}
                      onChange={(ev) => { const v = Number(ev.target.value); if (!Number.isNaN(v)) setField(i, f, Math.min(max, Math.max(min, v))); }}
                      style={{ width: 70 }}
                    />
                  </label>
                ))}
                <label>
                  {t('enemies.f_coins')}
                  <input type="number" min={0} max={50} value={e.coins?.[0] ?? 1} style={{ width: 50 }}
                    onChange={(ev) => edit(i, { coins: [Number(ev.target.value), Math.max(Number(ev.target.value), e.coins?.[1] ?? 1)] })} />
                  –
                  <input type="number" min={0} max={50} value={e.coins?.[1] ?? 1} style={{ width: 50 }}
                    onChange={(ev) => edit(i, { coins: [Math.min(Number(ev.target.value), e.coins?.[0] ?? 1), Number(ev.target.value)] })} />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
