import React from 'react';
import { useTranslation } from 'react-i18next';
import { defaultPicture } from './defaultLooks.js';

// Which projectile a shooting building, enemy or soldier uses (SPEC §7.1): one of
// the projectiles drawn in the studio, or the default arrow when none is chosen.
export default function ProjectilePick({ value, projectiles = [], onChange }) {
  const { t } = useTranslation();
  return (
    <div className="row small projectile-pick" role="radiogroup" aria-label={t('projectile.label')}>
      <b>➶ {t('projectile.label')}</b>
      <button type="button" role="radio" aria-checked={!value} className={`btn chip ${!value ? 'active' : ''}`} onClick={() => onChange(null)}>
        ➶ {t('projectile.default')}
      </button>
      {projectiles.map((p) => (
        <button key={p.id} type="button" role="radio" aria-checked={value === p.id} className={`btn chip ${value === p.id ? 'active' : ''}`} onClick={() => onChange(p.id)} title={p.name}>
          {p.image || defaultPicture(p.id) ? <img src={p.image || defaultPicture(p.id)} alt="" className="chip-pic" /> : '•'} {p.name}
        </button>
      ))}
      {!projectiles.length && <span className="muted">{t('projectile.none_drawn')}</span>}
    </div>
  );
}
