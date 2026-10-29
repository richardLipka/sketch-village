import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal.jsx';
import ImageSlot from './ImageSlot.jsx';
import HeroStatsEditor from './HeroStatsEditor.jsx';
import { getCategory } from './categories.js';
import { DEFAULT_HERO_POINTS } from '../config/heroStats.js';
import { defaultItemStats } from '../config/weapons.js';
import ItemStatsEditor from './ItemStatsEditor.jsx';
import { newId } from '../data/saveFile.js';

const AUTHOR_KEY = 'sv:lastAuthor';

function lastAuthor() {
  try { return localStorage.getItem(AUTHOR_KEY) || ''; } catch { return ''; }
}

export function emptyAsset(categoryId) {
  const cat = getCategory(categoryId);
  const now = new Date().toISOString();
  return {
    id: newId(),
    category: categoryId,
    name: '',
    author: lastAuthor(),
    images: Array(cat.levels).fill(null),
    ...(cat.stats === 'hero' ? { stats: { ...DEFAULT_HERO_POINTS } } : {}),
    ...(cat.stats === 'item' ? { stats: defaultItemStats(categoryId) } : {}),
    ...(cat.stats === 'coin' ? { stats: { value: 1 } } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

// Edit one asset: name, author, its drawing(s) – one per upgrade level – and stats.
export default function AssetEditor({ asset, isNew, heroRules, onSave, onDelete, onCancel }) {
  const { t } = useTranslation();
  const cat = getCategory(asset.category);
  // older records may have fewer drawings than the category has slots now
  // (and coins / equipment drawn before they had numbers get the defaults)
  const [draft, setDraft] = useState(() => ({
    ...asset,
    images: Array.from({ length: Math.max(cat.levels, asset.images.length) }, (_, i) => asset.images[i] ?? null),
    ...(cat.stats === 'item' ? { stats: { ...defaultItemStats(asset.category), ...asset.stats } } : {}),
    ...(cat.stats === 'coin' ? { stats: { value: 1, ...asset.stats } } : {}),
  }));

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setImage = (i, img) => setDraft((d) => {
    const images = [...d.images];
    images[i] = img;
    return { ...d, images };
  });

  const canSave = draft.images[0] && draft.name.trim();

  const save = () => {
    try { localStorage.setItem(AUTHOR_KEY, draft.author); } catch { /* ignore */ }
    onSave({ ...draft, name: draft.name.trim(), author: draft.author.trim(), updatedAt: new Date().toISOString() });
  };

  return (
    <Modal onClose={onCancel} wide>
      <h2>{isNew ? t('editor.new_title', { cat: t(`cat.${asset.category}`) }) : t('editor.edit_title')}</h2>
      <div className="row" style={{ marginBottom: 16 }}>
        <label>{t('editor.name')} <input type="text" value={draft.name} onChange={(e) => set({ name: e.target.value })} autoFocus /></label>
        <label>{t('editor.author')} <input type="text" value={draft.author} onChange={(e) => set({ author: e.target.value })} /></label>
      </div>

      <div className="slots">
        {draft.images.map((img, i) => {
          // a missing level shows the previous drawing, faded (SPEC §3.2); a missing
          // named slot (hero with a weapon) shows the default drawing
          let fallback = null;
          if (cat.slots) fallback = i > 0 ? draft.images[0] : null;
          else for (let j = i - 1; j >= 0 && !fallback; j--) fallback = draft.images[j];
          const label = cat.slots ? t(`editor.slot_${cat.slots[i]}`) : cat.levels > 1 ? t('editor.level', { n: i + 1 }) : null;
          return (
            <ImageSlot
              key={i}
              label={label}
              image={img}
              fallback={fallback}
              category={cat}
              onChange={(v) => setImage(i, v)}
            />
          );
        })}
      </div>
      {cat.levels > 1 && <p className="small muted">{t(cat.slots ? 'editor.slots_hint' : 'editor.levels_hint')}</p>}

      {cat.stats === 'hero' && (
        <div style={{ marginTop: 16 }}>
          <HeroStatsEditor points={draft.stats} rules={heroRules} onChange={(stats) => set({ stats })} />
        </div>
      )}

      {cat.stats === 'item' && (
        <div style={{ marginTop: 16 }}>
          <ItemStatsEditor category={asset.category} stats={draft.stats} onChange={(stats) => set({ stats })} />
        </div>
      )}

      {cat.stats === 'coin' && (
        <label className="row" style={{ marginTop: 16, gap: 8 }}>
          🪙 {t('editor.coin_value')}
          <input type="number" min={1} max={999} value={draft.stats.value} style={{ width: 80 }}
            onChange={(e) => { const v = Math.max(1, Math.min(999, Math.round(Number(e.target.value) || 1))); set({ stats: { value: v } }); }} />
        </label>
      )}

      <div className="row" style={{ marginTop: 20 }}>
        {!isNew && <button className="btn danger" onClick={() => { if (confirm(t('editor.confirm_delete'))) onDelete(draft.id); }}>🗑 {t('common.delete')}</button>}
        <span className="spacer" />
        {!canSave && <span className="small muted">{t('editor.need_name_image')}</span>}
        <button className="btn" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="btn primary" onClick={save} disabled={!canSave}>✓ {t('common.save')}</button>
      </div>
    </Modal>
  );
}
