import React from 'react';
import { useTranslation } from 'react-i18next';
import { HERO_POINTS, HERO_STAT_MAX, HERO_STATS, heroNumbers, pointsUsed } from '../config/heroStats.js';

// Distribute skill points among melee / ranged / armor / speed (SPEC §6.1).
export default function HeroStatsEditor({ points, onChange }) {
  const { t } = useTranslation();
  const used = pointsUsed(points);
  const left = HERO_POINTS - used;
  const n = heroNumbers(points);

  const setStat = (k, v) => {
    const cur = points[k] ?? 0;
    // clicking the highest filled dot again removes it
    const next = v === cur ? v - 1 : v;
    if (next - cur > left) return;
    onChange({ ...points, [k]: Math.max(0, next) });
  };

  const detail = {
    melee: t('hero.detail_melee', { dmg: n.melee.damage, dps: (n.melee.damage / n.melee.cooldown).toFixed(0) }),
    ranged: t('hero.detail_ranged', { dmg: n.ranged.damage, cd: n.ranged.cooldown }),
    armor: t('hero.detail_armor', { pct: Math.round(n.armor * 100) }),
    speed: t('hero.detail_speed', { speed: n.speed }),
  };

  return (
    <div>
      <h3>{t('hero.points_title')} <span className={left ? '' : 'muted'}>({t('hero.points_left', { n: left })})</span></h3>
      {HERO_STATS.map((k) => (
        <div className="stat-row" key={k}>
          <span>{t(`hero.stat_${k}`)}</span>
          <span className="dots">
            {Array.from({ length: HERO_STAT_MAX }, (_, i) => (
              <button
                key={i}
                className={`dot ${i < (points[k] ?? 0) ? 'on' : ''}`}
                onClick={() => setStat(k, i + 1)}
                aria-label={`${k} ${i + 1}`}
              />
            ))}
          </span>
          <span className="small muted">{detail[k]}</span>
        </div>
      ))}
    </div>
  );
}
