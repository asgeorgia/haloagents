# Halo — floating AI agent for macOS, Windows and Linux

Halo floats above every app and does tasks for you: organizes files, writes essays in Google Docs or your word processor, researches (local files first, then the web), compares prices and prepares job applications from your resume.

## Run from source
1. Install Node.js 20+ and (recommended) Ollama from https://ollama.com.
2. `npm install`, then `npm start`.
3. Press Ctrl/Cmd+Shift+Space to show or hide Halo. Click ⚙ for settings.
4. Click minimize to leave a small Halo button at the right edge of your screen. Click the button to restore the previous panel size and position. Closing hides Halo without stopping active tasks.

## First launch
On first open, Halo shows a setup panel with a one-click Ollama download for the current operating system (macOS app, Windows installer, or the Linux install script) and a "Check again" detection button. "Skip for now" hides the panel; reinstalling or resetting settings does not nag again until Ollama is detected or settings reset.

## Build installers
- `npm run dist:mac` → .dmg (Apple Silicon + Intel)
- `npm run dist:win` → .exe installer + portable
- `npm run dist:linux` → .AppImage, .deb, .rpm
Or push a tag like `v1.4.0` to GitHub: the included workflow builds all platforms and publishes a release.

## Command-line downloads (macOS and Linux)

Install [GitHub CLI](https://cli.github.com/) (`gh`) first. Public releases need no private token; private repository access requires `gh auth login`. Installers must be published before these commands work. In sh, bash or zsh:

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

Choose the matching processor: macOS arm64 is Apple Silicon, x64 is Intel; Linux needs an asset built for your processor. Some x64 filenames omit the architecture, so check release notes. Choose a DMG, AppImage, DEB or RPM, not metadata or a source ZIP. Verify the publisher and supplied checksums/signatures before opening.

Run only the command matching your selected download, in the same session:

```sh
# macOS DMG: drag Halo to Applications in the window that opens
open "$HOME/Downloads/Halo/$HALO_ASSET"
# After installation on macOS
xattr -dr com.apple.quarantine /Applications/Halo.app
open -a Halo

# Linux AppImage: keep it writable for updates; do not run with sudo
chmod +x "$HOME/Downloads/Halo/$HALO_ASSET"
"$HOME/Downloads/Halo/$HALO_ASSET"

# Debian / Ubuntu DEB (alternative to AppImage)
sudo apt install "$HOME/Downloads/Halo/$HALO_ASSET"

# Fedora / RHEL RPM (alternative to AppImage)
sudo dnf install "$HOME/Downloads/Halo/$HALO_ASSET"
```

For a past version, list tags with `gh release list --repo asgeorgia/haloagents`, then replace the placeholders below with a real tag and exact asset filename:

```sh
gh release view <published-tag> --repo asgeorgia/haloagents --json assets --jq '.assets[].name'
gh release download <published-tag> --repo asgeorgia/haloagents \
  --pattern '<exact-installer-filename>' --dir "$HOME/Downloads/Halo"
```

Downloads do not bypass OS security checks. A graphical desktop is required. Other Unix systems (FreeBSD, OpenBSD, NetBSD, Solaris, etc.) have no native Halo installers; Linux packages do not establish support there. Shell downloads may work, but compatibility layers and native installation on those systems are unverified. An older update-enabled install may offer the latest stable version on its daily check.

## Daily updates
- Release feed: https://github.com/asgeorgia/haloagents/releases. No private token is bundled.
- Packaged builds check on first launch, then once per 24 hours. The last successful check is stored in the user's application data, so relaunching does not reset the daily interval. Running apps check for overdue updates every minute, including after wake; failures retry after an hour.
- Windows NSIS, signed macOS installs and Linux AppImages download automatically. Restart installation requires confirmation and is blocked during active agent work. Later leaves the current version running; the tray offers Check for updates and Install update and restart.
- Windows portable and Linux deb/rpm builds poll the same release feed but require manual installation. AppImages must be writable. Development builds do not check automatically.
- Existing builds without this updater need one manual upgrade. This cannot retroactively add polling to software already installed.

## Publishing an update
1. Increase package.json version, commit changes and push the matching tag (for example v1.4.1) to asgeorgia/haloagents. A normal branch push does not publish a desktop update.
2. Keep the appId stable. Publish the installers together with electron-builder's latest.yml, latest-mac.yml, latest-linux.yml, ZIPs and blockmaps; do not delete release metadata or older release assets.
3. In GitHub repository Actions secrets, configure MAC_CSC_LINK and MAC_CSC_KEY_PASSWORD with a Developer ID certificate. macOS publishing fails intentionally if they are absent because unsigned macOS updates cannot be installed. Windows signing uses WIN_CSC_LINK and WIN_CSC_KEY_PASSWORD when supplied; keep the signing identity consistent between releases. Configure Apple notarization for public macOS distribution separately.
4. Test updates on actual Windows, macOS and Linux machines using an older update-enabled installed version. Source scheduler tests do not prove native installation works.
5. In the combined website repository, the root desktop-release workflow builds the desktop/ folder. In the source ZIP repository, the included release workflow builds from the root.

## Models
Local first via Ollama (pulls the configured model automatically, e.g. qwen2.5, llama3.1, deepseek-r1). If the local model fails, Halo escalates to your chosen cloud provider: Anthropic (Claude Opus), OpenAI (GPT-5), DeepSeek, or OpenRouter (Qwen, Llama, Mistral, Gemini, and more).

## Safety
- File access: "minimal" (installed apps + Desktop/Documents/Downloads) or "full" (entire disk).
- Halo asks before moving, writing or typing anything (can be turned off).
- Typing into other apps needs Accessibility permission on macOS (System Settings → Privacy & Security → Accessibility).

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
