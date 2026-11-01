import React from 'react';
import { useTranslation } from 'react-i18next';

// A note at the bottom of the screen (or the top: `top`) – the result of
// loading a file, a broken link, "plays offline now". Screen readers hear it
// (role="status"; an error is an alert), and it closes with its ✕ or a click.
//
//   {message && <Toast error={!message.ok} onClose={() => setMessage(null)}>{message.text}</Toast>}
export default function Toast({ children, error = false, top = false, onClose, testId }) {
  const { t } = useTranslation();
  return (
    <div className={`toast sketch-card ${top ? 'toast-top' : ''} ${error ? 'toast-error error-text' : ''}`} role={error ? 'alert' : 'status'} data-testid={testId}
      onClick={onClose}>
      <span>{children}</span>
      {onClose && <button type="button" className="btn icon toast-close" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label={t('common.close')} title={t('common.close')}>✕</button>}
    </div>
  );
}
