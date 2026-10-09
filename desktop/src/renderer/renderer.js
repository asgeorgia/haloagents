const $ = (id) => document.getElementById(id); const history = [];
const add = (cls, text) => { const d = document.createElement('div'); d.className = cls; d.textContent = text; $('log').append(d); $('log').scrollTop = 1e9; return d; };
async function send(text) { if (!text.trim()) return; add('msg user', text); history.push({ role: 'user', content: text }); $('input').value = ''; await halo.run(history.slice(-20)); }
halo.onEvent((e) => {
  if (e.type === 'communications') $('tasksButton').click();
  if (e.type === 'model') $('model').textContent = e.name;
  if (e.type === 'step') add('step', `${e.thought ? e.thought + '\n' : ''}→ ${e.tool} ${JSON.stringify(e.args)}`);
  if (e.type === 'result') add('step', `✓ ${e.result}`);
  if (e.type === 'final') { add('msg ai', e.text); history.push({ role: 'assistant', content: e.text }); }
  if (e.type === 'error') add('msg err', e.message);
  if (e.type === 'status') { let s = document.getElementById('status-line'); if (!e.text) { s?.remove(); return; } if (!s) { s = add('step', ''); s.id = 'status-line'; } s.textContent = e.text; $('log').append(s); $('log').scrollTop = 1e9; }
  if (e.type === 'confirm') { const d = add('confirm', 'Allow: ' + e.summary + '\n');
    for (const [l, ok] of [['Allow', true], ['Deny', false]]) { const b = document.createElement('button'); b.textContent = l; b.onclick = () => { halo.confirm(e.id, ok); d.remove(); }; d.append(b); } }
});
$('form').onsubmit = (ev) => { ev.preventDefault(); send($('input').value); };
$('input').onkeydown = (ev) => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); send($('input').value); } };
document.querySelectorAll('.chips button').forEach((b) => (b.onclick = () => send(b.textContent)));
$('close').onclick = () => halo.hide();
$('mini').onclick = () => { $('panel').classList.add('hidden'); $('orb').classList.remove('hidden'); halo.compact(true); };
$('orb').ondblclick = $('orb').onclick = () => { $('orb').classList.add('hidden'); $('panel').classList.remove('hidden'); halo.compact(false); };
$('gear').onclick = async () => { const s = await halo.getSettings(); $('settings').classList.toggle('hidden');
  for (const k of ['accessMode', 'localModel', 'cloudProvider', 'cloudModel', 'cloudInputRate', 'cloudOutputRate', 'cloudBudget']) $(k).value = s[k];
  for (const k of ['autoPullLatest', 'escalate', 'confirmDestructive']) $(k).checked = s[k];
  $('apiKey').value = ''; $('apiKey').placeholder = s.keySaved ? 'Saved securely; blank keeps it' : 'API key'; };
$('save').onclick = async () => { const p = {};
  for (const k of ['accessMode', 'localModel', 'cloudProvider', 'cloudModel', 'cloudInputRate', 'cloudOutputRate', 'cloudBudget']) p[k] = $(k).value;
  for (const k of ['autoPullLatest', 'escalate', 'confirmDestructive']) p[k] = $(k).checked;
  p.apiKey = $('apiKey').value; try { await halo.setSettings(p); $('apiKey').value = ''; $('settings').classList.add('hidden'); } catch(e) { add('msg err', e.message); } };
$('input').focus();
