// Run with: node --test fix/search/searchApps.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSearch, normalize, stem, withinEditDistance } = require('./searchApps');
const { legacySearch } = require('./legacySearch');

// Small fixture shaped like rows from the public tools_catalog endpoint.
const APPS = [
  { id: 'debt', name: 'Bad Debt Recovery', description: 'Draft strict messages for unpaid dues', category: 'Finance & Accounting', tool_types: ['Document Tools'] },
  { id: 'inv', name: 'Invoice Generator', description: 'Create tax-compliant bills with GST calculations', category: 'Finance & Accounting', tool_types: ['Finance & Billing'] },
  { id: 'quote', name: 'GST Quotation', description: 'Professional GST quotation with itemised pricing and tax', category: 'Finance & Accounting', tool_types: ['Document Tools'] },
  { id: 'exp', name: 'Expense Tracker', description: 'Log daily cash expenses to stop leakage', category: 'Finance & Accounting', tool_types: ['Finance & Billing'] },
  { id: 'pp', name: 'Passport Photo Maker', description: 'Official passport photo requirements', category: 'Image Tools', tool_types: ['Photo ID & Passport'] },
  { id: 'bg', name: 'Remove Background', description: 'Auto remove backgrounds', category: 'Image Tools', tool_types: ['Image Tools'] },
];
const search = createSearch(APPS);
const ids = (q) => search(q).results.map((r) => r.app.id);

test('legacy search reproduces the live bug: multi-word queries must appear as one substring', () => {
  assert.deepEqual(legacySearch(APPS, 'gst bill').map((a) => a.id), []);
  // Expense Tracker comes back for "bill" only because its tag "Finance & Billing" contains the substring.
  assert.deepEqual(legacySearch(APPS, 'bill').map((a) => a.id), ['inv', 'exp']);
});

test('every word must match, in any order and any field', () => {
  assert.deepEqual(ids('gst bill'), ['inv']);
  assert.deepEqual(ids('bill gst'), ['inv']);
  assert.equal(search('gst bill').mode, 'all');
});

test('name matches outrank description matches', () => {
  // "quotation" is in the GST Quotation name; nothing else mentions it.
  assert.equal(ids('gst')[0], 'quote');
  assert.equal(ids('invoice')[0], 'inv');
});

test('Hindi and Hinglish words find the English apps', () => {
  assert.equal(ids('बिल')[0], 'inv');
  assert.equal(ids('udhaar')[0], 'debt');
  assert.equal(ids('khata')[0], 'exp');
  assert.equal(ids('daily kharcha')[0], 'exp');
});

test('filler words like "banana" are ignored', () => {
  assert.equal(ids('bill banana')[0], 'inv');
  assert.equal(ids('mera bill banao')[0], 'inv');
});

test('one typo is forgiven on longer words, including swapped letters', () => {
  assert.equal(ids('invioce')[0], 'inv');
  assert.equal(ids('quotaion')[0], 'quote');
  assert.equal(ids('passprt photo')[0], 'pp');
});

test('falls back to closest matches instead of an empty page', () => {
  const r = search('photo background hatao');
  assert.equal(r.mode, 'partial');
  assert.equal(r.results[0].app.id, 'bg');
});

test('nonsense, punctuation and one-letter queries return nothing', () => {
  for (const q of ['', '   ', 'a', '%', '<b>x</b>', 'zzzzqqq']) {
    assert.equal(search(q).results.length, 0, JSON.stringify(q));
  }
});

test('results keep catalogue order when scores tie', () => {
  const tied = createSearch([
    { id: 'first', name: 'Alpha Tool', description: 'stock', category: 'X' },
    { id: 'second', name: 'Beta Tool', description: 'stock', category: 'X' },
  ]);
  assert.deepEqual(tied('stock').results.map((r) => r.app.id), ['first', 'second']);
});

test('helpers', () => {
  assert.equal(normalize('  GST—Bill!! '), 'gst bill');
  assert.equal(normalize('ＧＳＴ'), 'gst'); // full-width letters from some Indian keyboards
  assert.equal(stem('bills'), 'bill');
  assert.equal(stem('invoices'), 'invoice');
  assert.equal(stem('glass'), 'glass');
  assert.equal(stem('बिल'), 'बिल');
  assert.equal(withinEditDistance('invioce', 'invoice', 1), true);
  assert.equal(withinEditDistance('visiting', 'listing', 1), false);
});
