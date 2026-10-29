import React from 'react';
import { useTranslation } from 'react-i18next';
import { WEAPON_CLASSES } from '../config/weapons.js';

// Numbers of a drawn weapon / shield / armor (asset.stats), shown in the drawing
// editor next to the picture – the studio is also the place to edit equipment.

const CLASS_ICON = { melee: '⚔️', ranged: '🏹', magic: '✨' };

function Field({ label, value, min, max, step, onChange, suffix }) {
  return (
    <label className="row small" style={{ gap: 6 }}>
      {label}
      <input type="number" min={min} max={max} step={step} value={value} style={{ width: 70 }}
        onChange={(e) => { const v = Number(e.target.value); if (e.target.value !== '' && !Number.isNaN(v)) onChange(Math.min(max, Math.max(min, v))); }} />
      {suffix}
    </label>
  );
}

export default function ItemStatsEditor({ category, stats, onChange }) {
  const { t } = useTranslation();
  const set = (k) => (v) => onChange({ ...stats, [k]: v });

  return (
    <div className="sketch-card" style={{ padding: 10 }}>
      <h3 style={{ margin: '0 0 6px' }}>{t('weapons.numbers')}</h3>
      <div className="row" style={{ gap: 14 }}>
        {category === 'weapon' ? (
          <>
            <label className="row small" style={{ gap: 6 }}>{t('weapons.class')}
              <select value={stats.kind} onChange={(e) => set('kind')(e.target.value)}>
                {WEAPON_CLASSES.map((k) => <option key={k} value={k}>{CLASS_ICON[k]} {t(`weapons.class_${k}`)}</option>)}
              </select>
            </label>
            <label className="row small" style={{ gap: 6 }}>{t('weapons.hands')}
              <select value={stats.hands} onChange={(e) => set('hands')(Number(e.target.value))}>
                <option value={1}>{t('weapons.one_hand')}</option>
                <option value={2}>{t('weapons.two_hands')}</option>
              </select>
            </label>
            <Field label={t('weapons.f_damage')} value={stats.damage} min={-50} max={200} step={1} onChange={set('damage')} />
            <Field label={t('weapons.f_range')} value={stats.range} min={-100} max={400} step={5} onChange={set('range')} />
            <Field label={t('weapons.f_cooldown')} value={stats.cooldown} min={-2} max={3} step={0.05} onChange={set('cooldown')} />
            {stats.kind === 'magic' && <Field label={t('weapons.f_splash')} value={stats.splash} min={0} max={200} step={5} onChange={set('splash')} />}
          </>
        ) : (
          <Field label={t('weapons.f_armor')} value={Math.round((stats.armor ?? 0) * 100)} min={0} max={80} step={1} suffix="%" onChange={(v) => set('armor')(v / 100)} />
        )}
        <Field label={t('weapons.f_price')} value={stats.price} min={0} max={999} step={5} onChange={set('price')} />
        <label className="small"><input type="checkbox" checked={!!stats.shop} onChange={(e) => set('shop')(e.target.checked)} /> 🛒 {t('weapons.in_shop')}</label>
        <Field label={t('weapons.f_round')} value={stats.round} min={1} max={99} step={1} onChange={set('round')} />
        <Field label={t('weapons.f_drop')} value={stats.drop} min={0} max={10} step={1} onChange={set('drop')} />
      </div>
    </div>
  );
}
