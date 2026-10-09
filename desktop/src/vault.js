// Credentials and communication records stay in the main process, encrypted by the OS.
const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');
function available() { return safeStorage.isEncryptionAvailable() && !(process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text'); }
function location(name) { if (!/^[a-z-]+$/.test(name)) throw new Error('Invalid storage name'); return path.join(app.getPath('userData'), `${name}.encrypted`); }
function read(name, fallback) {
  if (!available()) throw new Error('Unlock your OS keychain. On Linux, enable a supported Secret Service or KWallet; plaintext fallback is disabled.');
  const file = location(name);
  if (!fs.existsSync(file)) return structuredClone(fallback);
  return JSON.parse(safeStorage.decryptString(fs.readFileSync(file)));
}
function write(name, data) {
  if (!available()) throw new Error('OS-backed encryption unavailable; nothing was saved.');
  const file = location(name); fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(`${file}.tmp`, safeStorage.encryptString(JSON.stringify(data)), { mode: 0o600 });
  fs.renameSync(`${file}.tmp`, file);
}
module.exports = { available, read, write };
