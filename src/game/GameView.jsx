import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Phaser from './phaser.js';
import { useTranslation } from 'react-i18next';
import GameScene from './GameScene.js';
import { mapCanvas, gridFromCanvas, ruggedRoads } from '../maps/mapRuntime.js';
import { texturedCanvas } from '../maps/textures.js';
import { fitsTheme } from '../config/themes.js';
import { loadImage } from '../assets/imageEncoding.js';
import { composeFrame, firstFrame, DEFAULT_FPS } from '../assets/animation.js';
import SelectionPanel from './SelectionPanel.jsx';
import Chronicle, { monstersOfWaves } from './Chronicle.jsx';
import Modal from '../ui/Modal.jsx';
import { useDevice } from '../ui/device.js';
import AnimPreview from '../assets/AnimPreview.jsx';
import { legendText } from '../config/legends.js';
import { Resources, Lives, WaveInfo, AttackBar, Equipment, Toolbar, Coach, RoundSummary, gameKey } from './GameOverlay.jsx';
import { difficultyOf } from '../config/difficulty.js';
import { DEFAULT_HERO_POINTS } from '../config/heroStats.js';
import { DEFAULT_RULES } from '../config/rules.js';
import { wavesOf } from '../config/waves.js';
import { unlockLabel } from '../config/unlocks.js';
import { DEFAULT_WEAPONS, isWeapon } from '../config/weapons.js';
import { coinTypesOf } from '../config/components.js';
import { World } from '../logic/world.js';
import { play, setMuted, soundFor, loadClip, playClip } from './sound.js';
import { VoiceDirector } from './monsterVoices.js';
import { SOUND_KINDS } from '../assets/audioClip.js';
import { TUTORIAL_STEPS, TUTORIAL_DONE, advanceTutorial } from './tutorial.js';

const MESSAGE_MS = 2600;
const NEW_MONSTER_MS = 7000;
const SUMMARY_MS = 9000;
const voiceKey = (v) => `voice:${v.type}:${v.kind}`;

// React wrapper: prepares images, grid and the World, runs Phaser and lays the
// controls over the map (GameOverlay). Fills the whole window.
//
// Performance notes:
// - the Phaser game is created once per game; it is NOT recreated when callbacks
//   or the language change (they are read through refs);
// - the scene sends a HUD snapshot only when a visible value changed;
// - overlay pieces are memoized with primitive props and stable callbacks;
// - the build panel refreshes itself (SelectionPanel), not the whole screen.
export default function GameView({ map, hero, assets, enemyTypes, buildings, weapons = DEFAULT_WEAPONS, rules = DEFAULT_RULES, themes = [], difficulty, settings = {}, onSettings, onExit }) {
  const { t, i18n } = useTranslation();
  const hostRef = useRef(null);
  const gameRef = useRef(null);
  const worldRef = useRef(null);
  const [hud, setHud] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [restart, setRestart] = useState(0);
  const [selection, setSelection] = useState(null);
  const [panelVersion, setPanelVersion] = useState(0); // bumped after an action → panel re-reads at once
  // phone (held sideways) / tablet / pc – the controls are laid out for it (ui/device.js, sketch.css)
  const { device, portrait } = useDevice();
  // the chronicle of this map's monsters: who has been met in this game, the newest one
  const seen = useRef(new Set());
  const [newMonster, setNewMonster] = useState(null);
  const [chronicle, setChronicle] = useState(false);
  // the card after each wave: what happened, the reward, what's new (World `roundEnd` + `unlocked`)
  const [summary, setSummary] = useState(null);
  const monsters = useMemo(() => monstersOfWaves(wavesOf(map, rules.balance), enemyTypes), [map, rules, enemyTypes]);
  const wobble = !!settings.wobble;
  const muted = !!settings.muted;
  const tip = settings.tutorialStep ?? 0;
  useEffect(() => setMuted(muted), [muted]);

  // latest values for callbacks that the running scene / stable handlers call
  const live = useRef({});
  const lang = i18n.language;
  // a themed map offers only the buildings of its theme (and those without one); the Town Hall always
  const types = useMemo(() => buildings.types.filter((ty) => ty.core || fitsTheme(ty, map.theme)), [buildings, map.theme]);
  const typeName = useCallback((id) => buildings.types.find((ty) => ty.id === id)?.name?.[lang] ?? id, [buildings, lang]);
  live.current = { t, lang, typeName, tip, onSettings, weapons, onExit, wobble: !!settings.wobble, muted: !!settings.muted };

  // messages arriving together (round end + new unlocks) are joined, not replaced
  const say = useCallback((text) => {
    setMessage((m) => (m && Date.now() - m.at < 300 ? { ...m, text: `${m.text} · ${text}` } : { text, at: Date.now() }));
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const id = setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => clearTimeout(id);
  }, [message]);

  // the kids' monster sounds: the director decides when one may play (monsterVoices.js)
  const voices = useRef(null);

  // every World event (and a few UI ones): sound + tutorial progress
  const anyEvent = useCallback((e) => {
    const voice = voices.current?.onEvent(e, performance.now() / 1000, worldRef.current?.enemies.length ?? 0);
    if (voice) playClip(voiceKey(voice), voice.volume);
    // a monster's own death sound replaces the game's
    if (!(voice?.kind === 'death' && e.type === 'enemyDied')) play(soundFor(e));
    const { tip: step, onSettings: save } = live.current;
    const next = advanceTutorial(step, e);
    if (next !== step) save?.({ tutorialStep: next });
    // a monster seen for the first time in this game: a short note from the chronicle
    if (e.type === 'spawn' && !seen.current.has(e.enemy)) {
      seen.current.add(e.enemy);
      setNewMonster({ id: e.enemy, at: Date.now() });
    }
  }, []);

  useEffect(() => {
    if (!summary) return undefined;
    const id = setTimeout(() => setSummary(null), SUMMARY_MS);
    return () => clearTimeout(id);
  }, [summary]);

  useEffect(() => {
    if (!newMonster) return undefined;
    const id = setTimeout(() => setNewMonster(null), NEW_MONSTER_MS);
    return () => clearTimeout(id);
  }, [newMonster]);

  // World events shown as a message
  const onEvent = useCallback((e) => {
    const { t: tr, weapons: items, lang, typeName } = live.current;
    if (e.type === 'roundEnd') { setSummary({ ...e, unlocked: [], at: Date.now() }); return; }
    if (e.type === 'unlocked') { setSummary((s) => (s ? { ...s, unlocked: e.keys } : s)); return; }
    if (e.type === 'waveStart') setSummary(null);
    const name = () => typeName(e.building);
    const item = (id) => items.find((w) => w.id === id)?.name?.[lang] ?? id;
    const msg = {
      waveStart: () => tr('game.msg_wave', { n: e.round }),
      bonus: () => tr('game.msg_bonus', { coins: e.amount }),
      cantHit: () => tr('game.msg_cant_hit'),
      heroDown: () => tr('game.msg_hero_down', { s: e.respawnIn, n: e.lives }),
      heroRespawn: () => tr('game.msg_hero_back'),
      built: () => tr('build.msg_built', { name: name() }),
      upgraded: () => (e.townHall ? tr('build.msg_th_upgraded', { n: e.level }) : tr('build.msg_upgraded', { name: name(), n: e.level })),
      buildingDestroyed: () => tr('build.msg_destroyed', { name: name() }),
      sold: () => tr('build.msg_sold', { name: name(), coins: e.refund }),
      chestOpened: () => (e.weapon ? tr('weapons.msg_found', { name: item(e.weapon) }) : tr('weapons.msg_chest_coins', { coins: e.coins })),
      weaponBought: () => tr('weapons.msg_bought', { name: item(e.weapon) }),
      heroUpgraded: () => tr('build.msg_hero_upgraded', { stat: tr(`hero.stat_${e.stat}`), n: e.level }),
    }[e.type];
    const text = msg?.();
    if (text) say(text);
  }, [say]);

  useEffect(() => {
    let alive = true;
    setHud(null);
    setSelection(null);
    setSummary(null);
    seen.current = new Set();
    setNewMonster(null);
    (async () => {
      const bg = await mapCanvas(map);
      const grid = gridFromCanvas(bg, map.palette); // walkability from the painted map…
      // …the picture gets rugged road edges and the map's terrain textures
      const shown = await texturedCanvas(ruggedRoads(bg, map.palette, map.id), map.textures, assets);
      const firstImage = (cat) => assets.find((a) => a.category === cat)?.images.find(Boolean);
      const images = { background: shown };
      const load = async (key, src) => { if (src) images[key] = await loadImage(src); };
      // (something drawn only as an animation uses its first frame as the still picture)
      await load('hero', hero?.images[0] || firstFrame(hero?.anims));
      // optional hero drawings per weapon class (images[1..3]); missing ones use the default
      for (const [i, k] of ['melee', 'ranged', 'magic'].entries()) await load(`hero:${k}`, hero?.images[i + 1]);
      // buildings: every look of a type (its own drawings + "another look" components)
      // is one variant, picked at random per building; one texture per level,
      // a missing level uses the previous drawing
      const variants = {};
      for (const type of types) {
        const looks = buildings.looks[type.id] ?? [];
        variants[type.id] = looks.length;
        for (const [v, images] of looks.entries()) {
          let last = images.find(Boolean);
          for (let lvl = 1; lvl <= type.levels.length; lvl++) {
            last = images[lvl - 1] || last;
            await load(`${type.id}#${v}:${lvl}`, last);
          }
        }
      }
      const coinTypes = coinTypesOf(assets);
      for (const c of coinTypes) if (c.src) await load(c.key, c.src);
      const soldier = assets.find((a) => a.category === 'soldier' && (a.images?.some(Boolean) || firstFrame(a.anims)));
      await load('soldier', soldier?.images.find(Boolean) || firstFrame(soldier?.anims));
      await load('cave', firstImage('cave'));
      await load('projectile', firstImage('projectile'));
      await load('chest', firstImage('chest'));
      for (const et of enemyTypes) await load(`enemy:${et.id}`, et.image || firstFrame(et.anims));
      for (const d of map.decorations) {
        const a = assets.find((x) => x.id === d.asset);
        if (a && !images[a.id]) await load(a.id, a.images[0]);
      }
      // animations: every frame (moved by its alignment offset) is a texture
      // `${base}|${kind}|${i}`; the scene plays them (still picture without them)
      const anims = {};
      const loadAnims = async (base, set) => {
        const info = {};
        for (const [kind, a] of Object.entries(set ?? {})) {
          if (!a?.frames?.length) continue;
          for (const [i, src] of a.frames.entries()) images[`${base}|${kind}|${i}`] = composeFrame(await loadImage(src), a.offsets?.[i]);
          info[kind] = { n: a.frames.length, fps: a.fps ?? DEFAULT_FPS };
        }
        if (Object.keys(info).length) anims[base] = info;
      };
      // recorded monster sounds → the voice director knows how long each one plays
      const lengths = {};
      for (const et of enemyTypes) {
        for (const kind of SOUND_KINDS) {
          const secs = await loadClip(`voice:${et.id}:${kind}`, et.sounds?.[kind]);
          if (secs) (lengths[et.id] ??= {})[kind] = secs;
        }
      }
      const director = new VoiceDirector({ voices: lengths });
      await loadAnims('hero', hero?.anims);
      await loadAnims('soldier', soldier?.anims);
      for (const et of enemyTypes) await loadAnims(`enemy:${et.id}`, et.anims);
      for (const type of types) {
        for (const [v, set] of (buildings.lookAnims?.[type.id] ?? []).entries()) await loadAnims(`${type.id}#${v}`, set);
      }
      if (!alive) return;
      voices.current = director;

      const world = new World({
        map, grid, enemyTypes, buildingTypes: types, rules, weapons, coinTypes,
        waves: wavesOf(map, rules.balance),
        heroPoints: hero?.stats ?? DEFAULT_HERO_POINTS, difficulty,
      });
      worldRef.current = world;

      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        parent: hostRef.current,
        backgroundColor: '#fbf8ef',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: map.world.width, height: map.world.height },
        disableContextMenu: true,
        audio: { noAudio: true }, // sounds come from sound.js; Phaser's own AudioContext would just idle
        scene: [],
      });
      gameRef.current.scene.add('game', GameScene, true, {
        world, map, images, variants, anims, enemyTypes, buildingTypes: types, wobble: !!live.current.wobble,
        onHud: setHud, onEvent, onSelect: setSelection, onAnyEvent: anyEvent,
      });
      // dev-only handle for automated browser testing
      if (import.meta.env.DEV) window.__sv = { game: gameRef.current, world, voices: voices.current };
    })().catch((e) => setError(String(e)));

    return () => {
      alive = false;
      gameRef.current?.destroy(true);
      gameRef.current = null;
      worldRef.current = null;
    };
    // only things that change the game itself restart it
  }, [map, hero, assets, enemyTypes, buildings, types, rules, weapons, difficulty, restart, onEvent, anyEvent]);

  const scene = () => gameRef.current?.scene.getScene('game');
  const started = hud !== null; // the scene exists once the first HUD arrived
  useEffect(() => { const s = scene(); if (s) s.wobble = wobble; }, [wobble, started]);

  // about once a second: a monster may growl while walking (only in a wave, not when paused)
  useEffect(() => {
    if (paused) return undefined;
    const id = setInterval(() => {
      const w = worldRef.current, d = voices.current;
      if (!w || !d || d.empty) return;
      const alive = {};
      for (const e of w.enemies) alive[e.type] = (alive[e.type] ?? 0) + 1;
      const voice = d.tick(performance.now() / 1000, alive, w.phase);
      if (voice) playClip(voiceKey(voice), voice.volume);
    }, 1000);
    return () => clearInterval(id);
  }, [paused]);

  // ---- stable handlers (memoized children don't re-render because of them) ----
  const setMode = useCallback((m) => {
    const w = worldRef.current;
    if (!w) return;
    const reason = w.setMode(m);
    if (reason) say(live.current.t(`weapons.reason_${reason}`));
    else if (m === 'ranged') anyEvent({ type: 'modeRanged' });
    setHud(w.hud());
  }, [say, anyEvent]);
  const ready = useCallback(() => { worldRef.current?.callReady(); setPanelVersion((v) => v + 1); }, []);
  const changeSpeed = useCallback(() => setSpeed((s) => { const n = s === 1 ? 2 : 1; const sc = scene(); if (sc) sc.speed = n; return n; }), []);
  const togglePause = useCallback(() => setPaused((p) => { const sc = scene(); if (sc) sc.paused = !p; return !p; }), []);
  const zoom = useCallback((f) => scene()?.zoomBy(f), []);
  // the chronicle pauses the game while it is open (and resumes only if it paused it)
  const pausedByChronicle = useRef(false);
  const openChronicle = useCallback(() => {
    const sc = scene();
    pausedByChronicle.current = !!sc && !sc.paused;
    if (sc) sc.paused = true;
    setNewMonster(null);
    setChronicle(true);
  }, []);
  const closeChronicle = useCallback(() => {
    const sc = scene();
    if (sc && pausedByChronicle.current) sc.paused = false;
    pausedByChronicle.current = false;
    setChronicle(false);
  }, []);
  const toggleWobble = useCallback(() => live.current.onSettings?.({ wobble: !live.current.wobble }), []);
  const toggleMute = useCallback(() => {
    const m = !!live.current.muted;
    live.current.onSettings?.({ muted: !m });
    if (m) { setMuted(false); play('click'); }
  }, []);
  const toggleTips = useCallback(() => {
    const { tip: step, onSettings: save } = live.current;
    save?.({ tutorialStep: step < TUTORIAL_DONE ? TUTORIAL_DONE : 0 });
  }, []);
  const skipTips = useCallback(() => live.current.onSettings?.({ tutorialStep: TUTORIAL_DONE }), []);
  const exit = useCallback(() => live.current.onExit?.(), []);

  // build / upgrade / sell / shop actions; failures are explained in a message
  const act = useCallback((fn) => {
    const w = worldRef.current;
    if (!w) return;
    const r = fn(w);
    if (r && !r.ok) say(live.current.t(`build.reason_${r.reason}`));
    setPanelVersion((v) => v + 1);
    setHud(w.hud());
  }, [say]);
  const sel = selection;
  const onBuild = useCallback((type) => act((w) => w.build(sel.id, type)), [act, sel]);
  const onUpgrade = useCallback(() => act((w) => w.upgrade(sel.id)), [act, sel]);
  const onSell = useCallback(() => act((w) => w.sell(sel.id)), [act, sel]);
  const onUpgradeTownHall = useCallback(() => act((w) => w.upgradeTownHall()), [act]);
  const onUpgradeHero = useCallback((stat) => act((w) => w.upgradeHero(stat)), [act]);
  const onBuyWeapon = useCallback((id) => act((w) => w.buyWeapon(id)), [act]);
  // backpack: drop an item on a slot / drag a worn one back into the bag
  const equipAct = useCallback((fn) => {
    const w = worldRef.current;
    if (!w) return;
    const r = fn(w);
    if (r && !r.ok) say(live.current.t(`weapons.reason_${r.reason}`));
    setHud(w.hud());
  }, [say]);
  const onEquipTo = useCallback((id, slot) => equipAct((w) => w.equipTo(id, slot)), [equipAct]);
  const onUnequip = useCallback((slot) => equipAct((w) => w.unequip(slot)), [equipAct]);
  const closePanel = useCallback(() => { setSelection(null); const s = scene(); if (s) s.selection = null; }, []);

  // keyboard: 1/2/3 = attack type, I = backpack (GameOverlay), space = ready, P = pause;
  // not while typing or while a dialog is open (P must not resume the game behind the chronicle)
  useEffect(() => {
    const onKey = (e) => {
      if (!gameKey(e)) return;
      if (e.key === '1') setMode('melee');
      else if (e.key === '2') setMode('ranged');
      else if (e.key === '3') setMode('magic');
      else if (e.key === ' ') { e.preventDefault(); ready(); }
      else if (e.key === 'p' || e.key === 'P') togglePause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setMode, ready, togglePause]);

  // which attack types the backpack allows
  const inventoryKey = hud ? hud.inventory.join(',') : '';
  const has = useMemo(() => {
    const kinds = new Set(inventoryKey.split(',').map((id) => weapons.find((w) => w.id === id)).filter(isWeapon).map((w) => w.kind));
    return { melee: kinds.has('melee'), ranged: kinds.has('ranged'), magic: kinds.has('magic') };
  }, [inventoryKey, weapons]);

  const playing = hud && hud.phase !== 'won' && hud.phase !== 'lost';

  return (
    <section className={`game-screen device-${device}`}>
      {device === 'phone' && portrait && <div className="turn-phone sketch-card">📱↻ {t('game.turn_phone')}</div>}
      <div className="game-stage">
        <div ref={hostRef} className="game-host" />
        {error && <p className="error-text ov ov-tc">{error}</p>}
        {hud && (
          <>
            <Resources coins={hud.coins} workers={hud.workers} thHp={hud.townHall.hp} thMax={hud.townHall.maxHp} thLevel={hud.townHall.level} />
            <Lives lives={hud.hero.lives} maxLives={rules.balance.heroLives} hp={hud.hero.hp} maxHp={hud.hero.maxHp} dead={hud.hero.dead} respawnIn={hud.hero.respawnIn} />
            <WaveInfo
              phase={hud.phase} round={hud.round} totalRounds={hud.totalRounds} prepLeft={hud.prepLeft} earlyBonus={hud.earlyBonus}
              enemiesLeft={hud.enemiesLeft} nextRound={hud.nextRound} nextCaves={hud.nextCaves} caveCount={hud.caveCount}
              newThings={hud.newThings} enemyTypes={enemyTypes} typeName={typeName} onReady={ready}
            />
            <Equipment inventoryKey={inventoryKey} right={hud.equipped.right} left={hud.equipped.left} armor={hud.equipped.armor}
              attack={hud.hero.attack} reach={hud.hero.reach} armorPct={hud.hero.armor}
              items={weapons} assets={assets} onEquipTo={onEquipTo} onUnequip={onUnequip} />
            <AttackBar mode={hud.hero.mode} hasMelee={has.melee} hasRanged={has.ranged} hasMagic={has.magic} switching={hud.hero.switching} onMode={setMode} />
          </>
        )}
        <Toolbar compact={device === 'phone'} paused={paused} speed={speed} wobble={wobble} muted={muted} tipsOn={tip < TUTORIAL_DONE}
          onExit={exit} onPause={togglePause} onSpeed={changeSpeed} onZoom={zoom} onWobble={toggleWobble} onMute={toggleMute} onTips={toggleTips} onChronicle={openChronicle} />
        {playing && newMonster && <MonsterNote enemy={enemyTypes.find((e) => e.id === newMonster.id)} key={newMonster.at} onMore={openChronicle} onClose={() => setNewMonster(null)} />}
        {chronicle && (
          <Modal onClose={closeChronicle} wide fill
            header={<div className="row"><h2>📖 {t('chronicle.map_title')}</h2><span className="spacer" /><button className="btn" onClick={closeChronicle}>✕</button></div>}>
            <Chronicle enemies={monsters} themes={themes} seen={seen.current} />
          </Modal>
        )}
        {message && <div className="game-msg sketch-card" key={message.at}>{message.text}</div>}
        {playing && summary && (
          <RoundSummary key={summary.at} round={summary.round} total={hud.totalRounds} reward={summary.reward} income={summary.income} stats={summary.stats}
            unlocked={summary.unlocked.map((k) => unlockLabel(k, t, typeName))} onClose={() => setSummary(null)} />
        )}
        {playing && tip < TUTORIAL_DONE && <Coach text={t(`tips.${TUTORIAL_STEPS[tip].id}`)} index={tip} total={TUTORIAL_DONE} onSkip={skipTips} />}
        {playing && selection && (
          <SelectionPanel
            worldRef={worldRef} selection={selection} version={panelVersion}
            types={types} weapons={weapons} assets={assets}
            onClose={closePanel} onBuild={onBuild} onUpgrade={onUpgrade} onSell={onSell}
            onUpgradeTownHall={onUpgradeTownHall} onUpgradeHero={onUpgradeHero} onBuyWeapon={onBuyWeapon}
          />
        )}
        {paused && playing && <div className="game-over"><div className="sketch-card"><h2>{t('game.paused')}</h2><button className="btn primary" onClick={togglePause}>▶ {t('game.resume')}</button></div></div>}
        {hud && !playing && (
          <div className="game-over">
            <div className="sketch-card" style={{ textAlign: 'center' }}>
              <h1>{hud.phase === 'won' ? `🏆 ${t('game.won')}` : `💥 ${t(hud.lostBy === 'hero' ? 'game.lost_hero' : 'game.lost')}`}</h1>
              <p>{t('game.reached', { n: hud.round, total: hud.totalRounds })}</p>
              <p className="small">{difficultyOf(difficulty).icon} {t('difficulty.label')}: {t(`difficulty.${difficulty ?? 'normal'}`)}</p>
              <div className="row" style={{ justifyContent: 'center' }}>
                <button className="btn primary" onClick={() => { setPaused(false); setSpeed(1); setRestart((n) => n + 1); }}>↺ {t('game.again')}</button>
                <button className="btn" onClick={exit}>{t('game.exit')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// "New monster!" – shown once per game when a monster appears for the first time.
function MonsterNote({ enemy, onMore, onClose }) {
  const { t, i18n } = useTranslation();
  if (!enemy) return null;
  const lang = i18n.language;
  const hint = legendText(enemy.legend?.hint, lang);
  return (
    <div className="monster-note sketch-card ov">
      <AnimPreview anim={enemy.anims?.walk} still={enemy.image} size={56} className="" />
      <div>
        <b>📖 {t('chronicle.new_monster')}: {enemy.name?.[lang] ?? enemy.id}</b>
        {hint && <div className="small">💡 {hint}</div>}
        <button className="btn chip" onClick={onMore}>{t('chronicle.more')}</button>
      </div>
      <button className="btn icon" onClick={onClose} aria-label="✕">✕</button>
    </div>
  );
}
