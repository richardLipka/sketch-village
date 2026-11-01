import React from 'react';
import { useTranslation } from 'react-i18next';

// When a screen breaks (a bug, a strange file), the page doesn't go blank: a
// card says the drawings are safe (they are in the browser, not in the screen)
// and offers the menu or a backup. App gives every screen its own boundary
// (key = the screen), so going back starts clean.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('A screen broke:', error, info?.componentStack); // for whoever looks at the console
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <CrashCard error={this.state.error} onBack={this.props.onBack} onBackup={this.props.onBackup} />;
  }
}

function CrashCard({ error, onBack, onBackup }) {
  const { t } = useTranslation();
  return (
    <div className="sketch-card crash-card" role="alert">
      <h2>😵 {t('app.crash_title')}</h2>
      <p>{t('app.crash_text')}</p>
      <div className="row">
        {onBack && <button className="btn primary" onClick={onBack}>← {t('app.crash_back')}</button>}
        {onBackup && <button className="btn" onClick={onBackup}>💾 {t('app.crash_backup')}</button>}
      </div>
      <details className="small muted"><summary>{t('app.crash_details')}</summary><code>{String(error?.message ?? error)}</code></details>
    </div>
  );
}
