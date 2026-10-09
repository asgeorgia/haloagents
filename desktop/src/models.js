// Model router: local Ollama first (auto-pulls), escalates to cloud LLMs.
async function ollamaEnsure(cfg) {
  const tags = await fetch(`${cfg.ollamaUrl}/api/tags`).then((r) => r.json());
  const have = (tags.models || []).some((m) => m.name.startsWith(cfg.localModel));
  if (!have || cfg.autoPullLatest) {
    await fetch(`${cfg.ollamaUrl}/api/pull`, { method: 'POST', body: JSON.stringify({ name: cfg.localModel, stream: false }) });
  }
}
async function local(messages, cfg) {
  await ollamaEnsure(cfg);
  const r = await fetch(`${cfg.ollamaUrl}/api/chat`, { method: 'POST',
    body: JSON.stringify({ model: cfg.localModel, messages, stream: false, format: 'json' }) });
  if (!r.ok) throw new Error(`local model ${r.status}`);
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
  try { const out = await local(messages, cfg); JSON.parse(out); send('model', { name: `local · ${cfg.localModel}` }); return out; }
  catch (e) {
    if (!cfg.escalate) throw e;
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
module.exports = { complete };
