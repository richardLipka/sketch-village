import React, { useState, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { enterFullscreen } from '../ui/FullscreenButton.jsx';
import { DIFFICULTIES, DIFFICULTY_IDS, DEFAULT_DIFFICULTY } from '../config/difficulty.js';

// Phaser is big – load it only when a game starts.
const GameView = lazy(() => import('./GameView.jsx'));

// Pick a level (map), a hero and how hard it should be, then play (fullscreen).
export default function PlaySetup({ maps, assets, enemyTypes, buildings, rules, weapons, themes = [], settings, onSettings }) {
  const { t } = useTranslation();
  const playable = maps.filter((m) => m.valid);
  const heroes = assets.filter((a) => a.category === 'hero');
  const [mapId, setMapId] = useState(playable[0]?.id ?? null);
  const [heroId, setHeroId] = useState(heroes[0]?.id ?? null);
  const [playing, setPlaying] = useState(false);

  const map = playable.find((m) => m.id === mapId);
  const hero = heroes.find((h) => h.id === heroId) ?? null;
  const difficulty = DIFFICULTIES[settings?.difficulty] ? settings.difficulty : DEFAULT_DIFFICULTY;

  if (playing && map) {
    return (
      <Suspense fallback={<p>{t('app.loading')}</p>}>
        <GameView
          map={map} hero={hero} assets={assets} enemyTypes={enemyTypes} buildings={buildings} rules={rules} weapons={weapons} themes={themes} difficulty={difficulty}
          settings={settings} onSettings={onSettings} onExit={() => setPlaying(false)}
        />
      </Suspense>
    );
  }

  return (
    <section>
      <h1>{t('play.title')}</h1>

      <h2>{t('play.pick_map')}</h2>
      {playable.length === 0 && <p className="muted">{t('play.no_maps')}</p>}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', marginBottom: 24 }}>
        {playable.map((m) => (
          <div key={m.id} className="asset-tile" style={m.id === mapId ? { background: 'var(--hl-yellow)' } : undefined} onClick={() => setMapId(m.id)}>
            <img src={m.background} alt="" style={{ maxWidth: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 4 }} />
            <div className="name">{themes.find((th) => th.id === m.theme)?.icon} {m.name}</div>
          </div>
        ))}
      </div>

      <h2>{t('play.pick_hero')}</h2>
      {heroes.length === 0 && <p className="muted">{t('play.no_heroes')}</p>}
      <div className="grid" style={{ marginBottom: 24 }}>
        {heroes.map((h) => (
          <div key={h.id} className="asset-tile" style={h.id === heroId ? { background: 'var(--hl-yellow)' } : undefined} onClick={() => setHeroId(h.id)}>
            <img src={h.images[0]} alt={h.name} />
            <div className="name">{h.name}</div>
            <div className="author">{h.author && `✎ ${h.author}`}</div>
          </div>
        ))}
      </div>

      <h2>{t('difficulty.pick')}</h2>
      <div className="difficulty-pick" role="radiogroup">
        {DIFFICULTY_IDS.map((id) => (
          <button key={id} role="radio" aria-checked={id === difficulty} className={`btn ${id === difficulty ? 'active' : ''}`} onClick={() => onSettings?.({ difficulty: id })}>
            <span>{DIFFICULTIES[id].icon} <b>{t(`difficulty.${id}`)}</b></span>
            <span className="small muted">{t(`difficulty.${id}_hint`)}</span>
          </button>
        ))}
      </div>

      <button className="btn big primary" disabled={!map} onClick={() => { enterFullscreen(); setPlaying(true); }}>▶ {t('play.start')}</button>
    </section>
  );
}
