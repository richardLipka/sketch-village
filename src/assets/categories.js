// Registry of asset categories. Everything the Asset Studio does (crop shape,
// stored size, background removal, number of drawings) is driven from here, so
// a new kind of drawing only needs a new entry.
//
// size     – stored square size in px
// removeBg – photos of paper get the white paper removed
// levels   – number of drawings (one per upgrade level); 1 = single drawing
// stats    – which stats editor to show next to the drawing

export const CATEGORIES = {
  hero:       { size: 128, removeBg: true, levels: 1, stats: 'hero' },
  enemy:      { size: 128, removeBg: true, levels: 1 },
  soldier:    { size: 96,  removeBg: true, levels: 1 },
  townhall:   { size: 160, removeBg: true, levels: 3 },
  house:      { size: 128, removeBg: true, levels: 3 },
  tower:      { size: 128, removeBg: true, levels: 3 },
  castle:     { size: 128, removeBg: true, levels: 3 },
  cave:       { size: 128, removeBg: true, levels: 1 },
  decoration: { size: 128, removeBg: true, levels: 1 },
  coin:       { size: 64,  removeBg: true, levels: 1 },
  projectile: { size: 64,  removeBg: true, levels: 1 },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES);

export function getCategory(id) {
  const c = CATEGORIES[id];
  if (!c) throw new Error(`Unknown asset category: ${id}`);
  return c;
}
