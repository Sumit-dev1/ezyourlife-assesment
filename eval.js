// Before/after comparison on the real public catalogue snapshot (evidence/catalog.json, 425 live apps,
// captured 29 Oct 2026). Usage: node fix/search/eval.js
const path = require('node:path');
const { legacySearch } = require('./legacySearch');
const { createSearch } = require('./searchApps');

const catalog = require(path.join(__dirname, '../../evidence/catalog.json'));
const search = createSearch(catalog);

// Real things a shop owner would type, with the app(s) a human would expect near the top.
// A query "hits" when any expected app is in the first 3 results.
const CASES = [
  ['invoice', ['tool-1']],
  ['bill', ['tool-1', 'tool-98']],
  ['bills', ['tool-1', 'tool-98']],
  ['gst bill', ['tool-1', 'tool-40']],
  ['gst invoice', ['tool-1']],
  ['bill banana', ['tool-1', 'tool-98']],
  ['बिल', ['tool-1', 'tool-98']],
  ['invioce', ['tool-1']],
  ['receipt', ['tool-98', 'tool-80']],
  ['rasid', ['tool-98']],
  ['quotation', ['tool-40']],
  ['quotaion', ['tool-40']],
  ['gst quotation', ['tool-40']],
  ['udhaar', ['tool-5']],
  ['udhaar wapas', ['tool-5']],
  ['payment reminder', ['tool-14', 'tool-5']],
  ['khata', ['tool-2', 'tool-46']],
  ['daily kharcha', ['tool-2']],
  ['salary', ['tool-30', 'tool-50', 'tool-34']],
  ['salary slip', ['tool-50']],
  ['staff salary', ['tool-30', 'tool-34', 'tool-50']],
  ['tankhwah', ['tool-30', 'tool-50', 'tool-34']],
  ['attendance', ['tool-35', 'tool-91']],
  ['staff hazri', ['tool-35', 'tool-91']],
  ['stock', ['tool-20', 'tool-25']],
  ['maal ka hisab', ['tool-20', 'tool-25', 'tool-2']],
  ['profit', ['tool-3']],
  ['munafa', ['tool-3']],
  ['passport photo', ['passport-photo-maker']],
  ['passport size photo', ['passport-photo-maker']],
  ['remove background', ['remove-background']],
  ['photo background remove', ['remove-background']],
  ['signature', ['generate-signature', 'resize-signature']],
  ['rent agreement', ['tool-60']],
  ['kiraya agreement', ['tool-60']],
  ['loan agreement', ['tool-69']],
  ['shop poster', ['poster-and-flyer-studio']],
  ['whatsapp catalogue', ['whatsapp-catalogue-maker']],
  ['caption', ['caption-generator']],
  ['resume', ['resume-studio']],
];

// Hold-out set: written after the synonym list was frozen and never used for tuning,
// so it shows how the approach does on queries it was not shaped around.
const HOLDOUT = [
  ['tax invoice', ['tool-1']],
  ['estimate banana', ['tool-40', 'tool-77']],
  ['employee salary slip', ['tool-50']],
  ['customer ko reminder', ['tool-14']],
  ['stock register', ['tool-20', 'tool-25']],
  ['kharcha', ['tool-2', 'tool-46']],
  ['photo ka background hatao', ['remove-background']],
  ['sign banao', ['generate-signature']],
  ['naukri resume', ['resume-studio']],
  ['shop ke liye poster', ['poster-and-flyer-studio']],
  ['delivery challan', ['tool-80', 'tool-43']], // label fixed after run 1: I had missed that a Delivery Challan app exists
  ['proforma', ['tool-41']],
  ['pay slip', ['tool-50']],
  ['rent receipt', ['tool-98', 'tool-60']],
  ['gst return', ['gst-reconciliation-check']],
  ['passport foto', ['passport-photo-maker']],
];

function rank(results, ids) {
  const i = results.findIndex((a) => ids.includes(a.id));
  return i === -1 ? null : i + 1;
}

let before = { zero: 0, top3: 0, found: 0 };
let after = { zero: 0, top3: 0, found: 0, partial: 0 };
const rows = [];
for (const [q, ids] of CASES) {
  const old = legacySearch(catalog, q);
  const res = search(q);
  const neu = res.results.map((r) => r.app);
  const ro = rank(old, ids);
  const rn = rank(neu, ids);
  if (old.length === 0) before.zero += 1;
  if (ro && ro <= 3) before.top3 += 1;
  if (ro) before.found += 1;
  if (neu.length === 0) after.zero += 1;
  if (rn && rn <= 3) after.top3 += 1;
  if (rn) after.found += 1;
  if (res.mode === 'partial') after.partial += 1;
  rows.push({ q, oldN: old.length, oldRank: ro ?? '-', newN: neu.length, newRank: rn ?? '-', mode: res.mode, top: neu.slice(0, 3).map((a) => a.name).join(' | ') });
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('query', 26), pad('before: n', 10), pad('rank', 6), pad('after: n', 9), pad('rank', 6), pad('mode', 8), 'after top 3');
for (const r of rows) console.log(pad(JSON.stringify(r.q), 26), pad(r.oldN, 10), pad(r.oldRank, 6), pad(r.newN, 9), pad(r.newRank, 6), pad(r.mode, 8), r.top.slice(0, 90));
const n = CASES.length;
const pct = (x) => `${Math.round((100 * x) / n)}%`;
console.log(`\n${n} queries`);
console.log(`zero-result rate     before ${pct(before.zero)} (${before.zero})   after ${pct(after.zero)} (${after.zero})`);
console.log(`expected app top 3   before ${pct(before.top3)} (${before.top3})   after ${pct(after.top3)} (${after.top3})`);
console.log(`expected app found   before ${pct(before.found)} (${before.found})   after ${pct(after.found)} (${after.found})`);
console.log(`after: ${after.partial} queries answered with "closest matches" fallback`);

console.log('\nHold-out set (not used for tuning):');
const hold = { b0: 0, b3: 0, a0: 0, a3: 0 };
for (const [q, ids] of HOLDOUT) {
  const old = legacySearch(catalog, q);
  const res = search(q);
  const ro = rank(old, ids);
  const rn = rank(res.results.map((r) => r.app), ids);
  if (!old.length) hold.b0 += 1;
  if (ro && ro <= 3) hold.b3 += 1;
  if (!res.results.length) hold.a0 += 1;
  if (rn && rn <= 3) hold.a3 += 1;
  console.log(pad(JSON.stringify(q), 28), pad(`before ${old.length}/${ro ?? '-'}`, 14), pad(`after ${res.results.length}/${rn ?? '-'}`, 13), pad(res.mode, 8), res.results.slice(0, 3).map((r) => r.app.name).join(' | ').slice(0, 80));
}
const h = HOLDOUT.length;
console.log(`hold-out zero-result  before ${hold.b0}/${h}   after ${hold.a0}/${h}`);
console.log(`hold-out top 3        before ${hold.b3}/${h}   after ${hold.a3}/${h}`);

const t0 = process.hrtime.bigint();
for (let i = 0; i < 200; i++) search(CASES[i % n][0]);
console.log(`speed: ${(Number(process.hrtime.bigint() - t0) / 1e6 / 200).toFixed(2)} ms per query over ${catalog.length} apps`);

module.exports = { CASES, HOLDOUT };
