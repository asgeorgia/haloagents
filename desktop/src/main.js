// Halo — main process. Floating always-on-top widget, tray, global hotkey, agent IPC.
const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, screen, nativeImage, shell, dialog, powerMonitor } = require('electron');
const fs = require('fs');
const os = require('os');
const { autoUpdater } = require('electron-updater');
const { startUpdates } = require('./updates');
const { startModelOffers } = require('./model-offers');
const path = require('path');
const settings = require('./settings');
const { runAgent } = require('./agent');
const communications = require('./communications');
const { tools } = require('./tools');
tools.communication_setup = { desc: 'Open private accounts/contacts/task controls; no credentials in chat. args: {}', run: async () => { win.webContents.send('agent:event', { type: 'communications' }); return 'Accounts and task controls opened. User must configure and approve there.'; } };
let stopCommunications;

let win, tray;
let updates;
let modelOffers;
let activeTasks = 0;
const pending = new Map(); // confirmation requests

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: 420, height: 620, x: width - 440, y: height - 640,
    frame: false, transparent: true, resizable: true, skipTaskbar: true,
    alwaysOnTop: true, hasShadow: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  // Float above everything, including full-screen apps, on every desktop/space.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('blur', () => win.setAlwaysOnTop(true, 'screen-saver'));
}

function toggle() { if (!win) return; win.isVisible() ? win.hide() : (win.show(), win.focus()); }

function refreshTray() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show / hide  (Ctrl/Cmd+Shift+Space)', click: toggle },
    { label: 'Launch at login', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked }) },
    { type: 'separator' },
    ...(updates?.menu() || []),
    ...(modelOffers?.menu() || []),
    { type: 'separator' }, { label: 'Quit Halo', click: () => app.quit() },
  ]));
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock?.hide();
  createWindow();
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle?.('◎ Halo');
  tray.setToolTip('Halo agent');
  updates = startUpdates({ app, autoUpdater, dialog, shell, powerMonitor, isBusy: () => activeTasks > 0, onStatus: refreshTray });
  modelOffers = startModelOffers({app,settings,dialog,isBusy:()=>activeTasks>0,onStatus:refreshTray});
  stopCommunications = communications.start(delta => { activeTasks += delta; });
  refreshTray();
  globalShortcut.register('CommandOrControl+Shift+Space', toggle);
});
app.on('will-quit', () => { stopCommunications?.(); modelOffers?.stop(); globalShortcut.unregisterAll(); });
app.on('window-all-closed', (e) => e.preventDefault());

ipcMain.handle('settings:get', () => settings.publicSettings());
// First-launch local-AI setup: detect Ollama so the panel can show setup steps.
ipcMain.handle('setup:check', async () => {
  const platform = process.platform;
  let installed = false;
  if (platform === 'darwin') installed = fs.existsSync('/Applications/Ollama.app');
  else if (platform === 'win32') installed = fs.existsSync(path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'));
  else installed = ['/usr/local/bin/ollama', '/usr/bin/ollama', path.join(os.homedir(), '.local/bin/ollama')].some((p) => fs.existsSync(p));
  let running = false;
  let ollamaUrl = 'http://localhost:11434';
  try { ollamaUrl = settings.get().ollamaUrl || ollamaUrl; } catch {}
  try { running = (await fetch(`${ollamaUrl}/api/version`, { signal: AbortSignal.timeout(2000) })).ok; } catch {}
  let dismissed = false;
  try { dismissed = settings.get().setupDismissed === true; } catch {}
  return { installed, running, platform, dismissed };
});
ipcMain.handle('settings:set', (_e, patch) => settings.set(patch));
ipcMain.handle('win:minimize', () => win.hide());
ipcMain.handle('win:compact', (_e, compact) => win.setSize(compact ? 72 : 420, compact ? 72 : 620));
ipcMain.handle('open:external', (_e, url) => shell.openExternal(url));
ipcMain.handle('confirm:reply', (_e, id, ok) => { pending.get(id)?.(ok); pending.delete(id); });

ipcMain.handle('agent:run', async (_e, history) => {
  const send = (type, data) => win.webContents.send('agent:event', { type, ...data });
  const confirm = (summary) => new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2);
    pending.set(id, resolve);
    send('confirm', { id, summary });
  });
  activeTasks += 1;
  try { return await runAgent(history, settings.get(), { send, confirm }); }
  catch (err) {
    send('error', { message: String(err.message || err) });
    if (err.code === 'OLLAMA_MISSING') {
      const { response } = await dialog.showMessageBox(win, { type: 'info', buttons: ['Download Ollama', 'Not now'], defaultId: 0, cancelId: 1,
        message: 'Halo needs its free local AI engine', detail: 'Install Ollama (free) and open it once. Halo will then start it automatically and download its local model on first use.' });
      if (response === 0) shell.openExternal('https://ollama.com/download');
    }
    return null;
  }
  finally { activeTasks -= 1; send('status', { text: '' }); }
});

function communicationHandler(name, handler) {
  ipcMain.handle(`communications:${name}`, async (event, ...args) => {
    if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('Invalid sender');
    try { return { ok: true, data: await handler(...args) }; }
    catch (err) { return { ok: false, error: err.safeMessage || err.message || 'Task configuration failed' }; }
  });
}
communicationHandler('list', () => communications.snapshot());
communicationHandler('import', () => communications.importCSV(win));
communicationHandler('account', (channel, input) => communications.saveAccount(channel,input));
communicationHandler('create', input => communications.createTask(input,win));
communicationHandler('approve', async id => { await communications.approveTask(id,win); return communications.snapshot(); });
communicationHandler('action', (id, action) => communications.action(id,action));
communicationHandler('suppress', (channel,address) => communications.suppress(channel,address));
communicationHandler('refresh', id => communications.refresh(id));
