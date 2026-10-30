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

function Bar({ frac, color, width }) {
  return <span className="hud-bar" style={width ? { width } : undefined}><span style={{ width: `${Math.round(frac * 100)}%`, background: color }} /></span>;
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
          <Bar frac={hp / maxHp} color="#16a34a" width="4.5em" />
        </>
      )}
    </div>
  );
});

export const WaveInfo = memo(function WaveInfo({ phase, round, totalRounds, prepLeft, earlyBonus, enemiesLeft, nextRound, nextCaves, caveCount, newThings, enemyTypes, typeName, onReady }) {
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
      {newThings.length > 0 && <div className="small">🎁 <b>{t('unlock.new')}</b> {newThings.map((k) => unlockLabel(k, t, typeName)).join(', ')}</div>}
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

// which equipment slot an item goes into
const slotFor = (w) => (isWeapon(w) ? 'right' : w?.slot === 'shield' ? 'left' : 'armor');
const SLOTS = [['right', '✋', 'weapons.right_hand'], ['left', SLOT_ICON.shield, 'weapons.left_hand'], ['armor', SLOT_ICON.armor, 'weapons.slot_armor']];

// Equipment: the strip above the attack buttons shows what is worn; it opens
// the backpack: three slots (right hand, left hand, armor) and the items. An
// item is dragged onto its slot (mouse or finger) – or tapped, then the slot
// tapped; a worn item dragged back into the backpack comes off. The hero's
// numbers under the slots change with every move.
export const Equipment = memo(function Equipment({ inventoryKey, right, left, armor, attack, reach, armorPct, items, assets, onEquipTo, onUnequip }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState(null); // { id, from, x, y } while dragging
  const [picked, setPicked] = useState(null); // { id, from } after a tap
  const lang = i18n.language;
  const byId = (id) => items.find((w) => w.id === id);
  const owned = inventoryKey ? inventoryKey.split(',').map(byId).filter(Boolean) : [];
  const worn = { right, left, armor };
  const twoHanded = byId(right)?.slot === 'twohand';
  const inBag = owned.filter((w) => w.id !== right && w.id !== left && w.id !== armor);
  const moving = drag ?? picked;
  const target = moving && moving.from === 'bag' ? slotFor(byId(moving.id)) : null;
  const name = (w) => w?.name?.[lang] ?? w?.id;

  const drop = (id, from, to) => {
    setPicked(null);
    if (!to || to === from) return;
    if (to === 'bag') onUnequip(from);
    else onEquipTo(id, to);
  };
  const tap = (id, from) => {
    if (picked && from !== 'bag' && picked.from === 'bag') return drop(picked.id, 'bag', from); // bag item → slot
    if (picked && picked.id === id) return setPicked(null);
    setPicked(id ? { id, from } : null);
  };
  // pointer drag that works with a finger too; a short press is a tap
  const startDrag = (e, id, from) => {
    if (!id || (e.button ?? 0) > 0) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const move = (ev) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return;
      moved = true;
      setDrag({ id, from, x: ev.clientX, y: ev.clientY });
    };
    const end = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      setDrag(null);
      if (ev.type === 'pointercancel') return;
      if (!moved) return tap(id, from);
      const to = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-drop]')?.dataset.drop;
      drop(id, from, to);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };
  const tapBag = () => { if (picked && picked.from !== 'bag') drop(picked.id, picked.from, 'bag'); };

  const slotBox = ([key, icon, label]) => {
    const id = key === 'left' && twoHanded ? null : worn[key];
    const w = byId(id);
    const cls = ['eq-big', target === key && 'drop-ok', target && target !== key && 'drop-no', picked?.from === key && 'picked'].filter(Boolean).join(' ');
    return (
      <div key={key} className={cls} data-drop={key} title={t(label)}
        onPointerDown={(e) => (w ? startDrag(e, id, key) : undefined)}
        onClick={() => (!w ? tap(null, key) : undefined)}>
        <span className="small muted eq-label">{t(label)}</span>
        {w ? <WeaponIcon weapon={w} assets={assets} size="2.4em" />
          : key === 'left' && twoHanded ? <span className="eq-empty">↔</span> : <span className="eq-empty muted">{icon}</span>}
        <span className="small eq-name">{w ? name(w) : key === 'left' && twoHanded ? t('weapons.two_hands') : '—'}</span>
      </div>
    );
  };

  const stripSlot = (key, id, icon, label) => (
    <button key={key} className="btn eq-slot" onClick={() => setOpen(!open)} title={label}>
      {id ? <WeaponIcon weapon={byId(id)} assets={assets} size="1.5em" /> : <span className="muted">{icon}</span>}
    </button>
  );

  return (
    <div className="ov ov-br-eq">
      {open && (
        <div className="backpack sketch-card" onPointerDown={(e) => e.stopPropagation()}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>🎒 {t('weapons.inventory')}</b>
            <button className="btn icon" onClick={() => { setOpen(false); setPicked(null); }} title={t('common.done')}>✕</button>
          </div>
          <div className="eq-slots">{SLOTS.map(slotBox)}</div>
          <div className="small eq-stats">
            {CLASS_ICON[isWeapon(byId(right)) ? byId(right).kind : 'melee']} {t('weapons.stat_attack', { v: attack })} · {t('weapons.stat_reach', { v: reach })} · 🛡️ {t('weapons.stat_armor', { v: armorPct })}
          </div>
          <div className={`eq-bag ${moving && moving.from !== 'bag' ? 'drop-ok' : ''}`} data-drop="bag" onClick={tapBag}>
            {!owned.length && <p className="small muted">{t('weapons.empty')}</p>}
            {owned.length > 0 && !inBag.length && <p className="small muted">{t('weapons.bag_empty')}</p>}
            {inBag.map((w) => (
              <div key={w.id} className={`eq-item ${picked?.id === w.id ? 'picked' : ''}`} onPointerDown={(e) => startDrag(e, w.id, 'bag')}
                onClick={(e) => e.stopPropagation()} title={itemLine(w, t)}>
                <WeaponIcon weapon={w} assets={assets} size="2em" />
                <span className="small eq-name">{name(w)}</span>
                <span className="small muted">{itemLine(w, t)}</span>
              </div>
            ))}
          </div>
          <p className="small muted" style={{ margin: '4px 0 0' }}>{t('weapons.drag_hint')}</p>
        </div>
      )}
      {drag && (
        <div className="eq-ghost" style={{ left: drag.x, top: drag.y }}>
          <WeaponIcon weapon={byId(drag.id)} assets={assets} size="2.4em" />
        </div>
      )}
      <div className="row eq-row">
        {stripSlot('right', right, '✋', t('weapons.right_hand'))}
        {twoHanded ? <span className="btn eq-slot muted" title={t('weapons.two_hands')}>↔</span> : stripSlot('left', left, SLOT_ICON.shield, t('weapons.left_hand'))}
        {stripSlot('armor', armor, SLOT_ICON.armor, t('weapons.slot_armor'))}
        <button className={`btn eq-slot ${open ? 'active' : ''}`} onClick={() => { setOpen(!open); setPicked(null); }} title={`${t('weapons.inventory')} (I)`}>
          🎒<span className="small">{inBag.length}</span>
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

export const Toolbar = memo(function Toolbar({ paused, speed, wobble, muted, tipsOn, onExit, onPause, onSpeed, onZoom, onWobble, onMute, onTips, onChronicle }) {
  const { t } = useTranslation();
  return (
    <div className="ov ov-bc toolbar sketch-card">
      <button className="btn icon" onClick={onExit} title={t('game.exit')}>✕</button>
      <button className={`btn icon ${paused ? 'active' : ''}`} onClick={onPause} title={t('game.pause')}>{paused ? '▶' : '⏸'}</button>
      <button className={`btn icon ${speed === 2 ? 'active' : ''}`} onClick={onSpeed} title={t('game.speed')}>{speed}×</button>
      <button className="btn icon narrow-hide" onClick={() => onZoom(1 / 1.25)} title={t('game.zoom_out')}>−</button>
      <button className="btn icon narrow-hide" onClick={() => onZoom(1.25)} title={t('game.zoom_in')}>+</button>
      <button className="btn icon" onClick={onChronicle} title={t('game.chronicle')}>📖</button>
      <button className={`btn icon ${tipsOn ? 'active' : ''}`} onClick={onTips} title={t(tipsOn ? 'tips.skip' : 'tips.restart')}>💡</button>
      <button className="btn icon" onClick={onMute} title={t(muted ? 'game.sound_on' : 'game.sound_off')}>{muted ? '🔇' : '🔊'}</button>
      <button className={`btn icon ${wobble ? 'active' : ''}`} onClick={onWobble} title={t('game.wobble')}>〰️</button>
      <button className="btn icon narrow-hide" title={t('game.hint')}>?</button>
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
