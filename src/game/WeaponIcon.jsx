import React, { memo } from 'react';

// An item's drawing (from the studio), or an emoji until there is one.
// `size` is px (number) or any CSS length such as '1.5em' (grows with the text).
export const CLASS_ICON = { melee: '⚔️', ranged: '🏹', magic: '✨' };
export const SLOT_ICON = { shield: '🛡️', armor: '🦺' };

function WeaponIcon({ weapon, assets = [], size = 32 }) {
  const len = typeof size === 'number' ? `${size}px` : size;
  const pic = weapon?.asset && assets.find((a) => a.id === weapon.asset)?.images[0];
  if (pic) return <img src={pic} alt="" style={{ width: len, height: len, objectFit: 'contain' }} />;
  const icon = CLASS_ICON[weapon?.kind] ?? SLOT_ICON[weapon?.slot] ?? '❔';
  return <span style={{ display: 'inline-block', width: len, textAlign: 'center', fontSize: `calc(${len} * 0.7)` }}>{icon}</span>;
}

export default memo(WeaponIcon);
