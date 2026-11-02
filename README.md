# Sketch Village

A small village-defense strategy game for kids. Every sprite (hero, enemies, houses, towers, coins…) is drawn on paper by the kids, photographed, and turned into a game asset in the built-in drawing studio. Until something is drawn, the game uses simple geometric shapes. The game's own pictures – the default arrow, magic bolt, catapult stone and the built-in surfaces (grass, water…) – are in the studio too: kids can draw over them or replace them, but not delete them.

- Play: https://richardlipka.github.io/sketch-village/
- Full design: [SPEC.md](SPEC.md)
- Czech documentation (PDF, a short guide and the full documentation): [public/docs/kreslena-vesnice.pdf](public/docs/kreslena-vesnice.pdf), also at https://richardlipka.github.io/sketch-village/docs/kreslena-vesnice.pdf
- Asset pipeline origin: `CameraCapture`, `CargoImageEditor`, `defaultLooks.js` (the game's own pictures of the arrow, bolt, stone and surfaces), `SketchPad`, `imageEncoding` from [richardLipka/simple_editable_train](https://github.com/richardLipka/simple_editable_train)

## Playing

- **Pictures**: photo, upload, paste or draw → crop → the paper step: **Remove the paper** (switch it off to keep the whole picture with its background), how much paper to erase, **Darken lines** and **Livelier colours**. The preview is as sharp as the picture the game gets.
- **Save and leave**: ending a game offers to keep it; it is also kept after every round. **Play → Continue** goes on where it was left. The kept game is not part of the downloaded data.
- **Special ability**: every hero has one of eight (mighty strike, battle shout, reinforcements, healing, arrow rain, freeze, shield, rally), picked with its numbers in the hero editor, used with the button next to the attacks or **E** (arrow rain is aimed at a place on the map), upgraded in the Town Hall shop. Pointing at the button shows its area and who it will hit or help.
- **Caves**: in the map editor every cave can look different – a cave drawing or any decoration – and be resized by its corners; one that is no longer beside a road gets a red frame.
- **Wave strength in %**: in the wave editor each group has attack and health in % (200 = double), and the whole plan can grow a few % every round (1–2 % is already much harder). The ability icons can be drawn in the studio (Icons).
- **Speed** 1× / 2× / 3×, a **range circle** while choosing a building, optional **quiet music** (🎵), and the chronicle's **collection** ("you've met 9 of 14 monsters").
- **Save & load → Back to the game's own components** lists what isn't the game's own, what was changed and what is missing, and cleans it up after asking.

## Wave strength

Every monster has a **DSP** (danger strength points – a goblin is worth 10; its multipliers for ranged attacks, flying, area damage, speed, toughness and summoned minions were measured with the balance robot, `npm run calibrate-dsp`). In the wave editor:

- **📈 Wave strength** – a table of every round's DSP and how much stronger it is than the one before;
- **− weaker / + stronger by 10 %** – every wave of the map changed by adding or removing monsters of the kinds already in it;
- **🎲 Generate waves…** – pick the monsters, the number of rounds, the first wave's strength and the growth per round;
- **🧪 Find the limits** – the robot plays each wave again with more and more monsters until it loses 2 of 3 games, and the table shows where each wave breaks (`npm run wave-limits` prints the same for the built-in plan).

Details in SPEC §10b.

## Accessibility

Every screen passes axe-core's WCAG 2.1 AA checks on a PC and a phone (`e2e/a11y.spec.js`), dialogs keep and return the focus, and the game can be played with the keyboard alone: **arrows / WASD** walk, **B** picks the next building place (Tab + Enter builds), **F** attacks the nearest monster, **Space** calls the wave, **1/2/3** switch weapons, **I** opens the backpack, **P** pauses, **?** shows the help. Details in SPEC §4c.

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

```bash
npm run docs-shots   # screenshots of the running game for the documentation (needs npm run dev)
npm run docs         # docs/src/kreslena-vesnice.html → public/docs/kreslena-vesnice.pdf
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

The shipped file holds the class's drawings and maps: the built-in buildings, monsters and coins as the kids drew them, the goblin pack, skeleton warrior and roc, seven heroes with their abilities, the castle's soldiers, a chest, two caves, 16 decorations, the drawn icons and 11 maps (the three library maps among them). A fresh browser starts with these maps instead of the sample map. Before committing a new one, remove personal settings (tutorial progress, met monsters, backup dates) – the shipped file's settings hold only the data version.

## Sharing one map or one component

**Maps → ⬇ Download** on a map gives one `map-<name>.json` with the map and everything needed to play it as you see it: the buildings of its world, heroes, weapons, coins, soldiers, the monsters of its waves and what they call, decorations, textures (not the game's own icons). **Studio → ⬇** on a hero, monster, building, weapon… gives `<kind>-<name>.json` with it and what it needs: the minions a monster calls, a shooter's projectile, a castle's soldiers, a building's other looks.

Loading one on another computer – **⬆ Load a map** in Maps, **⬆ Load** in the studio or in Save & load (a file from the computer or an address: `https://…/map-x.json` or a library name like `green-valley`), the Library or a `?data=` link:

- things that are exactly the same there are used as they are;
- things with the same name but another picture or other numbers come as copies named after the map (or the file's author) – *Goblin (Zelené údolí)* – so it works as you made it;
- at the end a table lists the copies: **Keep both** (default), **Only mine** or **Only the map's / the file's**.

Loading the same file again adds nothing.

## Public library and data links

Ready-made maps for everyone live in [`public/library/`](public/library/): each one is a normal save file with its pictures inside, listed in [`public/library/index.json`](public/library/index.json). The game's **📚 Library** screen shows that list; **Load** imports a file like any save file and **Play this map** starts with it.

- **Add a file**: download a map (**⬇ Download** on a map in Maps) or everything, put the `.json` into `public/library/`, run `npm run library` (rebuilds `index.json` from the files' titles and pictures), push.
- **Links**: `https://richardlipka.github.io/sketch-village/?data=goblin-forest` opens the game with `library/goblin-forest.json` loaded and its map picked. `?data=` also takes a path (`?data=packs/class-3b.json`) or a full `https://…` address of a file elsewhere (the game asks first). The Library's **Link** button copies such a link.
- `npm run make-library` re-draws the three example maps (`scripts/library/maker.js`, in a headless browser; `PW_CHANNEL=chrome` uses the installed Chrome).

All data is always one file: the browser itself keeps exactly one save-file record in IndexedDB, the same JSON that **Download file** gives.

## Code map

- `src/assets/` – studio, the general component editor: `categories.js` (registry), `CameraCapture`, `AssetCropper`, `BackgroundRemover` + `bgRemoval.js`, `SketchPad`, `ImageSlot` (pipeline), `AssetStudio` (library), `AssetEditor` (pictures + all numbers of one component), `BuildingStatsEditor` (features + levels), `EnemyStatsEditor` (numbers + minions), `ProjectilePick` (which projectile a shooter flies), `SoundEditor` + `audioClip.js` (monster sounds: record, auto-trim, trim), `SoundPreview` (hear them as in the game), `PasteButton` + `clipboard.js` (pictures from the clipboard), `AnimationEditor` + `AnimPreview` + `animation.js` (animation strips: cutting, lining up, speed, preview), `ThemesEditor`, `shareComponent.js` (one component as a file with what it needs), `ItemStatsEditor`, `HeroStatsEditor`, `NumField`
- `src/data/` – `safety.js` + `SafetyCard` (backup reminder, asking the browser to keep the data), `saveFile.js` (JSON format), `mergePlan.js` + `ImportReview` + `useImporter` (import: add new, review changed – matched by name), `packageFile.js` (one map or component with everything it needs) + `packageImport.js` + `ImportDuplicates` (such a file: the same things used, partly different ones copied as "Name (Map)", then a table to merge them), `LoadFile` (⬆ a file from the computer or an address), `migrate.js` (old data → components), `store.js` (IndexedDB: one save-file record, coalesced writes), `defaultData.js` (class pack), `library.js` + `Library` (public library, `?data=` links), `DataPanel`
- `src/config/` – `uiIcons.js` (editable GUI icons), `components.js` (built-in components, the permanent ones = the game's own pictures, + `buildingsOf` / `enemyTypesOf` / `itemsOf` / `coinTypesOf`), `features.js` (what a building can do), `themes.js` (worlds), `difficulty.js` (easy / normal / hard), `legends.js` (monster stories and hints), `oldDefaults.js` (earlier default names / legends the migration replaces – `npm run old-defaults`), default numbers `balance.js`, `buildings.js`, `heroStats.js`, `enemies.js`, `weapons.js`, `waves.js`; `rules.js` merges the kids' global rules over them

Every game part – building type, enemy, weapon, shield, armor, coin, hero – is one **component** (a record in `assets`) holding its pictures and all its numbers. A new kind of building is just a component with a different set of features; no code change is needed.
- `src/logic/` – pure, unit-tested game logic: `world/abilities.js` (the hero's special ability), `World.saveState` / `World.restore` (saved games), `dsp.js` (danger strength points), `waveGen.js` (generated waves, all waves ±%), `waveLimit.js` (the robot's limit per wave), `pathGrid.js` (bitmap → walkable grid), `pathfinding.js` (A*, flow field), `mapModel.js` (map record + validation), `waves.js` (wave engine), `world.js` (the game simulation; its parts by topic in `world/`: equipment, buildings, soldiers, enemies, combat, hero, coins), `balanceBot.js` (plays 20 rounds for `balance.test.js`, and the kids' own maps for "Let the robot try")
- `src/maps/` – `MapList`, `MapPainter` (paint + place + terrain, theme; the whole window, an eraser for many things at once) with `PainterTools` (tool bars, terrain panel) and `painterOverlay.js` (overlay drawing), `DecorPanel` + `decorEdit.js` (decorations: searchable list, frame and handles, polygon fill, what the eraser touches), `WaveEditor` + `WaveStrength` + `WaveGenerator` (the strength table, ±%, generating), `MapTestPanel` + `mapTest.js` + `mapTest.worker.js` ("Let the robot try"), `shareMap.js` (one map as a file with everything needed to play it), `mapRuntime.js` (canvas helpers, sample/starter map), `textures.js` (terrain textures)
- `src/game/` – `monsterVoices.js` (when the kids' monster sounds may play), `viewport.js` (the map covers the screen, the paper border around it), `PlaySetup` (pick map + hero, each a sliding row), `GameView` (React ↔ Phaser, fullscreen layout), `phaser.js` (the trimmed Phaser the game uses), `GameScene` (draws the World, animations, wobble; its parts in `scene/`: Textures, Input, Effects, Entities), `GameOverlay` (HUD), `BuildPanel`, `Chronicle` (monster legends), `RulesEditor` (global rules only), `sound.js` (WebAudio effects), `tutorial.js` (first-game tips)
- `src/locales/` – `cs.json`, `en.json` (a test checks both have the same keys)
- `src/ui/` – `Screen.jsx` (fixed head, scrolling body), `Toast` (every note), `ErrorBoundary` (a broken screen shows a card), `PickStrip` (a row of tiles that slides sideways), `search.js` + `SearchBox` (list search), `UiIcon` (drawn GUI icons), `Modal.jsx` (fixed header / footer), `sketch.css` (pen-and-pencil look, phone layout), `device.js` (phone / tablet / PC detection), `install.js` + `UpdateToast` (installing, new versions), `LanguageSwitcher`, `FullscreenButton`, `Modal`
