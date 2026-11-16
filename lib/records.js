const STR = [
  'fileNumber', 'borrowerName', 'state', 'keyword', 'documents', 'playbookDocName',
  'selectedDocumentName', 'comments', 'processorName', 'processor', 'timeStarted',
  'timeEnded', 'initialAuditor', 'finalAuditor', 'error', 'errorDetails'
];

// Keeps only known fields, trims sizes, and drops rows with nothing useful in them.
function sanitize(r) {
  if (!r || typeof r !== 'object') return null;
  const o = {};
  for (const f of STR) {
    const v = r[f];
    if (v == null) continue;
    const s = String(v).slice(0, 8000);
    if (s.trim()) o[f] = s;
  }
  if (typeof r.date === 'number' && isFinite(r.date)) o.date = r.date;
  if (Number.isInteger(r.minutes)) o.minutes = r.minutes;
  if (!o.documents && !o.comments && !o.processorName && !o.processor) return null;
  return o;
}

// Same duplicate rule the page has always used.
function keyOf(r) {
  return [r.fileNumber, r.documents, r.date, r.timeStarted, r.processor || r.processorName, (r.comments || '').slice(0, 60)]
    .map((x) => String(x || '').toLowerCase())
    .join('|');
}

module.exports = { sanitize, keyOf };
