// Downloading one component (SPEC §13a): a package file (`kind: 'component'`,
// data/packageFile.js) with the component and everything it needs to work as
// its maker made it – a monster's minions (and theirs), a shooter's
// projectile, a castle's soldiers (drawn ones or monsters), a building's other
// looks or a look's building, and the worlds they belong to. GUI icons never
// travel. A friend imports it thing by thing (data/packageImport.js).

import { buildPackage, withReferences, themesFor, packageFileName } from '../data/packageFile.js';
import { compName } from '../config/components.js';
import { getCategory } from './categories.js';

export const COMPONENT_FILE_KIND = 'component';

/** Can it be downloaded on its own? (not the GUI icons – they are the game's) */
export const canShare = (asset) => !!asset && !getCategory(asset.category).fixed;

/** The component first, then what it needs, in the order they are stored. */
export function componentWithNeeds(asset, assets = []) {
  if (!canShare(asset)) return [];
  const list = assets.some((a) => a.id === asset.id) ? assets : [...assets, asset];
  // a building type travels with all its looks
  const looks = asset.category === 'building' && !asset.stats?.variantOf
    ? list.filter((a) => a.stats?.variantOf === asset.id).map((a) => a.id) : [];
  const ids = withReferences([asset.id, ...looks], list);
  return [asset, ...list.filter((a) => ids.has(a.id) && a.id !== asset.id)];
}

export function componentPackage(asset, db, lang = 'cs', now = new Date()) {
  const assets = componentWithNeeds(asset, db.assets);
  return buildPackage(COMPONENT_FILE_KIND, { assets, themes: themesFor(assets, db.themes) }, {
    title: compName(asset, lang),
    category: asset.category,
    ...(asset.author ? { author: asset.author } : {}),
    ...(asset.description ? { description: asset.description } : {}),
  }, now);
}

/** The kind and the name: "enemy-goblin-king.json". */
export const componentFileName = (asset, lang = 'cs') => packageFileName(asset.category, compName(asset, lang));
