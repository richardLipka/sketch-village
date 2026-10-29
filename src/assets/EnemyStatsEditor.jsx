import React from 'react';
import { useTranslation } from 'react-i18next';
import NumField from './NumField.jsx';
import { DEFAULT_ENEMY_STATS } from '../config/components.js';

// Properties of an enemy component, next to its picture.

const FIELDS = [
  ['hp', 1, 5000, 1],
  ['speed', 5, 200, 1],
  ['damage', 0, 200, 1],
  ['cooldown', 0.2, 5, 0.1],
  ['range', 10, 300, 5],
];

export default function EnemyStatsEditor({ stats: raw, onChange }) {
  const { t } = useTranslation();
  const stats = { ...DEFAULT_ENEMY_STATS, ...raw };
  const set = (patch) => onChange({ ...stats, ...patch });
  const [lo, hi] = stats.coins ?? [1, 1];

  return (
    <div className="sketch-card" style={{ padding: 10 }}>
      <h3 style={{ margin: '0 0 6px' }}>{t('weapons.numbers')}</h3>
      <div className="row" style={{ gap: 14 }}>
        {FIELDS.map(([f, min, max, step]) => (
          <NumField key={f} label={t(`enemies.f_${f}`)} value={stats[f]} min={min} max={max} step={step} onChange={(v) => set({ [f]: v })} />
        ))}
        <NumField label={t('enemies.f_armorPct')} value={stats.armor} min={0} max={0.9} step={0.05} pct onChange={(v) => set({ armor: v })} />
        <label className="row small" style={{ gap: 6 }}>
          {t('enemies.f_coins')}
          <NumField value={lo} min={0} max={99} onChange={(v) => set({ coins: [v, Math.max(v, hi)] })} width={56} />–
          <NumField value={hi} min={0} max={99} onChange={(v) => set({ coins: [Math.min(lo, v), v] })} width={56} />
        </label>
      </div>
      <div className="row small" style={{ gap: 14, marginTop: 8 }}>
        {[['flying', '🪽'], ['ranged', '🏹'], ['boss', '👑']].map(([k, icon]) => (
          <label key={k}><input type="checkbox" checked={!!stats[k]} onChange={(e) => set({ [k]: e.target.checked })} /> {icon} {t(`enemies.${k}`)}</label>
        ))}
        <label>{t('enemies.color')} <input type="color" value={stats.color} onChange={(e) => set({ color: e.target.value })} style={{ width: 48, height: 36 }} /></label>
      </div>
    </div>
  );
}
