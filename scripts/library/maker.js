// Runs in the browser (scripts/make-library.mjs loads it through Vite): draws
// the example maps of the public library – roads, a pond, building spots,
// caves – and the decorations standing on them, pencil-style, and returns
// them as save files (one per map, everything inside, pictures as data URLs).
// Seeded: the same code gives the same files.

import { emptyMap, validateMap, placeCave, CENTRE_RADIUS, MAX_SPOT_DISTANCE } from '/src/logic/mapModel.js';
import { worldToCell, isWalkable, nearestWalkable } from '/src/logic/pathGrid.js';
import { gridFromCanvas, mapThumbnail } from '/src/maps/mapRuntime.js';
import { makeCanvas } from '/src/assets/imageEncoding.js';
import { mapPackage } from '/src/maps/shareMap.js';
import { fillPolygon, seededRng } from '/src/maps/decorEdit.js';
import { DEFAULT_THEMES, fitsTheme } from '/src/config/themes.js';
import { DEFAULT_BUILDING_TYPES } from '/src/config/buildings.js';
import { playGame } from '/src/logic/balanceBot.js';

const STAMP = '2026-10-31T00:00:00.000Z';
const AUTHOR = 'Kreslená vesnice';
const INK = '#1f2937';
const POND = '#4c8dd6';

// ---------------- decorations (128 × 128, transparent) ----------------

function pencil(rng) {
  // a line that wobbles a little, like drawn by hand
  return (ctx, pts, close = false) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const jx = x + (rng() - 0.5) * 2, jy = y + (rng() - 0.5) * 2;
      if (i) ctx.lineTo(jx, jy); else ctx.moveTo(jx, jy);
    });
    if (close) ctx.closePath();
  };
}
const circlePts = (cx, cy, rx, ry = rx, n = 18) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * rx, cy + Math.sin((i / n) * Math.PI * 2) * ry]);

function blob(ctx, line, pts, fill) {
  line(ctx, pts, true);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.stroke();
}

const DRAW = {
  oak(ctx, line) {
    blob(ctx, line, [[56, 120], [57, 78], [71, 78], [73, 120]], '#8b5a2b');
    for (const [x, y, r, c] of [[44, 62, 24, '#3f8a30'], [84, 60, 24, '#3f8a30'], [64, 40, 28, '#4d9a3a'], [62, 70, 22, '#4d9a3a']]) blob(ctx, line, circlePts(x, y, r), c);
  },
  spruce(ctx, line) {
    blob(ctx, line, [[58, 124], [59, 100], [69, 100], [70, 124]], '#7c4a24');
    for (const [top, bottom, half] of [[60, 108, 40], [36, 84, 32], [10, 58, 24]]) blob(ctx, line, [[64, top - 4], [64 + half, bottom], [64 - half, bottom]], top === 10 ? '#3d7f45' : '#2f6b3a');
  },
  bush(ctx, line) {
    for (const [x, y, r] of [[40, 86, 24], [86, 86, 24], [63, 70, 28]]) blob(ctx, line, circlePts(x, y, r, r * 0.85), '#5fa648');
    ctx.fillStyle = '#dc2626';
    for (const [x, y] of [[48, 74], [70, 62], [82, 84], [58, 90]]) { ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
  },
  flowers(ctx, line, rng) {
    ctx.strokeStyle = '#2f6b3a';
    for (let i = 0; i < 9; i++) { const x = 20 + i * 11; line(ctx, [[x, 118], [x + (rng() - 0.5) * 10, 88 - rng() * 20]]); ctx.stroke(); }
    ctx.strokeStyle = INK;
    for (const [x, y, c] of [[30, 70, '#f472b6'], [62, 56, '#facc15'], [92, 72, '#ffffff'], [46, 92, '#a855f7'], [80, 96, '#f472b6']]) {
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; blob(ctx, line, circlePts(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 6, 6, 8), c); }
      ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
    }
  },
  rock(ctx, line) {
    blob(ctx, line, [[14, 110], [24, 70], [52, 46], [88, 50], [112, 80], [116, 112]], '#9ca3af');
    ctx.fillStyle = '#d1d5db';
    line(ctx, [[34, 74], [54, 58], [70, 62], [50, 80]], true); ctx.fill();
  },
  mushroom(ctx, line) {
    blob(ctx, line, [[52, 120], [54, 72], [74, 72], [76, 120]], '#fef3c7');
    blob(ctx, line, [[16, 78], [24, 48], [64, 26], [104, 48], [112, 78]], '#dc2626');
    ctx.fillStyle = '#ffffff';
    for (const [x, y, r] of [[40, 56, 7], [64, 42, 6], [88, 58, 7], [62, 66, 5]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  },
  gravestone(ctx, line) {
    blob(ctx, line, [[28, 122], [28, 50], [36, 28], [64, 16], [92, 28], [100, 50], [100, 122]], '#a8a29e');
    ctx.lineWidth = 4;
    line(ctx, [[64, 40], [64, 84]]); ctx.stroke();
    line(ctx, [[48, 54], [80, 54]]); ctx.stroke();
    ctx.lineWidth = 2;
    for (const y of [96, 106]) { line(ctx, [[42, y], [86, y]]); ctx.stroke(); }
  },
  deadTree(ctx, line) {
    ctx.strokeStyle = '#5b3a1e';
    ctx.lineCap = 'round';
    for (const [w, pts] of [[12, [[64, 124], [62, 80], [66, 40]]], [7, [[63, 80], [36, 56], [24, 30]]], [7, [[65, 64], [92, 44], [104, 22]]], [5, [[66, 40], [58, 14]]], [4, [[36, 56], [16, 52]]], [4, [[92, 44], [112, 50]]]]) {
      ctx.lineWidth = w; line(ctx, pts); ctx.stroke();
    }
  },
  pumpkin(ctx, line) {
    blob(ctx, line, [[60, 46], [58, 30], [70, 26], [68, 46]], '#3f8a30');
    for (const [x, rx] of [[40, 26], [88, 26], [64, 30]]) blob(ctx, line, circlePts(x, 86, rx, 34), '#f97316');
    ctx.fillStyle = INK;
    for (const pts of [[[46, 76], [56, 76], [51, 66]], [[72, 76], [82, 76], [77, 66]], [[44, 94], [84, 94], [74, 104], [54, 104]]]) { line(ctx, pts, true); ctx.fill(); }
  },
};

const DECOR_NAMES = {
  oak: { cs: 'Dub', en: 'Oak' },
  spruce: { cs: 'Smrk', en: 'Spruce' },
  bush: { cs: 'Keř s jahodami', en: 'Berry bush' },
  flowers: { cs: 'Kytičky', en: 'Flowers' },
  rock: { cs: 'Kámen', en: 'Rock' },
  mushroom: { cs: 'Muchomůrka', en: 'Toadstool' },
  gravestone: { cs: 'Náhrobek', en: 'Gravestone' },
  deadTree: { cs: 'Suchý strom', en: 'Dead tree' },
  pumpkin: { cs: 'Dýně', en: 'Pumpkin' },
};

function decoration(kind, seed) {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  const rng = seededRng(seed);
  DRAW[kind](ctx, pencil(rng), rng);
  return {
    id: `lib-${kind}`, category: 'decoration', name: DECOR_NAMES[kind], author: AUTHOR,
    images: [c.toDataURL('image/png')], themes: [], createdAt: STAMP, updatedAt: STAMP,
  };
}

// ---------------- maps ----------------

function road(ctx, pts, width) {
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(...pts[0]);
  // smooth curve through the points (midpoints as anchors)
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [nx, ny] = pts[i + 1];
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  ctx.lineTo(...pts[pts.length - 1]);
  ctx.stroke();
}

/** Building spots beside the roads: off the road, close enough to it, apart from each other. */
function spotsAlong(map, grid, roads, want, rng) {
  const { width: W, height: H } = map.world;
  const free = (x, y) => {
    for (const [dx, dy] of [[0, 0], [-26, -26], [26, -26], [-26, 26], [26, 26]]) {
      const c = worldToCell(grid, x + dx, y + dy);
      if (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= H || isWalkable(grid, c.cx, c.cy)) return false;
    }
    const c = worldToCell(grid, x, y);
    const n = nearestWalkable(grid, c.cx, c.cy, Math.ceil(MAX_SPOT_DISTANCE / grid.cell) + 1);
    return n && n.dist * grid.cell <= MAX_SPOT_DISTANCE - 8;
  };
  const candidates = [];
  for (const pts of roads) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const len = Math.hypot(bx - ax, by - ay);
      for (let s = 30; s < len; s += 40) {
        const k = s / len, x = ax + (bx - ax) * k, y = ay + (by - ay) * k;
        const nx = -(by - ay) / len, ny = (bx - ax) / len;
        for (const side of [1, -1]) {
          const p = { x: Math.round(x + nx * side * 56), y: Math.round(y + ny * side * 56) };
          // nearer the village first (towers there guard every road), a little mixed
          candidates.push({ ...p, r: Math.hypot(p.x - map.centre.x, p.y - map.centre.y) + rng() * 80 });
        }
      }
    }
  }
  candidates.sort((a, b) => a.r - b.r);
  const spots = [];
  for (const p of candidates) {
    if (spots.length >= want) break;
    if (!free(p.x, p.y)) continue;
    if (Math.hypot(p.x - map.centre.x, p.y - map.centre.y) < 110) continue;
    if ([...spots, ...map.caves].some((s) => Math.hypot(p.x - s.x, p.y - s.y) < 78)) continue;
    spots.push({ id: `${map.id}-spot-${spots.length + 1}`, x: p.x, y: p.y });
  }
  return spots;
}

const MAPS = [
  {
    file: 'green-valley', name: 'Zelené údolí', theme: 'plains', seed: 11,
    title: { cs: 'Zelené údolí', en: 'Green valley' },
    description: { cs: 'Tři cesty loukou k vesnici, rybník a lesík. Dobrá první mapa.', en: 'Three roads through the meadow to the village, a pond and a little wood. A good first map.' },
    textures: { grass: 'meadow', path: 'dirt', pond: 'water' },
    roads: [
      [[0, 200], [180, 230], [330, 330], [470, 360], [580, 360]],
      [[520, 0], [540, 120], [610, 200], [640, 300]],
      [[1280, 560], [1100, 520], [950, 450], [800, 400], [700, 370]],
    ],
    caves: [[30, 200], [520, 30], [1250, 560]],
    ponds: [[1000, 170, 120, 70], [250, 560, 90, 55]],
    spots: 9,
    decor: [
      { kinds: ['oak', 'bush'], poly: [[740, 560], [1000, 610], [1060, 720], [700, 720]], density: 6, size: 64 },
      { kinds: ['oak'], poly: [[0, 0], [380, 0], [420, 120], [0, 150]], density: 5, size: 70 },
      { kinds: ['flowers', 'bush', 'rock'], poly: [[0, 0], [1280, 0], [1280, 720], [0, 720]], density: 2, size: 44 },
    ],
  },
  {
    file: 'goblin-forest', name: 'Skřetí les', theme: 'goblinForest', seed: 23,
    title: { cs: 'Skřetí les', en: 'Goblin forest' },
    description: { cs: 'Klikatá cesta hustým smrkovým lesem. Skřeti chodí ze dvou stran.', en: 'A winding road through a thick spruce forest. Goblins come from two sides.' },
    textures: { grass: 'grass', path: 'dirt' },
    roads: [
      [[0, 110], [240, 100], [380, 190], [330, 300], [420, 400], [580, 380]],
      [[1280, 640], [1080, 620], [960, 540], [1010, 420], [880, 330], [700, 350]],
    ],
    caves: [[30, 110], [1250, 640]],
    ponds: [],
    spots: 11,
    decor: [
      { kinds: ['spruce'], poly: [[0, 0], [1280, 0], [1280, 720], [0, 720]], density: 7, size: 72 },
      { kinds: ['mushroom', 'rock'], poly: [[0, 0], [1280, 0], [1280, 720], [0, 720]], density: 1, size: 36 },
    ],
  },
  {
    file: 'spooky-graveyard', name: 'Strašidelný hřbitov', theme: 'graveyard', seed: 37,
    title: { cs: 'Strašidelný hřbitov', en: 'Spooky graveyard' },
    description: { cs: 'Čtyři cesty ze všech rohů a okruh kolem vesnice. Náhrobky, suché stromy a dýně. Těžší mapa.', en: 'Four roads from every corner and a ring around the village. Gravestones, dead trees and pumpkins. A harder map.' },
    textures: { grass: 'dirt', path: 'cobble' },
    roads: [
      [[60, 0], [200, 150], [380, 250], [560, 320]],
      [[1220, 0], [1080, 150], [900, 250], [720, 320]],
      [[0, 650], [200, 600], [400, 500], [560, 410]],
      [[1280, 660], [1080, 600], [880, 500], [720, 410]],
    ],
    ring: [150, 115],
    caves: [[70, 30], [1210, 30], [30, 640], [1250, 650]],
    ponds: [],
    spots: 12,
    decor: [
      { kinds: ['gravestone'], poly: [[420, 20], [860, 20], [860, 170], [420, 170]], density: 6, size: 46 },
      { kinds: ['gravestone'], poly: [[440, 580], [840, 580], [840, 710], [440, 710]], density: 6, size: 46 },
      { kinds: ['deadTree', 'pumpkin'], poly: [[0, 0], [1280, 0], [1280, 720], [0, 720]], density: 2, size: 60 },
    ],
  },
];

async function makeMap(def, decorById) {
  const m = { ...emptyMap(def.name), id: `lib-${def.file}`, author: AUTHOR, description: def.description.cs, theme: def.theme, createdAt: STAMP, updatedAt: STAMP };
  const { width: W, height: H } = m.world;
  const cx = W / 2, cy = H / 2;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = m.palette.grass;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = POND;
  for (const [x, y, rx, ry] of def.ponds) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = m.palette.path;
  for (const pts of def.roads) road(ctx, pts, 44);
  if (def.ring) { ctx.lineWidth = 44; ctx.beginPath(); ctx.ellipse(cx, cy, ...def.ring, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = m.palette.path; // the village square
  ctx.beginPath(); ctx.ellipse(cx, cy, 80, 58, 0, 0, Math.PI * 2); ctx.fill();

  const grid = gridFromCanvas(c, m.palette);
  const rng = seededRng(def.seed);
  m.centre = { x: cx, y: cy, radius: CENTRE_RADIUS };
  m.caves = def.caves.map(([x, y], i) => ({ id: `${m.id}-cave-${i + 1}`, ...placeCave(grid, { x, y }, m.world) }));
  m.spots = spotsAlong(m, grid, def.roads, def.spots, rng);
  m.textures = Object.fromEntries(Object.entries(def.textures).map(([k, tex]) => [k === 'grass' ? m.palette.grass : k === 'path' ? m.palette.path : POND, tex]));

  // decorations: on grass only, away from roads, the village, spots, caves and each other
  const onRoad = (p) => { const q = worldToCell(grid, p.x, p.y); return isWalkable(grid, q.cx, q.cy); };
  const nearRoad = (p, r) => { const q = worldToCell(grid, p.x, p.y); const n = nearestWalkable(grid, q.cx, q.cy, Math.ceil(r / grid.cell) + 1); return n && n.dist * grid.cell <= r; };
  const pondAt = (p) => def.ponds.some(([x, y, rx, ry]) => ((p.x - x) / (rx + 10)) ** 2 + ((p.y - y) / (ry + 10)) ** 2 <= 1);
  const placed = [];
  for (const layer of def.decor) {
    const made = fillPolygon(layer.poly.map(([x, y]) => ({ x, y })), {
      size: layer.size, density: layer.density, variety: 0.3, rng,
      allowed: (p) => !onRoad(p) && !nearRoad(p, 30) && !pondAt(p)
        && Math.hypot(p.x - cx, p.y - cy) > 130
        && ![...m.spots, ...m.caves].some((s) => Math.hypot(p.x - s.x, p.y - s.y) < 50)
        && !placed.some((d) => Math.hypot(p.x - d.x, p.y - d.y) < Math.min(d.w, layer.size) * 0.55),
    });
    for (const d of made) placed.push({ id: `${m.id}-d${placed.length + 1}`, asset: `lib-${layer.kinds[Math.floor(rng() * layer.kinds.length)]}`, ...d });
  }
  // further down = in front (the game draws by y too; the editor in list order)
  m.decorations = placed.sort((a, b) => a.y - b.y);

  m.background = c.toDataURL('image/png');
  const check = validateMap(m, grid);
  m.valid = check.ok;

  // the robot plays it three times on normal (only reported – the maps are made to be fair, not hard)
  const types = DEFAULT_BUILDING_TYPES.filter((ty) => ty.core || fitsTheme(ty, m.theme));
  const results = [1, 2, 3].map((seed) => playGame({ map: { ...m, background: null }, grid, buildingTypes: types, seed })).map((g) => `${g.result}@${g.round}`);

  const used = new Set(m.decorations.map((d) => d.asset));
  const db = { assets: [...used].map((id) => decorById[id]), themes: DEFAULT_THEMES };
  const file = mapPackage(m, db, undefined, new Date(STAMP), { thumbnail: await mapThumbnail(m, db.assets) });
  file.info = { ...file.info, title: def.title, description: def.description }; // both languages in the library
  return { name: `${def.file}.json`, file, problems: check.problems, results, decorations: m.decorations.length, spots: m.spots.length };
}

export async function makeLibrary() {
  const decorById = Object.fromEntries(Object.keys(DRAW).map((k, i) => [`lib-${k}`, decoration(k, 100 + i)]));
  const out = [];
  for (const def of MAPS) out.push(await makeMap(def, decorById));
  return out;
}
