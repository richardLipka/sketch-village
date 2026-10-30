import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal.jsx';

// Reviewing an import (data/mergePlan.js): new things are simply added; for
// every element that already exists and differs, the kid sees what changed –
// numbers, names, pictures – and decides: update / keep mine / update all /
// keep all mine.

const isPic = (v) => typeof v === 'string' && v.startsWith('data:image');
const MAX_ROWS = 25;

function Value({ v }) {
  const { t } = useTranslation();
  const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.some((x) => x !== null && x !== ''));
  if (empty) return <span className="muted">{t('import.nothing')}</span>;
  if (isPic(v)) return <img src={v} alt="" className="review-pic checker" />;
  if (Array.isArray(v) && v.some(isPic)) {
    return (
      <span className="row" style={{ gap: 4 }}>
        {v.filter(isPic).slice(0, 4).map((p, i) => <img key={i} src={p} alt="" className="review-pic small checker" />)}
        {v.length > 1 && <span className="small muted">{t('import.pictures', { n: v.length })}</span>}
      </span>
    );
  }
  if (typeof v === 'boolean') return <span>{v ? '✓' : '✕'}</span>;
  if (typeof v === 'object') {
    const s = JSON.stringify(v);
    return <code className="small">{s.length > 80 ? `${s.slice(0, 77)}…` : s}</code>;
  }
  const s = String(v);
  return <span>{s.length > 120 ? `${s.slice(0, 117)}…` : s}</span>;
}

export default function ImportReview({ plan, onDone, onCancel }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [i, setI] = useState(0);
  const [accepted, setAccepted] = useState(() => new Set());
  const changes = plan.changes;
  const ch = changes[i];

  const finish = (set) => onDone((c) => set.has(c));
  const decide = (yes) => {
    const next = new Set(accepted);
    if (yes) next.add(ch);
    if (i + 1 >= changes.length) finish(next);
    else { setAccepted(next); setI(i + 1); }
  };
  const all = (yes) => {
    const next = new Set(accepted);
    if (yes) for (const c of changes.slice(i)) next.add(c);
    finish(next);
  };

  const name = ch.name ? (typeof ch.name === 'string' ? ch.name : ch.name[lang] ?? ch.name.cs) : '';
  const kind = ch.collection === 'assets' ? t(`cat.${ch.category}`) : t(`import.kind_${ch.collection}`);
  const rows = ch.diff.slice(0, MAX_ROWS);

  return (
    <Modal onClose={onCancel} wide>
      <h2>📥 {t('import.review_title')}</h2>
      <p className="small">{t('import.review_counts', { added: plan.additions.length, changes: changes.length })}</p>
      <div className="sketch-card" style={{ padding: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <b>{kind}{name && `: ${name}`}</b>
          <span className="small muted">{t('import.change_n', { n: i + 1, total: changes.length })}</span>
        </div>
        <div className="review-table-wrap">
          <table className="review-table">
            <thead><tr><th>{t('import.col_what')}</th><th>{t('import.col_mine')}</th><th>{t('import.col_theirs')}</th></tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.path}>
                  <td className="small"><code>{d.path || '—'}</code></td>
                  <td><Value v={d.from} /></td>
                  <td><Value v={d.to} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ch.diff.length > MAX_ROWS && <p className="small muted">{t('import.more', { n: ch.diff.length - MAX_ROWS })}</p>}
      </div>
      <div className="row review-actions">
        <button className="btn primary" onClick={() => decide(true)}>✓ {t('import.accept')}</button>
        <button className="btn" onClick={() => decide(false)}>✕ {t('import.reject')}</button>
        <span className="spacer" />
        <button className="btn" onClick={() => all(true)}>✓✓ {t('import.accept_all')}</button>
        <button className="btn" onClick={() => all(false)}>✕✕ {t('import.reject_all')}</button>
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>
        <button className="btn" onClick={onCancel}>{t('import.cancel')}</button> {t('import.cancel_hint')}
      </p>
    </Modal>
  );
}
