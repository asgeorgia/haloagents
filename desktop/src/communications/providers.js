function failure(message, definite = true) { return Object.assign(new Error(message), { safeMessage: message, definite }); }
function validate(account, channel) {
  if (!account || !account.verified || !account.consentHandling) throw failure('Verify sender and consent/opt-out configuration in Accounts.');
  if (channel === 'email') {
    if (!account.apiKey || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.from || '') || !account.unsubscribeGroup || !/^\d+$/.test(String(account.unsubscribeGroup))) throw failure('SendGrid key, verified sender and unsubscribe group required.');
  } else {
    if (!/^AC[a-f0-9]{32}$/i.test(account.accountSid || '') || !/^SK[a-f0-9]{32}$/i.test(account.apiKeySid || '') || !account.apiSecret || !/^MG[a-f0-9]{32}$/i.test(account.messagingServiceSid || '')) throw failure('Twilio Account SID, API key/secret and registered Messaging Service required.');
    if (channel === 'whatsapp' && !/^HX[a-f0-9]{32}$/i.test(account.contentSid || '')) throw failure('An approved WhatsApp Content SID is required.');
  }
}
async function request(url, options, fetcher = fetch) {
  let r;
  try { r = await fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(30000) }); }
  catch { throw failure('Delivery uncertain. Check provider records; this recipient will not be retried automatically.', false); }
  if (!r.ok) {
    // Do not persist or log response bodies: providers may echo recipient or credentials.
    throw failure(`Provider HTTP ${r.status}. Task paused; review the provider console.`, r.status < 500);
  }
  return r;
}
async function sendMessage(task, contact, account, fetcher = fetch) {
  validate(account, task.channel);
  if (task.channel === 'email') {
    const r = await request('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { Authorization: `Bearer ${account.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ personalizations: [{ to: [{ email: contact.address }] }], from: { email: account.from }, subject: task.subject, content: [{ type: 'text/plain', value: task.content }], asm: { group_id: Number(account.unsubscribeGroup) }, mail_settings: { bypass_list_management: { enable: false }, bypass_unsubscribe_management: { enable: false } } }) }, fetcher);
    return { id: r.headers.get('x-message-id') || 'accepted-without-id' };
  }
  const body = new URLSearchParams({ To: task.channel === 'whatsapp' ? `whatsapp:${contact.address}` : contact.address, MessagingServiceSid: account.messagingServiceSid });
  if (task.channel === 'whatsapp') { body.set('ContentSid', account.contentSid); body.set('ContentVariables', '{}'); }
  else body.set('Body', task.content);
  const r = await request(`https://api.twilio.com/2010-04-01/Accounts/${account.accountSid}/Messages.json`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${account.apiKeySid}:${account.apiSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body }, fetcher);
  const data = await r.json().catch(() => { throw failure('Accepted response could not be read; review provider console.', false); });
  if (!data.sid) throw failure('Provider acceptance uncertain; review provider console.', false);
  return { id: data.sid };
}
async function refreshDelivery(task, attempt, account, fetcher = fetch) {
  if (task.channel === 'email') throw failure('SendGrid acceptance is not delivery. Review delivery and unsubscribe events in SendGrid.');
  validate(account, task.channel);
  if (!/^SM[a-f0-9]{32}$/i.test(attempt.providerId || '')) throw failure('No Twilio message ID available.');
  const r = await request(`https://api.twilio.com/2010-04-01/Accounts/${account.accountSid}/Messages/${attempt.providerId}.json`, { headers: { Authorization: `Basic ${Buffer.from(`${account.apiKeySid}:${account.apiSecret}`).toString('base64')}` } }, fetcher);
  const data = await r.json();
  return { status: ['queued','sending','sent','delivered','undelivered','failed','read'].includes(data.status) ? data.status : 'unknown', optOut: Number(data.error_code) === 21610 };
}
module.exports = { sendMessage, validate, refreshDelivery };
