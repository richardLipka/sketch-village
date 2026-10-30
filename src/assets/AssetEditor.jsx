import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal.jsx';
import ImageSlot from './ImageSlot.jsx';
import HeroStatsEditor from './HeroStatsEditor.jsx';
import ItemStatsEditor from './ItemStatsEditor.jsx';
import EnemyStatsEditor from './EnemyStatsEditor.jsx';
import BuildingStatsEditor from './BuildingStatsEditor.jsx';
import AnimationEditor from './AnimationEditor.jsx';
import SoundEditor from './SoundEditor.jsx';
import NumField from './NumField.jsx';
import { getCategory } from './categories.js';
import { DEFAULT_HERO_POINTS } from '../config/heroStats.js';
import { defaultItemStats } from '../config/weapons.js';
import { newLevel } from '../config/features.js';
import { DEFAULT_ENEMY_STATS, defaultComponent, compName } from '../config/components.js';
import { themeName } from '../config/themes.js';
import { legendText } from '../config/legends.js';
import { newId } from '../data/saveFile.js';

// The component editor (SPEC §3.4): one game thing – its name, its pictures and
// ALL its properties together (a hero's skill points, an enemy's numbers, a
// building type's features and levels, a weapon's damage, a coin's value…) and,
// for enemies and buildings, the themes (worlds) it belongs to, optional
// animations (walking, attacking, reloading) and, for enemies, a legend for the
// chronicle and their own recorded sounds.

const AUTHOR_KEY = 'sv:lastAuthor';

function lastAuthor() {
  try { return localStorage.getItem(AUTHOR_KEY) || ''; } catch { return ''; }
}

/** Properties a new component of this kind starts with. */
function defaultStats(categoryId) {
  const kind = getCategory(categoryId).stats;
  if (kind === 'hero') return { ...DEFAULT_HERO_POINTS };
  if (kind === 'item') return defaultItemStats(categoryId);
  if (kind === 'coin') return { value: 1 };
  if (kind === 'enemy') return { ...DEFAULT_ENEMY_STATS };
  if (kind === 'building') return { features: ['shoots'], levels: [newLevel(['shoots']), newLevel(['shoots'], { cost: 45, hp: 600, round: 5 })] };
  return undefined;
}

export function emptyAsset(categoryId) {
  const cat = getCategory(categoryId);
  const now = new Date().toISOString();
  const stats = defaultStats(categoryId);
  return {
    id: newId(), category: categoryId, name: '', author: lastAuthor(),
    images: Array(stats?.levels?.length ?? cat.levels).fill(null),
    ...(stats ? { stats } : {}),
    createdAt: now, updatedAt: now,
  };
}

/** How many pictures a component has: building types one per level, looks as many as their type. */
function pictureCount(draft, cat, types) {
  if (draft.category !== 'building') return cat.levels;
  if (draft.stats?.variantOf) return types.find((ty) => ty.id === draft.stats.variantOf)?.levels.length ?? 3;
  return draft.stats?.levels?.length ?? 1;
}

/** Toggle chips: which themes a component belongs to (none = every world). */
export function ThemeChips({ value = [], themes, onChange }) {
  const { t, i18n } = useTranslation();
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div>
      <div className="row" style={{ gap: 6 }}>
        <b className="small">🏷️ {t('themes.label')}</b>
        {themes.map((th) => (
          <button key={th.id} type="button" className={`btn chip ${value.includes(th.id) ? 'active' : ''}`} onClick={() => toggle(th.id)}>
            {th.icon} {themeName(th, i18n.language)}
          </button>
        ))}
      </div>
      <p className="small muted" style={{ margin: '2px 0 0' }}>{t('themes.component_hint')}</p>
    </div>
  );
}

export default function AssetEditor({ asset, isNew, heroRules, buildingTypes = [], enemyTypes = [], themes = [], onSave, onDelete, onCancel }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const cat = getCategory(asset.category);
  const [draft, setDraft] = useState(() => ({
    ...asset,
    // older records may miss properties added later: start from the defaults
    ...(cat.stats && cat.stats !== 'building' ? { stats: { ...defaultStats(asset.category), ...asset.stats } } : {}),
    ...(cat.stats === 'building' ? { stats: asset.stats ?? defaultStats('building') } : {}),
  }));

  const count = pictureCount(draft, cat, buildingTypes);
  const images = Array.from({ length: Math.max(count, 1) }, (_, i) => draft.images?.[i] ?? null);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setImage = (i, img) => setDraft((d) => {
    const next = Array.from({ length: Math.max(count, 1) }, (_, j) => d.images?.[j] ?? null);
    next[i] = img;
    return { ...d, images: next };
  });

  // built-in components have a name in both languages; kids' ones a single name
  const name = compName(draft, lang);
  const setName = (v) => set({ name: typeof draft.name === 'string' || !draft.name ? v : { ...draft.name, [lang]: v } });
  const builtIn = defaultComponent(draft.id);
  // legend texts: built-ins have one per language, kids' components a single text
  const setLegend = (key, v) => {
    const cur = draft.legend?.[key];
    set({ legend: { ...draft.legend, [key]: cur && typeof cur === 'object' ? { ...cur, [lang]: v } : v } });
  };
  const isCore = !!draft.stats?.core;

  const canSave = name.trim() && !(draft.category === 'building' && draft.stats?.variantOf && !images.some(Boolean));

  const save = () => {
    try { localStorage.setItem(AUTHOR_KEY, draft.author ?? ''); } catch { /* ignore */ }
    const clean = typeof draft.name === 'string' ? draft.name.trim() : draft.name;
    onSave({ ...draft, images, name: clean, author: (draft.author ?? '').trim(), updatedAt: new Date().toISOString() });
  };
  const restore = () => {
    if (!confirm(t('component.confirm_restore'))) return;
    set({ name: builtIn.name, stats: structuredClone(builtIn.stats), themes: [...(builtIn.themes ?? [])], ...(builtIn.legend ? { legend: structuredClone(builtIn.legend) } : {}) });
  };

  return (
    <Modal onClose={onCancel} wide>
      <h2>{isNew ? t('editor.new_title', { cat: t(`cat.${asset.category}`) }) : t('editor.edit_title', { name: compName(asset, lang) || t(`cat.${asset.category}`) })}</h2>
      <div className="row" style={{ marginBottom: 16 }}>
        <label>{t('editor.name')} <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
        <label>{t('editor.author')} <input type="text" value={draft.author ?? ''} onChange={(e) => set({ author: e.target.value })} /></label>
        {builtIn && <span className="small muted">⭐ {t('component.built_in')}</span>}
      </div>

      {cat.themed && themes.length > 0 && (
        <div style={{ marginBottom: 12 }}><ThemeChips value={draft.themes ?? []} themes={themes} onChange={(v) => set({ themes: v })} /></div>
      )}

      <div className="slots">
        {images.map((img, i) => {
          // a missing level shows the previous drawing, faded (SPEC §3.2); a missing
          // named slot (hero with a weapon) shows the default drawing
          let fallback = null;
          if (cat.slots) fallback = i > 0 ? images[0] : null;
          else for (let j = i - 1; j >= 0 && !fallback; j--) fallback = images[j];
          const label = cat.slots ? t(`editor.slot_${cat.slots[i]}`) : images.length > 1 ? t('editor.level', { n: i + 1 }) : null;
          return <ImageSlot key={i} label={label} image={img} fallback={fallback} category={cat} onChange={(v) => setImage(i, v)} />;
        })}
      </div>
      <p className="small muted">{t(cat.slots ? 'editor.slots_hint' : images.length > 1 ? 'editor.levels_hint' : 'component.picture_hint')}</p>

      {cat.stats && (
        <div style={{ marginTop: 12 }}>
          {cat.stats === 'hero' && <HeroStatsEditor points={draft.stats} rules={heroRules} onChange={(stats) => set({ stats })} />}
          {cat.stats === 'item' && <ItemStatsEditor category={asset.category} stats={draft.stats} onChange={(stats) => set({ stats })} />}
          {cat.stats === 'enemy' && <EnemyStatsEditor id={draft.id} stats={draft.stats} enemies={enemyTypes} onChange={(stats) => set({ stats })} />}
          {cat.stats === 'building' && <BuildingStatsEditor id={draft.id} stats={draft.stats} types={buildingTypes} onChange={(stats) => set({ stats })} />}
          {cat.stats === 'coin' && (
            <NumField label={`🪙 ${t('editor.coin_value')}`} value={draft.stats.value} min={1} max={999} onChange={(v) => set({ stats: { value: Math.round(v) } })} />
          )}
        </div>
      )}

      {cat.legend && (
        <div className="sketch-card" style={{ padding: 10, marginTop: 12 }}>
          <h3 style={{ margin: '0 0 6px' }}>📖 {t('chronicle.legend')}</h3>
          <p className="small muted" style={{ margin: '0 0 6px' }}>{t('chronicle.legend_hint')}</p>
          <textarea rows={3} style={{ width: '100%' }} value={legendText(draft.legend?.story, lang)} placeholder={t('chronicle.story_placeholder')} onChange={(e) => setLegend('story', e.target.value)} />
          <label className="row small" style={{ gap: 6, marginTop: 6 }}>💡 {t('chronicle.hint')}
            <input type="text" style={{ flex: 1 }} value={legendText(draft.legend?.hint, lang)} placeholder={t('chronicle.hint_placeholder')} onChange={(e) => setLegend('hint', e.target.value)} />
          </label>
        </div>
      )}

      {cat.anims && (
        <div style={{ marginTop: 12 }}>
          <AnimationEditor kinds={cat.anims} anims={draft.anims ?? {}} size={cat.size} removeBg={cat.removeBg} onChange={(anims) => set({ anims })} />
        </div>
      )}

      {cat.sounds && (
        <div style={{ marginTop: 12 }}>
          <SoundEditor sounds={draft.sounds ?? {}} onChange={(sounds) => set({ sounds })} />
        </div>
      )}

      <div className="row" style={{ marginTop: 20 }}>
        {!isNew && !isCore && <button className="btn danger" onClick={() => { if (confirm(t('editor.confirm_delete'))) onDelete(draft.id); }}>🗑 {t('common.delete')}</button>}
        {builtIn && <button className="btn" onClick={restore}>↺ {t('component.restore')}</button>}
        <span className="spacer" />
        {!canSave && <span className="small muted">{t('component.need_name')}</span>}
        <button className="btn" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="btn primary" onClick={save} disabled={!canSave}>✓ {t('common.save')}</button>
      </div>
    </Modal>
  );
}
