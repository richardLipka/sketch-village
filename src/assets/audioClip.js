// Monster sounds recorded or loaded in the component editor (SPEC §3.2b).
// A sound is stored as { data, start, end }: the recording as a data URL
// (Opus / AAC, a few kB) and the part that plays, in seconds – trimming never
// re-encodes, so it can always be changed back.

export const SOUND_KINDS = ['walk', 'attack', 'death'];
export const MAX_RECORD_SECONDS = 3;
export const MAX_PLAY_SECONDS = 3; // the trimmed part is at most this long
export const MAX_FILE_BYTES = 600 * 1024;

/**
 * Where the sound is: the first and last moment louder than `threshold` of the
 * peak, with a little padding – silence before and after the shout is cut.
 */
export function findTrim(samples, sampleRate, { threshold = 0.08, pad = 0.05 } = {}) {
  const duration = samples.length / sampleRate;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  if (peak < 1e-4) return { start: 0, end: Math.min(duration, MAX_PLAY_SECONDS) };
  const limit = peak * threshold;
  let first = 0, last = samples.length - 1;
  while (first < samples.length && Math.abs(samples[first]) < limit) first++;
  while (last > first && Math.abs(samples[last]) < limit) last--;
  const start = Math.max(0, first / sampleRate - pad);
  const end = Math.min(duration, last / sampleRate + pad, start + MAX_PLAY_SECONDS);
  return { start: round2(start), end: round2(end) };
}

/** Gain that brings the loudest moment of the played part to `target` (quiet recordings get louder, at most ×6). */
export function normalizeGain(samples, sampleRate, start = 0, end = samples.length / sampleRate, target = 0.8) {
  let peak = 0;
  for (let i = Math.floor(start * sampleRate); i < Math.min(samples.length, Math.ceil(end * sampleRate)); i++) peak = Math.max(peak, Math.abs(samples[i]));
  return peak < 1e-4 ? 1 : Math.min(6, target / peak);
}

/** Clamp a trim to the recording: start < end, at most MAX_PLAY_SECONDS. */
export function clampTrim({ start, end }, duration) {
  const s = Math.max(0, Math.min(start, Math.max(0, duration - 0.05)));
  const e = Math.min(duration, Math.max(end, s + 0.05), s + MAX_PLAY_SECONDS);
  return { start: round2(s), end: round2(e) };
}

/** Min / max of each of `width` columns – the waveform drawing. */
export function waveform(samples, width) {
  const out = [];
  const step = samples.length / width;
  for (let x = 0; x < width; x++) {
    let lo = 0, hi = 0;
    for (let i = Math.floor(x * step); i < Math.floor((x + 1) * step); i++) { lo = Math.min(lo, samples[i]); hi = Math.max(hi, samples[i]); }
    out.push([lo, hi]);
  }
  return out;
}

const round2 = (v) => Math.round(v * 100) / 100;

/** A recording format this browser can make (Chrome / Firefox: Opus, Safari: AAC). */
export function recorderMime(MR = globalThis.MediaRecorder) {
  if (!MR) return null;
  return ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'].find((m) => MR.isTypeSupported?.(m)) ?? '';
}

export const canRecord = () => !!(globalThis.MediaRecorder && globalThis.navigator?.mediaDevices?.getUserMedia);
