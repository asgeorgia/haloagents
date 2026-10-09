const fs = require('fs');
const path = require('path');
const semver = require('semver');
const { createUpdateScheduler } = require('./update-scheduler');

const RELEASES = 'https://github.com/asgeorgia/haloagents/releases';

function startUpdates({ app, autoUpdater, dialog, shell, powerMonitor, isBusy, onStatus }) {
  let downloaded = false;
  let latestVersion;
  let status = 'Updates: ready';
  const statePath = path.join(app.getPath('userData'), 'update-check.json');
  const automatic = process.platform === 'darwin'
    || (process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_FILE)
    || (process.platform === 'linux' && Boolean(process.env.APPIMAGE));
  const setStatus = (value) => { status = value; onStatus(); };
  const scheduler = createUpdateScheduler({
    readLastCheck: () => {
      try { return JSON.parse(fs.readFileSync(statePath, 'utf8')).lastCheck; }
      catch { return 0; }
    },
    writeLastCheck: (lastCheck) => {
      fs.mkdirSync(path.dirname(statePath), { recursive: true });
      fs.writeFileSync(statePath, JSON.stringify({ lastCheck }));
    },
    check: async () => {
      if (!app.isPackaged) { setStatus('Updates: disabled in development'); return; }
      setStatus('Updates: checking…');
      if (automatic) {
        await autoUpdater.checkForUpdates();
      } else {
        const response = await fetch('https://api.github.com/repos/asgeorgia/haloagents/releases/latest', {
          headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) throw new Error(`Release check returned ${response.status}`);
        const release = await response.json();
        const version = semver.valid(release.tag_name);
        if (version && semver.gt(version, app.getVersion())) {
          latestVersion = version;
          setStatus(`Update ${version} available — download installer`);
        } else setStatus('Updates: up to date');
      }
    },
    onError: () => setStatus('Updates: check failed — retry later'),
  });

  autoUpdater.autoDownload = true;
  // Never silently terminate a task or change versions while Halo is running.
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.on('update-available', (info) => setStatus(`Update ${info.version}: downloading…`));
  autoUpdater.on('update-not-available', () => setStatus('Updates: up to date'));
  autoUpdater.on('download-progress', (progress) => setStatus(`Update downloading: ${Math.round(progress.percent)}%`));
  autoUpdater.on('error', () => setStatus('Updates: failed — check again to retry'));
  autoUpdater.on('update-downloaded', async (info) => {
    downloaded = true;
    setStatus(`Update ${info.version}: ready to restart`);
    if (!isBusy()) await install();
  });

  async function install() {
    if (isBusy()) {
      await dialog.showMessageBox({ type: 'info', message: 'Halo is working on a task.', detail: 'Finish your task, then choose Install update and restart from the tray menu.' });
      return;
    }
    if (!downloaded) {
      if (latestVersion) await shell.openExternal(RELEASES);
      return;
    }
    const result = await dialog.showMessageBox({
      type: 'info', title: 'Halo update ready', message: 'Install the update and restart Halo?',
      detail: 'Your settings and local files are kept. Choose Later to continue using the current version.',
      buttons: ['Restart and install', 'Later'], defaultId: 1, cancelId: 1,
    });
    if (result.response === 0 && !isBusy()) autoUpdater.quitAndInstall();
  }

  const resume = () => void scheduler.run();
  powerMonitor.on('resume', resume);
  app.on('before-quit', () => { scheduler.stop(); powerMonitor.removeListener('resume', resume); });
  if (app.isPackaged) scheduler.start();
  else setStatus('Updates: disabled in development');
  return {
    menu: () => [
      { label: status, enabled: false },
      { label: 'Check for updates', click: () => void scheduler.run(true) },
      { label: downloaded ? 'Install update and restart' : 'View latest release', click: () => downloaded ? void install() : void shell.openExternal(RELEASES) },
    ],
  };
}

module.exports = { startUpdates };