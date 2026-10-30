import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SOUND_KINDS } from './audioClip.js';
import { loadClip, playClip } from '../game/sound.js';
import { previewWave } from '../game/monsterVoices.js';

// "🎧 Hear it as in the game" (SPEC §3.2b): a little wave of this monster
// played through the game's real VoiceDirector, with a timeline that shows
// which sounds play and which the game leaves out so a wave doesn't become noise.

const ICON = { spawn: '👾', walk: '🗣️', attack: '⚔️', death: '💀' };
const LANES = ['walk', 'attack', 'death'];

export default function SoundPreview({ sounds }) {
  const { t } = useTranslation();
  const [run, setRun] = useState(null); // { duration, events, began }
  const [now, setNow] = useState(0);
  const timers = useRef([]);
  const frame = useRef(0);

  const stop = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    cancelAnimationFrame(frame.current);
  };
  useEffect(() => stop, []);

  const start = async () => {
    stop();
    const lengths = {};
    for (const kind of SOUND_KINDS) {
      const secs = await loadClip(`preview:${kind}`, sounds[kind]);
      if (secs) lengths[kind] = secs;
    }
    const wave = previewWave(lengths);
    const began = performance.now();
    for (const e of wave.events) {
      if (e.played) timers.current.push(setTimeout(() => playClip(`preview:${e.kind}`, 1, true), e.t * 1000));
    }
    timers.current.push(setTimeout(() => { cancelAnimationFrame(frame.current); setNow(wave.duration); }, wave.duration * 1000));
    const step = () => {
      setNow(Math.min(wave.duration, (performance.now() - began) / 1000));
      frame.current = requestAnimationFrame(step);
    };
    setRun({ ...wave, began });
    setNow(0);
    frame.current = requestAnimationFrame(step);
  };

  const playing = run && now < run.duration;
  const count = (kind, played) => run?.events.filter((e) => e.kind === kind && (played === undefined || e.played === played)).length ?? 0;

  return (
    <div className="sound-preview">
      <div className="row">
        <button type="button" className="btn" onClick={playing ? () => { stop(); setNow(run.duration); } : start}>
          {playing ? `⏹ ${t('sounds.preview_stop')}` : `🎧 ${t('sounds.preview')}`}
        </button>
        <span className="small muted">{t('sounds.preview_hint')}</span>
      </div>
      {run && (
        <>
          <div className="preview-timeline" aria-label={t('sounds.preview')}>
            <div className="track-area">
            <div className="lane lane-spawn">
              {run.events.filter((e) => e.kind === 'spawn').map((e, i) => (
                <span key={i} className={`mark ${e.t <= now ? 'past' : ''}`} style={{ left: `${(e.t / run.duration) * 100}%` }}>👾</span>
              ))}
            </div>
            {LANES.filter((k) => sounds[k]).map((kind) => (
              <div key={kind} className="lane">
                <span className="lane-icon">{ICON[kind]}</span>
                {run.events.filter((e) => e.kind === kind).map((e, i) => (
                  <span key={i} className={`mark ${e.played ? 'played' : 'skipped'} ${e.t <= now ? 'past' : ''}`} style={{ left: `${(e.t / run.duration) * 100}%` }}
                    title={e.played ? t('sounds.preview_played') : t('sounds.preview_skipped')}>
                    {e.played ? ICON[kind] : '○'}
                  </span>
                ))}
              </div>
            ))}
            <div className="playhead" style={{ left: `${(now / run.duration) * 100}%` }} />
            </div>
          </div>
          <p className="small preview-summary">
            {sounds.walk && <span>🗣️ {t('sounds.preview_growls', { count: count('walk', true) })}</span>}
            {sounds.attack && <span>⚔️ {t('sounds.preview_hits', { n: count('attack', true), total: count('attack') })}</span>}
            {sounds.death && <span>💀 {t('sounds.preview_deaths', { n: count('death', true), total: count('death') })}</span>}
          </p>
          <p className="small muted" style={{ margin: 0 }}>{t('sounds.preview_why', { monsters: count('spawn') })}</p>
        </>
      )}
    </div>
  );
}
