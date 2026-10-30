import React from 'react';
import { useTranslation } from 'react-i18next';
import NumField from './NumField.jsx';
import ProjectilePick from './ProjectilePick.jsx';
import { FEATURES, FEATURE_IDS, LEVEL_FIELDS, newLevel } from '../config/features.js';

// Properties of a building component, next to its pictures (one per level):
//  - either its own building type: which features it has (workers, arrows,
//    soldiers, income, healing…) and the numbers of every level,
//  - or "another look" of an existing type: only pictures, the game picks one of
//    the looks at random for each building of that type.
// A shooting / throwing building picks its projectile; a castle picks, per level,
// who its soldiers are – a drawn soldier or any enemy (shown soldier-sized).
// The core building (Town Hall) is always its own type and keeps its first level free.

export const MAX_LEVELS = 5;

export default function BuildingStatsEditor({ id, stats, types, projectiles = [], soldierChoices = { soldiers: [], enemies: [] }, onChange }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const core = !!stats.core;
  const isLook = !!stats.variantOf;
  const levels = stats.levels ?? [newLevel([])];
  const features = stats.features ?? [];
  const others = types.filter((ty) => ty.id !== id);

  const setLevels = (next) => onChange({ ...stats, levels: next });
  const setLevel = (i, key, v) => setLevels(levels.map((l, j) => (j === i ? { ...l, [key]: v } : l)));
  const toggleFeature = (f) => {
    const on = features.includes(f);
    const nextFeatures = on ? features.filter((x) => x !== f) : [...features, f];
    // a feature that is switched on gets its default numbers on every level;
    // switching it off drops its numbers so the saved data stays clean
    const drop = (l) => Object.fromEntries(Object.entries(l).filter(([k]) => !(k in FEATURES[f].defaults)));
    onChange({ ...stats, features: nextFeatures, levels: levels.map((l) => (on ? drop(l) : { ...FEATURES[f].defaults, ...l })) });
  };
  const addLevel = () => {
    const last = levels.at(-1);
    setLevels([...levels, newLevel(features, { ...last, cost: Math.round((last.cost || 20) * 1.5), hp: Math.round(last.hp * 1.4), round: Math.min(99, last.round + 3) })]);
  };

  if (isLook || (!core && !stats.levels)) {
    // another look of an existing type
    return (
      <div className="sketch-card" style={{ padding: 10 }}>
        <label className="row" style={{ gap: 8 }}>
          <input type="radio" checked={!isLook} onChange={() => onChange({ features: ['shoots'], levels: [newLevel(['shoots'])] })} /> {t('component.own_type')}
        </label>
        <label className="row" style={{ gap: 8 }}>
          <input type="radio" checked={isLook} onChange={() => onChange({ variantOf: others[0]?.id })} /> {t('component.look_of')}
          <select value={stats.variantOf ?? ''} onChange={(e) => onChange({ variantOf: e.target.value })}>
            {others.map((ty) => <option key={ty.id} value={ty.id}>{ty.name?.[lang] ?? ty.id}</option>)}
          </select>
        </label>
        <p className="small muted">{t('component.look_hint')}</p>
      </div>
    );
  }

  const rows = [...LEVEL_FIELDS, ...features.flatMap((f) => FEATURES[f].fields.map((fl) => [...fl, f]))];

  return (
    <div className="sketch-card" style={{ padding: 10 }}>
      {!core && (
        <label className="row" style={{ gap: 8, marginBottom: 6 }}>
          <input type="radio" checked readOnly /> {t('component.own_type')}
          <span className="spacer" />
          <button className="btn small" onClick={() => onChange({ variantOf: others[0]?.id })} disabled={!others.length}>{t('component.make_look')}</button>
        </label>
      )}
      {core && <p className="small muted" style={{ marginTop: 0 }}>🏛️ {t('component.core_hint')}</p>}

      <h3 style={{ margin: '4px 0' }}>{t('component.features')}</h3>
      <div className="row small" style={{ gap: 12 }}>
        {FEATURE_IDS.map((f) => (
          <label key={f} title={t(`feature.hint_${f}`)}>
            <input type="checkbox" checked={features.includes(f)} onChange={() => toggleFeature(f)} /> {FEATURES[f].icon} {t(`feature.name_${f}`)}
          </label>
        ))}
      </div>

      {(features.includes('shoots') || features.includes('lobs')) && (
        <div style={{ marginTop: 8 }}><ProjectilePick value={stats.projectile} projectiles={projectiles} onChange={(projectile) => onChange({ ...stats, projectile })} /></div>
      )}

      <h3 style={{ margin: '10px 0 4px' }}>{t('component.levels')}</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="rules-table">
          <thead>
            <tr>
              <th />
              {levels.map((_, i) => <th key={i}>{t('rules.level_n', { n: i + 1 })}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, min, max, step, f]) => (
              <tr key={key}>
                <td>{f ? `${FEATURES[f].icon} ` : ''}{t(`feature.f_${key}`)}</td>
                {levels.map((l, i) => (
                  <td key={i}>
                    {core && i === 0 && (key === 'cost' || key === 'time' || key === 'round')
                      ? '—'
                      : <NumField value={l[key]} min={min} max={max} step={step} onChange={(v) => setLevel(i, key, v)} />}
                  </td>
                ))}
              </tr>
            ))}
            {features.includes('soldiers') && (
              <tr>
                <td>{FEATURES.soldiers.icon} {t('feature.f_soldierKind')}</td>
                {levels.map((l, i) => (
                  <td key={i}>
                    <select value={l.soldierKind ?? ''} onChange={(e) => setLevel(i, 'soldierKind', e.target.value || null)} aria-label={t('feature.f_soldierKind')}>
                      <option value="">💂 {t('feature.soldier_default')}</option>
                      {soldierChoices.soldiers.length > 0 && (
                        <optgroup label={t('cat.soldier')}>{soldierChoices.soldiers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                      )}
                      <optgroup label={t('cat.enemy')}>{soldierChoices.enemies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                    </select>
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn" onClick={addLevel} disabled={levels.length >= MAX_LEVELS}>+ {t('component.add_level')}</button>
        <button className="btn" onClick={() => setLevels(levels.slice(0, -1))} disabled={levels.length <= 1}>− {t('component.remove_level')}</button>
        <span className="small muted">{t('component.levels_hint')}</span>
      </div>
    </div>
  );
}
