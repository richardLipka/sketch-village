import React from 'react';
import { useTranslation } from 'react-i18next';

// Which way a moving thing's drawing goes (category `moves`): the game shows a
// walker as drawn while it goes right and mirrors it going left, and turns a
// projectile to where it flies – so they are drawn going right ➜.
export default function MoveArrow({ moves, big = false }) {
  const { t } = useTranslation();
  if (!moves) return null;
  const label = t(`move.${moves}`);
  return <span className={`move-arrow ${big ? 'big' : ''}`} role="img" aria-label={label} title={label} data-testid="move-arrow">➜</span>;
}
