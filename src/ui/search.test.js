import { describe, it, expect } from 'vitest';
import { normalize, matchesQuery, searchTexts } from './search.js';

describe('searching lists', () => {
  it('ignores capitals and accents', () => {
    expect(normalize('Skřetí LES')).toBe('skreti les');
    expect(matchesQuery('skret', 'Skřet')).toBe(true);
  });
  it('finds by name in any language, description, author and legend; every word must match', () => {
    const goblin = { name: { cs: 'Skřet', en: 'Goblin' }, description: 'malý zelený', author: 'Eliška', legend: { story: { cs: 'Krade koláče', en: 'Steals cakes' } } };
    expect(matchesQuery('goblin', ...searchTexts(goblin))).toBe(true);
    expect(matchesQuery('zeleny', ...searchTexts(goblin))).toBe(true);
    expect(matchesQuery('eliska', ...searchTexts(goblin))).toBe(true);
    expect(matchesQuery('kolace', ...searchTexts(goblin))).toBe(true);
    expect(matchesQuery('maly zeleny', ...searchTexts(goblin))).toBe(true);
    expect(matchesQuery('maly drak', ...searchTexts(goblin))).toBe(false);
    expect(matchesQuery('', ...searchTexts(goblin))).toBe(true);
    expect(matchesQuery('x', ...searchTexts(null))).toBe(false);
  });
});
