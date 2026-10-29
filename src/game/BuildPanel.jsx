import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Panel for the selected building spot or the Town Hall (SPEC §7).
// `info` comes from World.describeSpot / describeTownHall; every option carries a
// `reason` (null = allowed) so kids see *why* a button is disabled.

const ICON = { house: '🏠', tower: '🗼', castle: '🏰' };

function Bar({ frac, color }) {
  return <span className="hud-bar" style={{ width: 90 }}><span style={{ width: `${Math.round(frac * 100)}%`, background: color }} /></span>;
}

export default function BuildPanel({ info, soldierMax = 3, onClose, onBuild, onUpgrade, onSell, onUpgradeTownHall, onUpgradeHero }) {
  const { t } = useTranslation();
  const why = (reason) => (reason ? t(`build.reason_${reason}`) : null);
  // selling needs a second tap, so a misclick doesn't demolish anything
  const [confirmSell, setConfirmSell] = useState(false);
  const spotKey = info.kind === 'spot' ? info.id : 'th';
  useEffect(() => setConfirmSell(false), [spotKey]);

  const statLine = (type, s) => {
    if (!s) return '';
    if (type === 'house') return t('build.stat_house', { n: s.workers });
    if (type === 'tower') return t('build.stat_tower', { dmg: s.damage, range: s.range, cd: s.cooldown });
    if (type === 'castle') return t('build.stat_castle', { n: soldierMax, hp: s.soldierHp, dmg: s.soldierDamage });
    return '';
  };

  const Action = ({ label, cost, reason, onClick, sub }) => (
    <div className="build-option">
      <button className="btn primary" disabled={!!reason} onClick={onClick}>
        {label} <span className="small">· {cost} 🪙</span>
      </button>
      {sub && <div className="small muted">{sub}</div>}
      {reason && <div className="small error-text">{why(reason)}</div>}
    </div>
  );

  let body;
  if (info.kind === 'townhall') {
    body = (
      <>
        <h3>🏛️ {t('build.townhall', { n: info.level })}</h3>
        <div className="row small"><Bar frac={info.hp / info.maxHp} color="#2563eb" /> {info.hp}/{info.maxHp}</div>
        {info.progress !== null && <div className="row small">🔨 <Bar frac={info.progress} color="#ca8a04" /></div>}
        {info.upgrade ? (
          <Action label={`⬆ ${t('build.upgrade_to', { n: info.upgrade.toLevel })}`} cost={info.upgrade.cost} reason={info.upgrade.reason}
            sub={t('build.th_sub', { hp: info.upgrade.hp, n: info.upgrade.toLevel })} onClick={onUpgradeTownHall} />
        ) : <p className="small muted">{t('build.max_level')}</p>}
        <h3 style={{ marginTop: 10 }}>{t('build.hero_upgrades')}</h3>
        {info.heroUpgrades.map((u) => (
          <div key={u.stat} className="row small" style={{ gap: 8, marginBottom: 4 }}>
            <span style={{ minWidth: 92 }}>{t(`hero.stat_${u.stat}`)}</span>
            <span>{'●'.repeat(u.level)}{'○'.repeat(u.maxLevel - u.level)}</span>
            {u.cost !== null ? (
              <button className="btn icon" disabled={!!u.reason} onClick={() => onUpgradeHero(u.stat)} title={why(u.reason) ?? ''}>+1 · {u.cost} 🪙</button>
            ) : <span className="muted">{t('build.max_level')}</span>}
            {u.reason && u.reason !== 'max' && <span className="error-text">{why(u.reason)}</span>}
          </div>
        ))}
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
        {info.options.map((o) => (
          <Action key={o.type}
            label={`${ICON[o.type]} ${o.rebuild ? t('build.rebuild') : t(`build.type_${o.type}`)}`}
            cost={o.cost} reason={o.reason} sub={statLine(o.type, o.stats)} onClick={() => onBuild(o.type)} />
        ))}
        {info.upgrade && (
          <Action label={`⬆ ${t('build.upgrade_to', { n: info.upgrade.toLevel })}`} cost={info.upgrade.cost} reason={info.upgrade.reason}
            sub={statLine(b.type, info.upgrade.stats)} onClick={onUpgrade} />
        )}
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
    <div className="build-panel sketch-card" onPointerDown={(e) => e.stopPropagation()}>
      <button className="btn icon" style={{ float: 'right' }} onClick={onClose} aria-label={t('common.cancel')}>✕</button>
      {body}
      {!info.near && <p className="small muted" style={{ marginTop: 6 }}>🚶 {t('build.walking')}</p>}
    </div>
  );
}
