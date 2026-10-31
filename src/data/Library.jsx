import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Screen from '../ui/Screen.jsx';
import SearchBox from '../ui/SearchBox.jsx';
import { matchesQuery } from '../ui/search.js';
import { fetchLibrary, fetchSaveFile, resolveDataUrl, shareLink, localText } from './library.js';

// 📚 The public library (SPEC §13c): ready-made maps and packs from the game's
// website (public/library/index.json). Loading one imports it like any save
// file; a map from it can be played right away. Every entry has a link that
// opens the game with that file loaded (…/?data=<name>).
export default function Library({ onImport, onPlay }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [lib, setLib] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(null); // the file being loaded
  const [done, setDone] = useState(null); // { file, maps, text, ok }
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchLibrary()
      .then((l) => { if (alive) setLib(l); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);

  const load = async (entry) => {
    setBusy(entry.file);
    setDone(null);
    try {
      const r = await onImport(await fetchSaveFile(resolveDataUrl(entry.file)));
      setDone(r
        ? { file: entry.file, ok: true, maps: r.maps, text: t('import.done_review', r.summary) }
        : { file: entry.file, ok: false, text: t('import.cancelled') });
    } catch (e) {
      setDone({ file: entry.file, ok: false, text: t(e.message, { defaultValue: t('import.error_generic') }) });
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async (entry) => {
    const link = shareLink(entry);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(entry.file);
    } catch {
      prompt(t('library.copy_manually'), link); // no clipboard (an old browser, http)
    }
  };

  const files = (lib?.files ?? []).filter((f) => matchesQuery(query, localText(f.title, lang), localText(f.description, lang), f.author ?? ''));

  return (
    <Screen title={`📚 ${t('library.title')}`} head={
      <div className="row">
        <SearchBox value={query} onChange={setQuery} count={lib ? files.length : undefined} />
        <span className="small muted">{t('library.hint')}</span>
      </div>
    }>
      {!lib && !error && <p className="muted">{t('app.loading')}</p>}
      {error && <p className="error-text">{t(error, { defaultValue: t('library.error_missing') })}</p>}
      {lib && !lib.files.length && <p className="muted">{t('library.empty')}</p>}

      <div className="library-list">
        {files.map((f) => (
          <div key={f.file} className="sketch-card library-entry" data-file={f.file}>
            {f.thumbnail ? <img src={f.thumbnail} alt="" className="library-thumb" /> : <span className="library-thumb no-pic" aria-hidden="true">📦</span>}
            <div className="library-text">
              <b>{localText(f.title, lang) || f.file}</b>
              {f.description && <div className="small">{localText(f.description, lang)}</div>}
              <div className="small muted">
                {f.author && <>✎ {f.author} · </>}
                {t('library.counts', { maps: f.maps ?? 0, components: f.components ?? 0 })}
                {f.size ? ` · ${Math.max(1, Math.round(f.size / 1024))} kB` : ''}
              </div>
              {done?.file === f.file && (
                <div className={`small ${done.ok ? '' : 'error-text'}`} role="status">
                  {done.text}{' '}
                  {done.ok && done.maps?.length > 0 && <button className="btn primary" onClick={() => onPlay(done.maps[0])}>▶ {t('library.play')}</button>}
                </div>
              )}
            </div>
            <div className="library-actions">
              <button className="btn" disabled={!!busy} onClick={() => load(f)}>{busy === f.file ? '…' : '⬇'} {t('library.load')}</button>
              <button className="btn icon" onClick={() => copyLink(f)} title={t('library.copy_link')}>🔗 {copied === f.file ? t('library.copied') : t('library.link')}</button>
            </div>
          </div>
        ))}
      </div>

      <details className="small" style={{ marginTop: 16 }}>
        <summary>{t('library.teacher')}</summary>
        <p className="muted">{t('library.howto')}</p>
      </details>
    </Screen>
  );
}
