# Sketch Village – Game Specification

Status: **v1.0** – M1–M5 implemented and published (https://richardlipka.github.io/sketch-village/); balance v2 in §16. Remaining work and open questions: §14 "Later" and §15 (Q2).

---

## 1. Vision

A short, replayable village-defense game for a group of kids who also produce all the art. The kids draw on paper, photograph the drawings, and the drawings become the game. The whole UI looks like it was drawn with pen and pencil on paper.

- Audience: kids **7–11 years**, can read, already know tower-defense games → standard TD conventions (range circles, wave preview, upgrade buttons) are fine.
- Session length: open (Q2); estimate ≈ 20–30 min for 20 rounds with the default waves (not measured with kids yet).
- Platform: desktop browser (mouse); point-and-click so touch tablets work too (not yet tested on a real tablet).
- Language: **Czech by default**, every text switchable to **English** (i18next, `cs.json` / `en.json`, switch in menu, choice remembered). No hardcoded strings anywhere, including config-defined names (enemies, buildings, levels carry `{ cs, en }` names).

## 2. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Build | Vite | Same as source repo, fast dev server |
| Language | JavaScript (ES modules), JSDoc types | Requested; source repo TSX components are ported to JSX |
| Game engine | **Phaser 3** | Sprites, tweens, arcade physics, input, scenes, camera |
| Menus / editors | React 19 | Reuses the existing camera/crop/sketch components |
| Sketch look | **Rough.js** + hand-written fonts (e.g. *Patrick Hand*, *Gochi Hand*) + paper texture + CSS wobbly borders | Pen-and-pencil feel in both DOM UI and in-game HUD |
| Crop | react-easy-crop | Already used in source |
| Pathfinding | Own A* / BFS on walkability grid (or `pathfinding` / `easystarjs`) | Paths come from bitmap |
| Storage | IndexedDB (via `idb-keyval`) + JSON export/import | localStorage quota (~5 MB) is too small for many assets |
| Tests | Vitest | Wave engine, economy and path extraction are pure logic |
| Hosting | **GitHub Pages** (repo on github.com/richardLipka) | Static, free, HTTPS (required for camera) |

### 2.1 Hosting & deployment
- Source in a public GitHub repo (`richardLipka/sketch-village`, name `TBD`), deployed to `https://richardlipka.github.io/<repo>/`.
- **Fully static, no backend.** All data lives in the browser (IndexedDB) and moves between computers only via the JSON save file (§13a).
- GitHub Actions workflow (`.github/workflows/deploy.yml`): on push to `main` → `npm ci` → `npm test` → `vite build` → deploy `dist/` to Pages.
- Vite `base` = `/<repo>/` so asset URLs work under the sub-path. No client-side routing that needs server rewrites (use in-app state or hash routes).
- **Class pack** (bundled default content): `public/default-data.json` shipped with the site is merged on a browser's first run and can be loaded any time (Save & load → Load class pack). Updating it = export JSON from the game, rename, commit it to the repo (steps in README). The shipped file is empty, so a fresh browser gets the built-in sample map.
- Note: data in IndexedDB is per browser + per origin; kids on different computers must export/import JSON (or the teacher commits a combined file as the new default).

## 3. Asset Studio (generalized from simple_editable_train)

### 3.1 What is reused
From `richardLipka/simple_editable_train`:
- `CameraCapture` – getUserMedia, centre square snapshot, front/back switch
- `CargoImageEditor` → renamed **`AssetCropper`** – react-easy-crop, zoom, outputs encoded image
- `SketchPad` – pencil, eraser, shapes, fill, magic wand, flip, undo
- `imageEncoding.js` – `encodeCanvas`, `normalizeAssetImage` (WebP with PNG fallback)

### 3.2 What is generalized / new
1. **Category registry** instead of hardcoded train slots. Each category declares its own rules:

   ```js
   // src/assets/categories.js
   export const CATEGORIES = {
     hero:     { label: 'Hero',     size: 128, aspect: 1, removeBg: true,  frames: 1, multiple: true },
     enemy:    { label: 'Enemy',    size: 128, aspect: 1, removeBg: true,  frames: 1, multiple: true },
     house:    { label: 'House',    size: 128, aspect: 1, removeBg: true,  levels: 3 },
     tower:    { label: 'Tower',    size: 128, aspect: 1, removeBg: true,  levels: 3 },
     coin:     { label: 'Coin',     size: 64,  aspect: 1, removeBg: true },
     projectile:{label: 'Arrow',    size: 64,  aspect: 1, removeBg: true },
     cave:     { label: 'Cave',     size: 128, aspect: 1, removeBg: true },
     castle:   { label: 'Castle',   size: 128, aspect: 1, removeBg: true,  levels: 3 },
     townhall: { label: 'Town Hall',size: 160, aspect: 1, removeBg: true },
     soldier:  { label: 'Soldier',  size: 96,  aspect: 1, removeBg: true },
     decoration:{label: 'Decoration',size: 128, aspect: 1, removeBg: true, multiple: true },
     ui:       { label: 'UI icon',  size: 64,  aspect: 1, removeBg: true },
   };
   ```
2. **Background removal** (new – source repo has none): paper-white → transparent via threshold + flood fill from the edges, with a tolerance slider and the magic wand for touch-ups.
3. **Non-square / large assets** (the map) – crop aspect and output size taken from the category.
4. **Asset record**: `{ id, category, name, author, image, level?, createdAt, stats? }` – the author field lets each kid see "their" asset in game.
5. **Asset library screen**: grid per category, edit / redraw / duplicate / delete, pick which asset is active.
6. **Upgrade levels**: house and tower have **one drawing per upgrade level** (kids draw each level). An asset of category `house`/`tower` is a set `{ levels: [img1, img2, img3] }`; a missing level falls back to the previous drawing with a pencil "+" badge so the game stays playable while drawings are in progress.
7. **Single JSON save file** – see §13a. All data (assets incl. scanned graphics as base64, maps, waves, settings) is downloadable and importable as one file.

### 3.3 Asset flow
```
[Photo | Upload | Draw] → Crop (category aspect) → Remove background → Touch-up in SketchPad → Name + author → Save to library
```

## 4. Visual style – "pen and pencil"
- Paper background (subtle grain), graph-paper or notebook lines in menus.
- All panels/buttons: Rough.js or CSS `border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px` wobble, 2–3 px dark-blue "ink" stroke, slight rotation on hover.
- Hand-written font for all text, numbers look hand-written.
- HUD (lives, coins, workers, wave) drawn with Rough.js onto a canvas layer.
- Hits / explosions as scribbles; destroyed buildings become crossed-out drawings.
- Palette: ink blue `#1e3a8a`, pencil grey, highlighter yellow/green/red accents `TBD`.

## 5. Map = Level

- **Each map is one level.** New maps can be added at any time (map editor), each map carries its own spots, spawns, centre and wave config. Level select screen lists all maps.
- Background is one bitmap **painted inside the app** in the Map Painter (§5.1) – not photographed. For now **the map fits the screen** (default 1280×720 world size).
- **Camera infrastructure from day one**: world coordinates are independent of screen coordinates (Phaser camera). Zoom (mouse wheel, +/- buttons) and pan (drag with right/middle button, or edge scroll) are implemented; with a screen-sized map the camera is simply clamped to bounds. Larger maps later need no game-logic change.
- **Walkability is derived from colour**:
  - **Yellow = path → walkable** (hero and enemies).
  - **Green = grass → not walkable** (only scenery; building spots and the centre sit next to/on paths).
  - Any other colour (trees, water, houses painted as decoration) → not walkable.
- Because maps are painted in-app, the painter uses **exact palette colours** for path and grass, so detection is exact (no HSV guessing needed). A tolerance-based HSV fallback is kept for imported bitmaps.
- Bitmap is downsampled into a **walkability grid** (cell size e.g. 16 px; a cell is walkable if ≥ 50 % of its pixels are path-yellow), cleaned with morphological open/close to remove noise.
- **Village centre** – the target of enemies (one point/area in the middle).
- **10 building spots** at **fixed positions around the village centre**, **close to the path** (on grass, next to yellow), marked by hand in the map editor. The hero builds standing on the nearest path cell. Editor warns if a spot is farther than `maxSpotDistance` from a path.
- **Buildings do not block paths** – enemies walk past and attack what is in range. A blocking **Wall** building may be added later (would require re-computing the flow field when built/destroyed; the pathfinding module is designed for that).
- **Several caves per map**, all on map edges. **Enemies spawn only from caves**; caves are just spawn points. A cave is a spawn object placed in the editor on the map border, where a yellow path reaches the edge. Each cave has an id/name (used in the wave config, e.g. `"spawn": "cave-north"`) and is drawn with a `cave` asset (new asset category, kids draw it). Editor validates that every cave connects by path to the village centre.

### 5.1 Map Painter & Map Editor (in app)
One screen with two modes:
1. **Paint** – bitmap painting at world resolution (1280×720), pencil look:
   - Tools: **path brush (yellow)** with adjustable width, **grass fill (green)**, decoration pencil/colours, eraser (→ grass), flood fill, undo/redo, zoom/pan.
   - Start a new map as all-grass, then draw yellow paths from edges to the centre.
   - **Decoration stamps**: kids' drawings of category `decoration` (trees, rocks, flowers, …) placed on the map – click to stamp, scale/rotate, delete. Decorations are a separate layer (stored as positions, not baked into the bitmap) and never change walkability.
   - Live overlay toggle: shows the computed walkability grid on top of the painting.
2. **Place** – put the **village centre / Town Hall**, **10 building spots** (around centre), **caves** on edges, **hero respawn point**. Drag to move, click to delete, validation messages (spot not next to a path, cave not connected, fewer than 10 spots).
- Reuses SketchPad tools (fill, eraser, undo) generalized to a non-square, large canvas.

## 6. Hero (main character)

- Picked before the game from all `hero` assets in the library.
- **Control: mouse click** on a walkable cell → hero walks along the shortest path (A*). Click on unwalkable area → moves to the nearest walkable cell.
- Click on enemy → attack with the currently selected mode (melee: walk to enemy and hit; ranged: shoot if in range, otherwise walk into range).
- Click on empty building spot (when near) → build menu; click on own building → upgrade / rebuild menu.
- **Input**: desktop mouse is primary; everything works by **point-and-click / tap** (no hover-only info, no right-click-only actions); the backpack also supports drag & drop with mouse or finger, with tap-then-tap as the alternative. Zoom/pan additionally via wheel/drag on desktop and pinch on touch.
- **Lives: 5.** Each life is an HP bar. When HP hits 0, one life is lost: the hero **disappears for 10 s** (visible countdown, Rules editor `heroRespawnDelay`), the village is defended only by towers and soldiers, then the hero comes back **at the Town Hall** with full HP. Lives don't come back.
- **When all 5 lives are lost, the game is lost.** The Town Hall heals a hero standing next to it, so walking back to heal when hurt is part of the game (the balance bot does this; a bot that never heals loses every game).
- **Combat** – the **player chooses** melee or ranged (HUD toggle button; keyboard shortcut optional).
  - Melee: short range, higher damage, cooldown.
  - Ranged: **unlimited arrows** with a **cooldown**.
- **Armor** reduces incoming damage: `damageTaken = max(1, round(damage × (1 − armor)))`, armor = 5 % per point, capped at 60 % (both editable in the Rules editor).

### 6.1 Hero stats – point distribution
Each hero has its own stats, set in the **Hero editor** (Asset Studio, next to the drawing):
- 4 characteristics: **Melee power**, **Ranged power**, **Armor**, **Speed**.
- Every hero starts from the same base and gets **N skill points** (e.g. 10, config) to **distribute** among them (min/max per stat, e.g. 0–5). Kids can't make an all-max hero.
- Each point maps to concrete values via a config table:

```js
// config/heroStats.js
export const HERO_POINTS = 10;
export const HERO_STAT_TABLE = {
  melee:  { base: { damage: 10, range: 40,  cooldown: 0.8 }, perPoint: { damage: 4 } },
  ranged: { base: { damage: 4,  range: 200, cooldown: 1.6 }, perPoint: { damage: 2, cooldown: -0.1 } },
  armor:  { base: 0, perPoint: 1 },
  speed:  { base: 90, perPoint: 12 },
};
// stored on the hero: { assetId: 'a1', points: { melee: 3, ranged: 3, armor: 2, speed: 2 } }
```

### 6.2 Hero upgrades (in game)
- Bought **for coins in the Town Hall** (click Town Hall when the hero is near → upgrade panel).
- Upgradeable: **melee power, ranged power (incl. arrow cooldown), armor, speed**. Each upgrade = +1 point in that stat; prices 15 / 30 / 50 (Rules editor). Upgrades are instant.
- Upgrades last for the current game only; **nothing carries over** to the next game or map.
- HP is the same for every hero (base HP, not a distributed stat); the whole hero table (points, per-point values, HP, caps) is editable in the Rules editor (`rules.hero`).

### 6.3 Weapons & inventory
- Three **weapon classes**, each a separate attack the player switches between (keys 1 / 2 / 3, HUD buttons ⚔️ 🏹 ✨):
  - **melee** – hits one enemy next to the hero, can't reach flying enemies;
  - **ranged** – shoots an arrow at one enemy;
  - **magic** – shoots a spell that damages **every enemy around the target** (splash radius from the weapon), flying ones too. Only usable with a magic weapon.
- A weapon **adds** its damage / reach / cooldown (and splash for magic) to the hero's attack of that class. The **backpack** (🎒) shows three slots – **right hand** (weapon), **left hand** (shield; covered by a two-handed weapon) and **armor** – with the hero's resulting attack / reach / armor under them, and every other item below. Items are **dragged onto their slot** (or tapped, then the slot tapped); a wrong slot is refused with an explanation; dragging a worn item back into the backpack takes it off (no weapon = bare hands). The attack buttons still pick a weapon of their class into the right hand. A found shield or armor goes on at once when its slot is free.
- Getting weapons: enemies sometimes drop a **chest** (2 %, bosses always; picked up by walking over it, vanishes after 60 s; holds a weapon the hero doesn't have yet, or coins when it has all), or buy them in the **Town Hall shop** (price, available from a round).
- **Weapon editor** (🗡️ menu): name, class, drawing (studio category *Weapons*), numbers, price, shop yes/no, from which round, chest chance; add / delete / defaults. Stored in the `weapons` collection (exported). Six defaults: sword, axe, long bow, crossbow, magic wand, fire staff.
- **Hero drawings per class**: a hero has a default drawing plus optional drawings holding a sword / bow / magic; the game shows the one for the current attack class (missing → default). Ready for animated sprites later.
- Weapons are lost at the end of a game, like hero upgrades.

## 7. Buildings

- The **Town Hall** stands in the village centre from the start. **If the Town Hall is destroyed → game over.**
- Other buildings are built only on the 10 spots, only when the hero is **near** (90 px, Rules editor). Any building can be **sold** for 70 % of the coins spent on it.
- **3 levels per building** (build + 2 upgrades); number of levels is data-driven so it can grow later. Each level has its own kids' drawing (§3.2).

| Type | Purpose | Levels | Notes |
|---|---|---|---|
| **Town Hall** | centre, game over when destroyed; sells hero upgrades | 3 | pre-built, not on a spot; upgrade = more HP + **unlocks next building level** |
| **House** | adds **workers** | 3 | `workers` per level |
| **Tower** | shoots **arrows** at the enemy **in range nearest to the village centre** | 3 | damage, range, cooldown per level |
| **Castle** | periodically sends **soldiers** that attack the nearest enemy | 3 | soldier count / spawn interval / soldier stats per level |

- **Town Hall level gates other buildings**: a building can't be upgraded above the Town Hall's level (TH 1 → buildings max level 1, TH 2 → max 2, TH 3 → max 3). Town Hall upgrades also raise its max HP.
- **Soldiers**: auto-controlled units, walk on paths, attack the nearest enemy, **significantly weaker than the hero** (e.g. ~20 % of hero HP/damage). **Max 3 alive per castle**; a dead soldier is replaced after the castle's respawn interval. Castle level raises soldier strength (not count). With no enemy around, soldiers walk back and guard next to their castle. Kids draw a `soldier` asset.
- Every building has **limited HP** and **repairs itself slowly** (1 % max HP/s, starting 5 s after the last hit).
- **Destroyed** building → rubble on the spot; can be **rebuilt for coins** (= level-1 build cost) or cleared for free. A rebuilt building starts at **level 1 – upgrades are lost**.
- **Buildings are data, built from features.** Each building type is a component (§7.1); what it does comes from the features switched on in the studio, so new kinds of buildings are added without code.

### 7.1 Components and features

Every game part is one **component** – a record in `assets` with its pictures *and* all its numbers, edited together in the studio (the general component editor):

| Category | Numbers edited with the pictures |
|---|---|
| `building` | features + a table of levels (1–5); or `variantOf: <type>` = just another look of an existing type |
| `enemy` | hp, speed, damage, cooldown, range, armor, coin drop, flying / ranged / boss, colour |
| `weapon`, `shield`, `armor` | class, one/two hands, damage / range / cooldown / splash or armor, price, shop round, chest drop weight, starter |
| `coin` | value |
| `hero` | skill points (+ drawings per weapon class) |

Built-in components (⭐) ship with the game, can be edited and restored ("Original numbers"), and come back after "Delete all". Kids can duplicate them or create new ones.

Building **features** (`config/features.js`) – each adds its own columns to the level table:

| Feature | Level fields | Effect |
|---|---|---|
| 👷 workers | workers | speeds up all construction |
| 🏹 shoots | damage, range, cooldown | arrows at the enemy nearest to the centre |
| 🛡️ soldiers | soldierCount, soldierHp, soldierDamage, soldierCooldown, soldierRespawn | keeps up to N soldiers alive |
| 🪙 income | income | coins at the end of every round |
| ❤️ healHero | heal, healRange | heals the hero standing nearby |

Every level also has `cost`, `time`, `hp` and `round` (the round from which that level can be built). The **Town Hall** is the building type marked `core` – it uses the same features (default: shoots + healHero) and cannot be deleted. Without a picture a type is drawn as a shape picked from its main feature.

**Rules editor** keeps only what belongs to no single component: economy and timing, selling / repair, soldier movement, the hero point table, hero upgrade prices and their unlock rounds.

## 8. Economy

- **Coins** drop from defeated enemies onto the ground. They **must be picked up** by the hero walking over them (pickup radius). An unpicked coin **despawns after 30 s** (blinks during the last ~5 s). Coins pay for construction, upgrades and rebuilding.
- **Workers**: a **statistic only** (no sprites, no assignment). `workers = Σ workersPerLevel[level]` over all **living** houses; recomputed whenever a house is built, upgraded or destroyed. Workers **speed up construction and upgrades** of everything: `buildTime = baseTime / (1 + k * workers)` (k `TBD`). Shown in HUD next to coins.
- Round reward and early-call bonus coins are added directly (no pickup).
- Starting coins per map in wave config.

## 9. Enemies

- Spawn only from **caves** on map edges, walk along paths towards the **village centre / Town Hall** (flow-field / BFS from centre, shared by all enemies).
- **On the way they attack everything in range** – buildings, soldiers and the hero. While something is in range they stop and fight; when it is gone they continue to the centre.
- Target priority when several things are in range: the nearest.
- Enemy types are `enemy` components (§7.1): picture and numbers in one record. Kids edit the built-in ones and add their own:

```js
{ id: 'goblin', category: 'enemy', name: { cs: 'Skřet', en: 'Goblin' }, images: ['data:…'], builtIn: true,
  stats: { hp: 30, speed: 40, damage: 5, attackCooldown: 1.0, range: 30, coinDrop: [1, 3] } }
```
  - **Both melee and ranged enemies.** Ranged enemies use the same model with larger `range` + `projectileAsset`; they stop at range and shoot.
  - Enemies may have `armor` too (same formula as hero).
  - **Flying enemies** (`flying: true`): fly in a straight line from their cave to the centre, ignoring paths and grass. They **can't be hit by melee** (hero melee, soldiers) – only by arrows (hero ranged, towers, ranged soldiers if added later). They still attack what is in range below them.

## 10. Wave configuration engine

Waves are data (JSON), editable in an in-game editor and importable.

```json
{
  "level": "Meadow",
  "startCoins": 20,
  "rounds": [
    {
      "name": "Round 1",
      "prepTime": 20,
      "groups": [
        { "enemy": "goblin", "count": 5, "spawn": "auto", "interval": 1.5, "delay": 0 },
        { "enemy": "wolf",   "count": 2, "spawn": "cave-north", "interval": 3, "delay": 8 }
      ],
      "reward": { "coins": 10 }
    }
  ]
}
```

- **20 rounds per level** (the default; the count is simply the length of `rounds`).
- Round flow: preparation → wave → round end (reward) → preparation …
  - HUD always shows **time to next wave** (countdown from `prepTime`).
  - **Ready button** starts the next wave immediately; calling it early gives **bonus coins** `floor(remaining × earlyBonusPerSecond)`.
  - Next-wave preview (which enemies, from which caves) shown next to the Ready button – standard TD convention.
  - Each round may override its **reward** and the **prep time before it** (wave editor; empty = automatic).
- **Pacing target**: 20 waves of **40–60 s** each with **20 s** to recover between them (first prep 45 s). Spawns are spread over ~25–32 s; slow enemies (orcs, bosses) come first so they don't drag a wave out. `balance.test.js` checks the average length of every wave.
- **Progression**: something new unlocks after **every** wave (building levels: the `round` of each level in the component editor; hero upgrades: Rules editor): round 1 house + tower → 2 castle → 3 Town Hall 2 → 4 hero bow +1 → 5 tower L2 → 6 sword +1 → 7 house L2 → 8 armor +1 → 9 castle L2 → 10 speed +1 → 11 Town Hall 3 → 12 tower L3 → 13 bow +2 → 14 house L3 → 15 sword +2 → 16 castle L3 → 17 armor +2 → 18 speed +2 → 19 bow +3, sword +3 → 20 armor +3, speed +3. Locked buttons show 🔒 "Available from round N"; new items are announced and listed in the HUD while preparing.
- Difficulty scaling: enemy HP × `(1 + hpScalePerRound × (round − 1))` (Rules editor).

## 11. Win / lose

- **Win**: survive all **20 rounds** of the level.
- **Lose**: the **Town Hall is destroyed**, or the **hero has lost all 5 lives**. The end screen says which.
- End screen: simple **Victory / Defeat** drawing with the round reached. **No score, no stars.**

## 12. Screens

1. Main menu (Play, Asset Studio, Map editor, Wave editor, Settings)
2. Asset Studio (library by category + capture/draw/edit)
3. Hero select
4. Game (map + HUD + build menu)
5. Round summary / Victory / Defeat
6. Editors – **all open to kids**: Map Painter/Editor, **Wave editor** (rounds, groups, caves, timings), the studio's component editor (pictures + numbers of buildings, enemies, weapons, coins, heroes) and the Rules editor (global rules). "Reset to defaults" button in each editor so experiments are safe.

## 13a. Save file (one JSON)

Everything is downloadable as **one JSON file** and importable on another computer. Images are embedded as base64 data URLs (WebP, PNG fallback).

- **Import merges** into existing data: items are matched by `id`; new ids are added; for an existing id the newer `updatedAt` wins (import summary lists added / updated / skipped). Ids are random UUIDs so drawings from different computers don't collide.
- **Purge on demand**: Settings → "Delete all data" (with confirm), plus delete per category / per map. Suggest "export first" before purging.

```json
{
  "format": "sketch-village",
  "version": 2,
  "exportedAt": "2026-10-29T12:00:00Z",
  "settings": { "language": "cs" },
  "assets": [
    { "id": "a1", "category": "hero", "name": "Rytíř Kuba", "author": "Kuba", "images": ["data:image/webp;base64,..."], "stats": { "melee": 3, "ranged": 3, "armor": 2, "speed": 2 }, "createdAt": "…", "updatedAt": "…" },
    { "id": "tower", "category": "building", "name": { "cs": "Věž", "en": "Tower" }, "builtIn": true, "images": ["data:...", "data:...", null],
      "stats": { "features": ["shoots"], "levels": [ { "cost": 25, "time": 12, "hp": 500, "round": 1, "damage": 8, "range": 180, "cooldown": 1 } ] } },
    { "id": "a2", "category": "building", "name": "Ema's tower", "images": ["data:..."], "stats": { "variantOf": "tower" } },
    { "id": "goblin", "category": "enemy", "name": { "cs": "Skřet", "en": "Goblin" }, "images": ["data:..."], "stats": { "hp": 30, "speed": 40, "damage": 5, "coinDrop": [1, 3] } }
  ],
  "rules": [ { "id": "rules", "balance": { }, "build": { }, "hero": { }, "heroUpgradeCosts": [15, 30, 50], "unlocks": [ { "key": "hero:ranged:1", "round": 4 } ] } ],
  "maps": [
    {
      "id": "m1", "name": { "cs": "Louka", "en": "Meadow" },
      "background": "data:image/webp;base64,...",
      "world": { "width": 1280, "height": 720 },
      "palette": { "path": "#f2d24b", "grass": "#8cc66a" },
      "centre": { "x": 640, "y": 360, "radius": 60 },
      "spots": [ { "id": 1, "x": 560, "y": 300 } ],
      "caves": [ { "id": "cave-north", "asset": "a9", "x": 640, "y": 0 } ],
      "heroRespawn": { "x": 660, "y": 380 },
      "decorations": [ { "asset": "a12", "x": 200, "y": 150, "scale": 1, "rotation": 0 } ],
      "waves": { "startCoins": 20, "rounds": [] }
    }
  ]
}
```

- Storage at runtime: IndexedDB; the JSON is the exchange format.
- Version field + migration (`data/migrate.js`): version-1 files (separate `enemyTypes`, `buildingTypes`, `weapons`, `rules.townHallLevels`, per-type drawing categories) are converted into components on load and after import.
- Export can also be per map (map + the assets it uses) `TBD`.

## 13. Project structure

```
src/
  main.jsx, App.jsx
  ui/            sketch.css (CSS wobble instead of Rough.js), LanguageSwitcher, FullscreenButton, Modal
  assets/        categories.js, CameraCapture, AssetCropper, BackgroundRemover + bgRemoval.js, SketchPad, ImageSlot, AssetStudio, AssetEditor (component editor), BuildingStatsEditor, EnemyStatsEditor, ItemStatsEditor, HeroStatsEditor, NumField
  data/          saveFile.js (JSON + merge), migrate.js (v1 → components), store.js (IndexedDB), defaultData.js (class pack), DataPanel
  config/        components.js (built-in components + derived lists), features.js, balance, buildings, heroStats, enemies, weapons, waves (defaults) + rules.js (global rules over defaults)
  logic/         pathGrid, pathfinding, mapModel, waves, world (whole simulation), balanceBot  ← pure, unit-tested
  maps/          MapList, MapPainter, WaveEditor, mapRuntime (canvas helpers, sample map)
  game/          PlaySetup, GameView (React ↔ Phaser), GameScene, GameOverlay, BuildPanel, RulesEditor, sound.js, tutorial.js
  locales/       cs.json, en.json
public/default-data.json   class pack (empty by default)
```

## 14. Milestones

1. **M1 Asset Studio** ✅ – category registry, camera/crop/sketch ported to JS, paper removal, library per category with per-level drawings, hero skill points, IndexedDB, JSON export / merge import / purge, cs/en.
2. **M2 Map** ✅ – Map Painter (road/grass brush, pencil, bucket, undo, live walkable overlay), Place mode (town hall, 10 spots, caves snapped to edge, hero start, decoration stamps, drag/remove), validation with kid-friendly messages, sample map, map list; Phaser game with hero click-to-move (A* on 16 px grid + smoothing), zoom (wheel/pinch/buttons) and drag-pan.
3. **M3 Enemies, waves, hero combat** ✅ – pure `World` simulation (`src/logic/world.js`, unit-tested incl. a full 20-round run): rounds with prep countdown, Ready + early bonus, round rewards, 20-round default plan; enemies from caves on the flow field (flying straight), attack hero/Town Hall in range, melee + ranged enemies, HP scaling per round; hero melee/ranged (keys 1/2), click-to-attack, auto-attack in range, 5 lives → 30 s respawn; coins drop on roads, pick-up, 30 s despawn with blinking; Town Hall HP → defeat; victory after last round. HUD (round, countdown, coins, Town Hall HP, lives, mode, next-wave preview, flying tip), pause, 2× speed, messages. Enemy editor (drawing + stats per type) and per-map wave editor.
4. **M4 Buildings & economy** ✅ – build/upgrade on spots when the hero is near (House → workers, Tower → arrows at the enemy nearest the centre, Castle → up to 3 soldiers guarding ~150 px around it, ground enemies only), Town Hall upgrades (HP, building level cap, hero upgrades for coins), worker speed-up, 1 %/s self-repair 5 s after the last hit, ruins rebuilt at level 1; enemies attack buildings and soldiers in range. Build panel explains every disabled button. Idle hero guards a 130 px radius and walks back afterwards. Building numbers in `src/config/buildings.js` (`buildingTypes` collection overrides them; no editor yet).
4b. **M4 follow-ups** ✅ – **Rules editor** (⚙️ menu): every building level, Town Hall level, hero upgrade price and general number (coins, prep, rewards, refunds, regen, soldiers…) is editable and stored in the `buildingTypes` + `rules` collections, so it travels in the exported JSON. **Selling** a building returns 70 % of everything spent (rules); a ruin can be cleared for free. **Several drawings per building kind**: each building picks one of the kids' drawings at random and keeps it through upgrades. **Simple geometry** placeholders until drawings exist (house = square, tower = triangle, castle = hexagon, town hall = circle, dots = level; enemies circle / diamond = flying / triangle = shooting). **Pencil wobble** toggle (〰️) makes single drawings jitter like a flip-book. **Fullscreen** game layout + fullscreen button (game starts fullscreen). Balance retuned with a bot (`src/logic/balanceBot.js`, `balance.test.js`).
5. **M5 Polish** ✅ – synthesized sound effects (WebAudio, no files; 🔊/🔇 toggle, throttled hits), first-game tips (7 steps advanced by the player's actions: walk, build, Ready, fight, coins, town hall, bow; 💡 hides / shows again; progress saved), a ready-to-play sample map added on the very first start (geometric shapes until drawings exist), balance pass with the bot. Next: playtest with kids and tune the numbers in the Rules editor.
5b. **Gaps closed** ✅ – class pack (`public/default-data.json`), kids can add/delete their own enemy types, hero table in the Rules editor (stored heroes are squeezed into new limits), per-round reward and prep time in the wave editor, next-wave preview shows the caves, Czech/English key-parity test, workflow on Node 22.
5c. **Pacing & progression** ✅ – waves retimed to 40–60 s (bot-measured over 8 seeds: averages 40–57 s, all games won, ~6 buildings lost per 8 games, all late), unlock schedule with something new after every wave, dragon speed 25 → 32, bot hunts enemies attacking buildings before collecting coins (like a kid would).
5d. **v1.1** ✅ – one click builds / upgrades / sells (fixed a bug where the panel's buttons were remounted on every HUD refresh and swallowed the first click; no confirmations); hero respawns after **10 s** at the **Town Hall**, which **heals** a hero standing next to it (8 HP/s) and **shoots arrows** like a weak tower (5 / 8 / 12 dmg by level, editable); maps take **any number of building spots** (1–30), the separate hero-start marker is gone; **weapons** (§6.3); waves re-tuned for the stronger defence (spawn spread ×1.2, enemy HP +5 %/round): bot averages 42–54 s per wave, all games won.
5e. **v1.2** ✅ – **equipment**: backpack + right hand (weapon), left hand (shield, +armor), body armor; two-handed weapons (bows, battle axe, fire staff) take both hands; the hero starts with a weak wooden sword (in hand) and a short bow; changing weapons takes **2 s** (no attacks meanwhile); the attack buttons pick a weapon of that class. Weapons, shields and armor **drawn in the studio are items** with their numbers set next to the drawing (class, one/two hands, damage, reach, speed, splash / damage absorbed, price, shop round, chest chance); the Weapons editor keeps the built-in ones. **Coins have values**: every coin drawing has its own value; drops are paid in the biggest coins that fit (default 1 and 5 without drawings). **Ready** also advances buildings/upgrades in progress by the skipped prep time. Selling asks "Really?" again; upgrades are one click. **Game controls laid over the map**: coins/workers/Town Hall top left, lives top centre, wave info top right, attack types bottom right with equipment above, tools bottom centre. **Rugged road edges** generated from the map (picture only). Decorations: picture list of every drawing, only on grass. Drawing editor: crop, load from disk, magic-wand strength (all undoable). **Performance**: HUD snapshot sent to React only when it changes (~10× fewer renders), memoized overlay pieces with stable callbacks, the build panel refreshes itself, the Phaser game is no longer recreated by language changes or new callbacks, health bars / rings / scaffolding redrawn only when their value changes, pooled floating texts and effects, Phaser's unused audio disabled.
5f. **Components** ✅ – every game part is one component (pictures + all numbers) edited in the studio, which became the general component editor (§7.1). Buildings are made from **features** (workers, arrows, soldiers, income, hero healing) with a table of 1–5 levels whose fields follow the features; the Town Hall is the `core` building type with the same features; "another look" components add drawings to an existing type. Enemies, weapons/shields/armor and coins carry their numbers next to their drawings; the separate Enemies and Weapons screens are gone and the Rules editor keeps only global rules. Old data and version-1 save files are migrated automatically. Tests cover new building kinds made only from data (market, well, 4-level tower).
5g. **Lives & backpack** ✅ – every lost life sends the hero away for 10 s and back to the Town Hall; losing all 5 loses the game (the end screen says why). The bot now walks back to heal below 40 % HP and still wins every seed without losing a life; the same bot without healing loses every seed (new test). Small retune: dragon 280 HP / speed 36, rounds 14–15 spawns. **Backpack** rebuilt: three slots (right hand, left hand, armor) with the hero's attack / reach / armor shown live, items dragged onto slots with mouse or finger (or tap item → tap slot), wrong slots refused, worn items dragged back to take them off.
6. **Later** – rotating decorations, a "+" mark on reused level drawings, a round-summary card, per-map export, playtests on a real tablet and with kids, animated sprites (frame sheets photographed from a printed template), longbowmen soldiers that can hit flying enemies, walls.

## 15. Open questions

| # | Question | Answer |
|---|---|---|
| Q1 | Age of the kids / reading ability? | 7–11, can read, know TD games |
| Q2 | Target length of one game? | |
| Q3 | Tablets / touch needed? | Desktop + mouse; point-and-click so touch taps work too |
| Q4 | Languages? | Czech default, switchable to English |
| Q5 | Map size, single screen or scrolling? | Screen-sized now; zoom/pan infrastructure ready |
| Q6 | Green vs yellow meaning? | Yellow = path (walkable), green = grass (blocked); maps painted in app; enemies spawn from edge caves |
| Q7 | How are the 10 spots defined? | Fixed around centre, marked in map editor |
| Q8 | Melee vs ranged selection | Player chooses |
| Q9 | Hero lives | 5; every lost life → 10 s absence, back at the Town Hall; all lost → game over |
| Q10 | Ranged ammo limited? | Unlimited arrows, cooldown, upgradeable |
| Q11 | Per-hero stats? | Yes, editable in game |
| Q12 | Upgrade levels | 3 levels (build + 2 upgrades), drawing per level, data-driven |
| Q13 | Building types | Town Hall, House, Tower, Castle (soldiers); Wall later |
| Q14 | Coin pickup | Hero must pick up; despawn after 30 s |
| Q15 | Workers | Statistic from living houses |
| Q16 | What enemies attack | Walk to centre, attack everything in range on the way |
| Q17 | Round flow | Ready button, early-call bonus, countdown shown |
| Q18 | Rounds per level | 20 |
| Q19 | Lose condition | Town Hall destroyed, or all hero lives lost |
| Q20 | Editors for kids or for teacher only? | Kids can edit maps |
| Q21 | Losing one life | Hero is away 10 s, then back at the Town Hall with full HP |
| Q22 | Starting buildings | Town Hall only |
| Q23 | Import: merge or replace? | Merge; purge on demand |
| Q24 | Decoration stamps from kids' drawings on the map? | Yes, decoration layer |
| Q25 | Spots vs path | Spots close to the path; hero builds from the path |
| Q26 | Caves | Several caves on map edges; just spawn points (closing caves not planned) |
| Q27 | Do buildings block paths? | No; a blocking **Wall** building may be added later |
| Q28 | How is the hero upgraded? | Coins in Town Hall: melee, ranged, armor, speed |
| Q29 | Limit on hero stats? | Skill points distributed among characteristics |
| Q30 | Is the Town Hall upgradeable? | Yes: more HP + unlocks next building levels |
| Q31 | Soldier limits | 3 per castle |
| Q32 | Rebuilt building level | Level 1, upgrades lost |
| Q33 | Ranged enemies? | Yes, melee and ranged |
| Q34 | End screen: stars / score? | No score |
| Q35 | Flying enemies? | Yes, ignore paths, immune to melee |
| Q36 | Do hero upgrades persist between levels? | No |
| Q37 | Wave editor for kids? | Yes |
| Q38 | Town Hall max level | 3 |
| Q39 | Buildings destroyed by passing enemies | Raise building HP (×5 after bot test); all numbers editable in the Rules editor and exported |
| Q40 | Several drawings of one building kind | Allowed; random one per building, kept through upgrades |
| Q41 | Editor for building numbers | Yes, GUI Rules editor |
| Q42 | Soldiers vs flying enemies | Can't hit them; longbowmen soldiers may come later |
| Q43 | Selling buildings | Yes, ~70 % refund (editable) |
| Q44 | Building during waves | Always allowed |
| Q45 | Hero upgrades | Instant |
| Q46 | Default content | Simple geometry (squares, circles…) until kids' drawings replace it |
| Q47 | Animation | Single drawing + optional wobble now; animated sprites later |

## 16. Balance draft (v1 – starting values, tune by playtesting)

All values become the **defaults** in `src/config/` and are editable in the in-game editors. Units: distance in px (world 1280×720), time in seconds, speed in px/s.

### 16.1 Global

| Setting | Value | Note |
|---|---|---|
| Start coins | **40** | enough for 1 tower + 1 house... almost (forces a choice) |
| First prep time | **45 s** | time to look around and build |
| Prep time (rounds 2–20) | **20 s** | |
| Round reward | **10 + round** coins | round 1 = 11, round 20 = 30; total ≈ 410 |
| Early-call bonus | **0.5 coin / remaining s** | Ready at 20 s left → +10 |
| Coin pickup radius | 24 px | |
| Coin despawn | **30 s** (blinks last 5 s) | |
| Worker speed-up | `buildTime = base / (1 + 0.15 × workers)` | 6 workers → 1.9× faster, 15 → 3.25× |
| Building regen | 1 % max HP / s, starts 5 s after last hit | |
| Enemy scaling | HP × `(1 + 0.04 × (round − 1))` | round 20 = ×1.76 |
| Hero respawn delay | 10 s (every lost life) | |
| Hit invulnerability | 1.5 s after losing a life | |
| Build/interaction radius | 90 px from spot / Town Hall | |

### 16.2 Hero

Base HP **100**, **10 skill points**, **0–5 points per stat**.

| Stat | Base (0 pts) | + per point | At 3 pts | At 5 pts |
|---|---|---|---|---|
| Melee | dmg 10, range 40, cd 0.8 | +4 dmg | 22 dmg → 27 DPS | 30 dmg → 37 DPS |
| Ranged | dmg 5, range 200, cd 1.6 | +2 dmg, −0.1 cd | 11 dmg / 1.3 s → 8.5 DPS | 15 dmg / 1.1 s → 13.6 DPS |
| Armor | 0 % | +5 % damage reduction | 15 % | 25 % |
| Speed | 90 | +12 | 126 | 150 |

Armor cap 60 %. Ranged cooldown floor 0.6 s. Melee is ~3× stronger than ranged per second but risky (enemies hit back); ranged is the only answer to flying enemies.

**Town Hall hero upgrades** – each level = +1 point in that stat (may exceed 5). Level *n* needs Town Hall level *n*.

| Upgrade level | 1 | 2 | 3 |
|---|---|---|---|
| Cost (each of melee / ranged / armor / speed) | 15 | 30 | 50 |

### 16.3 Buildings

Cost = coins to build (L1) or upgrade to that level. Rebuild after destruction = L1 cost. Time = base build time before worker speed-up. Selling returns 70 % of all coins spent on the building. All values below are defaults; the Rules editor changes them.

v2 (after the balance bot): HP ×5 (buildings) / ×2 (Town Hall), tower and soldier damage ×1.5, round reward base 5 → 10. With these, an average build order wins all 20 rounds on a 4-cave test map and loses ~5 buildings in total, none in the first 4 rounds (`npm test` checks this).

**Town Hall** (pre-built, centre)

| Level | Upgrade cost | Time | HP | Unlocks |
|---|---|---|---|---|
| 1 | – | – | 600 | buildings L1, hero upgrades L1 |
| 2 | 60 | 20 | 900 | buildings L2, hero upgrades L2 |
| 3 | 100 | 30 | 1200 | buildings L3, hero upgrades L3 |

**House**

| Level | Cost | Time | HP | Workers |
|---|---|---|---|---|
| 1 | 20 | 10 | 400 | 1 |
| 2 | 30 | 12 | 600 | 2 |
| 3 | 45 | 15 | 800 | 3 |

**Tower** – shoots the enemy in range nearest to the centre; hits ground and flying.

| Level | Cost | Time | HP | Damage | Range | Cooldown | DPS |
|---|---|---|---|---|---|---|---|
| 1 | 30 | 12 | 500 | 9 | 180 | 1.0 | 9 |
| 2 | 45 | 14 | 750 | 15 | 200 | 0.9 | 17 |
| 3 | 70 | 18 | 1000 | 22 | 220 | 0.75 | 29 |

**Castle** – max 3 soldiers, melee only (can't hit flying).

| Level | Cost | Time | HP | Soldier HP | Soldier dmg / cd | Soldier respawn |
|---|---|---|---|---|---|---|
| 1 | 40 | 15 | 750 | 30 | 6 / 1.0 | 12 s |
| 2 | 60 | 18 | 1100 | 45 | 9 / 1.0 | 10 s |
| 3 | 90 | 22 | 1500 | 60 | 12 / 1.0 | 8 s |

Soldier speed 80, range 30, aggro radius 150 around castle (300 against enemies attacking that castle or its soldiers).

Full village (10 spots maxed + Town Hall + all hero upgrades) costs ≈ **2 000 coins**; a good run earns ≈ **1 500**, so players must choose – that's the strategy.

### 16.4 Enemies

| Id | Name (cs / en) | Type | HP | Speed | Dmg | Cd | Range | Armor | Coins |
|---|---|---|---|---|---|---|---|---|---|
| goblin | Skřet / Goblin | melee | 25 | 45 | 4 | 1.0 | 25 | 0 | 1–2 |
| wolf | Vlk / Wolf | fast melee | 18 | 80 | 3 | 0.7 | 25 | 0 | 1–2 |
| archer | Lučištník / Archer | ranged | 20 | 40 | 5 | 1.5 | 150 | 0 | 2 |
| orc | Zlobr / Orc | tank melee | 90 | 30 | 10 | 1.4 | 30 | 15 % | 3–5 |
| bat | Netopýr / Bat | flying | 15 | 55 | 3 | 1.0 | 25 | 0 | 1–2 |
| troll | Troll / Troll | boss melee | 400 | 22 | 25 | 2.0 | 40 | 25 % | 20 |
| dragon | Drak / Dragon | boss flying, ranged | 300 | 25 | 20 | 2.0 | 120 | 20 % | 20 |

### 16.5 Wave plan (20 rounds)

`spawn: "all"` = groups are split round-robin over all caves of the map. Interval = seconds between two enemies of a group. Groups start together unless a delay is given.

| R | Groups (count × enemy, interval s) | Enemies | New thing |
|---|---|---|---|
| 1 | 6 goblin (2.0) | 6 | |
| 2 | 8 goblin (1.8) | 8 | |
| 3 | 8 goblin (1.6) + 4 wolf (2.0, delay 6) | 12 | fast enemy |
| 4 | 10 goblin (1.5) + 3 archer (3.0) | 13 | ranged enemy |
| 5 | 6 goblin + 6 wolf (1.4) + 4 archer (2.5) | 16 | |
| 6 | 12 goblin (1.2) + 2 orc (5.0, delay 8) | 14 | tank |
| 7 | 8 wolf (1.0) + 6 archer (2.0) + 2 orc (5.0) | 16 | |
| 8 | 10 goblin (1.2) + 6 bat (1.5, delay 5) | 16 | **flying** |
| 9 | 8 bat (1.2) + 6 archer (2.0) + 3 orc (4.0) | 17 | |
| 10 | 10 goblin (1.0) + **troll** (delay 10) | 11 | **boss** |
| 11 | 14 goblin (0.9) + 8 wolf (1.0) + 4 archer (2.0) | 26 | |
| 12 | 10 bat (1.0) + 6 archer (1.8) + 4 orc (3.5) | 20 | |
| 13 | 12 wolf (0.8) + 8 archer (1.6) + 4 orc (3.0) | 24 | |
| 14 | 10 goblin (0.8) + 14 bat (0.9) + 5 orc (3.0) | 29 | |
| 15 | 8 bat (1.0) + 8 archer (1.5) + **dragon** (delay 12) | 17 | **flying boss** |
| 16 | 20 goblin (0.6) + 10 wolf (0.8) + 6 orc (2.5) | 36 | |
| 17 | 12 bat (0.8) + 10 archer (1.2) + 6 orc (2.5) | 28 | |
| 18 | 16 wolf (0.6) + 12 archer (1.0) + 8 orc (2.0) + 8 bat (1.0) | 44 | |
| 19 | 20 bat (0.6) + 10 archer (1.0) + 10 orc (2.0) | 40 | |
| 20 | 15 goblin (0.6) + 10 bat (0.8) + 8 orc (2.0) + **troll** + **dragon** (delay 15) | 35 | **final** |

Total ≈ 430 enemies → ≈ 850 coins in drops if all are picked up, + 310 round rewards + 40 start + early bonuses (up to ~190) ≈ **1 400–1 500 coins**.

### 16.6 Sanity checks (to verify in first playtest)
- Round 1 must be winnable by the hero alone (6 goblins × 25 HP vs ~27 melee DPS → yes).
- Round 8 (first bats): the player needs ≥ 1 tower or a ranged-capable hero – show a tip in the next-wave preview ("Flying! Only arrows hit them").
- Round 10 troll (400 HP × 1.36 = 544): needs ~2 L2 towers + hero, or the Town Hall takes ~25 % damage.
- If kids lose before round 6 too often: start coins 60, enemy scaling 0.03.
