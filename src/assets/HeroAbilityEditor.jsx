import React from 'react';
import { useTranslation } from 'react-i18next';
import NumField from './NumField.jsx';
import { ABILITIES, ABILITY_IDS, ABILITY_PARAMS, PARAM_LIMITS, abilityOf, abilityAt, abilityNumbers } from '../config/abilities.js';
import { HERO_UPGRADE_COSTS } from '../config/buildings.js';

// The hero's special ability (SPEC §6.4): one of eight, with its numbers. A
// hero without a choice shows (and plays with) the one picked for it by its id.
// Underneath: what the Town Hall shop's upgrades make of it.
export default function HeroAbilityEditor({ hero, onChange }) {
  const { t } = useTranslation();
  const a = abilityOf(hero);
  const d = ABILITIES[a.id];
  const pick = (id) => onChange({ id, ...Object.fromEntries(ABILITY_PARAMS.filter((k) => ABILITIES[id].uses.includes(k)).map((k) => [k, ABILITIES[id][k]])) });
  const setParam = (k, v) => onChange({ ...a, [k]: v });
  const top = abilityAt(a, HERO_UPGRADE_COSTS.length);

  return (
    <div className="sketch-card hero-ability" style={{ padding: 10, marginTop: 12 }}>
      <h3 style={{ margin: '0 0 6px' }}>{d.icon} {t('ability.title')}</h3>
      <p className="small muted" style={{ margin: '0 0 6px' }}>{t('ability.hint')}</p>
      <div className="ability-pick" role="radiogroup" aria-label={t('ability.title')}>
        {ABILITY_IDS.map((id) => (
          <button key={id} type="button" role="radio" aria-checked={id === a.id} className={`btn chip ${id === a.id ? 'active' : ''}`} onClick={() => pick(id)} title={t(`ability.${id}_hint`)}>
            {ABILITIES[id].icon} {t(`ability.${id}`)}
          </button>
        ))}
      </div>
      <p className="small" style={{ margin: '6px 0' }}>{t(`ability.${a.id}_hint`)}</p>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        {d.uses.map((k) => (
          <NumField key={k} label={t(`ability.param_${k}${k === 'power' ? `_${a.id}` : ''}`)} value={a[k]} pct={k === 'power' && !!d.share}
            min={k === 'power' && d.share ? 0.05 : PARAM_LIMITS[k][0]} max={k === 'power' && d.share ? d.max : PARAM_LIMITS[k][1]}
            step={k === 'power' && d.share ? 0.05 : k === 'duration' || k === 'cooldown' ? 0.5 : 1} onChange={(v) => setParam(k, v)} />
        ))}
      </div>
      <p className="small muted" style={{ margin: '6px 0 0' }} data-testid="ability-top">
        ⬆ {t('ability.upgraded', { n: HERO_UPGRADE_COSTS.length })}: {abilityNumbers(top, t)}
      </p>
    </div>
  );
}
