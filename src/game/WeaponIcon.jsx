import React, { memo } from 'react';

// An item's drawing (from the studio), or an emoji until there is one.
export const CLASS_ICON = { melee: '⚔️', ranged: '🏹', magic: '✨' };
export const SLOT_ICON = { shield: '🛡️', armor: '🦺' };

function WeaponIcon({ weapon, assets = [], size = 32 }) {
  const pic = weapon?.asset && assets.find((a) => a.id === weapon.asset)?.images[0];
  if (pic) return <img src={pic} alt="" style={{ width: size, height: size, objectFit: 'contain' }} />;
  const icon = CLASS_ICON[weapon?.kind] ?? SLOT_ICON[weapon?.slot] ?? '❔';
  return <span style={{ display: 'inline-block', width: size, textAlign: 'center', fontSize: size * 0.7 }}>{icon}</span>;
}

export default memo(WeaponIcon);
