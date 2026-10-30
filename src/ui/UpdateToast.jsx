import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';

// The service worker (vite.config.js) keeps the game for offline play. A new
// version waits until the player taps "reload" – never in the middle of a game
// (App shows this toast outside the play screen only).
export default function UpdateToast() {
  const { t } = useTranslation();
  const { needRefresh: [needRefresh, setNeedRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } = useRegisterSW();
  useEffect(() => {
    if (!offlineReady) return undefined;
    const id = setTimeout(() => setOfflineReady(false), 6000);
    return () => clearTimeout(id);
  }, [offlineReady, setOfflineReady]);

  if (needRefresh) {
    return (
      <div className="toast toast-top sketch-card update-toast">
        🆕 {t('app.update_ready')}{' '}
        <button className="btn primary" onClick={() => updateServiceWorker(true)}>↻ {t('app.update_reload')}</button>{' '}
        <button className="btn" onClick={() => setNeedRefresh(false)}>{t('app.later')}</button>
      </div>
    );
  }
  if (offlineReady) return <div className="toast toast-top sketch-card" onClick={() => setOfflineReady(false)}>✈️ {t('app.offline_ready')}</div>;
  return null;
}
