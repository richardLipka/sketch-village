import React, { createContext, useContext } from 'react';
import { UI_ICON_EMOJI } from '../config/uiIcons.js';

// A GUI icon: the kids' drawing when there is one (studio → Icons), else the emoji.
// It is decoration for assistive technology (the button or text around it says
// what it is) unless it has a `title`.
export const UiIconContext = createContext({});

export default function UiIcon({ name, title }) {
  const drawn = useContext(UiIconContext)[name];
  if (drawn) return <img src={drawn} alt={title ?? ''} title={title} className="ui-icon" />;
  return <span className="ui-icon-emoji" title={title} aria-hidden={title ? undefined : true}>{UI_ICON_EMOJI[name] ?? '?'}</span>;
}
