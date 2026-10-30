// Registry of component kinds (studio tabs). Everything the studio does with a
// kind – stored picture size, paper removal, how many pictures, which property
// editor – is driven from here, so a new kind only needs a new entry.
//
// size     – stored square size in px
// removeBg – photos of paper get the white paper removed
// levels   – number of pictures (buildings: one per level, follows the levels)
// slots    – names of the pictures when they aren't levels; a missing one uses the first
// stats    – which property editor sits next to the pictures
// themed   – can belong to themes (worlds, config/themes.js)

export const CATEGORIES = {
  // hero: default drawing + optional drawings holding a melee / ranged / magic weapon
  hero:       { size: 128, removeBg: true, levels: 4, slots: ['default', 'melee', 'ranged', 'magic'], stats: 'hero' },
  enemy:      { size: 128, removeBg: true, levels: 1, stats: 'enemy', themed: true },
  // buildings: a type (features + levels, one picture per level) or another look of a type
  building:   { size: 128, removeBg: true, levels: 3, stats: 'building', themed: true },
  soldier:    { size: 96,  removeBg: true, levels: 1 },
  weapon:     { size: 96,  removeBg: true, levels: 1, stats: 'item' },
  shield:     { size: 96,  removeBg: true, levels: 1, stats: 'item' },
  armor:      { size: 96,  removeBg: true, levels: 1, stats: 'item' },
  coin:       { size: 64,  removeBg: true, levels: 1, stats: 'coin' },
  chest:      { size: 64,  removeBg: true, levels: 1 },
  projectile: { size: 64,  removeBg: true, levels: 1 },
  cave:       { size: 128, removeBg: true, levels: 1 },
  decoration: { size: 128, removeBg: true, levels: 1 },
  // a surface (grass, stones…) that covers a colour of the map in the game; tiled, so no paper removal
  texture:    { size: 128, removeBg: false, levels: 1 },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES);

export function getCategory(id) {
  const c = CATEGORIES[id];
  if (!c) throw new Error(`Unknown component kind: ${id}`);
  return c;
}
