// The hero's special ability (SPEC §6.4): one per hero, picked in the hero's
// editor with its numbers, used in the game with a button (or E) and then
// waiting its cooldown; bought better in the Town Hall shop.
//
//   power     what the ability does – damage, slowing share, soldiers, health, speed-up
//   radius    px around the hero it reaches
//   duration  s it lasts (slow, freeze, shield, soldiers, rally)
//   cooldown  s before it can be used again
// Every upgrade level: power ×(1 + UPGRADE.power), duration ×(1 + UPGRADE.duration),
// cooldown ×(1 − UPGRADE.cooldown); a share (slow, speed-up) stays at most its `max`.

export const ABILITIES = {
  strike: { icon: '💥', power: 120, radius: 70, duration: 0, cooldown: 20, uses: ['power', 'radius', 'cooldown'] },
  shout: { icon: '📣', power: 0.5, radius: 160, duration: 5, cooldown: 25, uses: ['power', 'radius', 'duration', 'cooldown'], share: true, max: 0.9 },
  reinforcements: { icon: '🛡️', power: 3, radius: 40, duration: 15, cooldown: 40, uses: ['power', 'duration', 'cooldown'] },
  heal: { icon: '💚', power: 60, radius: 150, duration: 0, cooldown: 30, uses: ['power', 'radius', 'cooldown'] },
  arrowRain: { icon: '🌧️', power: 40, radius: 130, duration: 0, cooldown: 25, uses: ['power', 'radius', 'cooldown'] },
  freeze: { icon: '❄️', power: 1, radius: 120, duration: 3, cooldown: 35, uses: ['radius', 'duration', 'cooldown'] },
  shield: { icon: '🔰', power: 1, radius: 0, duration: 5, cooldown: 30, uses: ['duration', 'cooldown'] },
  rally: { icon: '🎺', power: 0.6, radius: 220, duration: 8, cooldown: 35, uses: ['power', 'radius', 'duration', 'cooldown'], share: true, max: 3 },
};

export const ABILITY_IDS = Object.keys(ABILITIES);
export const ABILITY_PARAMS = ['power', 'radius', 'duration', 'cooldown'];
export const UPGRADE = { power: 0.25, duration: 0.15, cooldown: 0.1 };
// what a kid may type in the hero editor
export const PARAM_LIMITS = { power: [0.1, 500], radius: [0, 400], duration: [0, 30], cooldown: [3, 120] };

const hash = (s) => [...String(s ?? '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** The default ability of a hero that has none chosen: different heroes usually get different ones. */
export const defaultAbilityId = (heroId) => ABILITY_IDS[hash(heroId) % ABILITY_IDS.length];

/** A hero's ability { id, power, radius, duration, cooldown }: its own numbers over the ability's defaults. */
export function abilityOf(hero) {
  const own = hero?.ability ?? {};
  const id = ABILITIES[own.id] ? own.id : defaultAbilityId(hero?.id);
  const d = ABILITIES[id];
  const out = { id };
  for (const k of ABILITY_PARAMS) {
    const v = Number(own.id === id ? own[k] : NaN);
    const [lo, hi] = PARAM_LIMITS[k];
    out[k] = Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d[k];
  }
  return out;
}

/** The ability's numbers at an upgrade level (0 = as bought with the hero). */
export function abilityAt(ability, level = 0) {
  if (!ability) return null;
  const d = ABILITIES[ability.id];
  const power = ability.power * (1 + UPGRADE.power * level);
  return {
    ...ability,
    power: d?.share ? Math.min(d.max, Math.round(power * 100) / 100) : Math.max(1, Math.round(power)),
    duration: Math.round(ability.duration * (1 + UPGRADE.duration * level) * 10) / 10,
    cooldown: Math.round(ability.cooldown * Math.pow(1 - UPGRADE.cooldown, level) * 10) / 10,
  };
}
