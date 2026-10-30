// When do the kids' monster sounds play? (SPEC §3.2b) Pure – unit-tested.
//
// A wave can have forty monsters; if each roared on every step, hit and death
// the game would be noise and nobody would hear their own recording. So the
// VoiceDirector lets a sound play only when it will be heard:
//
//  - priority: death > attack > walking growl; at most 2 monster sounds at
//    once and 0.35 s between two starts – a crowd never stacks up;
//  - death: every time, but the same kind at most every 1.5 s;
//  - attack: only about a third of the hits, the same kind at most every 4 s;
//  - walking growl ("challenge"): only during a wave, at most one every 6 s in
//    the whole game, the same kind again only after 12–18 s, and then only on
//    some ticks – a growl now and then from somewhere on the road;
//  - introduction: the first time a kind appears in a game its growl plays at
//    once (waiting up to 3 s for a free moment), next to the "new monster" note;
//  - many monsters on the map → the sounds get a little quieter.
// The game's own synthesized death sound is skipped when a recording plays.

export const VOICE_RULES = {
  maxVoices: 2,
  minGap: 0.35,
  death: { cooldown: 1.5, chance: 1 },
  attack: { cooldown: 4, chance: 0.35 },
  walk: { cooldown: [12, 18], chance: 0.3, globalGap: 6 },
  introWait: 3,
};

const slot = (type, kind) => `${type}|${kind}`;

export class VoiceDirector {
  /**
   * @param {object} o
   * @param {object} o.voices  { [enemyTypeId]: { walk?, attack?, death? } } – length in s of each recording
   */
  constructor({ voices = {}, rules = VOICE_RULES, rng = Math.random } = {}) {
    this.voices = voices;
    this.rules = rules;
    this.rng = rng;
    this.playing = []; // end times of the sounds playing now
    this.lastStart = -Infinity;
    this.lastWalk = -Infinity;
    this.nextAllowed = new Map(); // slot(type, kind) → time
    this.introduced = new Set();
    this.intros = []; // { type, until }
  }

  get empty() { return !Object.keys(this.voices).length; }

  has(type, kind) { return this.voices[type]?.[kind] > 0; }

  ready(type, kind, now) { return this.has(type, kind) && (this.nextAllowed.get(slot(type, kind)) ?? -Infinity) <= now; }

  free(now) {
    this.playing = this.playing.filter((end) => end > now);
    return this.playing.length < this.rules.maxVoices && now - this.lastStart >= this.rules.minGap;
  }

  start(type, kind, now, alive) {
    this.playing.push(now + this.voices[type][kind]);
    this.lastStart = now;
    const c = this.rules[kind].cooldown;
    this.nextAllowed.set(slot(type, kind), now + (Array.isArray(c) ? c[0] + this.rng() * (c[1] - c[0]) : c));
    if (kind === 'walk') this.lastWalk = now;
    return { type, kind, volume: Math.max(0.55, Math.min(1, 1 - 0.015 * alive)) };
  }

  /** A World event → the sound to play now, or null. `alive` = monsters on the map. */
  onEvent(e, now, alive = 0) {
    if (e.type === 'spawn' && !e.summoned && !this.introduced.has(e.enemy)) {
      this.introduced.add(e.enemy);
      if (this.has(e.enemy, 'walk')) this.intros.push({ type: e.enemy, until: now + this.rules.introWait });
      return this.intro(now, alive);
    }
    const kind = e.type === 'enemyDied' ? 'death' : e.type === 'enemyAttack' ? 'attack' : null;
    if (!kind || !this.ready(e.enemy, kind, now) || !this.free(now)) return null;
    if (this.rng() >= this.rules[kind].chance) return null;
    return this.start(e.enemy, kind, now, alive);
  }

  intro(now, alive) {
    this.intros = this.intros.filter((i) => i.until > now);
    if (!this.intros.length || !this.free(now)) return null;
    const { type } = this.intros.shift();
    return this.start(type, 'walk', now, alive);
  }

  /** Called about once a second: introductions waiting, then now and then a growl. */
  tick(now, aliveByType = {}, phase = 'wave') {
    const alive = Object.values(aliveByType).reduce((a, n) => a + n, 0);
    const intro = this.intro(now, alive);
    if (intro || phase !== 'wave') return intro;
    const w = this.rules.walk;
    if (now - this.lastWalk < w.globalGap || !this.free(now)) return null;
    const candidates = Object.keys(aliveByType).filter((ty) => aliveByType[ty] > 0 && this.ready(ty, 'walk', now));
    if (!candidates.length || this.rng() >= w.chance) return null;
    return this.start(candidates[Math.floor(this.rng() * candidates.length)], 'walk', now, alive);
  }
}

// ---------------- preview in the editor ----------------

// eight monsters close together; the first half is defeated on the road, the rest reach the Town Hall
export const PREVIEW = { monsters: 8, every: 0.9, firstAt: 0.5, onRoad: 4, killedAfter: 3.5, walk: 5, attacks: 3, attackEvery: 1, dieAfter: 0.5, duration: 16 };

/**
 * A little wave as the game would play it (SoundEditor's "hear it as in the
 * game"): eight monsters of one kind come close together; four are defeated
 * on the road, four reach the Town Hall, hit it three times each and are
 * defeated there. The real VoiceDirector decides – the
 * result lists every moment a sound could play and whether it did.
 * @param {object} lengths  { walk?, attack?, death? } – seconds each sound plays
 * @returns {{ duration, events: { t, kind: 'spawn'|'walk'|'attack'|'death', played }[] }}
 */
export function previewWave(lengths, { rng = Math.random, plan = PREVIEW } = {}) {
  const type = 'preview';
  const d = new VoiceDirector({ voices: { [type]: lengths }, rng });
  const script = [];
  for (let i = 0; i < plan.monsters; i++) {
    const at = plan.firstAt + i * plan.every;
    const arrive = at + plan.walk;
    script.push({ t: at, e: { type: 'spawn', enemy: type }, kind: 'spawn', i });
    if (i < plan.onRoad) {
      script.push({ t: at + plan.killedAfter, e: { type: 'enemyDied', enemy: type }, kind: 'death', i, dies: true });
      continue;
    }
    for (let k = 0; k < plan.attacks; k++) script.push({ t: arrive + k * plan.attackEvery, e: { type: 'enemyAttack', enemy: type }, kind: 'attack', i });
    script.push({ t: arrive + (plan.attacks - 1) * plan.attackEvery + plan.dieAfter, e: { type: 'enemyDied', enemy: type }, kind: 'death', i, dies: true });
  }
  for (let t = 1; t < plan.duration; t++) script.push({ t, tick: true });
  script.sort((a, b) => a.t - b.t || (a.tick ? 1 : 0) - (b.tick ? 1 : 0));

  const events = [];
  const born = new Set(), gone = new Set();
  const aliveNow = () => born.size - gone.size;
  for (const s of script) {
    if (s.tick) {
      const v = d.tick(s.t, { [type]: aliveNow() }, 'wave');
      if (v) events.push({ t: s.t, kind: v.kind, played: true });
      continue;
    }
    if (s.kind === 'spawn') born.add(s.i);
    if (s.dies) gone.add(s.i);
    const v = d.onEvent(s.e, s.t, aliveNow());
    if (s.kind === 'spawn') {
      events.push({ t: s.t, kind: 'spawn', played: false });
      if (v) events.push({ t: s.t, kind: 'walk', played: true });
    } else if (lengths[s.kind]) {
      events.push({ t: s.t, kind: s.kind, played: !!v });
    }
  }
  return { duration: plan.duration, events };
}
