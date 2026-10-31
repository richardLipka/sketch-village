import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { planImport, applyImport } from './mergePlan.js';
import ImportReview from './ImportReview.jsx';

// Importing a save file – from the computer, the class pack, the public library
// or a `?data=` link – always the same way (data/mergePlan.js): new things are
// added at once, changed ones are reviewed first (ImportReview).
//
//   const { importFile, reviewModal } = useImporter(db, onReplaceDb); // onReplaceDb stores the result
//   const result = await importFile(file); // null when the kid cancelled the review
//   // result: { summary, maps } – maps: ids of the file's maps here (to play one)
export default function useImporter(db, onReplaceDb) {
  const { i18n } = useTranslation();
  const [review, setReview] = useState(null); // { plan, resolve } waiting for the kid's decisions
  const dbRef = useRef(db);
  useEffect(() => { dbRef.current = db; }, [db]);

  const finish = useCallback(async (plan, accept) => {
    const { db: next, language, summary } = applyImport(dbRef.current, plan, accept);
    dbRef.current = next;
    await onReplaceDb(next); // stores it
    if (language && language !== i18n.language) i18n.changeLanguage(language);
    return { summary, maps: plan.maps };
  }, [onReplaceDb, i18n]);

  const importFile = useCallback(async (file) => {
    const plan = planImport(dbRef.current, file, { language: i18n.language });
    if (!plan.changes.length) return finish(plan, () => true);
    const accept = await new Promise((resolve) => setReview({ plan, resolve }));
    return accept ? finish(plan, accept) : null;
  }, [finish, i18n]);

  const reviewModal = review && (
    <ImportReview
      plan={review.plan}
      onDone={(accept) => { setReview(null); review.resolve(accept); }}
      onCancel={() => { setReview(null); review.resolve(null); }}
    />
  );

  return { importFile, reviewModal };
}
