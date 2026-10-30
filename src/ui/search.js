// Searching the lists (studio, maps, chronicle, play): by name and description –
// and author, legend, what a thing is – ignoring capitals and Czech accents.

/** "Skřetí Les" → "skreti les" */
export const normalize = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** All words of the query appear somewhere in the texts. An empty query matches everything. */
export function matchesQuery(query, ...texts) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = normalize(texts.flat(3).filter((x) => x !== null && x !== undefined).map((x) => (typeof x === 'object' ? Object.values(x) : x)).flat().join(' '));
  return words.every((w) => hay.includes(w));
}

/** The searchable texts of a component or a map: names (every language), description, author, legend. */
export const searchTexts = (c, extra = []) => [c?.name, c?.description, c?.author, c?.legend?.story, c?.legend?.hint, ...extra];
