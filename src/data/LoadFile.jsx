import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal.jsx';
import { parseSaveFile } from './saveFile.js';
import { resolveDataUrl, fetchSaveFile } from './library.js';

// "⬆ Load…" (Maps, studio, Save & load): a save file from the computer, or
// from an address the kid types or pastes (a file on GitHub, the class's
// website, a library name like "green-valley"). The file goes to `onImport`
// (App's useImporter: a whole save is reviewed, a map or a component file is
// matched thing by thing); the result is reported in a note at the bottom.
//
//   <LoadFile label={t('maps.load')} title={t('maps.load_title')} hint={t('maps.load_hint')} onImport={importFile} />
export default function LoadFile({ label, title, hint, onImport, testId }) {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); // a translation key, shown in the dialog
  const [message, setMessage] = useState(null); // { ok, text } – the note after loading

  const load = async (getFile) => {
    setBusy(true);
    setError(null);
    let file;
    try {
      file = await getFile();
    } catch (e) {
      setError(e.message);
      setBusy(false);
      return;
    }
    setOpen(false);
    setBusy(false);
    const r = await onImport(file);
    setMessage(r ? { ok: true, text: t(r.message ?? 'import.done_review', r.summary) } : { ok: false, text: t('import.cancelled') });
  };

  const fromComputer = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) load(async () => parseSaveFile(await f.text()));
  };

  const fromAddress = () => {
    const url = resolveDataUrl(address);
    if (!url) { setError('load.error_address'); return; }
    load(() => fetchSaveFile(url));
  };

  return (
    <>
      <button className="btn" onClick={() => { setOpen(true); setError(null); }} data-testid={testId}>⬆ {label}</button>
      {open && (
        <Modal onClose={() => setOpen(false)}>
          <div className="load-file">
            <h2>⬆ {title}</h2>
            {hint && <p className="small muted">{hint}</p>}
            <button className="btn primary" disabled={busy} onClick={() => fileRef.current.click()}>📁 {t('load.from_computer')}</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={fromComputer} data-testid="load-file-input" />
            <form className="row load-address" onSubmit={(e) => { e.preventDefault(); fromAddress(); }}>
              <label className="small" htmlFor="load-address">🔗 {t('load.from_address')}</label>
              <input id="load-address" type="text" inputMode="url" autoComplete="url" spellCheck={false} value={address} placeholder="https://…/….json" onChange={(e) => setAddress(e.target.value)} />
              <button className="btn" type="submit" disabled={busy || !address.trim()}>{busy ? '…' : t('load.load')}</button>
            </form>
            {error && <p className="error-text" role="alert">{t(error, { defaultValue: t('import.error_generic') })}</p>}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
            </div>
          </div>
        </Modal>
      )}
      {message && (
        <div className={`toast sketch-card ${message.ok ? '' : 'error-text'}`} role="status" style={message.ok ? undefined : { background: 'var(--hl-red)' }} onClick={() => setMessage(null)}>
          {message.text}
        </div>
      )}
    </>
  );
}
