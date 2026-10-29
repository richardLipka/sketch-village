// Tiny synthesized sound effects (WebAudio, no sound files): short, soft,
// cartoonish. Game events are mapped to sounds in `soundFor`; frequent ones
// (hits) are throttled so a big fight doesn't turn into noise.

let ctx = null;
let master = null;
let muted = false;
const lastPlayed = new Map();

const MIN_GAP = { hit: 0.07, shoot: 0.08, enemyHit: 0.06, coin: 0.05 }; // s between two of the same kind

function audio() {
  if (!ctx) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {}); // needs a user click first
  return ctx;
}

export function setMuted(m) { muted = m; }

// one tone: frequency slide f0 → f1 over `dur` s, with a quick fade out
function tone(c, { type = 'sine', f0, f1 = f0, dur = 0.12, vol = 0.5, delay = 0 }) {
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(c, { dur = 0.1, vol = 0.3, freq = 1200, delay = 0 }) {
  const t = c.currentTime + delay;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = c.createBufferSource();
  s.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = vol;
  s.connect(f).connect(g).connect(master);
  s.start(t);
}

const SOUNDS = {
  shoot: (c) => noise(c, { dur: 0.08, vol: 0.25, freq: 2500 }),
  hit: (c) => tone(c, { type: 'square', f0: 180, f1: 90, dur: 0.08, vol: 0.18 }),
  enemyHit: (c) => tone(c, { type: 'triangle', f0: 420, f1: 260, dur: 0.06, vol: 0.2 }),
  enemyDied: (c) => { tone(c, { type: 'triangle', f0: 500, f1: 120, dur: 0.22, vol: 0.3 }); noise(c, { dur: 0.15, vol: 0.15, freq: 800 }); },
  coin: (c) => { tone(c, { f0: 1320, dur: 0.06, vol: 0.25 }); tone(c, { f0: 1760, dur: 0.12, vol: 0.25, delay: 0.06 }); },
  build: (c) => { for (let i = 0; i < 3; i++) noise(c, { dur: 0.05, vol: 0.3, freq: 600, delay: i * 0.12 }); },
  built: (c) => [523, 659, 784].forEach((f, i) => tone(c, { type: 'triangle', f0: f, dur: 0.16, vol: 0.3, delay: i * 0.09 })),
  destroyed: (c) => { noise(c, { dur: 0.5, vol: 0.4, freq: 300 }); tone(c, { type: 'sawtooth', f0: 200, f1: 50, dur: 0.5, vol: 0.15 }); },
  sold: (c) => [880, 660].forEach((f, i) => tone(c, { f0: f, dur: 0.1, vol: 0.25, delay: i * 0.08 })),
  wave: (c) => { tone(c, { type: 'sawtooth', f0: 220, f1: 330, dur: 0.35, vol: 0.18 }); tone(c, { type: 'sawtooth', f0: 330, f1: 330, dur: 0.4, vol: 0.18, delay: 0.35 }); },
  roundEnd: (c) => [523, 784, 1047].forEach((f, i) => tone(c, { type: 'triangle', f0: f, dur: 0.18, vol: 0.28, delay: i * 0.1 })),
  ouch: (c) => tone(c, { type: 'square', f0: 300, f1: 150, dur: 0.18, vol: 0.2 }),
  heroDown: (c) => [392, 330, 262].forEach((f, i) => tone(c, { type: 'triangle', f0: f, dur: 0.25, vol: 0.3, delay: i * 0.18 })),
  won: (c) => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(c, { type: 'triangle', f0: f, dur: 0.2, vol: 0.3, delay: i * 0.13 })),
  lost: (c) => [392, 370, 349, 262].forEach((f, i) => tone(c, { type: 'sawtooth', f0: f, dur: 0.35, vol: 0.15, delay: i * 0.3 })),
  click: (c) => tone(c, { f0: 900, dur: 0.04, vol: 0.15 }),
  nope: (c) => tone(c, { type: 'square', f0: 160, dur: 0.12, vol: 0.12 }),
};

/** Which sound a World event makes (or null). Pure – unit-tested. */
export function soundFor(e) {
  switch (e.type) {
    case 'heroAttack': return e.mode === 'ranged' ? 'shoot' : 'hit';
    case 'hit': return e.kind === 'enemy' ? 'enemyHit' : e.kind === 'hero' ? 'ouch' : null;
    case 'enemyDied': return 'enemyDied';
    case 'coinPicked': return 'coin';
    case 'buildStart': case 'upgradeStart': return 'build';
    case 'built': case 'upgraded': case 'heroUpgraded': return 'built';
    case 'buildingDestroyed': return 'destroyed';
    case 'sold': return 'sold';
    case 'waveStart': return 'wave';
    case 'roundEnd': return 'roundEnd';
    case 'heroDown': return 'heroDown';
    case 'won': return 'won';
    case 'lost': return 'lost';
    case 'cantHit': return 'nope';
    default: return null;
  }
}

export function play(name) {
  if (muted || !name || !SOUNDS[name]) return;
  const c = audio();
  if (!c) return;
  const gap = MIN_GAP[name] ?? 0;
  const last = lastPlayed.get(name) ?? -1;
  if (c.currentTime - last < gap) return;
  lastPlayed.set(name, c.currentTime);
  try { SOUNDS[name](c); } catch { /* audio is a bonus – never break the game */ }
}
