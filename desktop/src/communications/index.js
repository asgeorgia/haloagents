const { dialog } = require('electron');
const fs = require('fs');
const vault = require('../vault');
const { importContacts, contactKey, CHANNELS } = require('./contacts');
const { draft, nextRun, TaskRunner } = require('./tasks');
const { sendMessage, validate, refreshDelivery } = require('./providers');
const EMPTY = { contacts: [], suppressed: [], tasks: [], accounts: {} };
const load = () => vault.read('communications', EMPTY);
const save = s => vault.write('communications', s);
function publicAccount(a = {}) { const { apiKey, apiSecret, ...rest } = a; return { ...rest, keySaved: Boolean(apiKey || apiSecret) }; }
function snapshot() { const s = load(); return { contacts: s.contacts.map(({ evidence, ...c }) => ({ ...c, suppressed: s.suppressed.includes(c.id) })), tasks: s.tasks.map(t => ({ ...t, nextRun: nextRun(t) })), accounts: Object.fromEntries(CHANNELS.map(c => [c, publicAccount(s.accounts[c])])) }; }
async function importCSV(win) {
  const choice = await dialog.showOpenDialog(win, { title: 'Import opted-in contacts', filters: [{ name: 'Contacts CSV', extensions: ['csv'] }], properties: ['openFile'] });
  if (choice.canceled || !choice.filePaths[0]) return { cancelled: true };
  if (fs.statSync(choice.filePaths[0]).size > 2_000_000) throw new Error('CSV must be under 2 MB.');
  const result = importContacts(fs.readFileSync(choice.filePaths[0], 'utf8'));
  const s = load(); let added = 0;
  for (const c of result.contacts) { if (!s.contacts.some(x => x.id === c.id) && !s.suppressed.includes(c.id)) { s.contacts.push(c); added++; } }
  save(s); return { added, rejected: result.rejected, duplicatesOrSuppressed: result.contacts.length - added };
}
function saveAccount(channel, input) {
  if (!CHANNELS.includes(channel)) throw new Error('Invalid channel');
  const s = load(), old = s.accounts[channel] || {};
  const fields = channel === 'email' ? ['from','apiKey','unsubscribeGroup'] : ['accountSid','apiKeySid','apiSecret','messagingServiceSid','contentSid'];
  const a = { verified: input.verified === true, consentHandling: input.consentHandling === true };
  for (const f of fields) a[f] = typeof input[f] === 'string' && input[f].trim() ? input[f].trim().slice(0,1000) : old[f] || '';
  validate(a, channel); s.accounts[channel] = a;
  // Changed senders/templates invalidate existing approvals.
  for (const t of s.tasks.filter(t => t.channel === channel && !['complete','cancelled'].includes(t.state))) { t.state = 'draft'; t.reason = 'Account changed; approve again'; }
  save(s); return publicAccount(a);
}
async function createTask(input, win) {
  const s = load(); validate(s.accounts[input.channel], input.channel);
  const t = draft(input, s.contacts.filter(c => !s.suppressed.includes(c.id)));
  if (t.channel === 'whatsapp') {
    if (input.templateReviewed !== true) throw new Error('Confirm that the displayed text exactly matches the approved static WhatsApp template. Variables are not supported yet.');
    t.contentSid = s.accounts.whatsapp.contentSid;
  }
  t.accountSnapshot = JSON.stringify(publicAccount(s.accounts[t.channel]));
  t.state = 'draft'; s.tasks.push(t); save(s);
  await approveTask(t.id, win); return snapshot();
}
async function approveTask(id, win) {
  let s = load(), t = s.tasks.find(t => t.id === id); if (!t || ['complete','cancelled'].includes(t.state)) throw new Error('Task not approvable.');
  validate(s.accounts[t.channel], t.channel);
  const accountVersion = JSON.stringify(publicAccount(s.accounts[t.channel]));
  const result = await dialog.showMessageBox(win, { type: 'question', buttons: ['Cancel','Approve schedule'], defaultId: 0, cancelId: 0, title: 'Approve recurring messaging', message: `${t.name} · ${t.channel} · ${t.contactIds.length} contacts, once each`, detail: `${t.content}\n\nSubject: ${t.subject || 'n/a'}\nAllowed hours ${t.start}–${t.end} (${t.timezone})\nCap ${t.dailyCap}/day. Estimated upper cost $${t.unitCost}/message; total approved estimate $${t.budget} USD. Provider billing can differ; set provider-side limits.\n${t.contentSid ? `Static approved template: ${t.contentSid}\n` : ''}Runs only while Halo is open. Missed windows are skipped. Research is not consent. No automatic uncertain retries.` });
  s = load(); t = s.tasks.find(t => t.id === id);
  if (result.response === 1 && t && !['cancelled','complete'].includes(t.state)) {
    if (accountVersion !== JSON.stringify(publicAccount(s.accounts[t.channel]))) throw new Error('Account changed during approval; approve again.');
    t.state = 'active'; t.approvedAt = new Date().toISOString(); t.reason = ''; t.nextEligibleAt = new Date().toISOString(); save(s);
  }
}
function action(id, action) {
  const s = load(); const t = s.tasks.find(t => t.id === id); if (!t) throw new Error('Task not found');
  if (!['pause','cancel'].includes(action)) throw new Error('Resume requires fresh approval');
  if (['complete','cancelled'].includes(t.state)) throw new Error('Task already closed');
  t.state = action === 'pause' ? 'paused' : 'cancelled'; t.reason = 'Owner action'; save(s); return snapshot();
}
function suppress(channel, address) {
  if (!CHANNELS.includes(channel) || typeof address !== 'string') throw new Error('Channel and recipient required');
  const s = load(), id = contactKey(channel,address); if (!s.suppressed.includes(id)) s.suppressed.push(id);
  save(s); return snapshot();
}
async function refresh(id) {
  const s = load(), t = s.tasks.find(t => t.id === id); if (!t) throw new Error('Task not found');
  // Limited manual reconciliation; never sends a message.
  for (const a of t.attempts.slice(-20).filter(a => a.providerId && !['delivered','read','failed','undelivered'].includes(a.status))) {
    const result = await refreshDelivery(t,a,s.accounts[t.channel]); a.status = result.status;
    if (result.optOut && !s.suppressed.includes(a.contactId)) s.suppressed.push(a.contactId);
  }
  const latest = load(), current = latest.tasks.find(x => x.id === id);
  if (current) for (const a of t.attempts) { const entry = current.attempts.find(x => x.id === a.id); if (entry) Object.assign(entry,a); }
  latest.suppressed = [...new Set([...latest.suppressed,...s.suppressed])]; save(latest); return snapshot();
}
function start(busy) {
  const runner = new TaskRunner({ load, save, busy, send: (t,c) => { const account = load().accounts[t.channel]; if (t.contentSid && t.contentSid !== account?.contentSid) throw new Error('Template changed; reapproval required'); return sendMessage(t,c,account); } });
  // Crash recovery: a reserved request may already have left the computer.
  if (vault.available()) { const s = load(); for (const t of s.tasks) if (t.attempts.some(a => a.status === 'reserved')) { t.state='paused'; t.reason='Interrupted send; review provider records before approving remaining recipients'; for (const a of t.attempts.filter(a => a.status === 'reserved')) a.status='uncertain'; } save(s); }
  const timer = setInterval(() => { if (vault.available()) runner.tick().catch(() => {}); },60000);
  return () => clearInterval(timer);
}
module.exports = { snapshot, importCSV, saveAccount, createTask, approveTask, action, suppress, refresh, start };
