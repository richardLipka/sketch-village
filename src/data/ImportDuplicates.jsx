import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal.jsx';

// After a map is imported (data/mapImport.js): the things that were here
// already but are partly different in the map were added as copies with a new
// name. One row per copy – mine, the map's, what differs – and the choice:
// keep both (default), only mine, only the map's.

export const CHOICES = ['both', 'mine', 'theirs'];

const firstFrame = (rec) => Object.values(rec?.anims ?? {}).find((a) => a?.frames?.length)?.frames[0];
const picOf = (rec) => rec?.images?.find(Boolean) || firstFrame(rec) || rec?.background || null;
const nameOf = (rec, lang) => (typeof rec?.name === 'string' ? rec.name : rec?.name?.[lang] ?? rec?.name?.cs ?? '');

/** "images", "stats.speed", "stats.levels[1].hp" → what to show: picture, speed, levels… */
function whatDiffers(diff, t) {
  const out = new Set();
  for (const { path } of diff) {
    const [top, sub] = path.split(/[.[]/);
    out.add(top === 'stats' && sub ? sub.replace(/]$/, '') : t(`import.what_${top}`, { defaultValue: top }));
  }
  return [...out];
}

export default function ImportDuplicates({ plan, onDone }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [choice, setChoice] = useState(() => new Map(plan.partials.map((p) => [p, 'both'])));
  const set = (p, c) => setChoice((cur) => new Map(cur).set(p, c));
  const all = (c) => setChoice(new Map(plan.partials.map((p) => [p, c])));
  const done = () => onDone((p) => choice.get(p) ?? 'both');

  return (
    <Modal onClose={done} wide
      header={<>
        <h2>🔀 {t('import.dup_title')}</h2>
        <p className="small" style={{ margin: '4px 0 0' }}>{t('import.dup_intro', { n: plan.partials.length })}</p>
      </>}
      footer={<div className="row review-actions" style={{ marginTop: 0 }}>
        <span className="small muted">{t('import.dup_all')}</span>
        {CHOICES.map((c) => <button key={c} className="btn" onClick={() => all(c)}>{t(`import.dup_${c}`)}</button>)}
        <span className="spacer" />
        <button className="btn primary" onClick={done} data-testid="dup-done">✓ {t('import.dup_done')}</button>
      </div>}
    >
      <div className="review-table-wrap">
        <table className="review-table dup-table">
          <thead>
            <tr><th>{t('import.dup_col_mine')}</th><th>{t('import.dup_col_map')}</th><th>{t('import.dup_col_diff')}</th><th>{t('import.dup_col_choice')}</th></tr>
          </thead>
          <tbody>
            {plan.partials.map((p) => {
              const kind = p.collection === 'assets' ? t(`cat.${p.local.category}`) : t(`import.kind_${p.collection}`);
              const mineName = nameOf(p.local, lang), copyName = nameOf(p.record, lang);
              return (
                <tr key={p.record.id} data-name={mineName}>
                  <td>
                    <div className="dup-thing">
                      {picOf(p.local) ? <img src={picOf(p.local)} alt="" className="review-pic small checker" /> : <span className="review-pic small no-pic" />}
                      <span><b>{mineName}</b><br /><span className="small muted">{kind}</span></span>
                    </div>
                  </td>
                  <td>
                    <div className="dup-thing">
                      {picOf(p.record) ? <img src={picOf(p.record)} alt="" className="review-pic small checker" /> : <span className="review-pic small no-pic" />}
                      <span>{copyName}</span>
                    </div>
                  </td>
                  <td className="small">{whatDiffers(p.diff, t).join(', ')}</td>
                  <td>
                    <div className="dup-choice" role="radiogroup" aria-label={mineName}>
                      {CHOICES.map((c) => (
                        <label key={c} className={`btn chip ${choice.get(p) === c ? 'active' : ''}`} title={t(`import.dup_${c}_hint`, { mine: mineName, copy: copyName })}>
                          <input type="radio" name={`dup-${p.record.id}`} value={c} checked={choice.get(p) === c} onChange={() => set(p, c)} />
                          {t(`import.dup_${c}`)}
                        </label>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
