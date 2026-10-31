import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { planImport, applyImport } from './mergePlan.js';
import { isMapFile, planMapImport, applyMapImport, resolveDuplicates } from './mapImport.js';
import ImportReview from './ImportReview.jsx';
import ImportDuplicates from './ImportDuplicates.jsx';

// Importing a save file – from the computer, the class pack, the public library
// or a `?data=` link – always the same way:
//  – a whole save (data/mergePlan.js): new things are added at once, changed
//    ones are reviewed first (ImportReview);
//  – a map file (data/mapImport.js): what is here exactly is used, what is
//    partly different comes as a copy named after the map; at the end the kid
//    may merge the copies (ImportDuplicates).
//
//   const { importFile, reviewModal } = useImporter(db, onReplaceDb); // onReplaceDb stores the result
//   const result = await importFile(file); // null when the kid cancelled the review
//   // result: { summary, maps, message } – maps: ids of the file's maps here (to play one),
//   // message: the translation key that reports the summary
export default function useImporter(db, onReplaceDb) {
  const { i18n } = useTranslation();
  const [review, setReview] = useState(null); // { plan, resolve } waiting for the kid's decisions
  const [dupes, setDupes] = useState(null); // { plan, resolve } – a map's copies to merge
  const dbRef = useRef(db);
  useEffect(() => { dbRef.current = db; }, [db]);

  const store = useCallback(async (next) => {
    dbRef.current = next;
    await onReplaceDb(next); // stores it
  }, [onReplaceDb]);

  const finish = useCallback(async (plan, accept) => {
    const { db: next, language, summary } = applyImport(dbRef.current, plan, accept);
    await store(next);
    if (language && language !== i18n.language) i18n.changeLanguage(language);
    return { summary, maps: plan.maps, message: 'import.done_review' };
  }, [store, i18n]);

  const importMap = useCallback(async (file) => {
    const plan = planMapImport(dbRef.current, file);
    const { db: next, summary } = applyMapImport(dbRef.current, plan);
    await store(next); // imported – the table only merges what came twice
    let maps = plan.maps;
    if (plan.partials.length) {
      const choose = await new Promise((resolve) => setDupes({ plan, resolve }));
      const r = resolveDuplicates(dbRef.current, plan, choose);
      if (Object.keys(r.rename).length) await store(r.db);
      maps = maps.map((id) => r.rename[id] ?? id);
      summary.merged = r.summary.mine + r.summary.theirs;
    }
    return { summary: { merged: 0, ...summary }, maps, message: 'import.done_map' };
  }, [store]);

  const importFile = useCallback(async (file) => {
    if (isMapFile(file)) return importMap(file);
    const plan = planImport(dbRef.current, file, { language: i18n.language });
    if (!plan.changes.length) return finish(plan, () => true);
    const accept = await new Promise((resolve) => setReview({ plan, resolve }));
    return accept ? finish(plan, accept) : null;
  }, [finish, importMap, i18n]);

  const reviewModal = (review || dupes) && (
    <>
      {review && (
        <ImportReview
          plan={review.plan}
          onDone={(accept) => { setReview(null); review.resolve(accept); }}
          onCancel={() => { setReview(null); review.resolve(null); }}
        />
      )}
      {dupes && <ImportDuplicates plan={dupes.plan} onDone={(choose) => { setDupes(null); dupes.resolve(choose); }} />}
    </>
  );

  return { importFile, reviewModal };
}
