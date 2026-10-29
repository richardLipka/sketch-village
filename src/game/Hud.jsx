import React from 'react';
import { useTranslation } from 'react-i18next';
import { roundSummary } from '../logic/waves.js';

// Top bar: round, countdown + Ready, coins, Town Hall HP, hero lives, melee/ranged.
export default function Hud({ hud, onReady, onMode, enemyName, enemyTypes }) {
  const { t } = useTranslation();
  const { hero, townHall } = hud;
  const thPct = Math.round((townHall.hp / townHall.maxHp) * 100);
  const preview = hud.nextRound ? Object.entries(roundSummary(hud.nextRound)) : [];
  const flyingNext = preview.some(([id]) => enemyTypes.find((e) => e.id === id)?.flying);

  return (
    <div className="hud sketch-card">
      <div className="row" style={{ gap: 16 }}>
        <span><b>{t('game.round', { n: hud.round, total: hud.totalRounds })}</b></span>
        {hud.phase === 'prep' && (
          <>
            <span>{t('game.next_in', { s: Math.ceil(hud.prepLeft) })}</span>
            <button className="btn primary" onClick={onReady} title={t('game.ready_hint')}>
              ⚑ {t('game.ready')}{hud.earlyBonus > 0 && ` (+${hud.earlyBonus} 🪙)`}
            </button>
          </>
        )}
        {hud.phase === 'wave' && <span>{t('game.enemies_left', { n: hud.enemiesLeft })}</span>}
        <span className="spacer" />
        <span title={t('game.coins')} className="hud-num">🪙 {hud.coins}</span>
        <span title={t('build.workers_hint')} className="hud-num">👷 {hud.workers}</span>
        <span title={t('game.town_hall')} className="hud-num">
          🏛️ <span className="hud-bar"><span style={{ width: `${thPct}%`, background: '#2563eb' }} /></span> {townHall.hp}
        </span>
        <span title={t('game.lives')} className="hud-num" style={{ color: '#dc2626', letterSpacing: 1 }}>
          {hero.dead ? `⏳ ${Math.ceil(hero.respawnIn)} s` : '♥'.repeat(hero.lives) + '♡'.repeat(Math.max(0, 5 - hero.lives))}
        </span>
        <span className="row" style={{ gap: 4 }}>
          <button className={`btn icon ${hero.mode === 'melee' ? 'active' : ''}`} onClick={() => onMode('melee')} title={`${t('hero.stat_melee')} (1)`}>⚔️</button>
          <button className={`btn icon ${hero.mode === 'ranged' ? 'active' : ''}`} onClick={() => onMode('ranged')} title={`${t('hero.stat_ranged')} (2)`}>🏹</button>
        </span>
      </div>
      {preview.length > 0 && (
        <div className="small" style={{ marginTop: 4 }}>
          {t('game.coming')}: {preview.map(([id, n]) => `${n}× ${enemyName(id)}`).join(', ')}
          {flyingNext && <b style={{ color: 'var(--danger)' }}> · {t('game.flying_tip')}</b>}
        </div>
      )}
    </div>
  );
}
