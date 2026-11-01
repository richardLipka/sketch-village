import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal.jsx';
import { compName } from '../config/components.js';
import { fetchDefaultData } from './defaultData.js';
import { defaultAssets, resetPlan, defaultChoice, applyReset } from './resetDefaults.js';

// "Back to the game's own components" (SPEC §13d): every component that isn't
// the game's own, every changed and every missing one, a tick per line; what
// a map or another component uses is not ticked at first. Nothing changes
// before the second "Really?".
export default function ResetDefaults({ db, onReplaceDb, onDone }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [plan, setPlan] = useState(null);
  const [chosen, setChosen] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);

  const open = async () => {
    setBusy(true);
    const pack = await fetchDefaultData();
    const p = resetPlan(db.assets, defaultAssets(pack), db.maps);
    setPlan(p);
    setChosen(defaultChoice(p));
    setSure(false);
    setBusy(false);
  };
  const close = () => { setPlan(null); setSure(false); };
  const flip = (id) => setChosen((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const count = (list, idOf) => list.filter((x) => chosen.has(idOf(x))).length;

  const run = async () => {
    const next = applyReset(db.assets, plan, chosen);
    onReplaceDb({ ...db, assets: next });
    const n = { remove: count(plan.remove, (r) => r.asset.id), restore: count(plan.restore, (r) => r.asset.id), add: count(plan.add, (d) => d.id) };
    close();
    onDone?.(t('reset.done', n));
  };

  const line = (id, a, note) => (
    <label key={id} className="row small reset-line" style={{ gap: 6 }}>
      <input type="checkbox" checked={chosen.has(id)} onChange={() => flip(id)} />
      {a.images?.find(Boolean) ? <img src={a.images.find(Boolean)} alt="" className="reset-pic" /> : <span className="reset-pic" />}
      <span><b>{compName(a, lang) || id}</b> <span className="muted">· {t(`cat.${a.category}`, { defaultValue: a.category })}</span>{note && <span className="error-text"> · {note}</span>}</span>
    </label>
  );
  const usedNote = (u) => [
    u.maps.length ? t('reset.used_maps', { names: u.maps.join(', ') }) : '',
    u.components.length ? t('reset.used_components', { names: u.components.map((id) => compName(db.assets.find((a) => a.id === id), lang) || id).join(', ') }) : '',
  ].filter(Boolean).join('; ');

  const total = plan ? chosen.size : 0;
  const nothing = plan && !plan.remove.length && !plan.restore.length && !plan.add.length;

  return (
    <>
      <button className="btn" onClick={open} disabled={busy} data-testid="reset-defaults">♻ {t('reset.open')}</button>
      {plan && (
        <Modal onClose={close} wide
          header={<div className="row"><h2>♻ {t('reset.title')}</h2><span className="spacer" /><button className="btn" onClick={close} aria-label={t('common.close')} title={t('common.close')}>✕</button></div>}>
          <p className="small muted">{t('reset.hint')}</p>
          {nothing && <p data-testid="reset-nothing">✓ {t('reset.nothing')}</p>}
          {plan.remove.length > 0 && (
            <section>
              <h3>🗑 {t('reset.remove', { n: plan.remove.length })}</h3>
              {plan.remove.map((r) => line(r.asset.id, r.asset, usedNote(r.uses)))}
            </section>
          )}
          {plan.restore.length > 0 && (
            <section>
              <h3>↺ {t('reset.restore', { n: plan.restore.length })}</h3>
              {plan.restore.map((r) => line(r.asset.id, r.asset))}
            </section>
          )}
          {plan.add.length > 0 && (
            <section>
              <h3>➕ {t('reset.add', { n: plan.add.length })}</h3>
              {plan.add.map((d) => line(d.id, d))}
            </section>
          )}
          {!nothing && (
            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              {!sure ? (
                <button className="btn danger" disabled={!total} onClick={() => setSure(true)} data-testid="reset-go">♻ {t('reset.go', { n: total })}</button>
              ) : (
                <>
                  <b role="alert">{t('reset.sure', { remove: count(plan.remove, (r) => r.asset.id), restore: count(plan.restore, (r) => r.asset.id), add: count(plan.add, (d) => d.id) })}</b>
                  <button className="btn danger" onClick={run} data-testid="reset-yes">✓ {t('reset.yes')}</button>
                  <button className="btn" onClick={() => setSure(false)}>{t('common.cancel')}</button>
                </>
              )}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
