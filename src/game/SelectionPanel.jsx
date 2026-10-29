import React, { memo, useEffect, useState } from 'react';
import BuildPanel from './BuildPanel.jsx';

const REFRESH_MS = 250;

// Keeps the build / Town Hall panel up to date by asking the World a few times
// a second and re-rendering only when the description really changed. The rest
// of the game screen doesn't re-render for building progress at all.
function SelectionPanel({ worldRef, selection, version, ...handlers }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let last = '';
    const read = () => {
      const w = worldRef.current;
      const next = w && (selection.kind === 'spot' ? w.describeSpot(selection.id) : w.describeTownHall());
      if (!next) return;
      // progress is shown in 5 % steps – finer changes aren't worth a render
      const key = JSON.stringify(next, (k, v) => (k === 'progress' && typeof v === 'number' ? Math.round(v * 20) : v));
      if (key !== last) { last = key; setInfo(next); }
    };
    read();
    const id = setInterval(read, REFRESH_MS);
    return () => clearInterval(id);
  }, [worldRef, selection, version]);

  if (!info) return null;
  return <BuildPanel info={info} {...handlers} />;
}

export default memo(SelectionPanel);
