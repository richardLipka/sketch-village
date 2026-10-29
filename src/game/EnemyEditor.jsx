import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_ENEMY_TYPES } from '../config/enemies.js';

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
                <b style={{ fontSize: 24, minWidth: 110 }}>{e.name?.[lang] ?? e.id}</b>
                <span className="small muted">
                  {[e.flying && `🪽 ${t('enemies.flying')}`, e.ranged && `🏹 ${t('enemies.ranged')}`, e.boss && `👑 ${t('enemies.boss')}`].filter(Boolean).join(' · ')}
                </span>
                <span className="spacer" />
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
