import React from 'react';

// A small number input that keeps the value inside [min, max]; `pct` shows a
// 0..1 value as 0..100 %.
export default function NumField({ label, value, min, max, step = 1, pct = false, onChange, width = 72, disabled }) {
  const shown = value === undefined || value === null ? '' : pct ? Math.round(value * 1000) / 10 : value;
  const input = (
    <input
      type="number" min={pct ? min * 100 : min} max={pct ? max * 100 : max} step={pct ? step * 100 : step} value={shown}
      disabled={disabled} style={{ width }}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (e.target.value === '' || Number.isNaN(v)) return;
        const n = pct ? v / 100 : v;
        onChange(Math.min(max, Math.max(min, n)));
      }}
    />
  );
  if (!label) return input;
  return <label className="row small" style={{ gap: 6 }}>{label} {input}{pct && ' %'}</label>;
}
