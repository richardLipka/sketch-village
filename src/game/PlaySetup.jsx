import React, { useState, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import SearchBox from '../ui/SearchBox.jsx';
import { matchesQuery, searchTexts } from '../ui/search.js';
import Screen from '../ui/Screen.jsx';
import PickStrip from '../ui/PickStrip.jsx';
import { enterFullscreen } from '../ui/FullscreenButton.jsx';
import { compName } from '../config/components.js';
import { DIFFICULTIES, DIFFICULTY_IDS, DEFAULT_DIFFICULTY } from '../config/difficulty.js';

// Phaser is big – load it only when a game starts.
const GameView = lazy(() => import('./GameView.jsx'));

// Pick a level (map), a hero and how hard it should be, then play (fullscreen).
// Maps and heroes are each one row that slides sideways (ui/PickStrip.jsx), so
// however many there are, all of them can be reached.
export default function PlaySetup({ maps, assets, enemyTypes, buildings, rules, weapons, themes = [], settings, onSettings, initialMapId = null }) {
  const { t, i18n } = useTranslation();
  const playable = maps.filter((m) => m.valid);
  const heroes = assets.filter((a) => a.category === 'hero');
  // a map just loaded from the library or a link is already picked
  const [mapId, setMapId] = useState(() => (playable.some((m) => m.id === initialMapId) ? initialMapId : playable[0]?.id ?? null));
  const [heroId, setHeroId] = useState(heroes[0]?.id ?? null);
  const [playing, setPlaying] = useState(false);
  const [query, setQuery] = useState(''); // filters maps and heroes

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
    <Screen title={t('play.title')} head={
      <div className="row">
        <button className="btn big primary" disabled={!map} onClick={() => { enterFullscreen(); setPlaying(true); }}>▶ {t('play.start')}</button>
        <SearchBox value={query} onChange={setQuery} />
        {map && <span className="muted">{map.name}{hero ? ` · ${compName(hero, i18n.language)}` : ''}</span>}
      </div>
    }>

      <h2>{t('play.pick_map')}</h2>
      {playable.length === 0 && <p className="muted">{t('play.no_maps')}</p>}
      {playable.length > 0 && (
        <PickStrip label={t('play.pick_map')} selectedKey={mapId}>
          {playable.filter((m) => m.id === mapId || matchesQuery(query, ...searchTexts(m))).map((m) => (
            <div key={m.id} data-key={m.id} role="option" aria-selected={m.id === mapId} className="asset-tile map-pick" style={m.id === mapId ? { background: 'var(--hl-yellow)' } : undefined} onClick={() => setMapId(m.id)}>
              <img src={m.background} alt="" />
              <div className="name">{themes.find((th) => th.id === m.theme)?.icon} {m.name}</div>
            </div>
          ))}
        </PickStrip>
      )}

      <h2>{t('play.pick_hero')}</h2>
      {heroes.length === 0 && <p className="muted">{t('play.no_heroes')}</p>}
      {heroes.length > 0 && (
        <PickStrip label={t('play.pick_hero')} selectedKey={heroId}>
          {heroes.filter((h) => h.id === heroId || matchesQuery(query, ...searchTexts(h))).map((h) => (
            <div key={h.id} data-key={h.id} role="option" aria-selected={h.id === heroId} className="asset-tile hero-pick" style={h.id === heroId ? { background: 'var(--hl-yellow)' } : undefined} onClick={() => setHeroId(h.id)}>
              <img src={h.images[0]} alt={compName(h, i18n.language)} />
              <div className="name">{compName(h, i18n.language)}</div>
              <div className="author">{h.author && `✎ ${h.author}`}</div>
            </div>
          ))}
        </PickStrip>
      )}

      <h2>{t('difficulty.pick')}</h2>
      <div className="difficulty-pick" role="radiogroup">
        {DIFFICULTY_IDS.map((id) => (
          <button key={id} role="radio" aria-checked={id === difficulty} className={`btn ${id === difficulty ? 'active' : ''}`} onClick={() => onSettings?.({ difficulty: id })}>
            <span>{DIFFICULTIES[id].icon} <b>{t(`difficulty.${id}`)}</b></span>
            <span className="small muted">{t(`difficulty.${id}_hint`)}</span>
          </button>
        ))}
      </div>
    </Screen>
  );
}
