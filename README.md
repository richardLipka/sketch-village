# Sketch Village

A small village-defense strategy game for kids. Every sprite (hero, enemies, houses, towers, coins, the map itself) is drawn on paper by the kids, photographed, and turned into a game asset in the built-in Asset Studio.

- Full design: [SPEC.md](SPEC.md) (living document, filled in step by step)
- Asset pipeline origin: `CameraCapture`, `CargoImageEditor`, `SketchPad`, `imageEncoding` from [richardLipka/simple_editable_train](https://github.com/richardLipka/simple_editable_train)

## Run

```bash
npm install
npm run dev
```

```bash
npm test
```

Camera capture needs `https` or `localhost`.

## Code map

- `src/assets/` – Asset Studio: `categories.js` (registry), `CameraCapture`, `AssetCropper`, `BackgroundRemover` + `bgRemoval.js`, `SketchPad`, `ImageSlot` (pipeline), `AssetEditor`, `AssetStudio`, `HeroStatsEditor`
- `src/data/` – `saveFile.js` (JSON format + merge), `store.js` (IndexedDB), `DataPanel`
- `src/config/` – game numbers (`heroStats.js`)
- `src/logic/` – pure, unit-tested game logic: `pathGrid.js` (bitmap → walkable grid), `pathfinding.js` (A*, flow field), `mapModel.js` (map record + validation), `waves.js` (wave engine), `world.js` (the whole game simulation)
- `src/maps/` – `MapList`, `MapPainter` (paint + place), `WaveEditor`, `mapRuntime.js` (canvas helpers, sample map)
- `src/game/` – `PlaySetup` (pick map + hero), `GameView` (React ↔ Phaser + HUD), `GameScene` (draws the World), `Hud`, `EnemyEditor`
- `src/config/` also holds `balance.js`, `enemies.js`, `waves.js` (SPEC §16 defaults)
- `src/locales/` – `cs.json`, `en.json`
- `src/ui/` – `sketch.css` (pen-and-pencil look), shared widgets
