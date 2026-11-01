import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal.jsx';
import { dspTable, wavesDsp, showDsp } from '../logic/dsp.js';
import { generateWaves, GEN_DEFAULTS } from '../logic/waveGen.js';
import { roundSummary } from '../logic/waves.js';

// "🎲 Generate waves" (SPEC §10b, logic/waveGen.js): the kid picks which
// monsters should come, how many rounds, how strong the first wave is (DSP)
// and how much stronger every next one gets; the preview shows the rounds
// before they replace the map's waves.
export default function WaveGenerator({ map, waves, enemyTypes, themes = [], balance, onGenerate, onCancel }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const table = useMemo(() => dspTable(enemyTypes), [enemyTypes]);
  const name = (id) => enemyTypes.find((e) => e.id === id)?.name?.[lang] ?? id;
  // start from the monsters the map has now (or its world's), the length it has, its first wave's strength
  const used = [...new Set(waves.rounds.flatMap((r) => r.groups.map((g) => g.enemy)))].filter((id) => table[id] > 0);
  const ofTheme = map.theme ? enemyTypes.filter((e) => e.themes?.includes(map.theme)).map((e) => e.id) : [];
  const [chosen, setChosen] = useState(() => new Set(used.length ? used : ofTheme.length ? ofTheme : enemyTypes.map((e) => e.id)));
  const [rounds, setRounds] = useState(waves.rounds.length || GEN_DEFAULTS.rounds);
  const firstNow = Math.round(wavesDsp({ rounds: waves.rounds.slice(0, 1) }, table, balance)[0]?.dsp ?? 0);
  const [first, setFirst] = useState(firstNow > 0 ? firstNow : GEN_DEFAULTS.first);
  const [growth, setGrowth] = useState(Math.round(GEN_DEFAULTS.growth * 100));
  const toggle = (id) => setChosen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const preview = useMemo(
    () => generateWaves({ enemies: [...chosen], rounds, first, growth: growth / 100, base: waves }, enemyTypes, balance),
    [chosen, rounds, first, growth, waves, enemyTypes, balance],
  );
  const strength = preview ? wavesDsp(preview, table, balance) : [];
  const sorted = [...enemyTypes].sort((a, b) => (table[a.id] ?? 0) - (table[b.id] ?? 0));
  const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || lo)));

  const go = () => {
    if (!preview) return;
    if (waves.rounds.length && !confirm(t('waves.gen_confirm'))) return;
    onGenerate(preview);
  };

  return (
    <Modal onClose={onCancel} wide
      header={<h2>🎲 {t('waves.gen_title')}</h2>}
      footer={
        <div className="row">
          {!preview && <span className="small error-text">{t('waves.gen_none')}</span>}
          <span className="spacer" />
          <button className="btn" onClick={onCancel}>{t('common.cancel')}</button>
          <button className="btn primary" onClick={go} disabled={!preview} data-testid="gen-go">✓ {t('waves.gen_go')}</button>
        </div>
      }>
      <p className="small muted" style={{ marginTop: 0 }}>{t('waves.gen_hint')}</p>
      <fieldset className="gen-enemies">
        <legend>{t('waves.gen_enemies')}</legend>
        {sorted.map((e) => (
          <label key={e.id} className={`btn chip ${chosen.has(e.id) ? 'active' : ''}`}>
            <input type="checkbox" checked={chosen.has(e.id)} onChange={() => toggle(e.id)} />
            {name(e.id)} <span className="small muted">⚡{showDsp(table[e.id] ?? 0)}</span>
            {e.themes?.length > 0 && <span className="small">{e.themes.map((id) => themes.find((th) => th.id === id)?.icon).join('')}</span>}
          </label>
        ))}
      </fieldset>
      <div className="row gen-numbers">
        <label>{t('waves.gen_rounds')} <input type="number" min={1} max={60} value={rounds} onChange={(e) => setRounds(num(e.target.value, 1, 60))} style={{ width: 64 }} /></label>
        <label>{t('waves.gen_first')} <input type="number" min={5} max={5000} value={first} onChange={(e) => setFirst(num(e.target.value, 5, 5000))} style={{ width: 80 }} /></label>
        <label>{t('waves.gen_growth')} <input type="number" min={0} max={60} value={growth} onChange={(e) => setGrowth(num(e.target.value, 0, 60))} style={{ width: 64 }} /> %</label>
        {preview && <span className="small muted">{t('waves.gen_preview', { first: showDsp(strength[0].dsp), n: strength.length, last: showDsp(strength.at(-1).dsp) })}</span>}
      </div>
      {preview && (
        <div className="gen-preview" tabIndex={0} role="region" aria-label={t('waves.gen_preview_label')}>
          <table className="wave-strength-table">
            <thead><tr><th scope="col">{t('waves.col_round')}</th><th scope="col">{t('waves.col_monsters')}</th><th scope="col">DSP</th></tr></thead>
            <tbody>
              {preview.rounds.map((r, i) => (
                <tr key={i}>
                  <th scope="row">{i + 1}</th>
                  <td className="small">{Object.entries(roundSummary(r)).map(([id, n]) => `${n}× ${name(id)}`).join(', ')}</td>
                  <td className="num">{showDsp(strength[i].dsp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
