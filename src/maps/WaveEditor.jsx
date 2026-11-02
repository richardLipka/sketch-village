import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Screen from '../ui/Screen.jsx';
import { wavesOf, defaultWaves } from '../config/waves.js';
import { roundSummary, roundDuration, roundReward, groupBoost, oneDecimal, BOOST_LIMITS } from '../logic/waves.js';
import { BALANCE } from '../config/balance.js';
import { themeName } from '../config/themes.js';
import MapTestPanel from './MapTestPanel.jsx';
import WaveStrength from './WaveStrength.jsx';
import { dspTable, roundDsp, showDsp } from '../logic/dsp.js';

// Wave editor for one map (SPEC §10): rounds → groups of enemies; each round can
// override its reward and the prep time before it. A group can be made stronger
// (attack and health in % of the monster's own numbers) and the whole plan can
// grow a few % every round – all against the same base (logic/waves.js); the
// numbers show with at most one decimal place. On a themed map the enemies
// of that theme are listed first. The strength table (WaveStrength, SPEC §10b)
// shows every round's DSP, generates waves and makes them all stronger or weaker;
// the robot (MapTestPanel) tries the waves and finds each one's limit.
export default function WaveEditor({ map, enemyTypes, themes = [], balance = BALANCE, buildingTypes, rules, items, onSave, onCancel }) {
  const { t, i18n } = useTranslation();
  const [waves, setWaves] = useState(() => structuredClone(wavesOf(map, balance)));
  const [open, setOpen] = useState(0);
  const [report, setReport] = useState(null); // the robot's last try (MapTestPanel)
  const [limits, setLimits] = useState(null); // the robot's limits per wave (MapTestPanel → WaveStrength)
  const table = useMemo(() => dspTable(enemyTypes), [enemyTypes]);
  const lang = i18n.language;
  const name = (id) => enemyTypes.find((e) => e.id === id)?.name?.[lang] ?? id;
  const theme = themes.find((th) => th.id === map.theme);
  const ofTheme = theme ? enemyTypes.filter((e) => e.themes?.includes(theme.id)) : [];
  const otherEnemies = enemyTypes.filter((e) => !ofTheme.includes(e));
  const enemyOptions = (
    <>
      {ofTheme.length > 0 && (
        <optgroup label={`${theme.icon} ${themeName(theme, lang)}`}>
          {ofTheme.map((et) => <option key={et.id} value={et.id}>{et.name?.[lang] ?? et.id}</option>)}
        </optgroup>
      )}
      {ofTheme.length > 0 ? (
        <optgroup label={t('themes.others')}>
          {otherEnemies.map((et) => <option key={et.id} value={et.id}>{et.name?.[lang] ?? et.id}</option>)}
        </optgroup>
      ) : otherEnemies.map((et) => <option key={et.id} value={et.id}>{et.name?.[lang] ?? et.id}</option>)}
    </>
  );

  const setTop = (k, v) => setWaves((w) => ({ ...w, [k]: v }));
  const setRounds = (fn) => setWaves((w) => ({ ...w, rounds: fn(w.rounds) }));
  // empty field = automatic value (key removed)
  const setRound = (ri, k, v) => setRounds((rs) => rs.map((r, i) => {
    if (i !== ri) return r;
    const { [k]: _old, ...rest } = r;
    return v === undefined ? rest : { ...rest, [k]: v };
  }));
  const setGroup = (ri, gi, patch) => setRounds((rs) => rs.map((r, i) => (i !== ri ? r : { ...r, groups: r.groups.map((g, j) => (j === gi ? { ...g, ...patch } : g)) })));
  const addGroup = (ri) => setRounds((rs) => rs.map((r, i) => (i !== ri ? r : { ...r, groups: [...r.groups, { enemy: (ofTheme[0] ?? enemyTypes[0]).id, count: 5, interval: 1.5, delay: 0, spawn: 'all' }] })));
  const delGroup = (ri, gi) => setRounds((rs) => rs.map((r, i) => (i !== ri ? r : { ...r, groups: r.groups.filter((_, j) => j !== gi) })));
  const addRound = () => { setRounds((rs) => [...rs, structuredClone(rs.at(-1) ?? { groups: [] })]); setOpen(waves.rounds.length); };
  const dupRound = (ri) => setRounds((rs) => [...rs.slice(0, ri + 1), structuredClone(rs[ri]), ...rs.slice(ri + 1)]);
  const delRound = (ri) => { if (waves.rounds.length > 1) setRounds((rs) => rs.filter((_, i) => i !== ri)); };
  const reset = () => { if (confirm(t('waves.confirm_reset'))) setWaves(defaultWaves(balance)); };

  const num = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0));
  const num1 = (v, min, max) => Math.round(num(v, min, max) * 10) / 10; // one decimal place
  // a group's own strength: 100 % (as the monster is drawn) is not stored
  const setPct = (ri, gi, k, v) => setRounds((rs) => rs.map((r, i) => (i !== ri ? r : {
    ...r,
    groups: r.groups.map((g, j) => {
      if (j !== gi) return g;
      const { [k]: _old, ...rest } = g;
      const pct = v === '' ? 100 : num1(v, ...BOOST_LIMITS.group);
      return pct === 100 ? rest : { ...rest, [k]: pct };
    }),
  })));
  const growth = waves.growth ?? 0;
  const total = waves.rounds.reduce((s, r) => s + r.groups.reduce((a, g) => a + (g.count ?? 0), 0), 0);

  return (
    <Screen title={t('waves.title', { map: map.name })} head={
      <div className="row">
        <label>{t('waves.start_coins')} <input type="number" min={0} max={999} value={waves.startCoins} onChange={(e) => setTop('startCoins', num(e.target.value, 0, 999))} style={{ width: 70 }} /></label>
        <label>{t('waves.first_prep')} <input type="number" min={5} max={300} value={waves.firstPrep} onChange={(e) => setTop('firstPrep', num(e.target.value, 5, 300))} style={{ width: 60 }} /></label>
        <label>{t('waves.prep')} <input type="number" min={3} max={300} value={waves.prep} onChange={(e) => setTop('prep', num(e.target.value, 3, 300))} style={{ width: 60 }} /></label>
        <label title={t('waves.growth_hint')}>📈 {t('waves.growth')}{' '}
          <input type="number" min={BOOST_LIMITS.growth[0]} max={BOOST_LIMITS.growth[1]} step={0.1} value={oneDecimal(growth)} data-testid="wave-growth"
            onChange={(e) => setTop('growth', num1(e.target.value, ...BOOST_LIMITS.growth))} style={{ width: 60 }} /> %
        </label>
        <span className="muted small">{t('waves.total', { rounds: waves.rounds.length, enemies: total })}</span>
        <span className="spacer" />
        <button className="btn" onClick={reset}>↺ {t('waves.reset')}</button>
        <button className="btn" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="btn primary" onClick={() => onSave(waves)}>✓ {t('common.save')}</button>
      </div>
    }>

      {buildingTypes && rules && (
        <MapTestPanel map={map} waves={waves} enemyTypes={enemyTypes} buildingTypes={buildingTypes} rules={rules} items={items} onReport={setReport} onLimits={setLimits} />
      )}

      <WaveStrength map={map} waves={waves} enemyTypes={enemyTypes} themes={themes} balance={balance} limits={limits}
        onWaves={(next) => { setWaves(next); setLimits(null); setReport(null); }} />

      {waves.rounds.map((r, ri) => {
        const tried = report?.rounds[ri];
        const sum = Object.entries(roundSummary(r)).map(([id, n]) => `${n}× ${name(id)}`).join(', ');
        return (
          <div key={ri} className="sketch-card" style={{ padding: 10, marginBottom: 8 }}>
            <div className="row" onClick={() => setOpen(open === ri ? -1 : ri)} style={{ cursor: 'pointer' }}>
              <button type="button" className="tile-open round-toggle" aria-expanded={open === ri}><b>{open === ri ? '▾' : '▸'} {t('waves.round', { n: ri + 1 })}</b></button>
              <span className="small muted">{sum || t('waves.empty')} · ⚡{showDsp(roundDsp(r, ri, table, balance, growth))} DSP · ~{Math.ceil(roundDuration(r))} s · +{r.reward ?? roundReward(balance, ri)} 🪙{growth > 0 && ri > 0 ? ` · 📈 +${oneDecimal(growth * ri)} %` : ''}</span>
              {tried && (
                <span className={`round-test ${tried.flags.length ? 'flagged' : ''}`} title={t('maptest.title')}>
                  🤖 {tried.length} s{tried.lost > 0 ? ` 🏚 ${tried.lost}` : ''}{tried.flags.map((f) => ` · ${t(`maptest.flag_${f}`)}`).join('')}
                </span>
              )}
              <span className="spacer" />
              <button className="btn icon" onClick={(e) => { e.stopPropagation(); dupRound(ri); }} title={t('studio.duplicate')} aria-label={t('studio.duplicate')}>⧉</button>
              <button className="btn icon danger" onClick={(e) => { e.stopPropagation(); delRound(ri); }} title={t('common.delete')} aria-label={t('common.delete')} disabled={waves.rounds.length < 2}>🗑</button>
            </div>
            {open === ri && (
              <div style={{ marginTop: 8 }}>
                <div className="row small" style={{ gap: 14, marginBottom: 8 }}>
                  <label>{t('waves.reward')}{' '}
                    <input type="number" min={0} max={999} value={r.reward ?? ''} placeholder={String(roundReward(balance, ri))} style={{ width: 60 }}
                      onChange={(e) => setRound(ri, 'reward', e.target.value === '' ? undefined : num(e.target.value, 0, 999))} />
                  </label>
                  {ri > 0 && (
                    <label>{t('waves.round_prep')}{' '}
                      <input type="number" min={3} max={300} value={r.prep ?? ''} placeholder={String(waves.prep)} style={{ width: 60 }}
                        onChange={(e) => setRound(ri, 'prep', e.target.value === '' ? undefined : num(e.target.value, 3, 300))} />
                    </label>
                  )}
                  <span className="muted">{t('waves.empty_auto')}</span>
                </div>
                {r.groups.map((g, gi) => (
                  <div key={gi} className="row small" style={{ gap: 10, marginBottom: 6 }}>
                    <select value={g.enemy} onChange={(e) => setGroup(ri, gi, { enemy: e.target.value })} aria-label={t('waves.enemy')}>
                      {enemyOptions}
                    </select>
                    <label>{t('waves.count')} <input type="number" min={1} max={100} value={g.count} onChange={(e) => setGroup(ri, gi, { count: num(e.target.value, 1, 100) })} style={{ width: 55 }} /></label>
                    <label>{t('waves.interval')} <input type="number" min={0.2} max={20} step={0.1} value={g.interval} onChange={(e) => setGroup(ri, gi, { interval: num(e.target.value, 0.2, 20) })} style={{ width: 55 }} /></label>
                    <label>{t('waves.delay')} <input type="number" min={0} max={120} value={g.delay ?? 0} onChange={(e) => setGroup(ri, gi, { delay: num(e.target.value, 0, 120) })} style={{ width: 55 }} /></label>
                    <label>{t('waves.cave')}
                      <select value={g.spawn ?? 'all'} onChange={(e) => setGroup(ri, gi, { spawn: e.target.value })}>
                        <option value="all">{t('waves.all_caves')}</option>
                        {map.caves.map((c, i) => <option key={c.id} value={c.id}>{t('waves.cave_n', { n: i + 1 })}</option>)}
                      </select>
                    </label>
                    {['attack', 'hp'].map((k) => (
                      <label key={k} title={t('waves.pct_hint')}>{t(`waves.pct_${k}`)}{' '}
                        <input type="number" min={BOOST_LIMITS.group[0]} max={BOOST_LIMITS.group[1]} step={0.1} value={oneDecimal(g[k] ?? 100)} data-testid={`group-${k}`}
                          onChange={(e) => setPct(ri, gi, k, e.target.value)} style={{ width: 62 }} /> %
                      </label>
                    ))}
                    {(() => {
                      // what the monsters of this group really get in this round (own % + growth)
                      const b = groupBoost(g, ri, growth);
                      return b.hp === 1 && b.attack === 1 ? null : (
                        <span className="muted" data-testid="group-boost">= {t('waves.boost_now', { attack: oneDecimal(b.attack * 100), hp: oneDecimal(b.hp * 100) })}</span>
                      );
                    })()}
                    <button className="btn icon danger" onClick={() => delGroup(ri, gi)} title={t('common.delete')} aria-label={t('common.delete')}>✕</button>
                  </div>
                ))}
                <button className="btn" onClick={() => addGroup(ri)}>+ {t('waves.add_group')}</button>
              </div>
            )}
          </div>
        );
      })}
      <button className="btn" onClick={addRound}>+ {t('waves.add_round')}</button>
    </Screen>
  );
}
