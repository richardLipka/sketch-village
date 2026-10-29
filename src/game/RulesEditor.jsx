import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_RULES } from '../config/rules.js';
import { unlockLabel } from '../config/unlocks.js';
import NumField from '../assets/NumField.jsx';

// Global game rules – only what doesn't belong to one component: the hero's
// point system and upgrade prices / rounds, economy and timing, building repair
// and selling, soldier movement. Buildings, enemies, weapons and coins are
// edited with their pictures in the component editor (studio).
// Saved as one record in the `rules` collection (part of the exported JSON).

// [group, key, min, max, step, percent?]
const GENERAL = [
  ['balance', 'startCoins', 0, 999, 5],
  ['balance', 'firstPrep', 5, 300, 5],
  ['balance', 'prep', 5, 300, 5],
  ['balance', 'rewardBase', 0, 200, 1],
  ['balance', 'earlyBonusPerSecond', 0, 5, 0.1],
  ['balance', 'hpScalePerRound', 0, 0.5, 0.01, true],
  ['balance', 'coinLifetime', 5, 300, 5],
  ['balance', 'heroLives', 1, 20, 1],
  ['balance', 'heroRespawnDelay', 0, 120, 1],
  ['balance', 'weaponSwitchTime', 0, 10, 0.5],
  ['balance', 'chestChance', 0, 1, 0.01, true],
  ['balance', 'chestLifetime', 5, 300, 5],
  ['balance', 'chestCoins', 0, 200, 5],
  ['build', 'sellRefund', 0, 1, 0.05, true],
  ['build', 'workerSpeedup', 0, 1, 0.01, true],
  ['build', 'regenPerSecond', 0, 0.2, 0.005, true],
  ['build', 'regenDelay', 0, 60, 1],
  ['build', 'interactRadius', 30, 400, 10],
  ['soldier', 'speed', 10, 300, 5],
  ['soldier', 'aggro', 30, 500, 10],
];

// hero skill-point table (rules.hero)
const HERO = [
  ['points', 1, 40, 1], ['statMax', 1, 20, 1], ['hp', 10, 2000, 10],
  ['meleeDamage', 0, 200, 1], ['meleePerPoint', 0, 50, 1], ['meleeRange', 20, 120, 5], ['meleeCooldown', 0.1, 5, 0.1],
  ['rangedDamage', 0, 200, 1], ['rangedPerPoint', 0, 50, 1], ['rangedRange', 50, 600, 10], ['rangedCooldown', 0.1, 10, 0.1],
  ['rangedCooldownPerPoint', 0, 1, 0.05], ['rangedMinCooldown', 0.1, 5, 0.1],
  ['armorPerPoint', 0, 0.3, 0.01, true], ['armorMax', 0, 0.95, 0.05, true],
  ['speed', 20, 400, 5], ['speedPerPoint', 0, 60, 1],
  ['magicDamage', 0, 200, 1], ['magicRange', 50, 600, 10], ['magicCooldown', 0.3, 10, 0.1],
];

const clone = (x) => JSON.parse(JSON.stringify(x));
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '8px 18px' };

export default function RulesEditor({ rules, onSave }) {
  const { t } = useTranslation();
  const [r, setR] = useState(() => clone(rules));
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  const touch = () => { setDirty(true); setSaved(false); };
  const setHeroCost = (li, v) => { setR((x) => ({ ...x, heroUpgradeCosts: x.heroUpgradeCosts.map((c, j) => (j === li ? v : c)) })); touch(); };
  const setUnlock = (key, round) => { setR((x) => ({ ...x, unlocks: x.unlocks.map((u) => (u.key === key ? { ...u, round } : u)) })); touch(); };
  const getGeneral = (g, k) => (g === 'soldier' ? r.build.soldier[k] : r[g][k]);
  const setGeneral = (g, k, v) => {
    setR((x) => (g === 'soldier'
      ? { ...x, build: { ...x.build, soldier: { ...x.build.soldier, [k]: v } } }
      : { ...x, [g]: { ...x[g], [k]: v } }));
    touch();
  };

  const save = () => {
    onSave({ ...r, updatedAt: new Date().toISOString() });
    setDirty(false);
    setSaved(true);
  };
  const reset = () => {
    if (!confirm(t('rules.confirm_reset'))) return;
    setR(clone(DEFAULT_RULES));
    touch();
  };

  const field = (label, value, [min, max, step, pct], onChange) => (
    <label key={label} className="row small" style={{ justifyContent: 'space-between', gap: 8 }}>
      <span>{label}</span>
      <span>
        <NumField value={value} min={min} max={max} step={step} pct={pct} onChange={onChange} />{pct ? ' %' : ''}
      </span>
    </label>
  );

  return (
    <section>
      <h1>⚙️ {t('rules.title')}</h1>
      <p className="muted small">{t('rules.hint')}</p>
      <div className="row" style={{ marginBottom: 12, position: 'sticky', top: 0, zIndex: 5, background: 'var(--paper)', padding: '6px 0' }}>
        <button className="btn primary" onClick={save} disabled={!dirty}>✓ {t('common.save')}</button>
        <button className="btn" onClick={reset}>↺ {t('rules.reset')}</button>
        {saved && <span className="small" style={{ color: 'var(--ok, #15803d)' }}>✓ {t('rules.saved')}</span>}
      </div>

      <h2>🎲 {t('rules.general')}</h2>
      <div className="sketch-card" style={{ padding: 12 }}>
        <div style={grid}>
          {GENERAL.map(([g, key, ...lim]) => field(t(`rules.g_${g}_${key}`), getGeneral(g, key), lim, (v) => setGeneral(g, key, v)))}
        </div>
        <p className="small muted">{t('rules.waves_note')}</p>
      </div>

      <h2>🦸 {t('rules.hero')}</h2>
      <div className="sketch-card" style={{ padding: 12 }}>
        <div style={grid}>
          {HERO.map(([key, ...lim]) => field(t(`rules.h_${key}`), r.hero[key], lim, (v) => setGeneral('hero', key, v)))}
        </div>
        <p className="small muted">{t('rules.hero_hint')}</p>
      </div>

      <h2>🏛️🦸 {t('rules.hero_costs')}</h2>
      <div className="sketch-card" style={{ padding: 12 }}>
        <div className="row small">
          {r.heroUpgradeCosts.map((c, li) => (
            <label key={li}>{t('rules.level_n', { n: li + 1 })} <NumField value={c} min={0} max={999} step={5} onChange={(v) => setHeroCost(li, v)} /> 🪙</label>
          ))}
        </div>
        <div style={{ ...grid, marginTop: 10 }}>
          {r.unlocks.map((u) => field(`🎁 ${unlockLabel(u.key, t)} – ${t('rules.from_round')}`, u.round, [1, 99, 1], (v) => setUnlock(u.key, v)))}
        </div>
        <p className="small muted">{t('rules.hero_costs_hint')} {t('rules.components_note')}</p>
      </div>
    </section>
  );
}
