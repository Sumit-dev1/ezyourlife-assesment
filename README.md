# Part D: app search that understands how shop owners type

**Finding fixed:** B-03. The /ai-apps search only returns apps whose text contains the *whole query as one
substring*, in catalogue order. So "gst bill", "staff salary", "बिल", "udhaar" and "invioce" all return
**0 apps**, even though Invoice Generator ("Create tax-compliant bills with GST calculations") exists.

## What the live code does (from the public bundle `Tools-BEUU9YXO.js`)

```js
x = b.trim().toLowerCase();
N = x ? I.filter(s =>
      `${s.name} ${s.description} ${L(s).join(" ")} ${(s.tool_types ?? []).join(" ")}`
        .toLowerCase().includes(x))
    : [];
// L(s) = unique [s.category, ...s.extra_categories]
```

`legacySearch.js` is a line-for-line copy, so the before/after numbers compare against the real behaviour.

## What I changed (`searchApps.js`, `synonyms.js`)

| Change | Why |
|---|---|
| Split the query into words. Every meaningful word must match somewhere (any field, any order) | "gst bill" finds Invoice Generator |
| Drop filler words: "banana", "chahiye", "mera", "ka", "for", "the"… | "bill banana" means "make a bill" |
| Synonyms in English, Hinglish and Hindi (30 small groups, hand-written) | "बिल", "rasid", "udhaar", "khata", "tankhwah", "hazri", "kiraya" now find the right apps |
| Forgive one typo on words of 5+ letters (two on 10+); a swap of neighbouring letters counts as one | "invioce", "quotaion" |
| Rank results: name match 10, category/type 4, description 2; synonym ×0.8, typo ×0.6; ties keep catalogue order | "invoice" → Invoice Generator first, not "Bad Debt Recovery" |
| If no app matches *every* word, show the apps matching *most* words with the note "No app matches every word. Closest matches:" | No more dead-end empty page for "udhaar wapas" |
| Ignore one-letter words and one-character queries | "a" no longer returns 548 results |

There are no dependencies, and it is a pure function. It builds an index once per catalogue load and takes about 5.6 ms per query for 425 apps on a laptop.

## How I tested it

1. **Unit tests**: `node --test fix/search/searchApps.test.js`. There are 10 tests: multi-word, ranking, Hindi/Hinglish, filler words,
   typos, partial fallback, junk input (`%`, `<b>x</b>`, `a`), tie order, and helpers. One test pins the legacy bug so the
   difference is explicit.
2. **Before/after on the real catalogue**: `node fix/search/eval.js` (output saved in `eval-output.txt`). It runs 40 realistic
   shopkeeper queries against the public catalogue snapshot (425 live apps, 29 Oct 2026):

   | | Today | Proposed |
   |---|---|---|
   | Queries with zero results | **53%** (21/40) | **0%** (0/40) |
   | Expected app in the top 3 | 45% (18/40) | 100% (40/40) |

   Caveat: I wrote that list while building the synonyms, so it flatters the fix. A **hold-out set of 16 queries,
   written after the synonyms were frozen and never tuned on**, gives: zero results 14/16 → 0/16, expected app in the top 3
   2/16 → 15/16. The one miss is "gst return", where GST Reconciliation ranks 4th behind "Return Authorization".
   I also fixed one label after the first run: I had not known a "Delivery Challan" app exists. The search found it, and my
   label was wrong.
3. **Demo**: `demo.html` (built by `node fix/search/build-demo.js`). It shows today's search and the new one side by side over
   the same 425 apps. It opens straight from disk, so no server is needed. Screenshots: `demo-gst-bill.png`, `demo-hindi-mobile.png`.
4. **End to end**: the Playwright test `B-03: searching "gst bill" finds the Invoice Generator` is marked `test.fail()` today.
   Once this ships, Playwright reports "expected to fail but passed", which is the cue to remove the marker.

## How it would go into the real code (proposed patch, against the de-minified component)

```diff
+ import { createSearch } from '@/lib/searchApps';
  …
- const x = b.trim().toLowerCase();
- const N = useMemo(() => x ? I.filter(s => `${s.name} ${s.description} ${L(s).join(" ")} ${(s.tool_types ?? []).join(" ")}`
-   .toLowerCase().includes(x)) : [], [I, x]);
+ const searchApps = useMemo(() => createSearch(I), [I]);          // index rebuilt only when the catalogue changes
+ const { results, mode } = useMemo(() => searchApps(b), [searchApps, b]);
+ const N = results.map((r) => r.app);
  …
+ {mode === 'partial' && <p className="text-sm text-muted-foreground">No app matches every word. Closest matches:</p>}
```

Also log every query that returns `mode !== 'all'` (debounced, no personal data) to a `search_misses` table.
That list is how the synonym groups grow from real usage instead of guesses.

## What could go wrong

- **Synonym false positives.** For example "sign" also matches "Resize Sign 6cm x 2cm", and "challan" is grouped with "bill". Every group
  should be reviewed by someone who talks to customers, and each new entry needs a test query.
- **AND matching can hide results** when one word is noise (for example "photo ka background hatao"). The partial fallback covers this,
  but the fallback list is ranked more loosely, so it needs watching in the miss log.
- **Ranking is hand-weighted, not learned.** I tried a variant that rewards matches in several fields. It improved the hold-out set
  but pushed Invoice Generator down for "bill", so I reverted it. Real click data should drive the next change.
- **Hindi coverage is thin**: about 40 Devanagari words. Transliteration such as "बिल" ↔ "bil" is only handled where I listed it.
- **Two searches can disagree.** The home page "Find" box and the websites/cards search (`ip_products`) use their own matching.
  They should share this module, or users will see different answers in different places.
- **Cost of the index**: about 425 entries is trivial. At 10k+ apps it should move to Postgres full-text search with `pg_trgm`
  on the server rather than downloading the whole catalogue to the phone (see B-06).

## If I had the codebase, I would check first

1. Whether any other component (home "Find", `ToolsEmptyState`, the browser extension) has its own copy of the substring filter.
2. Whether `tools_catalog` has per-app keywords or aliases I could use instead of a hard-coded synonym file.
3. Analytics: what people actually search for today, and what share of searches end with no app opened.
