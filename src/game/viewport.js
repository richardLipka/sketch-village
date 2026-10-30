// How much of the map the game shows (SPEC §4a). The map is 16 : 9; a phone held
// sideways is wider. "Fit" would leave empty paper bars beside the map; "cover"
// fills the whole screen and the part that doesn't fit is reached by dragging
// the map (the controls lie over it). Phones and tablets always cover; a PC
// covers when it hides at most COVER_MAX_HIDDEN of the map, else shows it all.

export const COVER_MAX_HIDDEN = 0.12;

/** Share of the map hidden when covering a `pw × ph` screen. */
export function hiddenShare(pw, ph, mw, mh) {
  const a = pw / ph, m = mw / mh;
  return 1 - Math.min(a / m, m / a);
}

/** The game's size in map px: the screen's shape, as big as the map allows (cover), or the whole map (fit). */
export function gameSize(pw, ph, mw, mh, device = 'pc') {
  if (!pw || !ph) return { width: mw, height: mh, cover: false };
  const cover = device !== 'pc' || hiddenShare(pw, ph, mw, mh) <= COVER_MAX_HIDDEN;
  if (!cover) return { width: mw, height: mh, cover };
  const a = pw / ph;
  return a >= mw / mh ? { width: mw, height: Math.round(mw / a), cover } : { width: Math.round(mh * a), height: mh, cover };
}
