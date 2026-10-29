import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_BUILDING_TYPES } from '../config/buildings.js';
import { DEFAULT_RULES } from '../config/rules.js';

// Edit the game rules: building levels, Town Hall levels, hero upgrade prices and
// general numbers. Saved into the `buildingTypes` and `rules` collections, so
// everything travels in the exported JSON file.

const BUILDING_FIELDS = {
  common: [['cost', 0, 999, 1], ['time', 1, 300, 1], ['hp', 1, 9999, 10]],
  house: [['workers', 0, 10, 1]],
  tower: [['damage', 0, 500, 1], ['range', 30, 600, 10], ['cooldown', 0.1, 10, 0.05]],
  castle: [['soldierHp', 1, 999, 5], ['soldierDamage', 0, 200, 1], ['soldierCooldown', 0.1, 10, 0.1], ['soldierRespawn', 1, 120, 1]],
};

// [group, key, min, max, step, percent?]
const GENERAL = [
  ['balance', 'startCoins', 0, 999, 5],
  ['balance', 'firstPrep', 5, 300, 5],
  ['balance', 'prep', 5, 300, 5],
  ['balance', 'rewardBase', 0, 200, 1],
  ['balance', 'earlyBonusPerSecond', 0, 5, 0.1],
  ['balance', 'hpScalePerRound', 0, 50, 1, true],
  ['balance', 'coinLifetime', 5, 300, 5],
  ['balance', 'heroLives', 1, 20, 1],
  ['balance', 'heroRespawnDelay', 0, 120, 5],
  ['build', 'sellRefund', 0, 100, 5, true],
  ['build', 'workerSpeedup', 0, 100, 1, true],
  ['build', 'regenPerSecond', 0, 20, 0.5, true],
  ['build', 'regenDelay', 0, 60, 1],
  ['build', 'interactRadius', 30, 400, 10],
  ['soldier', 'max', 0, 10, 1],
  ['soldier', 'speed', 10, 300, 5],
  ['soldier', 'aggro', 30, 500, 10],
];

const ICON = { house: '🏠', tower: '🗼', castle: '🏰' };
const clone = (x) => JSON.parse(JSON.stringify(x));
const round = (v) => Math.round(v * 1000) / 1000;

function Num({ value, onChange, min, max, step, pct, disabled }) {
  const shown = value === undefined ? '' : pct ? round(value * 100) : value;
  return (
    <input
      type="number" min={min} max={max} step={step} value={shown} disabled={disabled} style={{ width: 76 }}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (e.target.value === '' || Number.isNaN(v)) return;
        const c = Math.min(max, Math.max(min, v));
        onChange(pct ? c / 100 : c);
      }}
    />
  );
}

export default function RulesEditor({ buildingTypes, rules, onSave }) {
  const { t, i18n } = useTranslation();
  const [types, setTypes] = useState(() => clone(buildingTypes));
  const [r, setR] = useState(() => clone(rules));
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const lang = i18n.language;

  const touch = () => { setDirty(true); setSaved(false); };
  const setLevel = (ti, li, key, v) => {
    setTypes((ts) => ts.map((tp, i) => (i !== ti ? tp : { ...tp, levels: tp.levels.map((l, j) => (j === li ? { ...l, [key]: v } : l)) })));
    touch();
  };
  const setTh = (li, key, v) => { setR((x) => ({ ...x, townHallLevels: x.townHallLevels.map((l, j) => (j === li ? { ...l, [key]: v } : l)) })); touch(); };
  const setHeroCost = (li, v) => { setR((x) => ({ ...x, heroUpgradeCosts: x.heroUpgradeCosts.map((c, j) => (j === li ? v : c)) })); touch(); };
  const getGeneral = (g, k) => (g === 'soldier' ? r.build.soldier[k] : r[g][k]);
  const setGeneral = (g, k, v) => {
    setR((x) => (g === 'soldier'
      ? { ...x, build: { ...x.build, soldier: { ...x.build.soldier, [k]: v } } }
      : { ...x, [g]: { ...x[g], [k]: v } }));
    touch();
  };

  const save = () => {
    const now = new Date().toISOString();
    onSave(types.map((tp) => ({ ...tp, updatedAt: now })), { ...r, updatedAt: now });
    setDirty(false);
    setSaved(true);
  };
  const reset = () => {
    if (!confirm(t('rules.confirm_reset'))) return;
    setTypes(clone(DEFAULT_BUILDING_TYPES));
    setR(clone(DEFAULT_RULES));
    touch();
  };

  const levelHead = (n) => Array.from({ length: n }, (_, i) => <th key={i}>{t('rules.level_n', { n: i + 1 })}</th>);

  return (
    <section>
      <h1>⚙️ {t('rules.title')}</h1>
      <p className="muted small">{t('rules.hint')}</p>
      <div className="row" style={{ marginBottom: 12, position: 'sticky', top: 0, zIndex: 5, background: 'var(--paper)', padding: '6px 0' }}>
        <button className="btn primary" onClick={save} disabled={!dirty}>✓ {t('common.save')}</button>
        <button className="btn" onClick={reset}>↺ {t('rules.reset')}</button>
        {saved && <span className="small" style={{ color: 'var(--ok, #15803d)' }}>✓ {t('rules.saved')}</span>}
      </div>

      <h2>{t('rules.buildings')}</h2>
      <div style={{ display: 'grid', gap: 12 }}>
        {types.map((tp, ti) => (
          <div key={tp.id} className="sketch-card" style={{ padding: 12, overflowX: 'auto' }}>
            <b style={{ fontSize: 24 }}>{ICON[tp.id] ?? '🏗️'} {tp.name?.[lang] ?? tp.id}</b>
            <table className="rules-table">
              <thead><tr><th />{levelHead(tp.levels.length)}</tr></thead>
              <tbody>
                {[...BUILDING_FIELDS.common, ...(BUILDING_FIELDS[tp.id] ?? [])].map(([key, min, max, step]) => (
                  <tr key={key}>
                    <td>{t(`rules.f_${key}`)}</td>
                    {tp.levels.map((l, li) => (
                      <td key={li}><Num value={l[key]} min={min} max={max} step={step} onChange={(v) => setLevel(ti, li, key, v)} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <h2>🏛️ {t('rules.townhall')}</h2>
      <div className="sketch-card" style={{ padding: 12, overflowX: 'auto' }}>
        <table className="rules-table">
          <thead><tr><th />{levelHead(r.townHallLevels.length)}</tr></thead>
          <tbody>
            {[['hp', 1, 99999, 50], ['cost', 0, 999, 5], ['time', 1, 300, 1]].map(([key, min, max, step]) => (
              <tr key={key}>
                <td>{t(`rules.f_${key}`)}</td>
                {r.townHallLevels.map((l, li) => (
                  <td key={li}>{li === 0 && key !== 'hp' ? '—' : <Num value={l[key]} min={min} max={max} step={step} onChange={(v) => setTh(li, key, v)} />}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small muted">{t('rules.townhall_hint')}</p>
      </div>

      <h2>🦸 {t('rules.hero_costs')}</h2>
      <div className="sketch-card" style={{ padding: 12 }}>
        <div className="row small">
          {r.heroUpgradeCosts.map((c, li) => (
            <label key={li}>{t('rules.level_n', { n: li + 1 })} <Num value={c} min={0} max={999} step={5} onChange={(v) => setHeroCost(li, v)} /> 🪙</label>
          ))}
        </div>
        <p className="small muted">{t('rules.hero_costs_hint')}</p>
      </div>

      <h2>🎲 {t('rules.general')}</h2>
      <div className="sketch-card" style={{ padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px 18px' }}>
          {GENERAL.map(([g, key, min, max, step, pct]) => (
            <label key={`${g}.${key}`} className="row small" style={{ justifyContent: 'space-between', gap: 8 }}>
              <span>{t(`rules.g_${g}_${key}`)}{pct ? ' (%)' : ''}</span>
              <Num value={getGeneral(g, key)} min={min} max={max} step={step} pct={pct} onChange={(v) => setGeneral(g, key, v)} />
            </label>
          ))}
        </div>
        <p className="small muted">{t('rules.waves_note')}</p>
      </div>
    </section>
  );
}
