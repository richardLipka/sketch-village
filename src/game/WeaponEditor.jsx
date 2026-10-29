import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_WEAPONS, WEAPON_CLASSES } from '../config/weapons.js';
import { newId } from '../data/saveFile.js';
import WeaponIcon, { CLASS_ICON } from './WeaponIcon.jsx';

// Edit weapons (SPEC §6.3): name, class, drawing, what they add to the hero's
// attack, shop price / from which round, and how often chests contain them.
// Saves the whole list into the `weapons` collection.

// [field, min, max, step]
const FIELDS = [
  ['damage', -50, 200, 1],
  ['range', -100, 400, 5],
  ['cooldown', -2, 3, 0.05],
  ['splash', 0, 200, 5],
  ['price', 0, 999, 5],
  ['round', 1, 99, 1],
  ['drop', 0, 10, 1],
];

const now = () => new Date().toISOString();

export default function WeaponEditor({ weapons, assets, onChange }) {
  const { t, i18n } = useTranslation();
  const [list, setList] = useState(() => weapons.map((w) => ({ ...w })));
  const [dirty, setDirty] = useState(false);
  const drawings = assets.filter((a) => a.category === 'weapon');
  const lang = i18n.language;

  const edit = (i, patch) => {
    setList((l) => l.map((w, j) => (j === i ? { ...w, ...patch, updatedAt: now() } : w)));
    setDirty(true);
  };
  const setName = (i, v) => {
    const w = list[i];
    const other = lang === 'cs' ? 'en' : 'cs';
    const keepOther = w.name?.[other] && w.name[other] !== w.name?.[lang];
    edit(i, { name: { ...w.name, [lang]: v, ...(keepOther ? {} : { [other]: v }) } });
  };
  const add = (kind) => {
    const label = `${t(`weapons.class_${kind}`)} ${list.filter((w) => w.kind === kind).length + 1}`;
    setList((l) => [...l, {
      id: newId(), name: { cs: label, en: label }, kind, damage: 4, range: 0, cooldown: 0, splash: kind === 'magic' ? 40 : 0,
      price: 30, shop: true, round: 1, drop: 2, createdAt: now(), updatedAt: now(),
    }]);
    setDirty(true);
  };
  const remove = (i) => {
    if (!confirm(t('weapons.confirm_delete', { name: list[i].name?.[lang] ?? list[i].id }))) return;
    setList((l) => l.filter((_, j) => j !== i));
    setDirty(true);
  };
  const save = () => { onChange(list); setDirty(false); };
  const reset = () => {
    if (!confirm(t('weapons.confirm_reset'))) return;
    setList(DEFAULT_WEAPONS.map((w) => ({ ...w })));
    setDirty(true);
  };

  return (
    <section>
      <h1>🗡️ {t('weapons.title')}</h1>
      <p className="muted small">{t('weapons.hint')}</p>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn primary" onClick={save} disabled={!dirty}>✓ {t('common.save')}</button>
        {WEAPON_CLASSES.map((k) => <button key={k} className="btn" onClick={() => add(k)}>+ {CLASS_ICON[k]} {t(`weapons.class_${k}`)}</button>)}
        <button className="btn" onClick={reset}>↺ {t('weapons.reset')}</button>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {list.map((w, i) => (
          <div key={w.id} className="sketch-card" style={{ padding: 12 }}>
            <div className="row">
              <div className="checker" style={{ width: 56, height: 56, borderRadius: 6, display: 'grid', placeItems: 'center' }}>
                <WeaponIcon weapon={w} assets={assets} size={48} />
              </div>
              <input value={w.name?.[lang] ?? ''} onChange={(e) => setName(i, e.target.value)} aria-label={t('enemies.name')} style={{ fontSize: 22, width: 170, fontWeight: 'bold' }} />
              <select value={w.kind} onChange={(e) => edit(i, { kind: e.target.value })} aria-label={t('weapons.class')}>
                {WEAPON_CLASSES.map((k) => <option key={k} value={k}>{CLASS_ICON[k]} {t(`weapons.class_${k}`)}</option>)}
              </select>
              <label className="small">{t('enemies.drawing')}
                <select value={w.asset ?? ''} onChange={(e) => edit(i, { asset: e.target.value || undefined })}>
                  <option value="">{t('weapons.no_drawing')}</option>
                  {drawings.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label className="small"><input type="checkbox" checked={!!w.shop} onChange={(e) => edit(i, { shop: e.target.checked })} /> 🛒 {t('weapons.in_shop')}</label>
              <span className="spacer" />
              <button className="btn icon danger" onClick={() => remove(i)} title={t('common.delete')}>🗑</button>
            </div>
            <div className="row small" style={{ marginTop: 8, gap: 14 }}>
              {FIELDS.filter(([f]) => f !== 'splash' || w.kind === 'magic').map(([f, min, max, step]) => (
                <label key={f}>
                  {t(`weapons.f_${f}`)}
                  <input type="number" min={min} max={max} step={step} value={w[f] ?? 0} style={{ width: 66 }}
                    onChange={(e) => { const v = Number(e.target.value); if (e.target.value !== '' && !Number.isNaN(v)) edit(i, { [f]: Math.min(max, Math.max(min, v)) }); }} />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
