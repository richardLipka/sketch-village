// What the end screen shows (SPEC §11): who celebrates a victory and what flies
// up as fireworks. Pure, unit-tested; EndScreen.jsx draws it.

import { firstFrame } from '../assets/animation.js';

/** A hero's still picture (its first picture, else the first frame of an animation), or null. */
export const heroPicture = (h) => h?.images?.find(Boolean) || firstFrame(h?.anims) || null;

/**
 * The heroes jumping beside "You won": the one played with and up to `n` others
 * picked at random from the drawn heroes, the played one in the middle of the row.
 * Each is { id, src, played }; a hero without a picture is left out (the played
 * one stays – the end screen draws a stand-in).
 */
export function celebrationHeroes(played, heroes = [], random = Math.random, n = 3) {
  const others = heroes.filter((h) => h && h.id !== played?.id && heroPicture(h));
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const row = others.slice(0, n).map((h) => ({ id: h.id, src: heroPicture(h), played: false }));
  const me = { id: played?.id ?? 'hero', src: heroPicture(played), played: true };
  row.splice(Math.ceil(row.length / 2), 0, me);
  return row;
}

/**
 * Pictures to fire as fireworks: every drawn projectile, else the game's own
 * ones (`defaults` = [id, picture] of the built-in arrow, bolt and stone).
 */
export function fireworkPictures(projectiles = [], defaults = []) {
  const drawn = projectiles.map((p) => p?.images?.find(Boolean)).filter(Boolean);
  const own = defaults.filter(([id, src]) => src && !projectiles.some((p) => p?.id === id && p.images?.some(Boolean))).map(([, src]) => src);
  return [...new Set([...drawn, ...own])];
}
