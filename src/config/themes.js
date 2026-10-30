// Themes (worlds): plains, necromancy, graveyard, goblin forest… Kids rename
// them and add their own (studio → 🏷️ Themes); stored in the `themes`
// collection and exported with everything else.
//
//   component.themes = [themeId…]  which worlds an enemy / building belongs to;
//                                  empty = it fits every world
//   map.theme        = themeId | null
//
// In the game a themed map offers only the buildings of its theme (and the
// ones without a theme); the wave editor lists the theme's enemies first; the
// studio can show one theme at a time.

const STAMP = '2026-10-30T00:00:00.000Z';

export const DEFAULT_THEMES = [
  { id: 'plains', icon: '🌾', name: { cs: 'Pláně', en: 'Plains' } },
  { id: 'goblinForest', icon: '🌲', name: { cs: 'Skřetí les', en: 'Goblin forest' } },
  { id: 'graveyard', icon: '🪦', name: { cs: 'Hřbitov', en: 'Graveyard' } },
  { id: 'necromancy', icon: '💀', name: { cs: 'Nekromancie', en: 'Necromancy' } },
].map((th) => ({ ...th, builtIn: true, createdAt: STAMP, updatedAt: STAMP }));

/** Name in the current language (built-ins have { cs, en }, kids' themes a string). */
export function themeName(theme, lang = 'cs') {
  if (!theme) return '';
  return typeof theme.name === 'string' ? theme.name : theme.name?.[lang] ?? theme.name?.cs ?? theme.id;
}

/** Does a component (with `themes`) belong to the map's theme? No theme on either side = yes. */
export function fitsTheme(thing, themeId) {
  if (!themeId) return true;
  const list = thing?.themes ?? [];
  return !list.length || list.includes(themeId);
}
