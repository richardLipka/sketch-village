import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SearchBox from '../ui/SearchBox.jsx';
import { matchesQuery, searchTexts } from '../ui/search.js';
import AnimPreview from '../assets/AnimPreview.jsx';
import { legendText } from '../config/legends.js';
import { themeName, fitsTheme } from '../config/themes.js';

// The chronicle (📖): every monster with its picture – as big as in the
// component editor (160 px); walking when it has an animation, the game's
// shape when nobody has drawn it yet – its legend, a hint for the player and what it can do. Opened
// from the main menu (all monsters, by theme) and in the game (the monsters of
// that map; the ones not met yet are marked).

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

export default function Chronicle({ enemies, themes = [], seen = null, intro }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [theme, setTheme] = useState(null);
  const [query, setQuery] = useState('');
  const name = (e) => e.name?.[lang] ?? e.id;
  const nameOf = (id) => { const e = enemies.find((x) => x.id === id); return e ? name(e) : null; };
  const shown = enemies.filter((e) => fitsTheme(e, theme) && matchesQuery(query, ...searchTexts(e)));

  return (
    <div className="chronicle">
      {intro && <p className="muted small">{intro}</p>}
      <SearchBox value={query} onChange={setQuery} count={shown.length} />
      {themes.length > 0 && enemies.length > 4 && (
        <div className="row" style={{ gap: 6, marginBottom: 10 }}>
          <button className={`btn chip ${!theme ? 'active' : ''}`} onClick={() => setTheme(null)}>{t('themes.all')}</button>
          {themes.map((th) => <button key={th.id} className={`btn chip ${theme === th.id ? 'active' : ''}`} onClick={() => setTheme(th.id)}>{th.icon} {themeName(th, lang)}</button>)}
        </div>
      )}
      <div className="chronicle-grid">
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
                  ❤️ {e.hp} · 👟 {e.speed} · ⚔️ {e.damage}
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
