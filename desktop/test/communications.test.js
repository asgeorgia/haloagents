const test = require('node:test');
const assert = require('node:assert/strict');
const { importContacts } = require('../src/communications/contacts');
const { draft, eligible, TaskRunner, nextRun, clock } = require('../src/communications/tasks');
const { sendMessage } = require('../src/communications/providers');
const csv = 'channel,address,consent,consent_evidence,consent_date,name\nemail,test@example.com,yes,"Signed form, consent",2026-01-01,Test\n';
const contacts = importContacts(csv).contacts;
const input = { channel:'email', timezone:'UTC', start:'09:00',end:'17:00',dailyCap:20,unitCost:0.01,budget:1,content:'Hello',subject:'Update' };
const now = new Date('2026-10-09T10:00:00Z');
function task() {const t=draft(input,contacts,now);t.state='active';return t;}
test('CSV handles quoted commas and rejects missing consent and duplicates',()=>{
 const r=importContacts(csv+'email,test@example.com,yes,form,2026-01-01,Duplicate\nsms,+12025550100,no,unknown,2026-01-01,No\nwhatsapp,123,yes,form,2026-01-01,Bad\n');
 assert.equal(r.contacts.length,1);assert.equal(r.contacts[0].evidence,'Signed form, consent');assert.equal(r.rejected.length,3);
});
test('Invalid/future consent dates and invalid CSV fail closed',()=>{
 assert.equal(importContacts(csv.replace('2026-01-01','2026-02-31')).contacts.length,0);
 assert.equal(importContacts(csv.replace('2026-01-01','2099-01-01')).contacts.length,0);
 assert.throws(()=>importContacts('channel,address\nemail,"unclosed'));
});
test('Limits, hours, timezone and budgets validate',()=>{
 for(const p of [{dailyCap:0},{dailyCap:1.5},{timezone:'Bogus/Zone'},{budget:0},{unitCost:NaN},{start:'18:00'},{content:''}])assert.throws(()=>draft({...input,...p},contacts,now));
});
test('Quiet hours, suppression, consent, pause and daily caps prevent sends',()=>{
 assert.equal(eligible(task(),contacts,[],new Date('2026-10-09T18:00:00Z')),null);
 assert.equal(eligible({...task(),state:'paused'},contacts,[],now),null);
 assert.equal(eligible(task(),contacts,[contacts[0].id],now),null);
 assert.equal(eligible(task(),contacts.map(c=>({...c,consent:false})),[],now),null);
 const t=task();t.dailyCap=1;t.attempts=[{day:'2026-10-09',contactId:'other'}];assert.equal(eligible(t,contacts,[],now),null);
});
test('Timezone clock and next open window skip missed runs',()=>{
 assert.equal(clock(new Date('2026-10-09T23:30:00Z'),'Asia/Tokyo').day,'2026-10-10');
 assert.equal(nextRun(task(),new Date('2026-10-09T18:00:00Z')),'2026-10-10T09:00:00.000Z');
});
test('Budget gate pauses before a request',()=>{const t=task();t.spentEstimate=1;assert.equal(eligible(t,contacts,[],now),null);assert.equal(t.state,'paused');});
test('Reservations persisted before send and uncertain sends never replay',async()=>{
 let s={tasks:[task()],contacts,suppressed:[]}, sends=0;
 const runner=new TaskRunner({load:()=>structuredClone(s),save:x=>{s=structuredClone(x);},now:()=>now,send:async()=>{sends++;assert.equal(s.tasks[0].attempts[0].status,'reserved');throw new Error('timeout');}});
 await runner.tick();assert.equal(s.tasks[0].state,'paused');assert.equal(s.tasks[0].attempts[0].status,'uncertain');
 s.tasks[0].state='active';s.tasks[0].nextEligibleAt=now.toISOString();await runner.tick();assert.equal(sends,1);
});
test('Overlapping ticks and owner pause during request remain safe',async()=>{
 let s={tasks:[task()],contacts,suppressed:[]},finish,sends=0;
 const runner=new TaskRunner({load:()=>structuredClone(s),save:x=>{s=structuredClone(x);},now:()=>now,send:async()=>{sends++;await new Promise(r=>{finish=r;});return{id:'ok'};}});
 const first=runner.tick();await runner.tick();s.tasks[0].state='paused';finish();await first;assert.equal(sends,1);assert.equal(s.tasks[0].state,'paused');assert.equal(s.tasks[0].attempts[0].status,'accepted');
});
test('Provider account denial exposes no credentials or response content',async()=>{
 const secret='do-not-leak-secret';const a={verified:true,consentHandling:true,apiKey:secret,from:'owner@example.com',unsubscribeGroup:'1'};
 await assert.rejects(sendMessage(task(),contacts[0],a,async()=>({ok:false,status:403,text:async()=>secret})),e=>!e.message.includes(secret)&&e.definite);
 await assert.rejects(sendMessage(task(),contacts[0],{...a,verified:false}),/Verify sender/);
});
test('Email never bypasses provider suppressions; WhatsApp sends ContentSid not arbitrary body',async()=>{
 const a={verified:true,consentHandling:true,apiKey:'test-key',from:'owner@example.com',unsubscribeGroup:'1'};
 await sendMessage(task(),contacts[0],a,async(url,o)=>{const body=JSON.parse(o.body);assert.equal(body.asm.group_id,1);assert.equal(body.mail_settings.bypass_list_management.enable,false);return{ok:true,headers:new Headers({'x-message-id':'id'})};});
 const wa={verified:true,consentHandling:true,accountSid:'AC'+'a'.repeat(32),apiKeySid:'SK'+'a'.repeat(32),apiSecret:'test-secret',messagingServiceSid:'MG'+'a'.repeat(32),contentSid:'HX'+'a'.repeat(32)};
 await sendMessage({...task(),channel:'whatsapp'}, {...contacts[0],address:'+12025550100'},wa,async(url,o)=>{assert.equal(o.body.get('ContentSid'),wa.contentSid);assert.equal(o.body.has('Body'),false);return{ok:true,json:async()=>({sid:'SM'+'b'.repeat(32)})};});
});
