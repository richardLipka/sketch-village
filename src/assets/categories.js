// Registry of asset categories. Everything the Asset Studio does (crop shape,
// stored size, background removal, number of drawings) is driven from here, so
// a new kind of drawing only needs a new entry.
//
// size     – stored square size in px
// removeBg – photos of paper get the white paper removed
// levels   – number of drawings (one per upgrade level); 1 = single drawing
// stats    – which stats editor to show next to the drawing
// slots    – names of the drawings when they aren't upgrade levels; a missing
//            slot uses the first drawing

export const CATEGORIES = {
  // hero: default drawing + optional drawings holding a melee / ranged / magic weapon
  hero:       { size: 128, removeBg: true, levels: 4, slots: ['default', 'melee', 'ranged', 'magic'], stats: 'hero' },
  enemy:      { size: 128, removeBg: true, levels: 1 },
  soldier:    { size: 96,  removeBg: true, levels: 1 },
  townhall:   { size: 160, removeBg: true, levels: 3 },
  house:      { size: 128, removeBg: true, levels: 3 },
  tower:      { size: 128, removeBg: true, levels: 3 },
  castle:     { size: 128, removeBg: true, levels: 3 },
  cave:       { size: 128, removeBg: true, levels: 1 },
  decoration: { size: 128, removeBg: true, levels: 1 },
  coin:       { size: 64,  removeBg: true, levels: 1, stats: 'coin' }, // each coin drawing has its value
  projectile: { size: 64,  removeBg: true, levels: 1 },
  // equipment drawn by the kids is a playable item; its numbers are set next to the drawing
  weapon:     { size: 96,  removeBg: true, levels: 1, stats: 'item' },
  shield:     { size: 96,  removeBg: true, levels: 1, stats: 'item' },
  armor:      { size: 96,  removeBg: true, levels: 1, stats: 'item' },
  chest:      { size: 64,  removeBg: true, levels: 1 },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES);

export function getCategory(id) {
  const c = CATEGORIES[id];
  if (!c) throw new Error(`Unknown asset category: ${id}`);
  return c;
}
