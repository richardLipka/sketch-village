# Sketch Village

A small village-defense strategy game for kids. Every sprite (hero, enemies, houses, towers, coins…) is drawn on paper by the kids, photographed, and turned into a game asset in the built-in drawing studio. Until something is drawn, the game uses simple geometric shapes.

- Play: https://richardlipka.github.io/sketch-village/
- Full design: [SPEC.md](SPEC.md)
- Asset pipeline origin: `CameraCapture`, `CargoImageEditor`, `SketchPad`, `imageEncoding` from [richardLipka/simple_editable_train](https://github.com/richardLipka/simple_editable_train)

## Run

```bash
npm install
npm run dev
```

```bash
npm test
```

Camera capture needs `https` or `localhost`. Every push to `main` runs the tests and publishes to GitHub Pages (`.github/workflows/deploy.yml`).

## Class pack (shared starting content)

All data lives in each browser. To give every computer the same drawings, maps and rules:

1. In the game: **Save & load → Download file**.
2. Rename the file to `default-data.json` and replace [`public/default-data.json`](public/default-data.json) in this repository, then push.
3. A new computer loads it on its first start; others press **Save & load → Load class pack** (merges, deletes nothing).

The shipped file is empty, so a fresh browser gets the built-in sample map instead.

## Code map

- `src/assets/` – drawing studio: `categories.js` (registry), `CameraCapture`, `AssetCropper`, `BackgroundRemover` + `bgRemoval.js`, `SketchPad`, `ImageSlot` (pipeline), `AssetEditor`, `AssetStudio`, `HeroStatsEditor`
- `src/data/` – `saveFile.js` (JSON format + merge), `store.js` (IndexedDB), `defaultData.js` (class pack), `DataPanel`
- `src/config/` – default numbers: `balance.js`, `buildings.js`, `heroStats.js`, `enemies.js`, `waves.js`; `rules.js` merges the kids' edited rules over them
- `src/logic/` – pure, unit-tested game logic: `pathGrid.js` (bitmap → walkable grid), `pathfinding.js` (A*, flow field), `mapModel.js` (map record + validation), `waves.js` (wave engine), `world.js` (the whole game simulation), `balanceBot.js` (plays 20 rounds for `balance.test.js`)
- `src/maps/` – `MapList`, `MapPainter` (paint + place), `WaveEditor`, `mapRuntime.js` (canvas helpers, sample/starter map)
- `src/game/` – `PlaySetup` (pick map + hero), `GameView` (React ↔ Phaser, fullscreen layout), `GameScene` (draws the World, placeholders, wobble), `Hud`, `BuildPanel`, `EnemyEditor`, `RulesEditor`, `sound.js` (WebAudio effects), `tutorial.js` (first-game tips)
- `src/locales/` – `cs.json`, `en.json` (a test checks both have the same keys)
- `src/ui/` – `sketch.css` (pen-and-pencil look), `LanguageSwitcher`, `FullscreenButton`, `Modal`
