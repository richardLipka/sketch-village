import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SOUND_KINDS, MAX_RECORD_SECONDS, MAX_FILE_BYTES, findTrim, clampTrim, waveform, recorderMime, canRecord } from './audioClip.js';
import { decodeSound, loadClip, playClip } from '../game/sound.js';
import { blobToDataUrl } from './clipboard.js';

// A monster's own sounds (SPEC §3.2b): a growl now and then while walking, an
// attack and a death. Record with the microphone (up to 3 s) or load a file;
// the silence around is cut automatically and the two handles under the
// waveform trim it by hand. The game plays them sparingly (game/monsterVoices.js).

const ICON = { walk: '🗣️', attack: '⚔️', death: '💀' };

export default function SoundEditor({ sounds = {}, onChange }) {
  const { t } = useTranslation();
  const set = (kind, sound) => {
    const next = { ...sounds };
    if (sound) next[kind] = sound;
    else delete next[kind];
    onChange(next);
  };
  return (
    <div className="sketch-card sound-editor" style={{ padding: 10 }}>
      <h3 style={{ margin: '0 0 4px' }}>🔊 {t('sounds.title')}</h3>
      <p className="small muted" style={{ margin: '0 0 8px' }}>{t('sounds.hint')}</p>
      {SOUND_KINDS.map((kind) => <SoundRow key={kind} kind={kind} sound={sounds[kind]} onChange={(s) => set(kind, s)} />)}
    </div>
  );
}

function SoundRow({ kind, sound, onChange }) {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const recRef = useRef(null);
  const [buffer, setBuffer] = useState(null);
  const [recording, setRecording] = useState(null); // seconds so far
  const [error, setError] = useState(null);

  // decode for the waveform whenever the recording changes
  useEffect(() => {
    let alive = true;
    setBuffer(null);
    if (sound?.data) decodeSound(sound.data).then((b) => alive && setBuffer(b)).catch(() => alive && setError(t('sounds.cant_play')));
    return () => { alive = false; };
  }, [sound?.data, t]);

  useEffect(() => () => recRef.current?.stop(), []);

  // a new recording or file: cut the silence around it at once
  const take = async (data) => {
    setError(null);
    try {
      const b = await decodeSound(data);
      onChange({ data, ...findTrim(b.getChannelData(0), b.sampleRate) });
    } catch {
      setError(t('sounds.cant_play'));
    }
  };

  const record = async () => {
    setError(null);
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setError(t('sounds.no_mic'));
      return;
    }
    const mime = recorderMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    const began = performance.now();
    const timer = setInterval(() => {
      const s = (performance.now() - began) / 1000;
      setRecording(s);
      if (s >= MAX_RECORD_SECONDS && rec.state === 'recording') rec.stop();
    }, 100);
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      clearInterval(timer);
      stream.getTracks().forEach((tr) => tr.stop());
      recRef.current = null;
      setRecording(null);
      if (chunks.length) await take(await blobToDataUrl(new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' })));
    };
    recRef.current = rec;
    setRecording(0);
    rec.start();
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setError(t('sounds.too_big')); return; }
    await take(await blobToDataUrl(file));
  };

  const play = async () => {
    const key = `editor:${kind}`;
    if (await loadClip(key, sound)) playClip(key, 1, true);
  };

  const trim = (patch) => buffer && onChange({ ...sound, ...clampTrim({ start: sound.start, end: sound.end, ...patch }, buffer.duration) });
  const duration = buffer?.duration ?? 0;

  return (
    <div className="sound-row">
      <b className="sound-kind">{ICON[kind]} {t(`sounds.${kind}`)}</b>
      <div className="sound-body">
        {sound?.data && <Waveform buffer={buffer} start={sound.start} end={sound.end} />}
        {sound?.data && buffer && (
          <div className="row small sound-trim">
            <label>{t('sounds.from')} <input type="range" min={0} max={duration} step={0.01} value={sound.start} onChange={(e) => trim({ start: Number(e.target.value) })} /></label>
            <label>{t('sounds.to')} <input type="range" min={0} max={duration} step={0.01} value={sound.end} onChange={(e) => trim({ end: Number(e.target.value) })} /></label>
            <span className="muted">{(sound.end - sound.start).toFixed(1)} s</span>
          </div>
        )}
        {!sound?.data && recording === null && <span className="small muted">{t('sounds.none')}</span>}
        {recording !== null && <span className="small rec-dot">● {t('sounds.recording')} {recording.toFixed(1)} / {MAX_RECORD_SECONDS} s</span>}
        {error && <span className="small error-text">{error}</span>}
      </div>
      <div className="row sound-actions">
        {sound?.data && <button type="button" className="btn icon" title={t('sounds.play')} onClick={play}>▶</button>}
        {recording === null
          ? canRecord() && <button type="button" className="btn icon" title={t('sounds.record')} onClick={record}>🎤</button>
          : <button type="button" className="btn icon danger" title={t('sounds.stop')} onClick={() => recRef.current?.stop()}>⏹</button>}
        <button type="button" className="btn icon" title={t('sounds.load')} onClick={() => fileRef.current.click()}>📁</button>
        {sound?.data && <button type="button" className="btn icon danger" title={t('sounds.remove')} onClick={() => onChange(null)}>✕</button>}
      </div>
      <input ref={fileRef} type="file" accept="audio/*" hidden onChange={onFile} />
    </div>
  );
}

/** The recording as a pencil-drawn waveform; the part that plays is highlighted. */
function Waveform({ buffer, start, end }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d');
    const W = c.width, H = c.height;
    g.clearRect(0, 0, W, H);
    if (!buffer) return;
    const x0 = (start / buffer.duration) * W, x1 = (end / buffer.duration) * W;
    g.fillStyle = '#fde68a';
    g.fillRect(x0, 0, Math.max(1, x1 - x0), H);
    waveform(buffer.getChannelData(0), W).forEach(([lo, hi], x) => {
      g.fillStyle = x >= x0 && x <= x1 ? '#1e3a8a' : '#1e3a8a55';
      g.fillRect(x, H / 2 + lo * H * 0.48, 1, Math.max(1, (hi - lo) * H * 0.48));
    });
  }, [buffer, start, end]);
  return <canvas ref={ref} className="waveform" width={260} height={44} />;
}
