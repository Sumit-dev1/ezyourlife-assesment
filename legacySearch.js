// Faithful copy of the live /ai-apps search (Tools-BEUU9YXO.js, de-minified):
//
//   x = query.trim().toLowerCase()
//   N = x ? apps.filter(s => `${s.name} ${s.description} ${L(s).join(" ")} ${(s.tool_types??[]).join(" ")}`
//            .toLowerCase().includes(x)) : []
//
// where L(s) = unique [s.category, ...s.extra_categories].
// The whole query must appear as one substring, and results keep catalogue order (no ranking).

function categoriesOf(app) {
  const out = [];
  for (const c of [app.category, ...(app.extra_categories ?? [])]) {
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

function legacySearch(apps, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return [];
  return apps.filter((s) =>
    `${s.name} ${s.description} ${categoriesOf(s).join(' ')} ${(s.tool_types ?? []).join(' ')}`
      .toLowerCase()
      .includes(q),
  );
}

module.exports = { legacySearch, categoriesOf };
