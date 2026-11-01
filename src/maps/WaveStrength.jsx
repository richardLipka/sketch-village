import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dspTable, wavesDsp, showDsp } from '../logic/dsp.js';
import { scaleWaves } from '../logic/waveGen.js';
import { roundSummary } from '../logic/waves.js';
import { BALANCE } from '../config/balance.js';
import WaveGenerator from './WaveGenerator.jsx';

// "📈 Wave strength" in the wave editor (SPEC §10b): a table of every round's
// DSP (logic/dsp.js) – how much stronger than the round before – and, after the
// robot looked for them (MapTestPanel → Find the limits), how much stronger
// each wave may get before the robot is consistently defeated. All waves can
// be made stronger or weaker by a share (monsters of the same kinds added or
// removed), or generated anew (WaveGenerator).
export default function WaveStrength({ map, waves, enemyTypes, themes, balance = BALANCE, limits, onWaves }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const table = useMemo(() => dspTable(enemyTypes), [enemyTypes]);
  const rows = wavesDsp(waves, table, balance);
  const most = Math.max(1, ...rows.map((r) => Math.max(r.dsp, limits?.rounds.find((l) => l.round === r.round)?.limitDsp ?? 0)));
  const [pct, setPct] = useState(10);
  const [generating, setGenerating] = useState(false);
  const name = (id) => enemyTypes.find((e) => e.id === id)?.name?.[lang] ?? id;
  const change = (c) => (c === null ? '' : `${c >= 0 ? '+' : '−'}${Math.abs(Math.round(c * 100))} %`);
  const scale = (sign) => onWaves(scaleWaves(waves, 1 + sign * Math.max(1, Math.min(90, pct)) / 100, enemyTypes));
  const total = rows.reduce((a, r) => a + r.dsp, 0);

  return (
    <section className="sketch-card wave-strength" aria-labelledby="wave-strength-title">
      <div className="row">
        <h3 id="wave-strength-title" style={{ margin: 0 }}>📈 {t('waves.strength_title')}</h3>
        <span className="small muted">{t('waves.strength_hint')}</span>
        <span className="spacer" />
        <button className="btn" onClick={() => setGenerating(true)} data-testid="waves-generate">🎲 {t('waves.generate')}</button>
      </div>
      <div className="row wave-scale" role="group" aria-label={t('waves.scale_label')}>
        <span className="small">{t('waves.scale_label')}:</span>
        <button className="btn" onClick={() => scale(-1)} data-testid="waves-weaker">− {t('waves.weaker')}</button>
        <label className="small">
          <input type="number" min={1} max={90} value={pct} onChange={(e) => setPct(Math.max(1, Math.min(90, Number(e.target.value) || 1)))} style={{ width: 56 }} aria-label={t('waves.scale_pct')} /> %
        </label>
        <button className="btn" onClick={() => scale(1)} data-testid="waves-stronger">+ {t('waves.stronger')}</button>
        <span className="small muted">{t('waves.scale_hint')}</span>
      </div>
      <div className="wave-strength-scroll" tabIndex={0} role="region" aria-label={t('waves.strength_title')}>
        <table className="wave-strength-table">
          <thead>
            <tr>
              <th scope="col">{t('waves.col_round')}</th>
              <th scope="col">{t('waves.col_monsters')}</th>
              <th scope="col" title={t('waves.dsp_title')}>DSP</th>
              <th scope="col">{t('waves.col_change')}</th>
              <th scope="col">{t('waves.col_limit')}</th>
              <th scope="col" aria-hidden="true" className="strength-bar-col" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const l = limits?.rounds.find((x) => x.round === r.round);
              const monsters = Object.entries(roundSummary(waves.rounds[i])).map(([id, n]) => `${n}× ${name(id)}`).join(', ');
              return (
                <tr key={r.round} data-round={r.round} className={l ? `limit-${l.status}` : undefined}>
                  <th scope="row">{r.round}</th>
                  <td className="small">{monsters || '—'}</td>
                  <td className="num">{showDsp(r.dsp)}</td>
                  <td className={`num ${r.change !== null && r.change < 0 ? 'error-text' : ''}`}>{change(r.change)}</td>
                  <td className="small">{l ? limitText(l, t) : <span className="muted">–</span>}</td>
                  <td className="strength-bar-col" aria-hidden="true">
                    <span className="strength-bar"><span style={{ width: `${(r.dsp / most) * 100}%` }} />
                      {l?.limitDsp && <span className="strength-limit" style={{ left: `${Math.min(100, (l.limitDsp / most) * 100)}%` }} />}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr><th scope="row" colSpan={2}>{t('waves.strength_total')}</th><td className="num">{showDsp(total)}</td><td colSpan={3} /></tr>
          </tfoot>
        </table>
      </div>
      {generating && (
        <WaveGenerator map={map} waves={waves} enemyTypes={enemyTypes} themes={themes} balance={balance}
          onCancel={() => setGenerating(false)} onGenerate={(w) => { setGenerating(false); onWaves(w); }} />
      )}
    </section>
  );
}

/** "falls at ×2.4 (612 DSP)" / "holds even ×8" / "falls already now" / "not reached". */
export function limitText(l, t) {
  if (l.status === 'not_reached') return t('waves.limit_not_reached');
  if (l.status === 'strong') return t('waves.limit_strong');
  if (l.status === 'too_hard') return t('waves.limit_too_hard', { x: l.limit, holds: l.holds ?? '<0.25' });
  return t('waves.limit_at', { x: l.limit, dsp: showDsp(l.limitDsp) });
}
