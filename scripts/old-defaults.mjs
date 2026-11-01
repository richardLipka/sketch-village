// npm run old-defaults – rebuild src/config/oldDefaults.js from the git
// history: every earlier default name and legend text of a built-in component
// that differs from today's. The migration (data/migrate.js) replaces exactly
// those texts in a browser's stored built-ins – the wolf became the spider
// rider, but a browser kept "Wolf" and the grey wolves' story – while the
// kids' own texts stay. Run it after renaming a built-in or rewriting a legend.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const { DEFAULT_COMPONENTS } = await import(pathToFileURL(path.join(repo, 'src/config/components.js')).href);
const current = new Map(DEFAULT_COMPONENTS.map((c) => [c.id, c]));

const old = {}; // id → field → lang → Set of texts
const note = (id, field, lang, text) => {
  const c = current.get(id);
  if (!c || typeof text !== 'string' || !text.trim()) return;
  const now = field === 'name' ? c.name?.[lang] : c.legend?.[field]?.[lang];
  if (typeof now !== 'string' || now.trim() === text.trim()) return;
  (((old[id] ??= {})[field] ??= {})[lang] ??= new Set()).add(text.trim());
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'old-defaults-'));
for (const commit of git('log', '--format=%H', '--', 'src/config').trim().split('\n')) {
  const files = git('ls-tree', '-r', '--name-only', commit, 'src/config').trim().split('\n').filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'));
  for (const f of files) {
    const text = git('show', `${commit}:${f}`);
    // names: `id: 'x', name: { cs: '…', en: '…' }` and `component('kind', 'x', { cs: '…', en: '…' }`
    for (const m of text.matchAll(/id:\s*'([\w-]+)',\s*name:\s*\{\s*cs:\s*'([^']*)',\s*en:\s*'([^']*)'\s*\}/g)) { note(m[1], 'name', 'cs', m[2]); note(m[1], 'name', 'en', m[3]); }
    for (const m of text.matchAll(/component\('\w+',\s*'([\w-]+)',\s*\{\s*cs:\s*'([^']*)',\s*en:\s*'([^']*)'\s*\}/g)) { note(m[1], 'name', 'cs', m[2]); note(m[1], 'name', 'en', m[3]); }
    // legends: the module has no imports, so the old version can be loaded as it was
    if (f.endsWith('/legends.js') && !/^import /m.test(text)) {
      const file = path.join(tmp, `${commit}.mjs`);
      fs.writeFileSync(file, text);
      const { BUILT_IN_LEGENDS } = await import(pathToFileURL(file).href);
      for (const [id, lg] of Object.entries(BUILT_IN_LEGENDS ?? {})) {
        for (const field of ['story', 'hint']) for (const lang of ['cs', 'en']) note(id, field, lang, lg?.[field]?.[lang]);
      }
    }
  }
}
fs.rmSync(tmp, { recursive: true, force: true });

const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const lines = [];
for (const id of Object.keys(old).sort()) {
  lines.push(`  ${id}: {`);
  for (const field of ['name', 'story', 'hint']) {
    const langs = old[id][field];
    if (!langs) continue;
    const parts = Object.keys(langs).sort().map((l) => `${l}: [${[...langs[l]].sort().map(q).join(', ')}]`);
    lines.push(`    ${field}: { ${parts.join(', ')} },`);
  }
  lines.push('  },');
}
const out = `// Earlier default names and legend texts of the built-in components (made by
// \`npm run old-defaults\` from the git history – don't edit by hand). The
// migration gives a stored built-in today's default wherever it still has one
// of these (data/migrate.js, freshTexts below); a kid's own text stays.
//
//   OLD_DEFAULTS[id][field][lang] = [texts]   field: name | story | hint

export const OLD_DEFAULTS = {
${lines.join('\n')}
};

/**
 * The texts of a stored built-in \`asset\` brought up to date with its default
 * \`def\`: every language of its name, story and hint that is still an earlier
 * default becomes today's. null when nothing is old.
 */
export function freshTexts(asset, def) {
  const old = OLD_DEFAULTS[asset?.id];
  if (!old || !def) return null;
  const isOld = (field, lang, v) => typeof v === 'string' && (old[field]?.[lang] ?? []).includes(v.trim());
  const fix = (cur, now, field) => {
    if (!cur || typeof cur !== 'object' || !now || typeof now !== 'object') return cur; // a kid's single text stays
    let next = cur;
    for (const lang of Object.keys(now)) if (isOld(field, lang, cur[lang])) next = { ...next, [lang]: now[lang] };
    return next;
  };
  const name = fix(asset.name, def.name, 'name');
  const story = fix(asset.legend?.story, def.legend?.story, 'story');
  const hint = fix(asset.legend?.hint, def.legend?.hint, 'hint');
  if (name === asset.name && story === asset.legend?.story && hint === asset.legend?.hint) return null;
  return {
    ...(name !== asset.name ? { name } : {}),
    ...(story !== asset.legend?.story || hint !== asset.legend?.hint ? { legend: { ...asset.legend, story, hint } } : {}),
  };
}
`;
fs.writeFileSync(path.join(repo, 'src/config/oldDefaults.js'), out);
console.log(`src/config/oldDefaults.js: ${Object.keys(old).length} built-ins with earlier texts`);
