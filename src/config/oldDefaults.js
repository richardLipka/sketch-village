// Earlier default names and legend texts of the built-in components (made by
// `npm run old-defaults` from the git history – don't edit by hand). The
// migration gives a stored built-in today's default wherever it still has one
// of these (data/migrate.js, freshTexts below); a kid's own text stays.
//
//   OLD_DEFAULTS[id][field][lang] = [texts]   field: name | story | hint

export const OLD_DEFAULTS = {
  archer: {
    name: { cs: ['Lučištník'], en: ['Archer'] },
    story: { cs: ['Lučištníci se schovávají za kameny a střílejí z dálky. Prý nikdy neminou jablko.'], en: ['Archers hide behind rocks and shoot from far away. They say they never miss an apple.'] },
    hint: { cs: ['Střílejí z dálky na budovy – pošli na ně hrdinu nebo vojáky.'], en: ['They shoot buildings from afar – send the hero or soldiers after them.'] },
  },
  axe: {
    name: { cs: ['Sekera'], en: ['Axe'] },
  },
  dragon: {
    name: { cs: ['Drak'], en: ['Dragon'] },
    story: { cs: ['Drak spí na hoře z mincí. Jednou za čas se vzbudí a letí se podívat, kdo mu je bere.'], en: ['The dragon sleeps on a mountain of coins. Now and then he wakes up to see who is taking them.'] },
    hint: { cs: ['Létá a chrlí oheň z dálky: luk, kouzla a hodně věží. Za odměnu dá velký poklad.'], en: ['He flies and breathes fire from afar: bow, magic and many towers. He pays a big treasure.'] },
  },
  goblin: {
    name: { cs: ['Skřet'] },
    story: { cs: ['Skřeti žijí v lese za kopcem a nejradši kradou koláče. Chodí ve velkých skupinách a hrozně u toho hlučí.'] },
  },
  necromancer: {
    story: { cs: ['Nekromant čte ze staré knihy a volá kostlivce ze země. Nosí plášť z pavučin.'], en: ['The necromancer reads from an old book and calls skeletons out of the ground. His cloak is made of cobwebs.'] },
  },
  orc: {
    name: { cs: ['Zlobr'], en: ['Orc'] },
    story: { cs: ['Zlobři jsou velcí, pomalí a mají tvrdou kůži. Spí celou zimu a na jaře mají hlad.'], en: ['Orcs are big, slow and thick-skinned. They sleep all winter and wake up hungry.'] },
    hint: { cs: ['Mají brnění – silné věže a katapult na ně platí nejlíp.'], en: ['They wear armor – strong towers and the catapult work best.'] },
  },
  wolf: {
    name: { cs: ['Vlk'], en: ['Wolf'] },
    story: { cs: ['Šedí vlci běhají rychleji než vítr. Když zavyjí, ptáci v lese ztichnou.'], en: ['Grey wolves run faster than the wind. When they howl, the birds in the forest go quiet.'] },
  },
};

/**
 * The texts of a stored built-in `asset` brought up to date with its default
 * `def`: every language of its name, story and hint that is still an earlier
 * default becomes today's. null when nothing is old.
 */
export function freshTexts(asset, def) {
  const old = OLD_DEFAULTS[asset?.id];
  if (!old || !def) return null;
  const isOld = (field, lang, v) => typeof v === 'string' && (old[field]?.[lang] ?? []).includes(v.trim());
  const fix = (cur, now, field) => {
    if (!cur || typeof cur !== 'object' || !now || typeof now !== 'object') return cur; // a kid's single text stays
    let next = cur;
    for (const lang of Object.keys(now)) if (isOld(field, lang, cur[lang])) next = { ...next, [lang]: now[lang] };
    return next;
  };
  const name = fix(asset.name, def.name, 'name');
  const story = fix(asset.legend?.story, def.legend?.story, 'story');
  const hint = fix(asset.legend?.hint, def.legend?.hint, 'hint');
  if (name === asset.name && story === asset.legend?.story && hint === asset.legend?.hint) return null;
  return {
    ...(name !== asset.name ? { name } : {}),
    ...(story !== asset.legend?.story || hint !== asset.legend?.hint ? { legend: { ...asset.legend, story, hint } } : {}),
  };
}
