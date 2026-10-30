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
npm test          # unit tests (Vitest)
npm run lint      # ESLint
npm run e2e       # browser tests (Playwright): builds, serves and plays the game as a PC and a phone
```

The browser tests need a browser: `npx playwright install chromium` once, or use the installed Chrome with `PW_CHANNEL=chrome npm run e2e`. `npm run icons` re-renders the app icons from `public/icons/icon.svg`.

Camera capture needs `https` or `localhost`. Every push runs lint, unit and browser tests; a push to `main` then publishes to GitHub Pages (`.github/workflows/deploy.yml`).

## Installing and offline play

The game is an installable web app: after the first visit it plays without internet. Chrome / Edge / Android: **Save & load → Install the game**. iPhone / iPad: in Safari, **Share → Add to Home Screen** – on iPhone this is also what makes Safari keep the drawings for good. Still download a backup now and then (**Save & load → Download file**); the menu reminds you when changes are two days old.

## Class pack (shared starting content)

All data lives in each browser. To give every computer the same drawings, maps and rules:

1. In the game: **Save & load → Download file**.
2. Rename the file to `default-data.json` and replace [`public/default-data.json`](public/default-data.json) in this repository, then push.
3. A new computer loads it on its first start; others press **Save & load → Load class pack** (merges, deletes nothing).

The shipped file is empty, so a fresh browser gets the built-in sample map instead.

## Code map

- `src/assets/` – studio, the general component editor: `categories.js` (registry), `CameraCapture`, `AssetCropper`, `BackgroundRemover` + `bgRemoval.js`, `SketchPad`, `ImageSlot` (pipeline), `AssetStudio` (library), `AssetEditor` (pictures + all numbers of one component), `BuildingStatsEditor` (features + levels), `EnemyStatsEditor` (numbers + minions), `AnimationEditor` + `AnimPreview` + `animation.js` (animation strips: cutting, lining up, speed, preview), `ThemesEditor`, `ItemStatsEditor`, `HeroStatsEditor`, `NumField`
- `src/data/` – `safety.js` + `SafetyCard` (backup reminder, asking the browser to keep the data), `saveFile.js` (JSON format), `mergePlan.js` + `ImportReview` (import: add new, review changed – matched by name), `migrate.js` (old data → components), `store.js` (IndexedDB), `defaultData.js` (class pack), `DataPanel`
- `src/config/` – `components.js` (built-in components + `buildingsOf` / `enemyTypesOf` / `itemsOf` / `coinTypesOf`), `features.js` (what a building can do), `themes.js` (worlds), `difficulty.js` (easy / normal / hard), `legends.js` (monster stories and hints), default numbers `balance.js`, `buildings.js`, `heroStats.js`, `enemies.js`, `weapons.js`, `waves.js`; `rules.js` merges the kids' global rules over them

Every game part – building type, enemy, weapon, shield, armor, coin, hero – is one **component** (a record in `assets`) holding its pictures and all its numbers. A new kind of building is just a component with a different set of features; no code change is needed.
- `src/logic/` – pure, unit-tested game logic: `pathGrid.js` (bitmap → walkable grid), `pathfinding.js` (A*, flow field), `mapModel.js` (map record + validation), `waves.js` (wave engine), `world.js` (the whole game simulation), `balanceBot.js` (plays 20 rounds for `balance.test.js`, and the kids' own maps for "Let the robot try")
- `src/maps/` – `MapList`, `MapPainter` (paint + place + terrain, theme), `WaveEditor`, `MapTestPanel` + `mapTest.js` + `mapTest.worker.js` ("Let the robot try"), `shareMap.js` (one map as a file), `mapRuntime.js` (canvas helpers, sample/starter map), `textures.js` (terrain textures)
- `src/game/` – `PlaySetup` (pick map + hero), `GameView` (React ↔ Phaser, fullscreen layout), `GameScene` (draws the World, placeholders, animations, wobble), `GameOverlay` (HUD), `BuildPanel`, `Chronicle` (monster legends), `RulesEditor` (global rules only), `sound.js` (WebAudio effects), `tutorial.js` (first-game tips)
- `src/locales/` – `cs.json`, `en.json` (a test checks both have the same keys)
- `src/ui/` – `sketch.css` (pen-and-pencil look, phone layout), `device.js` (phone / tablet / PC detection), `install.js` + `UpdateToast` (installing, new versions), `LanguageSwitcher`, `FullscreenButton`, `Modal`
