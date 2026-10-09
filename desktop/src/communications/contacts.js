const { parse } = require('csv-parse/sync');
const { createHash } = require('crypto');
const CHANNELS = ['email', 'sms', 'whatsapp'];
function normalize(channel, address) { return channel === 'email' ? address.trim().toLowerCase() : address.trim(); }
function contactKey(channel, address) { return createHash('sha256').update(`${channel}:${normalize(channel, address)}`).digest('hex'); }
function importContacts(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 2_000_000) throw new Error('CSV must be under 2 MB.');
  const records = parse(text, { columns: true, bom: true, skip_empty_lines: true, trim: true, max_record_size: 10000 });
  if (records.length > 10000) throw new Error('Maximum 10,000 rows per import.');
  const contacts = [], rejected = [], seen = new Set();
  records.forEach((r, i) => {
    const channel = String(r.channel || '').toLowerCase();
    const address = normalize(channel, String(r.address || ''));
    const consent = String(r.consent || '').toLowerCase();
    const evidence = String(r.consent_evidence || '').trim();
    const date = String(r.consent_date || '');
    let reason;
    if (!CHANNELS.includes(channel)) reason = 'channel must be email, sms or whatsapp';
    else if (channel === 'email' ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) : !/^\+[1-9]\d{7,14}$/.test(address)) reason = 'Invalid email or E.164 phone number';
    else if (!['yes', 'true'].includes(consent) || evidence.length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date || Date.parse(date) > Date.now()) reason = 'Missing valid, dated opt-in evidence';
    const id = contactKey(channel, address);
    if (!reason && seen.has(id)) reason = 'Duplicate contact';
    if (reason) rejected.push({ row: i + 2, reason });
    else { seen.add(id); contacts.push({ id, channel, address, name: String(r.name || '').slice(0, 200), consent: true, evidence: evidence.slice(0, 1000), consentDate: date }); }
  });
  return { contacts, rejected };
}
module.exports = { importContacts, contactKey, CHANNELS };
