import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { storageStatus, unsavedDays } from './safety.js';
import { useInstall } from '../ui/install.js';

// "Keeping your drawings safe" (SPEC §13b): last backup, whether the browser
// promised to keep the data, installing the game (offline play; on iPhone the
// only way Safari keeps the data for good).
export default function SafetyCard({ settings, onBackup }) {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState(null);
  const [asked, setAsked] = useState(false);
  const { standalone, ios, canPrompt, install } = useInstall();
  useEffect(() => { storageStatus().then(setStatus); }, []);

  const last = settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleDateString(i18n.language) : null;
  return (
    <div className="sketch-card safety-card" style={{ marginBottom: 20 }}>
      <h2>🛟 {t('safety.title')}</h2>
      <p className="small muted">{t('data.export_hint')}</p>
      <p className="small">
        {last ? t('safety.last_backup', { date: last }) : t('safety.never')}
        {settings.unsavedSince && <> · <b>{t('safety.unsaved', { count: unsavedDays(settings) })}</b></>}
      </p>
      <button className="btn primary" onClick={onBackup}>⬇ {t('data.export')}</button>

      <p className="small" data-status={status ?? ''}>
        {status === 'persisted' && <>✅ {t('safety.persisted')}</>}
        {status === 'best-effort' && <>⚠️ {t('safety.best_effort')}</>}
        {status === 'unsupported' && <>⚠️ {t('safety.unsupported')}</>}
      </p>
      {status === 'best-effort' && (
        <button className="btn" onClick={() => storageStatus({ ask: true }).then((s) => { setStatus(s); setAsked(true); })}>🔒 {t('safety.ask_keep')}</button>
      )}
      {status === 'best-effort' && asked && <p className="small muted">{t('safety.refused')}</p>}

      <p className="small">
        {standalone ? <>📲 {t('safety.installed')}</> : <>📲 {t('safety.install_why')}</>}
      </p>
      {!standalone && canPrompt && <button className="btn" onClick={install}>📲 {t('safety.install')}</button>}
      {!standalone && !canPrompt && <p className="small muted">{t(ios ? 'safety.install_ios' : 'safety.install_menu')}</p>}
    </div>
  );
}

/** Reminder on the menu when changes have waited a few days for a backup. */
export function BackupReminder({ settings, onBackup, onLater }) {
  const { t } = useTranslation();
  return (
    <div className="sketch-card backup-reminder" role="status">
      <p>💾 {t('safety.reminder', { count: unsavedDays(settings) })}</p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn primary" onClick={onBackup}>⬇ {t('safety.backup_now')}</button>
        <button className="btn" onClick={onLater}>{t('app.later')}</button>
      </div>
    </div>
  );
}
