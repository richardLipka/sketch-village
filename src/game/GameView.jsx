import React, { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import { useTranslation } from 'react-i18next';
import GameScene from './GameScene.js';
import Hud from './Hud.jsx';
import { mapCanvas, gridFromCanvas } from '../maps/mapRuntime.js';
import { loadImage } from '../assets/imageEncoding.js';
import BuildPanel from './BuildPanel.jsx';
import { DEFAULT_HERO_POINTS } from '../config/heroStats.js';
import { wavesOf } from '../config/waves.js';
import { World } from '../logic/world.js';

const MESSAGE_MS = 2600;

// React wrapper: prepares images, grid and the World, runs Phaser, shows the HUD.
export default function GameView({ map, hero, assets, enemyTypes, buildingTypes, onExit }) {
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

  const say = useCallback((text) => {
    setMessage({ text, at: Date.now() });
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const id = setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => clearTimeout(id);
  }, [message]);

  const onEvent = useCallback((e) => {
    const msg = {
      waveStart: () => t('game.msg_wave', { n: e.round }),
      roundEnd: () => t('game.msg_round_end', { n: e.round, coins: e.reward }),
      bonus: () => t('game.msg_bonus', { coins: e.amount }),
      cantHit: () => t('game.msg_cant_hit'),
      heroLostLife: () => (e.lives > 0 ? t('game.msg_life', { n: e.lives }) : null),
      heroDown: () => t('game.msg_hero_down', { s: e.respawnIn }),
      heroRespawn: () => t('game.msg_hero_back'),
      built: () => t('build.msg_built', { name: t(`build.type_${e.type}`) }),
      upgraded: () => (e.townHall ? t('build.msg_th_upgraded', { n: e.level }) : t('build.msg_upgraded', { name: t(`build.type_${e.type}`), n: e.level })),
      buildingDestroyed: () => t('build.msg_destroyed', { name: t(`build.type_${e.type}`) }),
      heroUpgraded: () => t('build.msg_hero_upgraded', { stat: t(`hero.stat_${e.stat}`), n: e.level }),
    }[e.type];
    const text = msg?.();
    if (text) say(text);
  }, [t, say]);

  useEffect(() => {
    let alive = true;
    setHud(null);
    setSelection(null);
    (async () => {
      const bg = await mapCanvas(map);
      const grid = gridFromCanvas(bg, map.palette);
      const firstImage = (cat) => assets.find((a) => a.category === cat)?.images.find(Boolean);
      const images = { background: bg };
      const load = async (key, src) => { if (src) images[key] = await loadImage(src); };
      await load('hero', hero?.images[0]);
      // buildings: one texture per level; a missing level uses the previous drawing
      for (const cat of ['townhall', 'house', 'tower', 'castle']) {
        const imgs = assets.find((a) => a.category === cat)?.images ?? [];
        let last = null;
        for (let lvl = 1; lvl <= 3; lvl++) {
          last = imgs[lvl - 1] || last;
          await load(`${cat}:${lvl}`, last);
        }
      }
      await load('soldier', firstImage('soldier'));
      await load('cave', firstImage('cave'));
      await load('coin', firstImage('coin'));
      await load('projectile', firstImage('projectile'));
      for (const et of enemyTypes) {
        const a = et.asset && assets.find((x) => x.id === et.asset);
        if (a) await load(`enemy:${et.id}`, a.images[0]);
      }
      for (const d of map.decorations) {
        const a = assets.find((x) => x.id === d.asset);
        if (a && !images[a.id]) await load(a.id, a.images[0]);
      }
      if (!alive) return;

      const world = new World({
        map, grid, enemyTypes, buildingTypes,
        waves: wavesOf(map),
        heroPoints: hero?.stats ?? DEFAULT_HERO_POINTS,
      });
      worldRef.current = world;

      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        parent: hostRef.current,
        backgroundColor: '#fbf8ef',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: map.world.width, height: map.world.height },
        disableContextMenu: true,
        scene: [],
      });
      gameRef.current.scene.add('game', GameScene, true, { world, map, images, enemyTypes, onHud: setHud, onEvent, onSelect: setSelection });
      // dev-only handle for automated browser testing
      if (import.meta.env.DEV) window.__sv = { game: gameRef.current, world };
    })().catch((e) => setError(String(e)));

    return () => {
      alive = false;
      gameRef.current?.destroy(true);
      gameRef.current = null;
      worldRef.current = null;
    };
  }, [map, hero, assets, enemyTypes, buildingTypes, onEvent, restart]);

  const scene = () => gameRef.current?.scene.getScene('game');
  const zoom = (f) => scene()?.zoomBy(f);
  const setMode = (m) => { worldRef.current?.setMode(m); setHud((h) => h && { ...h, hero: { ...h.hero, mode: m } }); };
  const ready = () => worldRef.current?.callReady();
  const changeSpeed = () => { const s = speed === 1 ? 2 : 1; setSpeed(s); if (scene()) scene().speed = s; };
  const togglePause = () => { const p = !paused; setPaused(p); if (scene()) scene().paused = p; };

  // keyboard: 1 = melee, 2 = ranged, space = ready, P = pause
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === '1') setMode('melee');
      else if (e.key === '2') setMode('ranged');
      else if (e.key === ' ') { e.preventDefault(); ready(); }
      else if (e.key === 'p' || e.key === 'P') togglePause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // build / upgrade actions from the panel; failures are explained in a message
  const act = (fn) => {
    const r = fn(worldRef.current);
    if (r && !r.ok) say(t(`build.reason_${r.reason}`));
  };
  const closePanel = () => { setSelection(null); const s = scene(); if (s) s.selection = null; };
  const world = worldRef.current;
  const panel = world && selection
    ? (selection.kind === 'spot' ? world.describeSpot(selection.id) : world.describeTownHall())
    : null;

  const lang = i18n.language;
  const enemyName = (id) => enemyTypes.find((e) => e.id === id)?.name?.[lang] ?? id;

  return (
    <section>
      <div className="row" style={{ marginBottom: 6 }}>
        <button className="btn" onClick={onExit}>← {t('game.exit')}</button>
        <b>{map.name}</b>
        {hero && <span className="muted">· {hero.name}</span>}
        <span className="spacer" />
        <button className={`btn icon ${paused ? 'active' : ''}`} onClick={togglePause} title={t('game.pause')}>{paused ? '▶' : '⏸'}</button>
        <button className={`btn icon ${speed === 2 ? 'active' : ''}`} onClick={changeSpeed} title={t('game.speed')}>{speed}×</button>
        <button className="btn icon" onClick={() => zoom(1 / 1.25)} title={t('game.zoom_out')}>−</button>
        <button className="btn icon" onClick={() => zoom(1.25)} title={t('game.zoom_in')}>+</button>
      </div>

      {hud && <Hud hud={hud} onReady={ready} onMode={setMode} enemyName={enemyName} enemyTypes={enemyTypes} />}

      {error && <p className="error-text">{error}</p>}
      <div style={{ position: 'relative' }}>
        <div ref={hostRef} style={{ width: '100%', aspectRatio: `${map.world.width} / ${map.world.height}`, border: '2.5px solid var(--ink)', borderRadius: 6, overflow: 'hidden', touchAction: 'none' }} />
        {message && <div className="game-msg sketch-card" key={message.at}>{message.text}</div>}
        {panel && hud && hud.phase !== 'won' && hud.phase !== 'lost' && (
          <BuildPanel
            info={panel}
            coins={hud.coins}
            buildingTypes={buildingTypes}
            onClose={closePanel}
            onBuild={(type) => act((w) => w.build(selection.id, type))}
            onUpgrade={() => act((w) => w.upgrade(selection.id))}
            onUpgradeTownHall={() => act((w) => w.upgradeTownHall())}
            onUpgradeHero={(stat) => act((w) => w.upgradeHero(stat))}
          />
        )}
        {paused && hud && hud.phase !== 'won' && hud.phase !== 'lost' && <div className="game-over"><div className="sketch-card"><h2>{t('game.paused')}</h2><button className="btn primary" onClick={togglePause}>▶ {t('game.resume')}</button></div></div>}
        {hud && (hud.phase === 'won' || hud.phase === 'lost') && (
          <div className="game-over">
            <div className="sketch-card" style={{ textAlign: 'center' }}>
              <h1>{hud.phase === 'won' ? `🏆 ${t('game.won')}` : `💥 ${t('game.lost')}`}</h1>
              <p>{t('game.reached', { n: hud.round, total: hud.totalRounds })}</p>
              <div className="row" style={{ justifyContent: 'center' }}>
                <button className="btn primary" onClick={() => { setPaused(false); setSpeed(1); setRestart((n) => n + 1); }}>↺ {t('game.again')}</button>
                <button className="btn" onClick={onExit}>{t('game.exit')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <p className="small muted" style={{ marginTop: 6 }}>{t('game.hint')}</p>
    </section>
  );
}
