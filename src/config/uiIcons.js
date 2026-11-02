// GUI icons the kids can redraw (SPEC §4b): the hearts, coins, workers… on the
// game's controls. Each is a fixed built-in component of the studio category
// `icon` (they can't be added or deleted, only drawn); until it is drawn the
// emoji is shown. The heroes' special abilities have one each too.

import { ABILITIES } from './abilities.js';

const ABILITY_NAMES = {
  strike: { cs: 'Mocný úder', en: 'Mighty strike' },
  shout: { cs: 'Bojový pokřik', en: 'Battle shout' },
  reinforcements: { cs: 'Posily', en: 'Reinforcements' },
  heal: { cs: 'Léčení', en: 'Healing' },
  arrowRain: { cs: 'Déšť šípů', en: 'Arrow rain' },
  freeze: { cs: 'Zmrazení', en: 'Freeze' },
  shield: { cs: 'Štít', en: 'Shield' },
  rally: { cs: 'Povzbuzení', en: 'Rally' },
};

/** The GUI icon of a hero ability (its button, the shop, the hero editor). */
export const abilityIcon = (id) => `ability_${id}`;

export const UI_ICONS = [
  { key: 'heart', emoji: '♥', name: { cs: 'Srdce (život)', en: 'Heart (life)' } },
  { key: 'heartEmpty', emoji: '♡', name: { cs: 'Ztracený život', en: 'Lost life' } },
  { key: 'coin', emoji: '🪙', name: { cs: 'Mince', en: 'Coins' } },
  { key: 'worker', emoji: '👷', name: { cs: 'Dělník', en: 'Workers' } },
  { key: 'townhall', emoji: '🏛️', name: { cs: 'Radnice', en: 'Town hall' } },
  { key: 'ready', emoji: '⚑', name: { cs: 'Vlna hned', en: 'Wave now' } },
  { key: 'melee', emoji: '⚔️', name: { cs: 'Útok zblízka', en: 'Melee attack' } },
  { key: 'ranged', emoji: '🏹', name: { cs: 'Útok na dálku', en: 'Ranged attack' } },
  { key: 'magic', emoji: '✨', name: { cs: 'Kouzla', en: 'Magic' } },
  { key: 'backpack', emoji: '🎒', name: { cs: 'Batoh', en: 'Backpack' } },
  { key: 'chronicle', emoji: '📖', name: { cs: 'Kronika', en: 'Chronicle' } },
  { key: 'waves', emoji: '👺', name: { cs: 'Vlny (v editoru map)', en: 'Waves (in the map editor)' } },
  ...Object.entries(ABILITY_NAMES).map(([id, n]) => ({
    key: abilityIcon(id), emoji: ABILITIES[id].icon, name: { cs: `Schopnost: ${n.cs}`, en: `Ability: ${n.en}` },
  })),
];

export const uiIconId = (key) => `ui-${key}`;
export const UI_ICON_EMOJI = Object.fromEntries(UI_ICONS.map((i) => [i.key, i.emoji]));

/** { key: picture data URL } for every GUI icon the kids have drawn. */
export function uiIconsOf(assets = []) {
  const out = {};
  for (const a of assets) {
    if (a.category !== 'icon' || !a.stats?.icon) continue;
    const pic = (a.images ?? []).find(Boolean);
    if (pic) out[a.stats.icon] = pic;
  }
  return out;
}
