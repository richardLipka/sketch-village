import { describe, it, expect } from 'vitest';
import { frameAt, stripRects, hasAnim, guessFrameCount } from './animation.js';
import { monstersOfWaves } from '../game/Chronicle.jsx';
import { enemyTypesOf, DEFAULT_COMPONENTS } from '../config/components.js';
import { legendText, BUILT_IN_LEGENDS } from '../config/legends.js';
import { DEFAULT_ENEMY_TYPES } from '../config/enemies.js';
import { migrateDb } from '../data/migrate.js';
import { World } from '../logic/world.js';
import { DEFAULT_BUILDING_TYPES } from '../config/buildings.js';
import { DEFAULT_RULES } from '../config/rules.js';

describe('animation frames', () => {
  it('loops, or plays once and then ends', () => {
    expect([0, 124, 125, 999, 1000].map((ms) => frameAt(4, 8, ms))).toEqual([0, 0, 1, 3, 0]); // 8 fps = 125 ms a frame
    expect(frameAt(4, 8, 499, false)).toBe(3);
    expect(frameAt(4, 8, 500, false)).toBeNull(); // one-shot over
    expect(frameAt(0, 8, 100)).toBeNull();
    expect(frameAt(6, 10, -50)).toBe(0);
  });

  it('cuts a strip into frames side by side or one under another, covering it exactly', () => {
    const h = stripRects(1000, 200, 6);
    expect(h).toHaveLength(6);
    expect(h.every((r) => r.y === 0 && r.h === 200)).toBe(true);
    expect(h.reduce((s, r) => s + r.w, 0)).toBe(1000);
    expect(h[1].x).toBe(h[0].x + h[0].w);
    const v = stripRects(150, 900, 4);
    expect(v.every((r) => r.x === 0 && r.w === 150)).toBe(true);
    expect(v.reduce((s, r) => s + r.h, 0)).toBe(900);
    expect(stripRects(300, 300, 4, 'v')[3].y).toBe(225); // direction can be forced
    expect(hasAnim({ frames: ['a'] })).toBe(true);
    expect(hasAnim({ frames: [] })).toBe(false);
    expect(hasAnim(undefined)).toBe(false);
  });
});

describe('legends and the chronicle', () => {
  it('every built-in monster has a story and a hint in both languages', () => {
    for (const e of DEFAULT_ENEMY_TYPES) {
      const l = BUILT_IN_LEGENDS[e.id];
      expect(l, e.id).toBeTruthy();
      for (const lang of ['cs', 'en']) {
        expect(legendText(l.story, lang).length).toBeGreaterThan(10);
        expect(legendText(l.hint, lang).length).toBeGreaterThan(5);
      }
    }
    expect(legendText('a kid wrote this', 'en')).toBe('a kid wrote this');
    expect(legendText(undefined)).toBe('');
  });

  it('a map’s chronicle lists the monsters of its waves and the minions they call', () => {
    const enemies = enemyTypesOf(DEFAULT_COMPONENTS);
    const waves = { rounds: [{ groups: [{ enemy: 'goblin', count: 3 }] }, { groups: [{ enemy: 'necromancer', count: 1 }] }] };
    expect(monstersOfWaves(waves, enemies).map((e) => e.id).sort()).toEqual(['goblin', 'necromancer', 'skeleton', 'skeletonWarrior']);
    expect(enemies.find((e) => e.id === 'spider').legend.hint.en).toMatch(/spiderlings/);
  });

  it('built-in monsters of an older browser get their legends, kids’ edited ones are kept', () => {
    const { db } = migrateDb({ settings: {}, assets: [] });
    const old = { ...db, assets: db.assets.map(({ legend, ...a }) => (a.id === 'wolf' ? { ...a, legend: { story: 'Our wolf', hint: '' } } : a)) };
    const m = migrateDb(old);
    expect(m.changed).toBe(true);
    expect(m.db.assets.find((a) => a.id === 'orc').legend).toEqual(BUILT_IN_LEGENDS.orc);
    expect(m.db.assets.find((a) => a.id === 'wolf').legend.story).toBe('Our wolf');
  });
});

describe('attack events for animations', () => {
  it('towers report their shots, soldiers their hits', () => {
    const cols = 80, rows = 45, cell = 16;
    const walk = new Uint8Array(cols * rows);
    for (let x = 0; x < cols; x++) for (const y of [21, 22, 23]) walk[y * cols + x] = 1;
    const types = DEFAULT_BUILDING_TYPES.map((t) => ({ ...t, levels: t.levels.map((l) => ({ ...l, round: 1 })) }));
    const w = new World({
      map: { centre: { x: 1240, y: 360, radius: 60 }, caves: [{ id: 'c', x: 10, y: 360 }], spots: [{ id: 's1', x: 640, y: 320 }, { id: 's2', x: 560, y: 400 }] },
      grid: { cols, rows, cell, walk }, enemyTypes: DEFAULT_ENEMY_TYPES, buildingTypes: types, seed: 3,
      rules: { ...DEFAULT_RULES, unlocks: [] }, waves: { startCoins: 500, firstPrep: 1000, prep: 1000, rounds: [{ groups: [] }] },
    });
    w.hero.x = 600; w.hero.y = 360;
    w.build('s1', 'tower');
    w.build('s2', 'castle');
    w.hero.dead = true; w.hero.respawnAt = Infinity;
    for (let i = 0; i < 40 * 30; i++) w.update(1 / 30);
    w.drainEvents();
    const e = w.spawnEnemy('orc', { x: 600, y: 360 });
    w.types.orc.speed = 0;
    const seen = new Set();
    for (let i = 0; i < 6 * 30 && !e.dead; i++) { w.update(1 / 30); for (const ev of w.drainEvents()) seen.add(ev.type); }
    expect(seen.has('buildingAttack')).toBe(true);
    expect(seen.has('soldierAttack')).toBe(true);
  });
});

describe('guessing the number of frames in a strip', () => {
  // a strip on paper with `n` blobs separated by paper gaps
  const strip = (n, w = 600, h = 100) => {
    const data = new Uint8ClampedArray(w * h * 4).fill(245);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    for (let k = 0; k < n; k++) {
      const x0 = Math.round(((k + 0.25) * w) / n), x1 = Math.round(((k + 0.75) * w) / n);
      for (let y = 30; y < 70; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; data[i] = 30; data[i + 1] = 40; data[i + 2] = 50; }
    }
    return { data, width: w, height: h };
  };
  it('counts the drawings separated by paper', () => {
    expect(guessFrameCount(strip(4))).toBe(4);
    expect(guessFrameCount(strip(7))).toBe(7);
    expect(guessFrameCount(strip(12, 1200))).toBe(12);
    expect(guessFrameCount(strip(2))).toBeNull(); // too few for an animation
  });
});

describe('frames as panels', async () => {
  const { insertFrame, replaceFrame, duplicateFrame, moveFrame, removeFrame, MAX_FRAMES, DEFAULT_FPS } = await import('./animation.js');
  const anim = { frames: ['a', 'b', 'c'], fps: 10, offsets: [[1, 0], [2, 0], [3, 0]] };

  it('starts an animation from the first drawn frame', () => {
    expect(insertFrame(null, 'x')).toEqual({ fps: DEFAULT_FPS, frames: ['x'], offsets: [[0, 0]] });
  });

  it('adds, replaces, copies, moves and removes frames with their alignment', () => {
    expect(insertFrame(anim, 'd')).toMatchObject({ frames: ['a', 'b', 'c', 'd'], offsets: [[1, 0], [2, 0], [3, 0], [0, 0]], fps: 10 });
    expect(insertFrame(anim, 'z', 1).frames).toEqual(['a', 'z', 'b', 'c']);
    expect(replaceFrame(anim, 1, 'B')).toMatchObject({ frames: ['a', 'B', 'c'], offsets: [[1, 0], [0, 0], [3, 0]] });
    expect(duplicateFrame(anim, 0)).toMatchObject({ frames: ['a', 'a', 'b', 'c'], offsets: [[1, 0], [1, 0], [2, 0], [3, 0]] });
    expect(moveFrame(anim, 2, -1)).toMatchObject({ frames: ['a', 'c', 'b'], offsets: [[1, 0], [3, 0], [2, 0]] });
    expect(moveFrame(anim, 0, -1)).toBe(anim); // already first
    expect(removeFrame(anim, 0)).toMatchObject({ frames: ['b', 'c'], offsets: [[2, 0], [3, 0]] });
    expect(replaceFrame(anim, 0, null).frames).toEqual(['b', 'c']); // ✕ on a panel removes it
  });

  it('the last frame removed = no animation; never more than the maximum', () => {
    expect(removeFrame({ frames: ['a'], offsets: [[0, 0]] }, 0)).toBe(null);
    const full = { frames: Array(MAX_FRAMES).fill('f'), offsets: [] };
    expect(insertFrame(full, 'x')).toBe(full);
    expect(duplicateFrame(full, 0)).toBe(full);
  });

  it('frames without stored offsets get them', () => {
    expect(duplicateFrame({ frames: ['a'] }, 0).offsets).toEqual([[0, 0], [0, 0]]);
  });
});
