// Words a small-shop owner actually types, grouped by meaning.
// Each group lists English catalogue words first, then Hinglish and Hindi (Devanagari) forms.
// A query word that matches any entry in a group also searches the other entries of that group.
// Kept deliberately small and hand-written: every entry should be explainable by a real query.

const GROUPS = [
  ['bill', 'invoice', 'billing', 'बिल', 'bil', 'chalan', 'challan', 'चालान'],
  ['receipt', 'rasid', 'raseed', 'रसीद', 'parchi', 'पर्ची'],
  ['quotation', 'quote', 'estimate', 'kotation', 'कोटेशन'],
  ['gst', 'जीएसटी'],
  ['dues', 'unpaid', 'debt', 'recovery', 'udhaar', 'udhar', 'उधार', 'baki', 'baaki', 'बाकी'],
  ['ledger', 'expense', 'khata', 'khaata', 'खाता', 'bahi', 'बही', 'hisab', 'hisaab', 'हिसाब'],
  ['reminder', 'follow-up', 'yaad', 'tagada', 'तगादा'],
  ['salary', 'payroll', 'payslip', 'vetan', 'वेतन', 'tankhwah', 'tankha', 'तनख्वाह', 'pagaar', 'पगार'],
  ['staff', 'employee', 'karmchari', 'कर्मचारी', 'worker'],
  ['attendance', 'hazri', 'haziri', 'हाजिरी', 'हाज़िरी'],
  ['stock', 'inventory', 'maal', 'माल', 'स्टॉक'],
  ['profit', 'margin', 'munafa', 'मुनाफा', 'मुनाफ़ा'],
  ['expense', 'kharcha', 'kharch', 'खर्चा', 'खर्च'],
  ['photo', 'image', 'picture', 'pic', 'फोटो', 'tasveer', 'तस्वीर'],
  ['signature', 'sign', 'hastakshar', 'हस्ताक्षर'],
  ['agreement', 'contract', 'karar', 'करार', 'anubandh', 'अनुबंध'],
  ['rent', 'rental', 'kiraya', 'किराया', 'lease'],
  ['loan', 'emi', 'karz', 'karj', 'कर्ज', 'क़र्ज़'],
  ['resume', 'cv', 'biodata', 'बायोडाटा'],
  ['menu', 'मेनू', 'ratelist'],
  ['customer', 'client', 'grahak', 'ग्राहक'],
  ['shop', 'store', 'dukaan', 'dukan', 'दुकान'],
  ['wedding', 'shaadi', 'shadi', 'शादी', 'vivah', 'विवाह', 'marriage'],
  ['invitation', 'invite', 'nimantran', 'निमंत्रण', 'amantran'],
  ['birthday', 'janamdin', 'जन्मदिन', 'bday'],
  ['poster', 'banner', 'flyer', 'pamphlet', 'पोस्टर'],
  ['caption', 'captions'],
  ['letter', 'patra', 'पत्र'],
  ['website', 'site', 'वेबसाइट'],
  ['whatsapp', 'व्हाट्सएप'],
];

// Words that carry no search meaning on their own ("bill banana" = "make a bill").
const STOPWORDS = new Set([
  'a', 'an', 'the', 'for', 'to', 'of', 'my', 'me', 'i', 'and', 'in', 'on', 'with', 'want', 'need', 'please', 'how',
  'banana', 'banao', 'banaye', 'banayein', 'chahiye', 'kaise', 'ka', 'ki', 'ke', 'ko', 'mera', 'meri', 'mere',
  'hai', 'aur', 'karo', 'kare', 'karna', 'online', 'free',
  'का', 'की', 'के', 'को', 'मेरा', 'मेरी', 'है', 'और', 'बनाना', 'बनाओ', 'चाहिए',
]);

// Fixed Indian-English phrases rewritten before splitting into words ("passport size photo" is a passport photo).
const PHRASES = [
  ['passport size', 'passport'],
  ['bahi khata', 'khata'],
];

const SYNONYMS = new Map();
for (const group of GROUPS) {
  for (const word of group) {
    const existing = SYNONYMS.get(word) ?? new Set();
    for (const other of group) existing.add(other);
    SYNONYMS.set(word, existing);
  }
}

module.exports = { SYNONYMS, STOPWORDS, PHRASES };
