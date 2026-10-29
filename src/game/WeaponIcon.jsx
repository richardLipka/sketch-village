import React from 'react';

// A weapon's drawing (from the studio), or a class emoji until there is one.
export const CLASS_ICON = { melee: '⚔️', ranged: '🏹', magic: '✨' };

export default function WeaponIcon({ weapon, assets = [], size = 32 }) {
  const pic = weapon?.asset && assets.find((a) => a.id === weapon.asset)?.images[0];
  if (pic) return <img src={pic} alt="" style={{ width: size, height: size, objectFit: 'contain' }} />;
  return <span style={{ display: 'inline-block', width: size, textAlign: 'center', fontSize: size * 0.7 }}>{CLASS_ICON[weapon?.kind] ?? '❔'}</span>;
}
