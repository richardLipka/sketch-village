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

// (the texts follow the class's drawings: the wolf is a goblin riding a spider,
// the archer a shaman, the orc a hobgoblin, the dragon the goblin king)
export const BUILT_IN_LEGENDS = {
  goblin: L(
    'Goblini žijí v lese za kopcem a nejradši kradou koláče. Chodí ve velkých skupinách a hrozně u toho hlučí.',
    'Goblins live in the forest behind the hill and love stealing pies. They come in big noisy groups.',
    'Jsou slabí, ale je jich hodně – věž nebo katapult u cesty je zastaví.',
    'Weak but many – a tower or a catapult by the road stops them.'),
  goblinPack: L(
    'Dva goblini v kápích chodí vždycky spolu. Co nesebere jeden, sebere druhý.',
    'Two hooded goblins always go together. What one doesn’t grab, the other does.',
    'Jsou slabí jako goblini – věž nebo katapult u cesty je zastaví.',
    'As weak as goblins – a tower or a catapult by the road stops them.'),
  wolf: L(
    'Goblin si osedlal obřího pavouka a teď je rychlejší než vítr. Pavouk cvaká kusadly a jezdec se chechtá.',
    'A goblin saddled a giant spider and now he is faster than the wind. The spider clicks its jaws and the rider cackles.',
    'Jsou rychlí: postav věže dál od radnice, ať je trefí dřív, než doběhnou.',
    'They are fast: build towers far from the town hall so they are hit before they arrive.'),
  archer: L(
    'Šaman nosí masku z lebky a kouzelné kopí. Z dálky metá na budovy jiskry a zaříkadla.',
    'The shaman wears a skull mask and carries a magic spear. From far away he throws sparks and spells at the buildings.',
    'Útočí z dálky na budovy – pošli na něj hrdinu nebo vojáky.',
    'He attacks buildings from afar – send the hero or soldiers after him.'),
  orc: L(
    'Hopgoblin je větší a silnější bratranec goblina. Nosí kroužkovou zbroj, kopí a červený štít.',
    'The hobgoblin is the goblin’s bigger, stronger cousin. He wears chain mail and carries a spear and a red shield.',
    'Má brnění – silné věže a katapult na něj platí nejlíp.',
    'He wears armor – strong towers and the catapult work best.'),
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
  skeletonWarrior: L(
    'Kostlivý bojovník si ze hřbitova přinesl staré kopí. Nekromant ho volá spolu s kostlivci.',
    'The skeleton warrior brought an old spear from the graveyard. The necromancer calls him along with the skeletons.',
    'Je slabý, ale přichází pořád znovu – zastav nekromanta.',
    'Weak, but he keeps coming – stop the necromancer.'),
  necromancer: L(
    'Nekromant čte ze staré knihy a volá ze země kostlivce a kostlivé bojovníky. Nosí plášť z pavučin.',
    'The necromancer reads from an old book and calls skeletons and skeleton warriors out of the ground. His cloak is made of cobwebs.',
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
    'Král vládne goblinům a útočí se svou suitou.',
    'The king rules the goblins and attacks with his retinue.',
    'Útočí na dálku, volá své pomocníky. Pozor na něj.',
    'He attacks from afar and calls his helpers. Watch out for him.'),
  rukh: L(
    'Rukh je obrovský pták z dalekých hor. Když roztáhne křídla, zakryje slunce.',
    'The roc is a giant bird from faraway mountains. When it spreads its wings it hides the sun.',
    'Létá rychle a má tuhé peří: meč ani katapult na něj nedosáhnou – použij luk, kouzla a věže.',
    'It flies fast and has tough feathers: swords and the catapult can’t reach it – use a bow, magic and towers.'),
};
