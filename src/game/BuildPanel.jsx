import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import WeaponIcon from './WeaponIcon.jsx';
import { itemLine } from './GameOverlay.jsx';
import { FEATURES } from '../config/features.js';

// Panel for the selected building spot or the Town Hall (SPEC §7). The Town
// Hall's shop (hero upgrades + items) opens as an overlay over the map with
// tiles as big as the backpack's; the game keeps running meanwhile.
// `info` comes from World.describeSpot / describeTownHall; every option carries a
// `reason` (null = allowed) so kids see *why* a button is disabled.
// One click builds or upgrades; only selling asks "Really?" first.
//
// The panel re-renders several times a second (HUD updates), so buttons are
// rendered by plain functions, never by components defined inside this one:
// a new component type on every render would remount the button between
// mouse-down and mouse-up and swallow the click.

function Bar({ frac, color }) {
  return <span className="hud-bar" style={{ width: 90 }}><span style={{ width: `${Math.round(frac * 100)}%`, background: color }} /></span>;
}

/** What one level of a building does, feature by feature: "🏹 arrow 9, range 180 … · 👷 +1 workers". */
export function featureLine(type, s, t) {
  if (!type || !s) return '';
  return (type.features ?? []).map((f) => `${FEATURES[f]?.icon ?? ''} ${t(`feature.line_${f}`, s)}`).join(' · ');
}

const STAT_ICON = { melee: '⚔️', ranged: '🏹', armor: '🛡️', speed: '👟' };

const iconOf = (type) => (type?.core ? '🏛️' : FEATURES[type?.features?.[0]]?.icon ?? '🏗️');

export default function BuildPanel({ info, types = [], weapons = [], assets = [], onClose, onBuild, onUpgrade, onSell, onUpgradeTownHall, onUpgradeHero, onBuyWeapon }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const why = (reason, round) => (reason ? t(`build.reason_${reason}`, { n: round }) : null);
  const [confirmSell, setConfirmSell] = useState(false);
  const [shop, setShop] = useState(false);
  const spotKey = info.kind === 'spot' ? info.id : 'th';
  useEffect(() => { setConfirmSell(false); setShop(false); }, [spotKey]);
  const typeOf = (id) => types.find((ty) => ty.id === id);
  const nameOf = (id) => typeOf(id)?.name?.[lang] ?? id;
  const statLine = (id, s) => featureLine(typeOf(id), s, t);

  const action = ({ key, label, cost, reason, round, onClick, sub }) => (
    <div className="build-option" key={key}>
      <button className="btn primary" disabled={!!reason} onClick={onClick}>
        {reason === 'locked' && '🔒 '}{label} <span className="small">· {cost} 🪙</span>
      </button>
      {sub && <div className="small muted">{sub}</div>}
      {reason && <div className={`small ${reason === 'locked' ? 'muted' : 'error-text'}`}>{why(reason, round)}</div>}
    </div>
  );

  let body, overlay = null;
  if (info.kind === 'townhall') {
    const weaponName = (id) => weapons.find((w) => w.id === id)?.name?.[lang] ?? id;
    overlay = shop && (
      <div className="shop-overlay sketch-card ov" onPointerDown={(e) => e.stopPropagation()}>
        <div className="row shop-head">
          <h3 style={{ margin: 0 }}>🛒 {t('shop.title')}</h3>
          <span className="hud-num">🪙 {info.coins}</span>
          <span className="spacer" />
          <button className="btn icon" onClick={() => setShop(false)} aria-label={t('common.done')}>✕</button>
        </div>
        {!info.near && <p className="small muted" style={{ margin: '2px 0' }}>🚶 {t('shop.go_to_hall')}</p>}
        <h4>🦸 {t('build.hero_upgrades')}</h4>
        <div className="eq-bag shop-grid">
          {info.heroUpgrades.map((u) => (
            <div key={u.stat} className="eq-item shop-tile">
              <span className="shop-icon">{STAT_ICON[u.stat]}</span>
              <span className="small eq-name">{t(`hero.stat_${u.stat}`)}</span>
              <span className="small">{'●'.repeat(u.level)}{'○'.repeat(u.maxLevel - u.level)}</span>
              {u.cost !== null ? (
                <button className="btn" disabled={!!u.reason} onClick={() => onUpgradeHero(u.stat)}>{u.reason === 'locked' ? '🔒 ' : ''}+1 · {u.cost} 🪙</button>
              ) : <span className="small muted">{t('build.max_level')}</span>}
              {u.reason && u.reason !== 'max' && <span className={`small ${u.reason === 'locked' ? 'muted' : 'error-text'}`}>{why(u.reason, u.round)}</span>}
            </div>
          ))}
        </div>
        {info.shop?.length > 0 && (
          <>
            <h4>⚔️ {t('weapons.shop')}</h4>
            <div className="eq-bag shop-grid">
              {info.shop.map((s) => {
                const w = weapons.find((x) => x.id === s.id) ?? {};
                return (
                  <div key={s.id} className={`eq-item shop-tile ${s.reason === 'owned' ? 'owned' : ''}`}>
                    <WeaponIcon weapon={w} assets={assets} size="2em" />
                    <span className="small eq-name">{weaponName(s.id)}</span>
                    <span className="small muted">{itemLine(w, t)}</span>
                    {s.reason === 'owned' ? <span className="small">✓ {t('weapons.owned')}</span> : (
                      <button className="btn" disabled={!!s.reason} onClick={() => onBuyWeapon(s.id)}>{s.reason === 'locked' ? '🔒 ' : ''}{s.price} 🪙</button>
                    )}
                    {s.reason && s.reason !== 'owned' && <span className={`small ${s.reason === 'locked' ? 'muted' : 'error-text'}`}>{why(s.reason, s.round)}</span>}
                  </div>
    );
                  })}
                </div>
              </>
            )}
          </div>
        );
    body = (
      <>
        <h3>🏛️ {nameOf(info.type)} · {t('build.level', { n: info.level, max: info.maxLevel })}</h3>
        <div className="row small"><Bar frac={info.hp / info.maxHp} color="#2563eb" /> {info.hp}/{info.maxHp}</div>
        {statLine(info.type, info.stats) && <p className="small muted" style={{ margin: '2px 0' }}>{statLine(info.type, info.stats)}</p>}
        {info.progress !== null && <div className="row small">🔨 <Bar frac={info.progress} color="#ca8a04" /></div>}
        {info.upgrade ? action({
          key: 'th', label: `⬆ ${t('build.upgrade_to', { n: info.upgrade.toLevel })}`, cost: info.upgrade.cost, reason: info.upgrade.reason,
          round: info.upgrade.round, sub: t('build.th_sub', { hp: info.upgrade.hp, n: info.upgrade.toLevel }), onClick: onUpgradeTownHall,
        }) : <p className="small muted">{t('build.max_level')}</p>}

        <button className="btn big-action" onClick={() => setShop(true)}>🛒 {t('shop.open')}</button>
      </>
    );
  } else {
    const b = info.building;
    body = (
      <>
        <h3>
          {b ? `${iconOf(typeOf(b.type))} ${nameOf(b.type)} · ${t('build.level', { n: b.level, max: b.maxLevel })}` : t('build.empty_spot', { n: info.index + 1 })}
        </h3>
        {b && b.state !== 'ruin' && <div className="row small"><Bar frac={b.hp / b.maxHp} color="#16a34a" /> {b.hp}/{b.maxHp}</div>}
        {b && b.progress !== null && <div className="row small">🔨 {t(b.state === 'building' ? 'build.building' : 'build.upgrading')} <Bar frac={b.progress} color="#ca8a04" /></div>}
        {b && b.stats && b.state !== 'ruin' && <p className="small muted" style={{ margin: '4px 0' }}>{statLine(b.type, b.stats)}</p>}
        {b && b.state === 'ruin' && <p className="small error-text">{t('build.ruin')}</p>}
        {info.options.map((o) => action({
          key: o.type, label: `${iconOf(typeOf(o.type))} ${o.rebuild ? t('build.rebuild') : nameOf(o.type)}`,
          cost: o.cost, reason: o.reason, round: o.round, sub: statLine(o.type, o.stats), onClick: () => onBuild(o.type),
        }))}
        {info.upgrade && action({
          key: 'up', label: `⬆ ${t('build.upgrade_to', { n: info.upgrade.toLevel })}`, cost: info.upgrade.cost, reason: info.upgrade.reason,
          round: info.upgrade.round, sub: statLine(b.type, info.upgrade.stats), onClick: onUpgrade,
        })}
        {b && !info.upgrade && b.state !== 'ruin' && b.level === b.maxLevel && <p className="small muted">{t('build.max_level')}</p>}
        {info.sell && (
          <div className="build-option" style={{ borderTop: '1.5px dashed var(--ink-soft)', paddingTop: 6 }}>
            {!confirmSell ? (
              <button className="btn" disabled={!!info.sell.reason} onClick={() => setConfirmSell(true)}>
                {b.state === 'ruin' ? `🧹 ${t('build.clear')}` : `💰 ${t('build.sell')} · +${info.sell.refund} 🪙`}
              </button>
            ) : (
              <span className="row" style={{ gap: 6 }}>
                <b className="small">{t('build.sell_sure')}</b>
                <button className="btn danger" onClick={() => { setConfirmSell(false); onSell(); }}>✓ {t('build.sell_yes')}</button>
                <button className="btn" onClick={() => setConfirmSell(false)}>✕</button>
              </span>
            )}
            {info.sell.reason && <div className="small error-text">{why(info.sell.reason)}</div>}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {overlay}
      <div className="build-panel sketch-card" onPointerDown={(e) => e.stopPropagation()}>
        <button className="btn icon" style={{ float: 'right' }} onClick={onClose} aria-label={t('common.cancel')}>✕</button>
        {body}
        {!info.near && <p className="small muted" style={{ marginTop: 6 }}>🚶 {t('build.walking')}</p>}
      </div>
    </>
  );
}
