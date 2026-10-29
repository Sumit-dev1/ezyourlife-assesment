// Builds demo.html: the live search and the new search side by side over the real catalogue snapshot.
// Everything is inlined so the file opens straight from disk (file://) or any static host.
// Usage: node fix/search/build-demo.js
const fs = require('node:fs');
const path = require('node:path');

const here = __dirname;
const catalog = require(path.join(here, '../../evidence/catalog.json')).map((t) => ({
  id: t.id, name: t.name, description: t.description, category: t.category,
  extra_categories: t.extra_categories ?? [], tool_types: t.tool_types ?? [],
}));

// Minimal CommonJS shim so the same files used by the tests run in the browser unchanged.
const modules = ['synonyms', 'searchApps', 'legacySearch']
  .map((name) => `'./${name}': function (module, exports, require) {\n${fs.readFileSync(path.join(here, name + '.js'), 'utf8')}\n}`)
  .join(',\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>App search: before and after</title>
<style>
  :root { --bg: #fffdf7; --ink: #1d1b18; --muted: #6b665e; --line: #e4ddd0; --good: #0f7b55; --bad: #b42318; --chip: #f3eee4; }
  @media (prefers-color-scheme: dark) { :root { --bg: #16150f; --ink: #f2efe8; --muted: #a39d92; --line: #3a362e; --good: #5dd3a0; --bad: #ff8a80; --chip: #26241d; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 1040px; margin: 0 auto; padding: 20px 16px 48px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  p.lede { margin: 0 0 16px; color: var(--muted); }
  label { font-weight: 600; display: block; margin-bottom: 6px; }
  input { width: 100%; font: inherit; padding: 12px 14px; border: 2px solid var(--ink); border-radius: 12px; background: transparent; color: inherit; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 18px; }
  .chips button { font: inherit; font-size: 14px; padding: 6px 12px; min-height: 36px; border-radius: 999px; border: 1px solid var(--line); background: var(--chip); color: inherit; cursor: pointer; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 720px) { .cols { grid-template-columns: 1fr; } }
  section { border: 1px solid var(--line); border-radius: 14px; padding: 14px; min-width: 0; }
  h2 { font-size: 15px; margin: 0 0 2px; }
  .count { font-size: 14px; margin-bottom: 10px; }
  .count.zero { color: var(--bad); font-weight: 600; }
  .count.ok { color: var(--good); font-weight: 600; }
  ol { margin: 0; padding-left: 22px; }
  li { margin: 0 0 8px; }
  li small { display: block; color: var(--muted); }
  .note { font-size: 14px; color: var(--muted); margin-bottom: 8px; }
</style>
</head>
<body>
<main>
  <h1>App search: before and after</h1>
  <p class="lede">Same ${catalog.length} live apps (public catalogue snapshot, 29 Oct 2026). Left: the search as it works on the site today. Right: the proposed search.</p>
  <label for="q">Search apps</label>
  <input id="q" type="search" autocomplete="off" placeholder="Try: gst bill, udhaar, बिल, invioce" value="gst bill">
  <div class="chips" aria-label="Example searches">
    ${['gst bill', 'bill banana', 'बिल', 'udhaar', 'khata', 'staff salary', 'tankhwah', 'invioce', 'passport size photo', 'photo background remove', 'kiraya agreement', 'a']
      .map((q) => `<button type="button">${q}</button>`).join('')}
  </div>
  <div class="cols">
    <section aria-live="polite"><h2>Today</h2><div class="count" id="oldCount"></div><ol id="oldList"></ol></section>
    <section aria-live="polite"><h2>Proposed</h2><div class="count" id="newCount"></div><div class="note" id="newNote"></div><ol id="newList"></ol></section>
  </div>
</main>
<script>
const CATALOG = ${JSON.stringify(catalog)};
const __defs = {
${modules}
};
const __cache = {};
function require(name) {
  if (__cache[name]) return __cache[name].exports;
  const module = { exports: {} };
  __cache[name] = module;
  __defs[name](module, module.exports, require);
  return module.exports;
}
const { createSearch } = require('./searchApps');
const { legacySearch } = require('./legacySearch');
const search = createSearch(CATALOG);
const $ = (id) => document.getElementById(id);
function item(app) {
  const li = document.createElement('li');
  li.textContent = app.name;
  const small = document.createElement('small');
  small.textContent = app.description;
  li.appendChild(small);
  return li;
}
function render() {
  const q = $('q').value;
  const old = legacySearch(CATALOG, q);
  const res = search(q);
  $('oldCount').textContent = q.trim() ? old.length + ' results' : 'Type to search';
  $('oldCount').className = 'count ' + (q.trim() && !old.length ? 'zero' : '');
  $('oldList').replaceChildren(...old.slice(0, 8).map(item));
  $('newCount').textContent = q.trim() ? res.results.length + ' results' : 'Type to search';
  $('newCount').className = 'count ' + (!q.trim() ? '' : res.results.length ? 'ok' : 'zero');
  $('newNote').textContent = res.mode === 'partial' ? 'No app matches every word. Closest matches:' : '';
  $('newList').replaceChildren(...res.results.slice(0, 8).map((r) => item(r.app)));
}
$('q').addEventListener('input', render);
document.querySelectorAll('.chips button').forEach((b) => b.addEventListener('click', () => { $('q').value = b.textContent; render(); }));
render();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(here, 'demo.html'), html);
console.log('wrote', path.join(here, 'demo.html'), Math.round(html.length / 1024) + ' KB');
