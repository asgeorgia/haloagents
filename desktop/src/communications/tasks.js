const { randomUUID } = require('crypto');
const { CHANNELS } = require('./contacts');
function clock(now, timezone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', minute: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute) };
}
function minute(time) { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Use HH:MM for allowed hours.'); const [h,m] = time.split(':').map(Number); return h*60+m; }
function draft(input, contacts, now = new Date()) {
  if (!CHANNELS.includes(input.channel)) throw new Error('Choose a supported messaging channel.');
  clock(now, input.timezone);
  if (minute(input.start) >= minute(input.end)) throw new Error('End must be after start on the same day.');
  const cap = Number(input.dailyCap), unitCost = Number(input.unitCost), budget = Number(input.budget);
  if (!Number.isInteger(cap) || cap < 1 || cap > 1000) throw new Error('Daily cap must be 1–1000.');
  if (!Number.isFinite(unitCost) || unitCost <= 0 || !Number.isFinite(budget) || budget < unitCost) throw new Error('Enter a positive per-message upper estimate and total budget.');
  if (typeof input.content !== 'string' || !input.content.trim() || input.content.length > 5000) throw new Error('Message must be 1–5000 characters.');
  if (input.channel === 'sms' && !/^[\x20-\x7e\r\n]{1,160}$/.test(input.content)) throw new Error('SMS is limited to 160 plain ASCII characters to avoid unbudgeted segments.');
  if (input.channel === 'email' && (!input.subject?.trim() || input.subject.length > 200)) throw new Error('Email subject required (maximum 200 characters).');
  const ids = contacts.filter(c => c.channel === input.channel && c.consent).map(c => c.id);
  if (!ids.length) throw new Error('Import opted-in contacts for this channel first.');
  return { id: randomUUID(), name: String(input.name || 'Message task').slice(0,100), channel: input.channel, timezone: input.timezone, start: input.start, end: input.end, dailyCap: cap, unitCost, budget, currency: 'USD', content: input.content, subject: String(input.subject || ''), contactIds: ids, createdAt: now.toISOString(), state: 'draft', attempts: [], spentEstimate: 0, nextEligibleAt: now.toISOString(), reason: '', repeatPolicy: 'once-per-contact' };
}
function nextRun(task, now = new Date()) {
  if (task.state !== 'active') return null;
  // Search forward to the next open window. DST follows the chosen IANA zone.
  const earliest = Math.max(now.getTime(), Date.parse(task.nextEligibleAt));
  for (let t = earliest; t <= earliest + 49*3600000; t += 60000) {
    const c = clock(new Date(t), task.timezone);
    if (c.minute >= minute(task.start) && c.minute < minute(task.end) && task.attempts.filter(a => a.day === c.day).length < task.dailyCap) return new Date(t).toISOString();
  }
  return null;
}
function eligible(task, contacts, suppressed, now) {
  if (task.state !== 'active' || Date.parse(task.nextEligibleAt) > now.getTime()) return null;
  const c = clock(now, task.timezone);
  if (c.minute < minute(task.start) || c.minute >= minute(task.end)) return null;
  if (task.attempts.filter(a => a.day === c.day).length >= task.dailyCap) return null;
  if (task.spentEstimate + task.unitCost > task.budget + 1e-9) { task.state = 'paused'; task.reason = 'Approved estimated budget reached'; return null; }
  const contact = contacts.find(c => task.contactIds.includes(c.id) && c.consent && !suppressed.includes(c.id) && !task.attempts.some(a => a.contactId === c.id));
  if (!contact) { task.state = 'complete'; task.reason = 'All eligible contacts processed once'; return null; }
  return { contact, day: c.day };
}
// Persist reservation before networking. Uncertain requests are never replayed.
class TaskRunner {
  constructor({ load, save, send, now = () => new Date(), busy = () => {} }) { Object.assign(this, { load, save, send, now, busy }); this.running = false; }
  async tick() {
    if (this.running) return;
    this.running = true; this.busy(1);
    try {
      const store = this.load();
      for (const task of store.tasks) {
        const pick = eligible(task, store.contacts, store.suppressed, this.now());
        if (!pick) { this.save(store); continue; }
        const a = { id: randomUUID(), contactId: pick.contact.id, day: pick.day, at: this.now().toISOString(), status: 'reserved' };
        task.attempts.push(a); task.spentEstimate += task.unitCost;
        task.nextEligibleAt = new Date(this.now().getTime() + 60000).toISOString();
        this.save(store);
        try { const result = await this.send(task, pick.contact); a.status = 'accepted'; a.providerId = result.id; }
        catch (err) { a.status = err.definite ? 'rejected' : 'uncertain'; task.state = 'paused'; task.reason = err.safeMessage || 'Delivery uncertain or account unavailable. Review with provider before continuing.'; }
        // Merge only the reservation/result: UI can pause/suppress during a send.
        const latest = this.load(); const current = latest.tasks.find(t => t.id === task.id);
        if (current) {
          const saved = current.attempts.find(x => x.id === a.id); if (saved) Object.assign(saved, a);
          if (task.state === 'paused' && current.state !== 'cancelled') { current.state = task.state; current.reason = task.reason; }
          this.save(latest);
        }
        // One send globally per tick prevents long queues blocking user control.
        break;
      }
    } finally { this.running = false; this.busy(-1); }
  }
}
module.exports = { clock, draft, eligible, nextRun, TaskRunner };
