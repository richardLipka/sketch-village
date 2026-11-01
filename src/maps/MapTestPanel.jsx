import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { runMapTest, runWaveLimits, TRIAL_SEEDS } from './mapTest.js';
import { mapCanvas, gridFromCanvas } from './mapRuntime.js';
import { fitsTheme } from '../config/themes.js';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../config/difficulty.js';

// "🤖 Let the robot try" in the wave editor (SPEC §10a): the bot plays this map
// with the waves being edited (saved or not) and reports how it went.
// "🧪 Find the limits" (SPEC §10b): for every wave, how much stronger it may get
// before the robot is consistently defeated – shown in the strength table.
export default function MapTestPanel({ map, waves, enemyTypes, buildingTypes, rules, items, onReport, onLimits }) {
  const { t } = useTranslation();
  const [difficulty, setDifficulty] = useState('normal');
  const [state, setState] = useState(null); // { running, done, total } | { report } | { error }
  const job = useRef(null);
  useEffect(() => () => job.current?.cancel(), []);

  // what the robot needs: the map's roads (from its picture), the buildings of its world, the waves as edited
  const setup = async () => ({
    map: { ...map, background: null }, grid: gridFromCanvas(await mapCanvas(map), map.palette), waves, enemyTypes,
    buildingTypes: buildingTypes.filter((ty) => ty.core || fitsTheme(ty, map.theme)), rules, weapons: items, difficulty,
  });

  const run = async () => {
    job.current?.cancel();
    setState({ running: true, done: 0, total: TRIAL_SEEDS.length });
    onReport(null);
    try {
      job.current = runMapTest(await setup(), (done, total) => setState({ running: true, done, total }));
      const report = await job.current.promise;
      setState({ report });
      onReport(report);
    } catch (e) {
      setState({ error: String(e.message ?? e) });
    }
  };

  const findLimits = async () => {
    job.current?.cancel();
    setState({ limits: true, running: true, done: 0, total: waves.rounds.length });
    onLimits?.(null);
    try {
      job.current = runWaveLimits(await setup(), (done, total) => setState({ limits: true, running: true, done, total }));
      const limits = await job.current.promise;
      setState({ limitsDone: limits });
      onLimits?.(limits);
    } catch (e) {
      setState({ error: String(e.message ?? e) });
    }
  };

  const report = state?.report;
  return (
    <div className="sketch-card map-test" style={{ padding: 10, marginBottom: 12 }}>
      <div className="row">
        <b>🤖 {t('maptest.title')}</b>
        <span className="small muted">{t('maptest.hint')}</span>
        <span className="spacer" />
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} aria-label={t('difficulty.label')}>
          {DIFFICULTY_IDS.map((id) => <option key={id} value={id}>{DIFFICULTIES[id].icon} {t(`difficulty.${id}`)}</option>)}
        </select>
        <button className="btn primary" onClick={run} disabled={state?.running}>
          {state?.running && !state.limits ? `⏳ ${t('maptest.running', { done: state.done, total: state.total })}` : `▶ ${t('maptest.run')}`}
        </button>
        {onLimits && (
          <button className="btn" onClick={findLimits} disabled={state?.running} data-testid="find-limits" title={t('maptest.limits_hint')}>
            {state?.running && state.limits ? `⏳ ${t('maptest.limits_running', { done: state.done, total: state.total })}` : `🧪 ${t('maptest.limits')}`}
          </button>
        )}
      </div>
      {state?.running && state.limits && (
        <progress className="limits-progress" max={state.total} value={state.done} aria-label={t('maptest.limits')} />
      )}
      {state?.limitsDone && <p className="small" role="status">🧪 {t('maptest.limits_done', limitsSummary(state.limitsDone))}</p>}
      {state?.error && <p className="error-text small">{state.error}</p>}
      {report && (
        <div className="map-test-report">
          <p className={`verdict verdict-${report.verdict}`}>
            {{ too_hard: '😵', hard: '😬', ok: '🙂', easy: '😴' }[report.verdict]} <b>{t(`maptest.verdict_${report.verdict}`)}</b>{' '}
            <span className="small">{t('maptest.wins', { wins: report.wins, games: report.games })}
              {report.lostAt.length > 0 && ` · ${t('maptest.lost_at', { rounds: report.lostAt.join(', ') })}`}</span>
          </p>
          <div className="map-test-rounds">
            {report.rounds.map((r) => (
              <div key={r.round} className={`map-test-round ${r.flags.length ? 'flagged' : ''}`} title={r.flags.map((f) => t(`maptest.flag_${f}`)).join(', ')}>
                <b>{r.round}</b>
                <span>⏱ {r.length} s</span>
                {r.lost > 0 && <span>🏚 {r.lost}</span>}
                {r.livesLost > 0 && <span>💔 {r.livesLost}</span>}
                {r.flags.map((f) => <span key={f} className="flag">{t(`maptest.flag_${f}`)}</span>)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** The headline of a limit test: the round with the least room (and its ×), how many break already as they are. */
export function limitsSummary(limits) {
  const played = limits.rounds.filter((r) => r.limit !== null);
  const tight = played.reduce((a, r) => (!a || r.limit < a.limit ? r : a), null);
  return { round: tight?.round ?? '–', x: tight?.limit ?? '–', broken: limits.rounds.filter((r) => r.status === 'too_hard').length };
}
