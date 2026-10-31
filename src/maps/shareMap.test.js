import { describe, it, expect } from 'vitest';
import { mapPackage, mapFileName } from './shareMap.js';
import { parseSaveFile } from '../data/saveFile.js';
import { planMapImport } from '../data/mapImport.js';

const asset = (id, category, stats = {}) => ({ id, category, name: id, images: [], stats });
const db = {
  themes: [{ id: 'graveyard', icon: '🪦', name: 'Graveyard' }, { id: 'other', icon: '?', name: 'Other' }],
  assets: [
    asset('tree', 'decoration'), asset('flower', 'decoration'),
    asset('necro', 'enemy', { minions: ['skel'] }), asset('skel', 'enemy'), asset('dragon', 'enemy'),
    asset('mud', 'texture'), asset('house', 'building'),
  ],
  maps: [],
};
const map = {
  id: 'm1', name: 'Žluťoučký kůň', theme: 'graveyard', decorations: [{ asset: 'tree', x: 1, y: 2 }],
  textures: { '#00ff00': 'mud', '#ffffff': 'grass' }, waves: { startCoins: 20, rounds: [{ groups: [{ enemy: 'necro', count: 2 }] }] },
};

describe('sharing one map', () => {
  it('holds the map, its theme and what it uses (minions too, the buildings of its world)', () => {
    const f = mapPackage(map, db);
    expect(f.kind).toBe('map');
    expect(f.maps).toEqual([map]);
    expect(f.themes.map((t) => t.id)).toEqual(['graveyard']);
    expect(f.assets.map((a) => a.id).sort()).toEqual(['house', 'mud', 'necro', 'skel', 'tree']); // not the unused flower and dragon
    expect(f.settings).toEqual({ dataVersion: 4 }); // nothing else travels with a shared map
    expect(f.info).toEqual({ title: 'Žluťoučký kůň' }); // for the public library
    expect(mapPackage({ ...map, author: 'Ema', description: 'les' }, db, undefined, new Date(), { thumbnail: 'data:image/jpeg;base64,x' }).info)
      .toEqual({ title: 'Žluťoučký kůň', author: 'Ema', description: 'les', thumbnail: 'data:image/jpeg;base64,x' });
  });

  it('is a normal save file a friend can import', () => {
    const f = parseSaveFile(JSON.stringify(mapPackage(map, db)));
    const plan = planMapImport({ assets: [], maps: [], themes: [], rules: [], settings: {} }, f);
    expect(plan.additions).toHaveLength(7); // theme, 5 components, the map
    expect(plan.partials).toHaveLength(0);
  });

  it('names the file after the map', () => {
    expect(mapFileName(map)).toBe('map-zlutoucky-kun.json');
    expect(mapFileName({ name: '' })).toBe('map-map.json');
  });
});
