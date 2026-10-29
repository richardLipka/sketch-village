import React, { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { roundSummary } from '../logic/waves.js';
import { unlockLabel } from '../config/unlocks.js';
import { WEAPON_CLASSES, isWeapon } from '../config/weapons.js';
import WeaponIcon, { CLASS_ICON, SLOT_ICON } from './WeaponIcon.jsx';
import FullscreenButton from '../ui/FullscreenButton.jsx';

// The game's on-screen controls, laid over the map in its corners:
//   top left: coins, workers, Town Hall · top centre: hero lives · top right: wave
//   bottom right: attack types, equipment above them · bottom centre: tools, tips
// Every piece is memoized and gets only primitive props (or stable callbacks /
// lists), so a HUD change re-renders just the pieces that show it.

function Bar({ frac, color, width = 70 }) {
  return <span className="hud-bar" style={{ width }}><span style={{ width: `${Math.round(frac * 100)}%`, background: color }} /></span>;
}

export const Resources = memo(function Resources({ coins, workers, thHp, thMax, thLevel }) {
  const { t } = useTranslation();
  return (
    <div className="ov ov-tl sketch-card">
      <span className="hud-num" title={t('game.coins')}>🪙 {coins}</span>
      <span className="hud-num" title={t('build.workers_hint')}>👷 {workers}</span>
      <span className="hud-num" title={t('game.town_hall')}>🏛️{thLevel} <Bar frac={thHp / thMax} color="#2563eb" /></span>
    </div>
  );
});

export const Lives = memo(function Lives({ lives, maxLives, hp, maxHp, dead, respawnIn }) {
  const { t } = useTranslation();
  return (
    <div className="ov ov-tc sketch-card" title={t('game.lives')}>
      {dead ? <b>⏳ {t('game.respawn_in', { s: respawnIn })}</b> : (
        <>
          <span className="hearts">{'♥'.repeat(lives)}{'♡'.repeat(Math.max(0, maxLives - lives))}</span>
          <Bar frac={hp / maxHp} color="#16a34a" width={90} />
        </>
      )}
    </div>
  );
});

export const WaveInfo = memo(function WaveInfo({ phase, round, totalRounds, prepLeft, earlyBonus, enemiesLeft, nextRound, nextCaves, caveCount, newThings, enemyTypes, onReady }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const preview = nextRound ? Object.entries(roundSummary(nextRound)) : [];
  const name = (id) => enemyTypes.find((e) => e.id === id)?.name?.[lang] ?? id;
  const flyingNext = preview.some(([id]) => enemyTypes.find((e) => e.id === id)?.flying);
  return (
    <div className="ov ov-tr sketch-card">
      <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
        <b>{t('game.round', { n: round, total: totalRounds })}</b>
        {phase === 'prep' && <span>{t('game.next_in', { s: prepLeft })}</span>}
        {phase === 'wave' && <span>{t('game.enemies_left', { n: enemiesLeft })}</span>}
      </div>
      {phase === 'prep' && (
        <button className="btn primary" onClick={onReady} title={t('game.ready_hint')} style={{ marginTop: 4 }}>
          ⚑ {t('game.ready')}{earlyBonus > 0 && ` (+${earlyBonus} 🪙)`}
        </button>
      )}
      {newThings.length > 0 && <div className="small">🎁 <b>{t('unlock.new')}</b> {newThings.map((k) => unlockLabel(k, t)).join(', ')}</div>}
      {preview.length > 0 && (
        <div className="small">
          {t('game.coming')}: {preview.map(([id, n]) => `${n}× ${name(id)}`).join(', ')}
          {nextCaves?.length > 0 && <span className="muted"> · {nextCaves.length === caveCount && caveCount > 1 ? t('game.from_all_caves') : t('game.from_caves', { list: nextCaves.join(', ') })}</span>}
          {flyingNext && <b style={{ color: 'var(--danger)' }}> · {t('game.flying_tip')}</b>}
        </div>
      )}
    </div>
  );
});

// Attack types: each button takes a weapon of that class into the hand (2 s).
export const AttackBar = memo(function AttackBar({ mode, hasMelee, hasRanged, hasMagic, switching, onMode }) {
  const { t } = useTranslation();
  const has = { melee: hasMelee, ranged: hasRanged, magic: hasMagic };
  return (
    <div className="ov ov-br attack-bar">
      {WEAPON_CLASSES.map((k, i) => (
        <button key={k} className={`btn attack ${mode === k ? 'active' : ''}`} disabled={!has[k]} onClick={() => onMode(k)}
          title={has[k] ? `${t(`weapons.class_${k}`)} (${i + 1})` : t(`weapons.need_${k}`)}>
          {CLASS_ICON[k]}
          {mode === k && switching > 0 && <span className="switching" style={{ width: `${(switching / 2) * 100}%` }} />}
        </button>
      ))}
    </div>
  );
});

// Equipment: right hand, left hand (shield) and armor; the backpack lists every
// item and one click puts it on.
export const Equipment = memo(function Equipment({ inventoryKey, right, left, armor, items, assets, onEquip }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(null); // null | 'all' | 'weapon' | 'shield' | 'armor'
  const lang = i18n.language;
  const byId = (id) => items.find((w) => w.id === id);
  const owned = inventoryKey ? inventoryKey.split(',').map(byId).filter(Boolean) : [];
  const twoHanded = byId(right)?.slot === 'twohand';
  const shown = owned.filter((w) => open === 'all' || (open === 'weapon' ? isWeapon(w) : w.slot === open));
  const worn = (w) => w.id === right || w.id === left || w.id === armor;

  const slot = (key, id, icon, label) => (
    <button key={key} className={`btn eq-slot ${open === key ? 'active' : ''}`} onClick={() => setOpen(open === key ? null : key)} title={label}>
      {id ? <WeaponIcon weapon={byId(id)} assets={assets} size={30} /> : <span className="muted">{icon}</span>}
    </button>
  );

  return (
    <div className="ov ov-br-eq">
      {open && (
        <div className="backpack sketch-card" onPointerDown={(e) => e.stopPropagation()}>
          <b>🎒 {t('weapons.inventory')}</b>
          {!shown.length && <p className="small muted">{t('weapons.empty')}</p>}
          {shown.map((w) => (
            <button key={w.id} className={`btn weapon-row ${worn(w) ? 'active' : ''}`} onClick={() => onEquip(w.id)}
              disabled={w.slot === 'shield' && twoHanded}>
              <WeaponIcon weapon={w} assets={assets} size={26} />
              <span>{w.name?.[lang] ?? w.id}</span>
              <span className="small muted">{itemLine(w, t)}</span>
              {worn(w) && <span className="small">✓</span>}
            </button>
          ))}
        </div>
      )}
      <div className="row eq-row">
        {slot('weapon', right, '✋', t('weapons.right_hand'))}
        {twoHanded ? <span className="btn eq-slot muted" title={t('weapons.two_hands')}>↔</span> : slot('shield', left, SLOT_ICON.shield, t('weapons.left_hand'))}
        {slot('armor', armor, SLOT_ICON.armor, t('weapons.slot_armor'))}
        <button className={`btn eq-slot ${open === 'all' ? 'active' : ''}`} onClick={() => setOpen(open === 'all' ? null : 'all')} title={`${t('weapons.inventory')} (I)`}>
          🎒<span className="small">{owned.length}</span>
        </button>
      </div>
    </div>
  );
});

/** "⚔️ one hand · +6 attack" / "🛡️ +8 % armor" */
export function itemLine(w, t) {
  const sign = (v) => (v > 0 ? `+${v}` : `${v}`);
  if (!isWeapon(w)) return t('weapons.s_armor', { v: Math.round((w.armor ?? 0) * 100) });
  return [
    t(w.slot === 'twohand' ? 'weapons.two_hands' : 'weapons.one_hand'),
    w.damage ? t('weapons.s_damage', { v: sign(w.damage) }) : null,
    w.range ? t('weapons.s_range', { v: sign(w.range) }) : null,
    w.cooldown ? t('weapons.s_cooldown', { v: sign(w.cooldown) }) : null,
    w.kind === 'magic' && w.splash ? t('weapons.s_splash', { v: w.splash }) : null,
  ].filter(Boolean).join(' · ');
}

export const Toolbar = memo(function Toolbar({ paused, speed, wobble, muted, tipsOn, onExit, onPause, onSpeed, onZoom, onWobble, onMute, onTips }) {
  const { t } = useTranslation();
  return (
    <div className="ov ov-bc toolbar sketch-card">
      <button className="btn icon" onClick={onExit} title={t('game.exit')}>✕</button>
      <button className={`btn icon ${paused ? 'active' : ''}`} onClick={onPause} title={t('game.pause')}>{paused ? '▶' : '⏸'}</button>
      <button className={`btn icon ${speed === 2 ? 'active' : ''}`} onClick={onSpeed} title={t('game.speed')}>{speed}×</button>
      <button className="btn icon" onClick={() => onZoom(1 / 1.25)} title={t('game.zoom_out')}>−</button>
      <button className="btn icon" onClick={() => onZoom(1.25)} title={t('game.zoom_in')}>+</button>
      <button className={`btn icon ${tipsOn ? 'active' : ''}`} onClick={onTips} title={t(tipsOn ? 'tips.skip' : 'tips.restart')}>💡</button>
      <button className="btn icon" onClick={onMute} title={t(muted ? 'game.sound_on' : 'game.sound_off')}>{muted ? '🔇' : '🔊'}</button>
      <button className={`btn icon ${wobble ? 'active' : ''}`} onClick={onWobble} title={t('game.wobble')}>〰️</button>
      <button className="btn icon" title={t('game.hint')}>?</button>
      <FullscreenButton />
    </div>
  );
});

export const Coach = memo(function Coach({ text, index, total, onSkip }) {
  const { t } = useTranslation();
  return (
    <div className="coach sketch-card" key={index}>
      <span className="coach-icon">💡</span>
      <span>{text}</span>
      <span className="small muted coach-count">{index + 1}/{total}</span>
      <button className="btn icon" onClick={onSkip} title={t('tips.skip')}>✕</button>
    </div>
  );
});
