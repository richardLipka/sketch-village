import React from 'react';

// A menu screen (studio, maps, chronicle, rules, play, save & load): the head –
// title, tabs, filters, the main buttons – stays in place; only the body below
// it scrolls, with its own scrollbar. `fill` = the body arranges its own
// scrolling (the chronicle keeps its filter above its list).
export default function Screen({ title, head = null, fill = false, className = '', children }) {
  return (
    <section className={`screen ${className}`}>
      <div className="screen-head">
        {title && <h1>{title}</h1>}
        {head}
      </div>
      <div className={`screen-body ${fill ? 'fill' : ''}`}>{children}</div>
    </section>
  );
}
