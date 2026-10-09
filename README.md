# Halo

Halo is a floating desktop AI agent for macOS, Windows and Linux. It starts with a local Ollama model so local requests do not incur cloud-model API charges. Model downloads, release checks and web tasks still require internet access; running a local model uses your computer's resources.

- Website: https://www.haloagents.app
- Repository: https://github.com/asgeorgia/haloagents
- Published releases: https://github.com/asgeorgia/haloagents/releases
- Installation guide: https://www.haloagents.app/docs

## Current status and important limits

This repository contains the website and desktop application source. Installers must be built and published before release-download links work. Native installation and end-to-end updates require testing on each target operating system; passing scheduler tests alone does not establish that native updates work.

The website lists only verified releases; no native installer releases were found when links were checked. The working source ZIP is not a ready-to-install application. Do not promise that every suggested task works: results depend on the local model, available tools, permissions and installed software.

**Cloud controls:** cloud escalation defaults off. Every fallback request requires an approval naming the provider/model, conversation and tool-result payload size, and a conservative estimate using the configured input/output rates. Output is capped at 1,024 tokens; an estimated per-task budget is reserved before each request. This is not a guarantee of the provider invoice: configure provider-side billing limits. Keys are encrypted with Electron safeStorage; legacy plaintext keys migrate when OS encryption is available. Linux plaintext `basic_text` storage is rejected.

## Repository layout

| Path | Purpose |
| --- | --- |
| `desktop/` | Electron desktop source, package configuration, tests and desktop README |
| `src/` | TanStack Start / React website, download pages and installation guide |
| `src/data/releases.ts` | Website version history and GitHub download-link configuration |
| `.github/workflows/desktop-release.yml` | Builds desktop installers from `desktop/` on version tags |
| `desktop/` → private `halo-downloads` storage | Downloadable desktop source snapshot; regenerate and upload after source changes |

## Install Halo

Use the installer for your operating system and processor from an actual published GitHub release. Verify the release publisher and never bypass security warnings for an untrusted download.

### macOS

1. Open the matching Apple Silicon or Intel DMG and drag Halo to Applications.
2. If an unsigned test build is blocked, use Finder → Applications → Halo → right-click → Open only if you trust that build. Public releases should be signed and notarized.
3. Enable System Settings → Privacy & Security → Accessibility if Halo needs to type into other applications.
4. Automatic updates require a signed app installed in a writable location. Keep the signing identity stable across versions.

### Windows

1. Use the NSIS Setup installer for automatic updates.
2. A portable EXE is available when published, but updates require manual replacement.
3. If SmartScreen warns, verify the publisher and download source before choosing More info → Run anyway. Signing is recommended for public distribution.

### Linux

```sh
# AppImage: keep it in a directory your user can write to for automatic updates
chmod +x Halo-*.AppImage
./Halo-<version>.AppImage

# Debian / Ubuntu: use the actual filename in the release
sudo apt install ./halo-agent_<version>_amd64.deb

# Fedora / RHEL: use the actual filename in the release
sudo dnf install ./halo-agent-<version>.x86_64.rpm
```

Some systems need FUSE support to run AppImages. DEB/RPM builds detect new releases but require a new package installation. Typing automation may require X11/XWayland rather than a restricted Wayland session.

## Download from the command line (macOS, Linux and Unix shells)

These commands require the [GitHub CLI](https://cli.github.com/) (`gh`). Public releases do not require a private token; private repositories require `gh auth login` with an account that has access. Downloads only work once installers are published. Do not paste access tokens into commands or shared logs.

### Find and download the latest release

Run this in a POSIX-compatible shell, such as sh, bash or zsh. It lists the actual assets rather than assuming a filename:

```sh
gh release view --repo asgeorgia/haloagents --json tagName,assets \
  --jq '.tagName, (.assets[].name)'
uname -sm
mkdir -p "$HOME/Downloads/Halo"
printf 'Enter the exact installer filename from the list above: '
IFS= read -r HALO_ASSET
if [ -n "$HALO_ASSET" ]; then
  gh release download --repo asgeorgia/haloagents \
    --pattern "$HALO_ASSET" --dir "$HOME/Downloads/Halo"
fi
```

Choose a `.dmg` for macOS (arm64 for Apple Silicon, x64 for Intel), or an `.AppImage`, `.deb` or `.rpm` for Linux matching your processor. Some x64 filenames omit the architecture; consult the release notes if unclear. Do not choose update metadata, blockmaps or the source archive when you want an installer. Existing files are not overwritten by default. Inspect the publisher and any supplied checksums/signatures before opening the download.

### macOS: open the downloaded installer

In the same terminal session, after choosing a DMG:

```sh
open "$HOME/Downloads/Halo/$HALO_ASSET"
```

Drag Halo to Applications in the mounted window, then run `open -a Halo`. macOS signing, security and Accessibility requirements still apply; these commands do not bypass them.

### Linux: run or install the downloaded package

In the same terminal session, use the command that matches the asset you chose:

```sh
# AppImage: no sudo; keep the file writable for automatic updates
chmod +x "$HOME/Downloads/Halo/$HALO_ASSET"
"$HOME/Downloads/Halo/$HALO_ASSET"

# Debian / Ubuntu (.deb) — run this instead for a DEB asset
sudo apt install "$HOME/Downloads/Halo/$HALO_ASSET"

# Fedora / RHEL (.rpm) — run this instead for an RPM asset
sudo dnf install "$HOME/Downloads/Halo/$HALO_ASSET"
```

### Download a specific version

List published versions with `gh release list --repo asgeorgia/haloagents`. Substitute a real tag and an exact asset name from that release:

```sh
gh release view <published-tag> --repo asgeorgia/haloagents --json assets --jq '.assets[].name'
gh release download <published-tag> --repo asgeorgia/haloagents \
  --pattern '<exact-installer-filename>' --dir "$HOME/Downloads/Halo"
```

The angle-bracket values are placeholders: replace them before running. An older update-enabled version may offer the latest stable version on its next daily check.

### Other Unix systems and headless machines

The download commands can run wherever GitHub CLI and a compatible shell are available, but downloading does not establish installation support. Halo's Electron application targets macOS, Windows and Linux; native FreeBSD, OpenBSD, NetBSD, Solaris and other Unix builds are not provided. Linux packages are not native installers for those systems. Halo also needs a graphical desktop, not just a headless SSH terminal. Use a supported desktop OS; compatibility layers are unverified.

For supported macOS/Linux systems without a published installer, use the source instructions below. This still requires Electron/native-dependency support on the target platform, and does not imply other Unix support.

## Set up a local model

1. Install Ollama from https://ollama.com and start it.
2. The default endpoint is `http://localhost:11434` and the default model is `qwen2.5:7b-instruct`.
3. Optionally download the model ahead of time:

```sh
ollama pull qwen2.5:7b-instruct
```

Choose a model your hardware can run; memory and storage requirements vary. Initial model download requires internet. The current `autoPullLatest` setting checks/pulls the configured model when a local request runs; set it to false after downloading for strictly offline model use. Model updates and Halo application updates are separate.

## Everyday use and permissions

- Ctrl/Cmd+Shift+Space shows or hides the floating panel.
- The compact control shrinks the panel to an orb.
- The settings control selects the model, provider and file access scope.
- Minimal access scopes operations to the app's permitted folders; full access expands the scope. These settings are not an OS-level security sandbox.
- Keep destructive-action confirmation enabled. Review proposed file changes and typing actions before accepting them.
- Enable Launch at login from the tray menu when supported by the OS.
- Optional cloud providers include Anthropic, OpenAI, DeepSeek and OpenRouter. Charges and internet usage come from those providers; see the cloud safety limitation above.

Settings and update-check state are stored under Electron's userData directory, normally:

| OS | Typical location |
| --- | --- |
| macOS | `~/Library/Application Support/Halo/` |
| Windows | `%APPDATA%/Halo/` |
| Linux | `~/.config/Halo/` |

Exact directory names can vary with the packaged app name. `settings.json` currently stores API keys as plain JSON, not in the OS keychain. Treat it as sensitive: do not commit it, attach it to issues or include it in shared backups. `update-check.json` stores the last successful update-check timestamp. Back up settings before reinstalling; neither local files nor settings are intentionally deleted by the updater.

## Daily application updates

Every build that includes the updater connects to **published stable GitHub releases** in `asgeorgia/haloagents`. It checks on first launch, then once every 24 hours while running. Successful check times persist across relaunches. If Halo was closed or the computer was asleep, it checks when it next opens or wakes if overdue. It cannot poll while the app is not running.

- The scheduler tests whether a check is due every minute; this is not a network request every minute.
- Failed/offline checks retry after one hour. Local work can continue without the update service.
- Use **Check for updates** in the tray menu to check immediately.
- Installed Windows NSIS builds, signed macOS builds and writable Linux AppImages download updates in the background.
- Halo asks before restarting. An active agent task blocks installation; finish the task and choose **Install update and restart**. **Later** keeps the current version running. Automatic installation on ordinary quit is disabled.
- Windows portable builds and Linux DEB/RPM builds poll daily but direct users to the release page for manual installation.
- Prereleases and downgrades are not automatically selected.
- A version installed before the updater was introduced cannot gain polling remotely: users must install an update-enabled build once manually.

**A normal code push is not an application update.** Publish a higher-version installer and its update metadata through a matching version tag. Web-page refreshes do not replace installed desktop binaries. This is desktop update support, not a website service-worker cache.

## Run and test the desktop source

Install Node.js 22+ and native build tools if required by desktop automation dependencies.

```sh
git clone https://github.com/asgeorgia/haloagents.git
cd haloagents/desktop
npm install
npm test
npm start
```

For the standalone desktop source ZIP, open the extracted `halo/` folder instead of `haloagents/desktop`. Development builds do not automatically contact the update feed.

```sh
npm run dist:mac
npm run dist:win
npm run dist:linux
```

Build on the matching OS, especially for signed macOS builds and native automation dependencies. macOS targets include DMG and ZIP (the ZIP is necessary for updates); Windows targets include NSIS and portable; Linux targets include AppImage, DEB and RPM. Inspect the actual generated filenames and reconcile them with `src/data/releases.ts` before publishing download links, especially across CPU architectures.

## Publish a desktop update

1. Ensure this complete repository is connected to `asgeorgia/haloagents` through Lovable's GitHub sync, or transfer the source there. Naming a repository in download links does not itself connect or upload code to GitHub.
2. In GitHub → repository Settings → Actions → General, allow Actions to run and grant the release workflow permission to write repository contents. The workflow declares `contents: write` and uses the built-in `GITHUB_TOKEN`; do not embed a private GitHub token in the app.
3. Configure signing under GitHub → repository Settings → Secrets and variables → Actions:

| Secret | Purpose |
| --- | --- |
| `MAC_CSC_LINK` | Developer ID certificate file reference or encoded certificate accepted by electron-builder |
| `MAC_CSC_KEY_PASSWORD` | Password for the macOS signing certificate |
| `WIN_CSC_LINK` | Optional Windows code-signing certificate |
| `WIN_CSC_KEY_PASSWORD` | Password for that Windows certificate |

The macOS job intentionally fails if its signing secrets are missing. Configure Apple notarization with your Apple Developer credentials and appropriate electron-builder notarization configuration before public macOS distribution; this repository does not yet implement that step. Never paste signing keys, passwords or provider keys into source or public issues.

4. Increase `desktop/package.json` to a version higher than the installed version; keep `appId` and signing identity stable. Update the website's version history using real release information, and regenerate its source download.
5. Commit and push the changes, then create and push the matching tag, for example:

```sh
# Example only: package.json must already contain 1.4.1
git tag v1.4.1
git push origin v1.4.1
```

6. Watch GitHub → Actions → Desktop release. The Windows, macOS and Linux jobs run on their respective operating systems. A failure on one OS does not imply the other installers failed; verify every platform before announcing the release.
7. Verify the release is published, not draft, and contains installers, ZIPs, blockmaps and generated `latest.yml`, `latest-mac.yml`, and `latest-linux.yml` metadata. Metadata records download names and integrity hashes. Do not hand-edit hashes, delete metadata or replace binaries in an existing release; publish another higher version instead. Keep older releases available.
8. On real Windows, macOS and Linux machines, install the previous **update-enabled** version and check: daily/manual discovery, download, Later, busy-task protection, restart installation, settings retention, offline retry and version display. macOS signing and AppImage write permissions must be verified on-device.

The root workflow builds `desktop/`. The workflow inside the downloadable desktop ZIP is for a standalone desktop-only repository and builds its root. Do not activate both workflows against the same directory layout.

## Website development and deployment

The website uses TanStack Start, React, TypeScript and Tailwind CSS. It has Home, Download, Releases and Install guide pages. No account, database or payment setup is required for the current informational website.

```sh
# From the repository root
bun install
bun run dev
# Production build outside the managed Lovable preview
bun run build
```

Publish the website through Lovable when ready. Publishing the website and publishing native GitHub release installers are separate actions. Maintain valid downloads and factual version history in `src/data/releases.ts`.

To regenerate the source ZIP, archive only desktop source, package configuration, documentation, tests and the standalone workflow under a `halo/` top-level folder. Exclude `.git`, dependencies, build output, credentials and local settings. Upload the inspected archive as `halo-1.4.0-source.zip` into the private `halo-downloads` Cloud Storage bucket. Do not put it in `public/`: `/account` issues expiring links after verified signup. Update the version and storage object name together for future snapshots.

## Troubleshooting

| Problem | Check / next action |
| --- | --- |
| No update found after a code push | Publish a matching higher-version tag and stable GitHub release; branch pushes alone are insufficient |
| Update check fails | Verify internet access, public repository/release visibility and latest metadata; retry from the tray |
| Installed older build never checks | Manually install a build containing the updater once |
| macOS update fails | Verify Developer ID signing, consistent identity, ZIP target, metadata and installation permissions |
| Windows update fails | Use the installed NSIS build, verify signing identity and let antivirus/security checks finish |
| AppImage cannot update | Move it to a writable directory and confirm the running process has APPIMAGE set |
| DEB/RPM or portable build does not auto-install | Expected: download/install the new package manually |
| Restart unavailable during a task | Finish the task, then use Install update and restart |
| Local model unavailable | Start Ollama, check the endpoint and download a model that fits the machine |
| Offline requests attempt model download | Set autoPullLatest to false after obtaining the local model |
| Cannot type into another app | Check macOS Accessibility or Linux X11/Wayland restrictions |
| Download returns 404 | Verify the release/tag exists and the actual asset filename matches the website |

## Security and support

Report reproducible issues at https://github.com/asgeorgia/haloagents/issues. Include OS, architecture, installed version, installer type and non-sensitive error details. Remove API keys, file contents, personal paths and credentials from logs. Do not attach settings.json.

Use only trusted release sources, protect signing credentials and back up important files before agent file operations. The desktop package declares MIT licensing; review dependencies' licenses and include an appropriate LICENSE file before public distribution.

## Configurable communications — desktop source

The source includes email (SendGrid), SMS and static-template WhatsApp (Twilio) account settings, opted-in CSV import, channel-specific suppression, locally persisted schedules, approval, pause/cancel/resume and delivery history. Automated tests use mocks; real sends and native keychain behavior still require owner-approved accounts, test recipients and target-platform verification. This is not an unrestricted universal communications service.

### Setup
1. Open **Contacts & tasks → Accounts**. Create your own sender account in SendGrid or Twilio. Halo does not acquire accounts or numbers for you, and includes no shared workspace credentials. Confirm identity, sender verification, applicable SMS registration and destination permissions with your provider.
2. Email: provide SendGrid API key with mail-send permission, verified sender email and numeric unsubscribe group ID. Configure subscription tracking/group unsubscribe and suppression management in SendGrid. Halo never enables unsubscribe/list-management bypass flags. Check SendGrid delivery events in its console; acceptance does not prove delivery.
3. SMS/WhatsApp: provide Twilio Account SID (`AC…`), API Key SID (`SK…`), API Secret and Messaging Service SID (`MG…`). Configure Advanced Opt-Out on the service. WhatsApp also needs an approved static Content SID (`HX…`); no template variables are supported yet. Displayed task content must exactly match that approved template. Do not use researched leads without channel-specific opt-in. See https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out and https://www.twilio.com/docs/content/send-templates-created-with-the-content-template-builder.
4. Import a CSV under 2 MB (maximum 10,000 rows). Required headers: `channel,address,consent,consent_evidence,consent_date,name`. Use `email`, `sms` or `whatsapp`; phones must be E.164. `consent` is `yes`/`true`, evidence is the source/reference, and `consent_date` is a valid past/current YYYY-MM-DD. Validation does not independently prove that consent is genuine: you remain responsible for evidence. Reimport never removes a suppression.
5. Set message/subject, IANA timezone, same-day allowed hours, daily cap (1–1,000), conservative USD cost per message and total estimated USD budget. SMS is limited to 160 ASCII characters to avoid unexpected multipart costs. The native approval dialog shows audience size, content, hours and estimated budget before activating.
6. Each task processes each eligible contact **once**, at most one send globally per minute, only while Halo runs. Daily caps are upper limits, not quotas. Missed windows are skipped. Estimated costs are reserved before requests, not reconciled invoices; configure provider billing limits. Exhaustion/denials/uncertain delivery pause the task. Crash-interrupted reservations are uncertain and never replayed automatically.
7. Suppress recipients in Contacts immediately on opt-out. Twilio delivery refresh records a provider opt-out error in the local suppression list; Advanced Opt-Out/SendGrid remain responsible for provider-side enforcement. Manual delivery refresh is bounded to the last 20 pending Twilio records. No always-on callback endpoint or inbound-message handling is included yet.

### Data and secrets
Accounts, contacts, suppression and task records use OS-backed encrypted storage under the app userData directory. Keys never return to the renderer after saving. On Linux enable a supported Secret Service/KWallet keychain; plaintext fallback is disabled. The current OS user is the desktop owner; there is no multi-user desktop login. Do not give the agent access to key files or export them. An OS account administrator can still access that account's data.

### Not connected yet
- Google Calendar's official remote MCP endpoint is `https://calendarmcp.googleapis.com/mcp/v1`; official configuration is https://developers.google.com/workspace/calendar/api/guides/configure-mcp-server. It is developer-preview gated and requires eligible Workspace preview access plus project/API and end-user authorization. No calendar token or account is configured here.
- Microsoft calendar Work IQ/Agent 365 is preview/tenant-admin and billing gated: https://learn.microsoft.com/en-us/microsoft-agent-365/tooling-servers-overview. No booking, rescheduling or cancellation is claimed.
- Conversational inbound/outbound AI calls need a verified phone-service account/number, consent, disclosure, authorized voice processing and a reachable authenticated endpoint with offline voicemail/human fallback. None is connected. No recording or number purchase is automatic.
- iMessage is not SMS; no unrestricted bulk iMessage integration is included. Owner notification/approval messaging is also not connected; desktop approvals use native dialogs.

Run `node --test test/*.test.js` from `desktop/` to validate scheduling, CSV, provider redaction, cloud approval and updater behavior. Before production distribution, use opt-in test recipients and verify provider delivery, unsubscribe behavior, actual pricing and the OS keychain on each supported platform.


## Website accounts, owner administration and model offers

The website is built by **Magenta AI Lab Inc**. Terms and Privacy links appear in the footer. Source downloads require name, verified email, and Terms acceptance; signup does not authorize marketing. `/account` issues a five-minute source ZIP link. This is source, not a signed native installer. The admin panel at `/admin` is restricted to the confirmed owner account (`ing.appiah@gmail.com`); sign up and verify that account first. It reports accounts, download requests, issued links, conversion and daily activity. Issued links are not completed installations, and no local desktop task activity is uploaded.

Under Model releases, save an Ollama model tag, license, version, notes and minimum RAM as a draft, then publish or archive the offer. Creation and publication changes are audited. Compatible source builds poll `https://haloagents.app/api/public/models` daily with persisted successful checks and an hourly failure retry. The tray offers eligible models and a manual check. Downloads and selection require native owner approval, a local Ollama endpoint, and an idle task state; no shell command or arbitrary binary is executed. A task starting during download prevents switching. Custom model binaries, forced installs and proof of users adopting models are not supported. Existing apps need a release containing this integration first, and the website catalogue must be published before installed apps can read it.

Before commercial release, Magenta AI Lab Inc must supply a public privacy/legal contact and postal address and arrange legal review. Real native installers still require GitHub release publication and target-platform signing/testing. Calls, calendars, iMessage and incoming conversational reception are not connected in this source build; provider accounts, permissions and separate approved integration work remain necessary.
