import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SearchBox from '../ui/SearchBox.jsx';
import { matchesQuery, searchTexts } from '../ui/search.js';
import AnimPreview from '../assets/AnimPreview.jsx';
import { monsterDsp, showDsp } from '../logic/dsp.js';
import { legendText } from '../config/legends.js';
import { themeName, fitsTheme } from '../config/themes.js';

// The chronicle (📖): every monster with its picture – as big as in the
// component editor (160 px); walking when it has an animation, the game's
// shape when nobody has drawn it yet – its legend, a hint for the player and what it can do. Opened
// from the main menu (all monsters, by theme) and in the game (the monsters of
// that map; the ones not met yet are marked).
// The collection (🏅): every monster ever met in any game (settings.metMonsters)
// – "you've met 9 of 14" – a gentle progress without scores.

/** How many of `enemies` have been met: { met, total, ids } (ids = the met ones that still exist). */
export function collectionOf(enemies, met = []) {
  const known = new Set(met ?? []);
  const ids = enemies.filter((e) => known.has(e.id)).map((e) => e.id);
  return { met: ids.length, total: enemies.length, ids: new Set(ids) };
}

export function monstersOfWaves(waves, enemyTypes) {
  const ids = new Set();
  for (const r of waves?.rounds ?? []) for (const g of r.groups ?? []) ids.add(g.enemy);
  for (const id of [...ids]) {
    const e = enemyTypes.find((x) => x.id === id);
    if (e?.summons !== false) for (const m of e?.minions ?? []) ids.add(m);
  }
  return enemyTypes.filter((e) => ids.has(e.id));
}

export const PIC = 160; // the size of a picture in the component editor

/** The shape the game draws for a monster nobody has drawn yet (GameScene placeholders). */
export function EnemyShape({ enemy, size = PIC }) {
  const col = enemy.color ?? '#16a34a';
  const ink = '#111827';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {enemy.flying ? <polygon points="32,6 58,32 32,58 6,32" fill={col} stroke={ink} strokeWidth="3" />
        : enemy.ranged ? <polygon points="32,6 60,56 4,56" fill={col} stroke={ink} strokeWidth="3" />
          : <circle cx="32" cy="32" r="24" fill={col} stroke={ink} strokeWidth="3" />}
      {enemy.boss && <circle cx="32" cy="34" r="10" fill="none" stroke="#facc15" strokeWidth="3" />}
    </svg>
  );
}

export default function Chronicle({ enemies, themes = [], seen = null, intro, met = [], allEnemies = enemies }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [tab, setTab] = useState('monsters');
  const [theme, setTheme] = useState(null);
  const [query, setQuery] = useState('');
  const name = (e) => e.name?.[lang] ?? e.id;
  const nameOf = (id) => { const e = enemies.find((x) => x.id === id); return e ? name(e) : null; };
  const shown = enemies.filter((e) => fitsTheme(e, theme) && matchesQuery(query, ...searchTexts(e)));

  const tabs = (
    <div className="row chronicle-tabs" role="tablist" style={{ gap: 6, marginBottom: 8 }}>
      <button role="tab" aria-selected={tab === 'monsters'} className={`btn chip ${tab === 'monsters' ? 'active' : ''}`} onClick={() => setTab('monsters')}>📖 {t('chronicle.tab_monsters')}</button>
      <button role="tab" aria-selected={tab === 'collection'} className={`btn chip ${tab === 'collection' ? 'active' : ''}`} onClick={() => setTab('collection')} data-testid="collection-tab">🏅 {t('chronicle.tab_collection')}</button>
    </div>
  );

  if (tab === 'collection') {
    // met in any game, and those met in this one (seen) right away
    const all = collectionOf(allEnemies, [...(met ?? []), ...(seen ?? [])]);
    return (
      <div className="chronicle">
        {tabs}
        <div className="collection-head" role="status">
          <b data-testid="collection-count">{t('chronicle.collection_count', { n: all.met, total: all.total })}</b>
          <span className="hud-bar collection-bar" aria-hidden="true"><span style={{ width: `${all.total ? Math.round((all.met / all.total) * 100) : 0}%` }} /></span>
          <span className="small muted">{all.met === all.total && all.total ? t('chronicle.collection_all') : t('chronicle.collection_hint')}</span>
        </div>
        <div className="collection-grid" tabIndex={0} role="region" aria-label={t('chronicle.tab_collection')}>
          {allEnemies.map((e) => {
            const known = all.ids.has(e.id);
            return (
              <div key={e.id} className={`sketch-card collection-tile ${known ? 'met' : 'unmet'}`} title={known ? name(e) : t('chronicle.not_met')}>
                <div className="collection-pic">
                  {e.anims?.walk?.frames?.length || e.image
                    ? <AnimPreview anim={known ? e.anims?.walk : null} still={e.image || e.anims?.walk?.frames?.[0]} size={72} />
                    : <EnemyShape enemy={e} size={72} />}
                </div>
                <span className="small">{known ? name(e) : '❔'}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="chronicle">
      {tabs}
      {intro && <p className="muted small">{intro}</p>}
      <SearchBox value={query} onChange={setQuery} count={shown.length} />
      {themes.length > 0 && enemies.length > 4 && (
        <div className="row" style={{ gap: 6, marginBottom: 10 }}>
          <button className={`btn chip ${!theme ? 'active' : ''}`} onClick={() => setTheme(null)}>{t('themes.all')}</button>
          {themes.map((th) => <button key={th.id} className={`btn chip ${theme === th.id ? 'active' : ''}`} onClick={() => setTheme(th.id)}>{th.icon} {themeName(th, lang)}</button>)}
        </div>
      )}
      <div className="chronicle-grid" tabIndex={0} role="region" aria-label={t('chronicle.list')}>
        {shown.map((e) => {
          const story = legendText(e.legend?.story, lang);
          const hint = legendText(e.legend?.hint, lang);
          const met = !seen || seen.has(e.id);
          const minions = e.summons === false ? [] : (e.minions ?? []).map(nameOf).filter(Boolean);
          return (
            <article key={e.id} className={`sketch-card chronicle-card ${met ? '' : 'unmet'}`}>
              <div className="chronicle-pic">
                {e.anims?.walk?.frames?.length || e.image
                  ? <AnimPreview anim={e.anims?.walk} still={e.image} size={PIC} />
                  : <EnemyShape enemy={e} />}
              </div>
              <div>
                <h3 style={{ margin: 0 }}>{name(e)} <span className="small">{(e.themes ?? []).map((id) => themes.find((th) => th.id === id)?.icon).join('')}</span></h3>
                {!met && <div className="small muted">❔ {t('chronicle.not_met')}</div>}
                <p className="small" style={{ margin: '4px 0' }}>{story || <span className="muted">{t('chronicle.no_story')}</span>}</p>
                {hint && <p className="small chronicle-hint">💡 {hint}</p>}
                <div className="small muted">
                  <span title={t('waves.dsp_title')}>⚡ {showDsp(monsterDsp(e, enemies).dsp)} DSP</span> · ❤️ {e.hp} · 👟 {e.speed} · ⚔️ {e.damage}
                  {e.armor ? ` · 🛡️ ${Math.round(e.armor * 100)} %` : ''}
                  {e.flying ? ` · 🪽 ${t('enemies.flying')}` : ''}
                  {e.ranged ? ` · 🏹 ${t('enemies.ranged')}` : ''}
                  {e.boss ? ` · 👑 ${t('enemies.boss')}` : ''}
                  {minions.length ? ` · 💀 ${t('chronicle.calls')} ${minions.join(', ')}` : ''}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
