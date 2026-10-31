import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SearchBox from '../ui/SearchBox.jsx';
import { matchesQuery, searchTexts } from '../ui/search.js';
import Screen from '../ui/Screen.jsx';
import { CATEGORY_IDS } from './categories.js';
import AssetEditor, { emptyAsset } from './AssetEditor.jsx';
import { newId } from '../data/saveFile.js';
import { compName, isPermanent } from '../config/components.js';
import { defaultPicture } from './defaultLooks.js';
import { FEATURES } from '../config/features.js';
import { getCategory } from './categories.js';
import { fitsTheme, themeName } from '../config/themes.js';
import ThemesEditor from './ThemesEditor.jsx';

// The component library: one tab per kind. A component can exist without a
// picture (built-in ones start that way and are drawn as simple shapes).
// Themed kinds (enemies, buildings) can be shown one theme at a time; the
// themes themselves are edited here too (🏷️).

const KIND_ICON = { hero: '🦸', enemy: '👾', building: '🏗️', soldier: '💂', weapon: '⚔️', shield: '🛡️', armor: '🦺', coin: '🪙', chest: '🎁', projectile: '➶', cave: '🕳️', decoration: '🌳', texture: '🧱', icon: '♥' };

export default function AssetStudio({ assets, heroRules, buildingTypes = [], enemyTypes = [], themes = [], maps = [], onChange, onThemes }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [category, setCategory] = useState(() => {
    try { return sessionStorage.getItem('sv:studioTab') || 'hero'; } catch { return 'hero'; }
  });
  const [editing, setEditing] = useState(null); // { asset, isNew }
  const [theme, setTheme] = useState(null); // show only this theme (themed kinds)
  const [themesOpen, setThemesOpen] = useState(false);
  const [query, setQuery] = useState(''); // search by name and description

  const pickCategory = (c) => {
    setCategory(c);
    try { sessionStorage.setItem('sv:studioTab', c); } catch { /* ignore */ }
  };

  const themed = getCategory(category).themed;
  const inCategory = assets.filter((a) => a.category === category && (!themed || fitsTheme(a, theme)));
  const themeIcons = (a) => (a.themes ?? []).map((id) => themes.find((th) => th.id === id)?.icon).filter(Boolean).join('');
  const countOf = (c) => assets.filter((a) => a.category === c).length;
  const typeName = (id) => buildingTypes.find((ty) => ty.id === id)?.name?.[lang] ?? id;

  const save = (asset) => {
    const exists = assets.some((a) => a.id === asset.id);
    onChange(exists ? assets.map((a) => (a.id === asset.id ? asset : a)) : [...assets, asset]);
    setEditing(null);
  };

  const remove = (id) => {
    if (isPermanent(id)) return; // the game's own pictures are never deleted
    onChange(assets.filter((a) => a.id !== id));
    setEditing(null);
  };

  const duplicate = (asset) => {
    const now = new Date().toISOString();
    const { builtIn, ...rest } = asset;
    const stats = asset.stats?.core ? { ...asset.stats, core: false } : asset.stats; // only one Town Hall
    // a copy of the game's own picture starts from that picture
    const images = asset.images?.some(Boolean) || !defaultPicture(asset.id) ? asset.images : [defaultPicture(asset.id)];
    onChange([...assets, { ...rest, images, id: newId(), name: `${compName(asset, lang)} 2`, stats, createdAt: now, updatedAt: now }]);
  };

  // a line under the name saying what the component is
  const describe = (a) => {
    if (a.category === 'enemy' && a.stats?.minions?.length && a.stats.summons !== false) {
      const names = a.stats.minions.map((id) => compName(assets.find((x) => x.id === id), lang)).filter(Boolean);
      return `💀 ${a.stats.minionCount ?? 1}× ${names.join(', ')}`;
    }
    if (a.category !== 'building') return a.category === 'coin' ? `🪙 ${a.stats?.value ?? 1}` : '';
    if (a.stats?.variantOf) return `${t('component.look_of')} ${typeName(a.stats.variantOf)}`;
    const icons = (a.stats?.features ?? []).map((f) => FEATURES[f]?.icon).join(' ');
    return `${a.stats?.core ? '🏛️ ' : ''}${icons} · ${t('component.n_levels', { n: a.stats?.levels?.length ?? 0 })}`;
  };
  const list = inCategory.filter((a) => matchesQuery(query, ...searchTexts(a, [describe(a)])));

  return (
    <Screen title={t('studio.title')} head={<>
      <div className="tabs">
        {CATEGORY_IDS.map((c) => (
          <button key={c} className={`tab ${c === category ? 'on' : ''}`} onClick={() => pickCategory(c)}>
            {KIND_ICON[c]} {t(`cat.${c}`)} <span className="muted small">({countOf(c)})</span>
          </button>
        ))}
      </div>
      <p className="muted small">{t(`catHint.${category}`)}</p>
      {themed && (
        <div className="row" style={{ gap: 6, marginBottom: 10 }}>
          <button className={`btn chip ${!theme ? 'active' : ''}`} onClick={() => setTheme(null)}>{t('themes.all')}</button>
          {themes.map((th) => (
            <button key={th.id} className={`btn chip ${theme === th.id ? 'active' : ''}`} onClick={() => setTheme(th.id)}>{th.icon} {themeName(th, lang)}</button>
          ))}
          <button className="btn chip" onClick={() => setThemesOpen(true)}>🏷️ {t('themes.button')}…</button>
        </div>
      )}
      <SearchBox value={query} onChange={setQuery} count={list.length} />
    </>}>

      <div className="grid">
        {!getCategory(category).fixed && <button className="asset-tile new btn" onClick={() => setEditing({ asset: emptyAsset(category), isNew: true })} title={t('studio.add')}>
          +
        </button>}
        {list.map((a) => {
          const pics = (a.images ?? []).filter(Boolean);
          if (!pics.length && defaultPicture(a.id)) pics.push(defaultPicture(a.id)); // the game's own picture
          return (
            <div key={a.id} className="asset-tile" onClick={() => setEditing({ asset: a, isNew: false })}>
              <div className="checker" style={{ borderRadius: 6, display: 'grid', placeItems: 'center' }}>
                {pics.length ? <img src={pics.at(-1)} alt="" /> : <span className="no-pic" style={{ color: a.stats?.color }}>{a.stats?.emoji ?? KIND_ICON[a.category]}</span>}
              </div>
              <div className="name">{a.builtIn && '⭐ '}{compName(a, lang)} {themed && <span title={t('themes.label')}>{themeIcons(a)}</span>}</div>
              <div className="author">{a.author && `✎ ${a.author}`}</div>
              {describe(a) && <div className="small muted">{describe(a)}</div>}
              {!getCategory(a.category).fixed && <button className="btn icon small" onClick={(e) => { e.stopPropagation(); duplicate(a); }} title={t('studio.duplicate')}>⧉</button>}
            </div>
          );
        })}
      </div>

      {editing && (
        <AssetEditor
          asset={editing.asset}
          isNew={editing.isNew}
          heroRules={heroRules}
          assets={assets}
          buildingTypes={buildingTypes}
          enemyTypes={enemyTypes}
          themes={themes}
          onSave={save}
          onDelete={remove}
          onCancel={() => setEditing(null)}
        />
      )}
      {themesOpen && (
        <ThemesEditor themes={themes} assets={assets} maps={maps} onSave={(next) => { onThemes(next); setThemesOpen(false); }} onCancel={() => setThemesOpen(false)} />
      )}
    </Screen>
  );
}
