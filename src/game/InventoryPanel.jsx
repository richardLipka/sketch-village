import React from 'react';
import { useTranslation } from 'react-i18next';
import WeaponIcon, { CLASS_ICON } from './WeaponIcon.jsx';
import { WEAPON_CLASSES } from '../config/weapons.js';

// The hero's backpack: every weapon found or bought, grouped by class.
// One click equips a weapon (one per class); its numbers are added to that attack.
export default function InventoryPanel({ inventory, equipped, weapons, assets, onEquip, onClose }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const owned = inventory.map((id) => weapons.find((w) => w.id === id)).filter(Boolean);

  return (
    <div className="build-panel inventory-panel sketch-card" onPointerDown={(e) => e.stopPropagation()}>
      <button className="btn icon" style={{ float: 'right' }} onClick={onClose} aria-label={t('common.cancel')}>✕</button>
      <h3>🎒 {t('weapons.inventory')}</h3>
      {!owned.length && <p className="small muted">{t('weapons.empty')}</p>}
      {WEAPON_CLASSES.map((k) => {
        const list = owned.filter((w) => w.kind === k);
        if (!list.length) return null;
        return (
          <div key={k} style={{ marginBottom: 6 }}>
            <b className="small">{CLASS_ICON[k]} {t(`weapons.class_${k}`)}</b>
            {list.map((w) => {
              const on = equipped[k] === w.id;
              return (
                <button key={w.id} className={`btn weapon-row ${on ? 'active' : ''}`} onClick={() => onEquip(w.id)}>
                  <WeaponIcon weapon={w} assets={assets} size={28} />
                  <span>{w.name?.[lang] ?? w.id}</span>
                  <span className="small muted">{weaponStatLine(w, t)}</span>
                  {on && <span className="small">✓ {t('weapons.equipped')}</span>}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** "+6 attack · +60 range · splash 50" */
export function weaponStatLine(w, t) {
  const sign = (v) => (v > 0 ? `+${v}` : `${v}`);
  return [
    w.damage ? t('weapons.s_damage', { v: sign(w.damage) }) : null,
    w.range ? t('weapons.s_range', { v: sign(w.range) }) : null,
    w.cooldown ? t('weapons.s_cooldown', { v: sign(w.cooldown) }) : null,
    w.kind === 'magic' && w.splash ? t('weapons.s_splash', { v: w.splash }) : null,
  ].filter(Boolean).join(' · ');
}
