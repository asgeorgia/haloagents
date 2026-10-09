(() => {
  const el = id => document.getElementById(id);
  let state = { contacts: [], tasks: [], accounts: {} }, timer;
  const accountFields = {
    email: [['from','Verified sender email'],['apiKey','SendGrid API key',true],['unsubscribeGroup','Unsubscribe group ID']],
    sms: [['accountSid','Twilio Account SID'],['apiKeySid','Twilio API Key SID'],['apiSecret','Twilio API Secret',true],['messagingServiceSid','Messaging Service SID']],
    whatsapp: [['accountSid','Twilio Account SID'],['apiKeySid','Twilio API Key SID'],['apiSecret','Twilio API Secret',true],['messagingServiceSid','Messaging Service SID'],['contentSid','Approved static Content SID']],
  };
  function node(tag,text) { const n=document.createElement(tag); if(text) n.textContent=text; return n; }
  async function call(action,...args) {
    const result = await halo.communications(action,...args);
    if (!result.ok) throw new Error(result.error);
    return result.data;
  }
  function guard(fn) { return async () => { try { el('communicationStatus').textContent=''; await fn(); } catch(e) { el('communicationStatus').textContent=e.message; } }; }
  function tab(view) {
    for (const name of ['account','contacts','schedule']) {
      el(`${name}View`).classList.toggle('hidden',name!==view);
      el(`${name}Tab`).setAttribute('aria-selected', String(name===view));
    }
  }
  function showAccount() {
    const channel=el('accountChannel').value, a=state.accounts[channel] || {};
    el('accountFields').replaceChildren();
    for(const [key,label,secret] of accountFields[channel]) {
      const l=node('label',label), input=node('input'); input.id=`account-${key}`;
      input.type=secret?'password':'text'; input.autocomplete='off'; input.value=secret?'':a[key] || '';
      if(secret) input.placeholder=a.keySaved?'Saved securely; blank keeps it':'Enter key';
      l.append(input); el('accountFields').append(l);
    }
    el('senderVerified').checked=Boolean(a.verified); el('optOutConfigured').checked=Boolean(a.consentHandling);
  }
  function render() {
    el('contactList').replaceChildren(node('p',`${state.contacts.length} imported contacts`));
    for(const c of state.contacts.slice(0,100)) {
      const row=node('div'); row.className='contact-row'; row.append(node('span',`${c.name || c.address} · ${c.channel}${c.suppressed?' · suppressed':''}`));
      if(!c.suppressed) { const b=node('button','Suppress'); b.onclick=guard(async()=>{state=await call('suppress',c.channel,c.address);render();});row.append(b); }
      el('contactList').append(row);
    }
    el('taskList').replaceChildren();
    if(!state.tasks.length) el('taskList').append(node('p','No schedules'));
    for(const t of state.tasks) {
      const row=node('div');row.className='task-row';row.append(node('strong',t.name));
      row.append(node('p',`${t.channel} · ${t.state} · ${t.attempts.length}/${t.contactIds.length} attempted`));
      row.append(node('p',`${t.dailyCap}/day · ${t.start}–${t.end} ${t.timezone} · estimated $${t.spentEstimate.toFixed(3)} / $${t.budget}`));
      if(t.nextRun) row.append(node('p',`Next window: ${new Date(t.nextRun).toLocaleString()}`));
      if(t.reason) row.append(node('p',t.reason));
      for(const [label,action] of (t.state==='active'?[['Pause','pause'],['Cancel','cancel']]:['paused','draft'].includes(t.state)?[['Approve / resume','approve'],['Cancel','cancel']]:[])) {
        const b=node('button',label);b.onclick=guard(async()=>{state=await call(action==='approve'?'approve':'action',t.id,...(action==='approve'?[]:[action]));render();});row.append(b);
      }
      if(t.attempts.length) {
        const details=node('details'), summary=node('summary','Delivery history'); details.append(summary);
        for(const a of t.attempts.slice(-30)) details.append(node('p',`${new Date(a.at).toLocaleString()} · ${a.status} · ${a.providerId || 'no provider ID'}`));
        row.append(details);
        const b=node('button','Refresh delivery status'); b.onclick=guard(async()=>{state=await call('refresh',t.id);render();});row.append(b);
      }
      el('taskList').append(row);
    }
  }
  async function reload() { state=await call('list');render(); }
  el('tasksButton').onclick=guard(async()=>{
    el('communications').classList.remove('hidden');el('settings').classList.add('hidden');
    tab('schedule'); await reload();showAccount();
    if(!el('taskTimezone').value) el('taskTimezone').value=Intl.DateTimeFormat().resolvedOptions().timeZone;
    clearInterval(timer);timer=setInterval(()=>{if(!el('communications').classList.contains('hidden')) reload().catch(e=>{el('communicationStatus').textContent=e.message;});},10000);
  });
  el('tasksClose').onclick=()=>{el('communications').classList.add('hidden');clearInterval(timer);};
  for(const name of ['account','contacts','schedule']) el(`${name}Tab`).onclick=()=>tab(name);
  el('accountChannel').onchange=showAccount;
  el('accountSave').onclick=guard(async()=>{
    const channel=el('accountChannel').value, input={verified:el('senderVerified').checked,consentHandling:el('optOutConfigured').checked};
    for(const [key] of accountFields[channel]) input[key]=el(`account-${key}`).value;
    await call('account',channel,input);await reload();showAccount();el('communicationStatus').textContent='Saved with OS-backed encryption. Provider credentials have not been live-tested.';
  });
  el('csvImport').onclick=guard(async()=>{const r=await call('import');if(r.cancelled)return;el('importReport').textContent=`${r.added} added, ${r.duplicatesOrSuppressed} already present/suppressed. ${r.rejected.map(x=>`Row ${x.row}: ${x.reason}`).join('; ')}`;await reload();});
  el('suppressSave').onclick=guard(async()=>{state=await call('suppress',el('suppressChannel').value,el('suppressAddress').value);render();el('suppressAddress').value='';});
  el('taskCreate').onclick=guard(async()=>{
    const input={name:el('taskName').value,channel:el('taskChannel').value,subject:el('taskSubject').value,content:el('taskContent').value,timezone:el('taskTimezone').value,start:el('taskStart').value,end:el('taskEnd').value,dailyCap:Number(el('taskCap').value),unitCost:Number(el('taskCost').value),budget:Number(el('taskBudget').value),templateReviewed:el('templateReviewed').checked};
    el('taskCreate').disabled=true;
    try{state=await call('create',input);render();el('communicationStatus').textContent='Schedule saved. Approval status shown above.';}finally{el('taskCreate').disabled=false;}
  });
})();
