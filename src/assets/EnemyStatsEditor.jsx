import React from 'react';
import { useTranslation } from 'react-i18next';
import NumField from './NumField.jsx';
import ProjectilePick from './ProjectilePick.jsx';
import { DEFAULT_ENEMY_STATS } from '../config/components.js';

// Properties of an enemy component, next to its picture: its numbers, what it
// is (flies, shoots, boss), its size, and – for summoners like a necromancer or
// a spider queen – which other enemies it calls, how many and how often.

const FIELDS = [
  ['hp', 1, 5000, 1],
  ['speed', 0, 200, 1],
  ['damage', 0, 200, 1],
  ['cooldown', 0.2, 5, 0.1],
  ['range', 10, 300, 5],
  ['splash', 0, 200, 5], // area damage: everyone defending this close to the hit gets hurt too
];

const MINION_FIELDS = [
  ['minionCount', 1, 10, 1],
  ['minionEvery', 1, 60, 0.5],
  ['minionMax', 1, 30, 1],
  ['minionOnDeath', 0, 10, 1],
];

export default function EnemyStatsEditor({ id, stats: raw, enemies = [], projectiles = [], onChange }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const stats = { ...DEFAULT_ENEMY_STATS, ...raw };
  const set = (patch) => onChange({ ...stats, ...patch });
  const [lo, hi] = stats.coins ?? [1, 1];
  const minions = stats.minions ?? [];
  // the ability is switched on with a checkbox; switching it off keeps the choice for later
  const summons = stats.summons ?? minions.length > 0;
  const others = enemies.filter((e) => e.id !== id);
  const toggleMinion = (mid) => set({ minions: minions.includes(mid) ? minions.filter((x) => x !== mid) : [...minions, mid] });

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
        <NumField label={t('enemies.f_size')} value={stats.size} min={0.4} max={2.5} step={0.05} pct onChange={(v) => set({ size: v })} />
      </div>
      <div className="row small" style={{ gap: 14, marginTop: 8 }}>
        {[['flying', '🪽'], ['ranged', '🏹'], ['boss', '👑']].map(([k, icon]) => (
          <label key={k}><input type="checkbox" checked={!!stats[k]} onChange={(e) => set({ [k]: e.target.checked })} /> {icon} {t(`enemies.${k}`)}</label>
        ))}
        <label>{t('enemies.color')} <input type="color" value={stats.color} onChange={(e) => set({ color: e.target.value })} style={{ width: 48, height: 36 }} /></label>
      </div>
      {stats.ranged && <div style={{ marginTop: 8 }}><ProjectilePick value={stats.projectile} projectiles={projectiles} onChange={(projectile) => set({ projectile })} /></div>}

      <label className="row" style={{ gap: 8, margin: '12px 0 4px' }}>
        <input type="checkbox" checked={summons} onChange={(e) => set({ summons: e.target.checked })} />
        <b>💀 {t('enemies.minions')}</b>
      </label>
      {summons && <p className="small muted" style={{ margin: '0 0 6px' }}>{t('enemies.minions_hint')}</p>}
      {summons && <div className="row" style={{ gap: 6 }}>
        {others.map((e) => (
          <button key={e.id} type="button" className={`btn chip ${minions.includes(e.id) ? 'active' : ''}`} onClick={() => toggleMinion(e.id)}>
            {e.image ? <img src={e.image} alt="" className="chip-img" /> : <span className="chip-dot" style={{ background: e.color }} />}
            {e.name?.[lang] ?? e.id}
          </button>
        ))}
      </div>}
      {summons && minions.length > 0 && (
        <div className="row" style={{ gap: 14, marginTop: 8 }}>
          {MINION_FIELDS.map(([f, min, max, step]) => (
            <NumField key={f} label={t(`enemies.f_${f}`)} value={stats[f]} min={min} max={max} step={step} onChange={(v) => set({ [f]: v })} />
          ))}
        </div>
      )}
    </div>
  );
}
