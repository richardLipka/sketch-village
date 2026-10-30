import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { runMapTest, TRIAL_SEEDS } from './mapTest.js';
import { mapCanvas, gridFromCanvas } from './mapRuntime.js';
import { fitsTheme } from '../config/themes.js';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../config/difficulty.js';

// "🤖 Let the robot try" in the wave editor (SPEC §10a): the bot plays this map
// with the waves being edited (saved or not) and reports how it went.
export default function MapTestPanel({ map, waves, enemyTypes, buildingTypes, rules, items, onReport }) {
  const { t } = useTranslation();
  const [difficulty, setDifficulty] = useState('normal');
  const [state, setState] = useState(null); // { running, done, total } | { report } | { error }
  const job = useRef(null);
  useEffect(() => () => job.current?.cancel(), []);

  const run = async () => {
    job.current?.cancel();
    setState({ running: true, done: 0, total: TRIAL_SEEDS.length });
    onReport(null);
    try {
      const grid = gridFromCanvas(await mapCanvas(map), map.palette);
      const types = buildingTypes.filter((ty) => ty.core || fitsTheme(ty, map.theme));
      job.current = runMapTest(
        { map: { ...map, background: null }, grid, waves, enemyTypes, buildingTypes: types, rules, weapons: items, difficulty },
        (done, total) => setState({ running: true, done, total }),
      );
      const report = await job.current.promise;
      setState({ report });
      onReport(report);
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
          {state?.running ? `⏳ ${t('maptest.running', { done: state.done, total: state.total })}` : `▶ ${t('maptest.run')}`}
        </button>
      </div>
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
