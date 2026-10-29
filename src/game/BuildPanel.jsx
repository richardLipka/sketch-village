import React from 'react';
import { useTranslation } from 'react-i18next';
import WeaponIcon from './WeaponIcon.jsx';

// Panel for the selected building spot or the Town Hall (SPEC §7).
// `info` comes from World.describeSpot / describeTownHall; every option carries a
// `reason` (null = allowed) so kids see *why* a button is disabled.
// One click does the action – no confirmations.
//
// The panel re-renders several times a second (HUD updates), so buttons are
// rendered by plain functions, never by components defined inside this one:
// a new component type on every render would remount the button between
// mouse-down and mouse-up and swallow the click.

const ICON = { house: '🏠', tower: '🗼', castle: '🏰' };

function Bar({ frac, color }) {
  return <span className="hud-bar" style={{ width: 90 }}><span style={{ width: `${Math.round(frac * 100)}%`, background: color }} /></span>;
}

export default function BuildPanel({ info, soldierMax = 3, weapons = [], assets = [], onClose, onBuild, onUpgrade, onSell, onUpgradeTownHall, onUpgradeHero, onBuyWeapon }) {
  const { t, i18n } = useTranslation();
  const why = (reason, round) => (reason ? t(`build.reason_${reason}`, { n: round }) : null);

  const statLine = (type, s) => {
    if (!s) return '';
    if (type === 'house') return t('build.stat_house', { n: s.workers });
    if (type === 'tower' || type === 'townhall') return t('build.stat_tower', { dmg: s.damage, range: s.range, cd: s.cooldown });
    if (type === 'castle') return t('build.stat_castle', { n: soldierMax, hp: s.soldierHp, dmg: s.soldierDamage });
    return '';
  };

  const action = ({ key, label, cost, reason, round, onClick, sub }) => (
    <div className="build-option" key={key}>
      <button className="btn primary" disabled={!!reason} onClick={onClick}>
        {reason === 'locked' && '🔒 '}{label} <span className="small">· {cost} 🪙</span>
      </button>
      {sub && <div className="small muted">{sub}</div>}
      {reason && <div className={`small ${reason === 'locked' ? 'muted' : 'error-text'}`}>{why(reason, round)}</div>}
    </div>
  );

  let body;
  if (info.kind === 'townhall') {
    const weaponName = (id) => weapons.find((w) => w.id === id)?.name?.[i18n.language] ?? id;
    body = (
      <>
        <h3>🏛️ {t('build.townhall', { n: info.level })}</h3>
        <div className="row small"><Bar frac={info.hp / info.maxHp} color="#2563eb" /> {info.hp}/{info.maxHp}</div>
        {info.arrows?.damage > 0 && <p className="small muted" style={{ margin: '2px 0' }}>🏹 {statLine('townhall', info.arrows)} · ❤️ {t('build.th_heals')}</p>}
        {info.progress !== null && <div className="row small">🔨 <Bar frac={info.progress} color="#ca8a04" /></div>}
        {info.upgrade ? action({
          key: 'th', label: `⬆ ${t('build.upgrade_to', { n: info.upgrade.toLevel })}`, cost: info.upgrade.cost, reason: info.upgrade.reason,
          round: info.upgrade.round, sub: t('build.th_sub', { hp: info.upgrade.hp, n: info.upgrade.toLevel }), onClick: onUpgradeTownHall,
        }) : <p className="small muted">{t('build.max_level')}</p>}

        <h3 style={{ marginTop: 10 }}>{t('build.hero_upgrades')}</h3>
        {info.heroUpgrades.map((u) => (
          <div key={u.stat} className="row small" style={{ gap: 8, marginBottom: 4 }}>
            <span style={{ minWidth: 92 }}>{t(`hero.stat_${u.stat}`)}</span>
            <span>{'●'.repeat(u.level)}{'○'.repeat(u.maxLevel - u.level)}</span>
            {u.cost !== null ? (
              <button className="btn icon" disabled={!!u.reason} onClick={() => onUpgradeHero(u.stat)} title={why(u.reason, u.round) ?? ''}>{u.reason === 'locked' ? '🔒 ' : ''}+1 · {u.cost} 🪙</button>
            ) : <span className="muted">{t('build.max_level')}</span>}
            {u.reason && u.reason !== 'max' && <span className={u.reason === 'locked' ? 'muted' : 'error-text'}>{why(u.reason, u.round)}</span>}
          </div>
        ))}

        {info.shop?.length > 0 && (
          <>
            <h3 style={{ marginTop: 10 }}>🛒 {t('weapons.shop')}</h3>
            {info.shop.map((s) => (
              <div key={s.id} className="row small" style={{ gap: 8, marginBottom: 4 }}>
                <WeaponIcon weapon={weapons.find((w) => w.id === s.id)} assets={assets} size={28} />
                <span style={{ minWidth: 110 }}>{weaponName(s.id)}</span>
                {s.reason === 'owned' ? <span className="muted">✓ {t('weapons.owned')}</span> : (
                  <button className="btn icon" disabled={!!s.reason} onClick={() => onBuyWeapon(s.id)} title={why(s.reason, s.round) ?? ''}>
                    {s.reason === 'locked' ? '🔒 ' : ''}{s.price} 🪙
                  </button>
                )}
                {s.reason && s.reason !== 'owned' && <span className={s.reason === 'locked' ? 'muted' : 'error-text'}>{why(s.reason, s.round)}</span>}
              </div>
            ))}
          </>
        )}
      </>
    );
  } else {
    const b = info.building;
    body = (
      <>
        <h3>
          {b ? `${ICON[b.type]} ${t(`build.type_${b.type}`)} · ${t('build.level', { n: b.level, max: b.maxLevel })}` : t('build.empty_spot', { n: info.index + 1 })}
        </h3>
        {b && b.state !== 'ruin' && <div className="row small"><Bar frac={b.hp / b.maxHp} color="#16a34a" /> {b.hp}/{b.maxHp}</div>}
        {b && b.progress !== null && <div className="row small">🔨 {t(b.state === 'building' ? 'build.building' : 'build.upgrading')} <Bar frac={b.progress} color="#ca8a04" /></div>}
        {b && b.stats && b.state !== 'ruin' && <p className="small muted" style={{ margin: '4px 0' }}>{statLine(b.type, b.stats)}</p>}
        {b && b.state === 'ruin' && <p className="small error-text">{t('build.ruin')}</p>}
        {info.options.map((o) => action({
          key: o.type, label: `${ICON[o.type]} ${o.rebuild ? t('build.rebuild') : t(`build.type_${o.type}`)}`,
          cost: o.cost, reason: o.reason, round: o.round, sub: statLine(o.type, o.stats), onClick: () => onBuild(o.type),
        }))}
        {info.upgrade && action({
          key: 'up', label: `⬆ ${t('build.upgrade_to', { n: info.upgrade.toLevel })}`, cost: info.upgrade.cost, reason: info.upgrade.reason,
          round: info.upgrade.round, sub: statLine(b.type, info.upgrade.stats), onClick: onUpgrade,
        })}
        {b && !info.upgrade && b.state !== 'ruin' && b.level === b.maxLevel && <p className="small muted">{t('build.max_level')}</p>}
        {info.sell && (
          <div className="build-option" style={{ borderTop: '1.5px dashed var(--ink-soft)', paddingTop: 6 }}>
            <button className="btn" disabled={!!info.sell.reason} onClick={onSell}>
              {b.state === 'ruin' ? `🧹 ${t('build.clear')}` : `💰 ${t('build.sell')} · +${info.sell.refund} 🪙`}
            </button>
            {info.sell.reason && <div className="small error-text">{why(info.sell.reason)}</div>}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="build-panel sketch-card" onPointerDown={(e) => e.stopPropagation()}>
      <button className="btn icon" style={{ float: 'right' }} onClick={onClose} aria-label={t('common.cancel')}>✕</button>
      {body}
      {!info.near && <p className="small muted" style={{ marginTop: 6 }}>🚶 {t('build.walking')}</p>}
    </div>
  );
}
