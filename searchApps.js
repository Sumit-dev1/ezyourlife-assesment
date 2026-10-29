// Drop-in replacement for the /ai-apps search filter.
//
// What changes compared with the live substring match:
//  1. The query is split into words; an app must match every meaningful word (in any field, any order),
//     so "gst bill" finds "Invoice Generator: ...bills with GST calculations".
//  2. Each word is expanded with shopkeeper synonyms, including Hinglish and Hindi ("बिल", "udhaar", "khata").
//  3. One-letter typos are forgiven on longer words ("invioce", "quotaion").
//  4. Results are ranked: a match in the app name beats a match in the description.
//  5. If no app matches every word, it falls back to apps that match most of them and says so (mode "partial"),
//     instead of showing an empty page.
//  6. One-character queries return nothing, instead of "548 results" for "a".

const { SYNONYMS, STOPWORDS, PHRASES } = require('./synonyms');

const WEIGHTS = { name: 10, tags: 4, description: 2 };
const SYNONYM_FACTOR = 0.8;
const FUZZY_FACTOR = 0.6;

function normalize(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}

function words(text) {
  const n = normalize(text);
  return n ? n.split(' ') : [];
}

// Plural/simple-suffix folding for English words only; Devanagari is left alone.
function stem(word) {
  if (!/^[a-z]+$/.test(word) || word.length <= 3) return word;
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('es') && /(ch|sh|x|s)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

// Edit distance where swapping two neighbouring letters counts as one typo ("invioce" -> "invoice"),
// with an early exit once every path is already over max.
function withinEditDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return false;
  let prevPrev = null;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        curr[j] = Math.min(curr[j], prevPrev[j - 2] + 1);
      }
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return false;
    prevPrev = prev;
    prev = curr;
  }
  return prev[b.length] <= max;
}

function allowedTypos(word) {
  if (!/^[a-z]+$/.test(word)) return 0; // no fuzzy matching for Devanagari or numbers
  if (word.length >= 10) return 2; // at 8 letters, 2 typos already turns "visiting" into "listing"
  if (word.length >= 5) return 1;
  return 0;
}

function buildIndex(apps) {
  return apps.map((app, order) => {
    const categories = [app.category, ...(app.extra_categories ?? [])].filter(Boolean);
    const fields = {
      name: normalize(app.name),
      tags: normalize([...categories, ...(app.tool_types ?? [])].join(' ')),
      description: normalize(app.description),
    };
    const fieldWords = {};
    const fieldList = {};
    for (const key of Object.keys(fields)) {
      fieldWords[key] = new Set(fields[key].split(' ').filter(Boolean).flatMap((w) => [w, stem(w)]));
      fieldList[key] = [...fieldWords[key]];
    }
    return { app, order, fields, fieldWords, fieldList };
  });
}

// Best score for one query variant (a word or multi-word synonym) against one app.
function scoreVariant(entry, variant) {
  let best = 0;
  const isPhrase = variant.includes(' ');
  for (const [field, weight] of Object.entries(WEIGHTS)) {
    const text = entry.fields[field];
    const vocab = entry.fieldWords[field];
    const list = entry.fieldList[field];
    let s = 0;
    if (isPhrase) {
      if (text.includes(variant)) s = weight;
    } else if (vocab.has(variant) || vocab.has(stem(variant))) {
      s = weight; // whole word
    } else if (variant.length >= 3 && list.some((w) => w.startsWith(variant))) {
      s = weight * 0.8; // prefix: "invo" -> "invoice"
    } else if (variant.length >= 4 && text.includes(variant)) {
      s = weight * 0.5; // inside a longer word
    } else {
      const max = allowedTypos(variant);
      if (max > 0 && list.some((w) => w.length >= 4 && withinEditDistance(variant, w, max))) {
        s = weight * FUZZY_FACTOR;
      }
    }
    if (s > best) best = s;
  }
  return best;
}

function expand(term) {
  const variants = new Map([[term, 1]]);
  const stemmed = stem(term);
  for (const key of new Set([term, stemmed])) {
    for (const syn of SYNONYMS.get(key) ?? []) {
      const n = normalize(syn);
      if (!variants.has(n)) variants.set(n, SYNONYM_FACTOR);
    }
  }
  return variants;
}

function createSearch(apps) {
  const index = buildIndex(apps);

  return function search(query, { limit = 50 } = {}) {
    let normalized = ` ${normalize(query)} `;
    for (const [from, to] of PHRASES) normalized = normalized.replaceAll(` ${from} `, ` ${to} `);
    const raw = words(normalized).filter((w) => w.length > 1); // single letters match almost everything
    const terms = raw.filter((w) => !STOPWORDS.has(w));
    const effective = terms.length ? terms : raw; // "free" alone still searches for "free"
    if (normalize(query).replace(/ /g, '').length < 2) {
      return { mode: 'none', terms: [], results: [] };
    }

    const expanded = effective.map(expand);
    const scored = [];
    for (const entry of index) {
      let total = 0;
      let matched = 0;
      for (const variants of expanded) {
        let best = 0;
        for (const [variant, factor] of variants) {
          const s = scoreVariant(entry, variant) * factor;
          if (s > best) best = s;
        }
        if (best > 0) matched += 1;
        total += best;
      }
      if (matched > 0) scored.push({ app: entry.app, order: entry.order, score: total, matched });
    }

    const byRank = (a, b) => b.matched - a.matched || b.score - a.score || a.order - b.order;
    const all = scored.filter((r) => r.matched === expanded.length).sort(byRank);
    if (all.length) {
      return { mode: 'all', terms: effective, results: all.slice(0, limit) };
    }
    // Nothing matches every word: show what matches most words rather than an empty page.
    const partial = expanded.length > 1 ? scored.sort(byRank).slice(0, Math.min(limit, 12)) : [];
    return { mode: partial.length ? 'partial' : 'none', terms: effective, results: partial };
  };
}

module.exports = { createSearch, normalize, stem, withinEditDistance };
