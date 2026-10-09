const { app } = require('electron');
const fs = require('fs'); const path = require('path');
const vault = require('./vault');
const file = () => path.join(app.getPath('userData'), 'settings.json');
const defaults = {
  accessMode: 'minimal',            // 'minimal' = apps + Desktop/Documents/Downloads; 'full' = entire file system
  localModel: 'qwen2.5:7b-instruct', // pulled automatically from the Ollama library
  ollamaUrl: 'http://localhost:11434',
  autoPullLatest: true,
  escalate: false,                  // each cloud request additionally requires explicit approval
  cloudInputRate: 0, cloudOutputRate: 0, cloudBudget: 0,
  cloudProvider: 'anthropic',       // anthropic | openai | openrouter | deepseek
  cloudModel: 'claude-opus-4-1',
  keys: { anthropic: '', openai: '', openrouter: '', deepseek: '' },
  confirmDestructive: true,
  setupDismissed: false,            // hides the first-launch local-AI setup panel
};
function get() {
  let saved = {}; try { saved = JSON.parse(fs.readFileSync(file(), 'utf8')); } catch {}
  const cfg = { ...defaults, ...saved, keys: { ...defaults.keys } };
  // Migrate legacy plaintext credentials only when OS encryption is available.
  if (vault.available()) {
    const keys = vault.read('model-keys', {});
    if (saved.keys && Object.values(saved.keys).some(Boolean)) {
      vault.write('model-keys', { ...saved.keys, ...keys });
      delete saved.keys; saved.escalate = false;
      fs.writeFileSync(file(), JSON.stringify(saved, null, 2), { mode: 0o600 });
      cfg.escalate = false;
    }
    cfg.keys = { ...cfg.keys, ...vault.read('model-keys', {}) };
  } else if (saved.keys && Object.values(saved.keys).some(Boolean)) {
    throw new Error('Legacy plaintext keys detected. Unlock the OS keychain to migrate them before using Halo.');
  }
  return cfg;
}
function publicSettings() { const { keys, ...cfg } = get(); return { ...cfg, keySaved: Boolean(keys[cfg.cloudProvider]) }; }
function set(patch) {
  const current = get(); const next = { ...current };
  for (const k of ['accessMode','localModel','cloudProvider','cloudModel','autoPullLatest','escalate','confirmDestructive','cloudInputRate','cloudOutputRate','cloudBudget','setupDismissed']) if (Object.hasOwn(patch,k)) next[k] = patch[k];
  if (!['anthropic','openai','openrouter','deepseek'].includes(next.cloudProvider)) throw new Error('Invalid provider');
  if (patch.apiKey) { vault.write('model-keys', { ...current.keys, [next.cloudProvider]: String(patch.apiKey) }); }
  const { keys, ...safe } = next;
  fs.mkdirSync(path.dirname(file()), { recursive: true }); fs.writeFileSync(file(), JSON.stringify(safe, null, 2), { mode: 0o600 });
  return publicSettings();
}
module.exports = { get, set, publicSettings };
