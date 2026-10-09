// Model router: local Ollama first (starts it and pulls the model when needed), escalates to cloud LLMs only on approval.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class LocalEngineMissing extends Error {
  constructor() {
    super("Halo's free local AI engine (Ollama) is not installed or not running. Install it from https://ollama.com/download, open it once, then send your request again. You can also enable a cloud model in settings (⚙).");
    this.code = 'OLLAMA_MISSING';
  }
}

async function reachable(url, ms = 2500) {
  try { const r = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(ms) }); return r.ok; } catch { return false; }
}

function ollamaCandidates() {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (process.platform === 'win32') return [path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'), 'ollama.exe'];
  return ['/opt/homebrew/bin/ollama', '/usr/local/bin/ollama', '/usr/bin/ollama', path.join(home, '.local/bin/ollama'), 'ollama'];
}

function tryStart() {
  if (process.platform === 'darwin' && fs.existsSync('/Applications/Ollama.app')) {
    spawn('open', ['-a', 'Ollama'], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
    return true;
  }
  const onPath = (name) => (process.env.PATH || '').split(path.delimiter).map((d) => path.join(d, name)).find((p) => fs.existsSync(p));
  for (const candidate of ollamaCandidates()) {
    const bin = path.isAbsolute(candidate) ? (fs.existsSync(candidate) ? candidate : null) : onPath(candidate);
    if (!bin) continue;
    try {
      const child = spawn(bin, ['serve'], { detached: true, stdio: 'ignore', windowsHide: true });
      child.on('error', () => {}); child.unref();
      return true;
    } catch { /* try next */ }
  }
  return false;
}

// Only start a local engine for a local endpoint; never spawn processes for remote URLs.
const isLocalUrl = (url) => { try { return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(new URL(url).hostname); } catch { return false; } };

async function ensureRunning(cfg, send) {
  if (await reachable(cfg.ollamaUrl)) return;
  if (!isLocalUrl(cfg.ollamaUrl) || cfg.autoStartLocal === false) throw new LocalEngineMissing();
  send('status', { text: 'Starting the local AI engine…' });
  if (tryStart()) {
    for (let i = 0; i < 20; i++) { await new Promise((r) => setTimeout(r, 750)); if (await reachable(cfg.ollamaUrl)) return; }
  }
  throw new LocalEngineMissing();
}

async function pull(cfg, send) {
  send('status', { text: `Downloading local model ${cfg.localModel} (first run only; several GB)…` });
  const r = await fetch(`${cfg.ollamaUrl}/api/pull`, { method: 'POST', body: JSON.stringify({ name: cfg.localModel, stream: true }) });
  if (!r.ok || !r.body) throw new Error(`Could not download local model ${cfg.localModel} (HTTP ${r.status}). Check the model name in settings.`);
  const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = ''; let last = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
      let ev; try { ev = JSON.parse(line); } catch { continue; }
      if (ev.error) throw new Error(`Local model download failed: ${ev.error}`);
      if (ev.total && ev.completed && Date.now() - last > 1000) {
        last = Date.now();
        send('status', { text: `Downloading ${cfg.localModel}: ${Math.floor((ev.completed / ev.total) * 100)}% of ${(ev.total / 1e9).toFixed(1)} GB` });
      }
    }
  }
  send('status', { text: 'Local model ready.' });
}

async function ollamaEnsure(cfg, send) {
  await ensureRunning(cfg, send);
  const tags = await fetch(`${cfg.ollamaUrl}/api/tags`).then((r) => r.json());
  const have = (tags.models || []).some((m) => m.name === cfg.localModel || m.name.startsWith(`${cfg.localModel}:`) || m.name === `${cfg.localModel}:latest`);
  if (!have || cfg.autoPullLatest) await pull(cfg, send);
}

async function local(messages, cfg, send = () => {}) {
  await ollamaEnsure(cfg, send);
  send('status', { text: `Thinking with ${cfg.localModel}…` });
  let r;
  try {
    r = await fetch(`${cfg.ollamaUrl}/api/chat`, { method: 'POST',
      body: JSON.stringify({ model: cfg.localModel, messages, stream: false, format: 'json' }) });
  } catch (e) { throw new Error(`The local AI engine stopped responding (${e.cause?.code || e.message}). Make sure Ollama is running and try again.`); }
  if (!r.ok) throw new Error(`Local model error (HTTP ${r.status}): ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).message.content;
}
const OPENAI_COMPAT = {
  openai: 'https://api.openai.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions', // Qwen, Llama, DeepSeek, Mistral, Gemini...
  deepseek: 'https://api.deepseek.com/chat/completions',
};
async function cloud(messages, cfg) {
  const key = cfg.keys[cfg.cloudProvider];
  if (!key) throw new Error(`No API key set for ${cfg.cloudProvider}`);
  if (cfg.cloudProvider === 'anthropic') {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: cfg.cloudModel, max_tokens: 1024, system, messages: messages.filter((m) => m.role !== 'system') }) });
    if (!r.ok) throw new Error(`Anthropic HTTP ${r.status}; review the provider console.`);
    return (await r.json()).content.map((c) => c.text || '').join('');
  }
  const r = await fetch(OPENAI_COMPAT[cfg.cloudProvider], { method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: cfg.cloudModel, messages, max_tokens: 1024 }) });
  if (!r.ok) throw new Error(`${cfg.cloudProvider} HTTP ${r.status}; review the provider console.`);
  return (await r.json()).choices[0].message.content;
}
async function complete(messages, cfg, send, confirm) {
  try { const out = await local(messages, cfg, send); JSON.parse(out); send('model', { name: `local · ${cfg.localModel}` }); return out; }
  catch (e) {
    if (!cfg.escalate || e.code === 'OLLAMA_MISSING' && !cfg.keys?.[cfg.cloudProvider]) throw e;
    const inputRate = Number(cfg.cloudInputRate), outputRate = Number(cfg.cloudOutputRate);
    const budget = Number(cfg.cloudBudget);
    if (![inputRate,outputRate,budget].every(v => Number.isFinite(v) && v > 0)) throw new Error('Local inference stopped. Cloud requires configured rates and a positive estimated per-task budget.');
    const chars = messages.reduce((n,m) => n + String(m.content).length,0);
    const estimate = ((chars * 4 + messages.length * 200 + 2000) * inputRate + 1024 * outputRate) / 1e6;
    const spent = cfg.cloudSpent || 0;
    if (spent + estimate > budget) throw new Error('Estimated cloud budget reached. Local work stopped without another cloud request.');
    const detail = `Local inference could not finish. Send ${messages.length} messages (${chars} characters), including conversation and tool/file results, to ${cfg.cloudProvider} / ${cfg.cloudModel}? Estimated upper charge using your configured rates: $${estimate.toFixed(4)} USD. Estimated task budget: $${budget.toFixed(2)}, already reserved $${spent.toFixed(4)}. Output limited to 1024 tokens. Actual billing may differ; set provider-side limits. No request is sent if declined.`;
    if (!confirm || !(await confirm(detail))) throw new Error('Cloud request declined. No cloud model was called.');
    cfg.cloudSpent = spent + estimate;
    send('model', { name: `cloud · ${cfg.cloudModel}` });
    return cloud(messages, cfg);
  }
}
module.exports = { complete, LocalEngineMissing, isLocalUrl };
