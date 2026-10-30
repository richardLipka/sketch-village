// Monster legends for the chronicle (📖): a short story and a hint for the
// player. Kids write their own in the component editor; these are the texts of
// the built-in monsters (one per language – a kid's legend is a single text).
//
//   component.legend = { story, hint }   each a string or { cs, en }

/** Text in the current language (a kid's legend is one plain string). */
export function legendText(v, lang = 'cs') {
  if (!v) return '';
  return typeof v === 'string' ? v : v[lang] ?? v.cs ?? v.en ?? '';
}

const L = (storyCs, storyEn, hintCs, hintEn) => ({ story: { cs: storyCs, en: storyEn }, hint: { cs: hintCs, en: hintEn } });

export const BUILT_IN_LEGENDS = {
  goblin: L(
    'Skřeti žijí v lese za kopcem a nejradši kradou koláče. Chodí ve velkých skupinách a hrozně u toho hlučí.',
    'Goblins live in the forest behind the hill and love stealing pies. They come in big noisy groups.',
    'Jsou slabí, ale je jich hodně – věž nebo katapult u cesty je zastaví.',
    'Weak but many – a tower or a catapult by the road stops them.'),
  wolf: L(
    'Šedí vlci běhají rychleji než vítr. Když zavyjí, ptáci v lese ztichnou.',
    'Grey wolves run faster than the wind. When they howl, the birds in the forest go quiet.',
    'Jsou rychlí: postav věže dál od radnice, ať je trefí dřív, než doběhnou.',
    'They are fast: build towers far from the town hall so they are hit before they arrive.'),
  archer: L(
    'Lučištníci se schovávají za kameny a střílejí z dálky. Prý nikdy neminou jablko.',
    'Archers hide behind rocks and shoot from far away. They say they never miss an apple.',
    'Střílejí z dálky na budovy – pošli na ně hrdinu nebo vojáky.',
    'They shoot buildings from afar – send the hero or soldiers after them.'),
  orc: L(
    'Zlobři jsou velcí, pomalí a mají tvrdou kůži. Spí celou zimu a na jaře mají hlad.',
    'Orcs are big, slow and thick-skinned. They sleep all winter and wake up hungry.',
    'Mají brnění – silné věže a katapult na ně platí nejlíp.',
    'They wear armor – strong towers and the catapult work best.'),
  bat: L(
    'Netopýři létají z hřbitova, jakmile zapadne slunce. Cesty je nezajímají.',
    'Bats fly out of the graveyard as soon as the sun sets. They don’t care about roads.',
    'Létají: meč ani katapult je netrefí, použij luk, kouzla a věže.',
    'They fly: swords and the catapult can’t reach them – use a bow, magic and towers.'),
  troll: L(
    'Troll bydlí pod starým mostem. Když se naštve, třese se celá louka.',
    'The troll lives under the old bridge. When he gets angry the whole meadow shakes.',
    'Má hodně životů – soustřeď na něj všechny věže a nenech ho dojít k radnici.',
    'Lots of health – focus all towers on him and don’t let him reach the town hall.'),
  skeleton: L(
    'Kostlivci chrastí kostmi a poslouchají jen nekromanta. Bez něj se rozpadnou na hromádku.',
    'Skeletons rattle their bones and obey only the necromancer. Without him they fall apart.',
    'Jsou slabí, ale přicházejí pořád znovu – zastav nekromanta.',
    'Weak, but they keep coming – stop the necromancer.'),
  necromancer: L(
    'Nekromant čte ze staré knihy a volá kostlivce ze země. Nosí plášť z pavučin.',
    'The necromancer reads from an old book and calls skeletons out of the ground. His cloak is made of cobwebs.',
    'Každých pár sekund povolá kostlivce. Zaútoč na něj co nejdřív!',
    'Every few seconds he calls skeletons. Attack him as soon as you can!'),
  spiderling: L(
    'Malá pavoučátka jsou rychlá a lechtivá. Je jich vždycky víc, než čekáš.',
    'Spiderlings are quick and tickly. There are always more than you expect.',
    'Jedna rána je skolí – katapult jich zasáhne víc najednou.',
    'One hit is enough – a catapult catches many at once.'),
  spider: L(
    'Pavoučice spřádá sítě mezi stromy Skřetího lesa. Za ní cupitají její děti.',
    'The spider queen weaves webs between the trees of the goblin forest. Her children scuttle behind her.',
    'Když zemře, vypustí další pavoučata – měj připravený katapult.',
    'When she dies more spiderlings come out – have a catapult ready.'),
  dragon: L(
    'Drak spí na hoře z mincí. Jednou za čas se vzbudí a letí se podívat, kdo mu je bere.',
    'The dragon sleeps on a mountain of coins. Now and then he wakes up to see who is taking them.',
    'Létá a chrlí oheň z dálky: luk, kouzla a hodně věží. Za odměnu dá velký poklad.',
    'He flies and breathes fire from afar: bow, magic and many towers. He pays a big treasure.'),
};
