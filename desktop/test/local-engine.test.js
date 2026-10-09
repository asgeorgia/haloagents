const test = require('node:test');
const assert = require('node:assert');
const { complete, isLocalUrl } = require('../src/models');

test('only local Ollama endpoints may be auto-started', () => {
  assert.ok(isLocalUrl('http://localhost:11434'));
  assert.ok(isLocalUrl('http://127.0.0.1:11434'));
  assert.ok(!isLocalUrl('http://example.com:11434'));
});

test('unreachable local engine gives setup guidance instead of "fetch failed"', async () => {
  const cfg = { ollamaUrl: 'http://192.0.2.1:9', localModel: 'qwen2.5:7b-instruct', escalate: false, keys: {} };
  await assert.rejects(complete([{ role: 'user', content: 'hi' }], cfg, () => {}, null), (e) => e.code === 'OLLAMA_MISSING' && /ollama\.com\/download/.test(e.message));
});
