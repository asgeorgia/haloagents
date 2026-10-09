import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Install Halo — setup guide and FAQ" },
      { name: "description", content: "Step-by-step install notes for macOS, Windows and Linux, plus model setup and FAQ." },
      { property: "og:title", content: "Install Halo" },
      { property: "og:description", content: "Setup guide for every platform." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Docs,
});

const sections: [string, string[]][] = [
  ["macOS", [
    "Open the .dmg and drag Halo into Applications.",
    "Use the Apple Silicon (arm64) .dmg on M-series Macs and the Intel .dmg on older Macs.",
    "Install Ollama (required, free): download it from ollama.com/download/mac, open the downloaded Ollama.zip, drag Ollama into Applications and open it once — a small llama icon appears in the menu bar. Or in Terminal: brew install ollama. Halo starts Ollama automatically when it is not running.",
    "If you see \u201cApple could not verify Halo\u201d, click Done, open System Settings → Privacy & Security, scroll down and click Open Anyway next to Halo, then confirm with your password.",
    "Or in Terminal: xattr -dr com.apple.quarantine /Applications/Halo.app — then open Halo normally.",
    "Allow System Settings → Privacy & Security → Accessibility so Halo can type in other apps.",
    "Automatic updates on macOS start working once builds are signed with an Apple Developer ID.",
  ]],
  ["Windows", [
    "Run Halo-Setup-<version>.exe. If SmartScreen appears, choose More info → Run anyway (builds are not yet code-signed).",
    "Prefer no install? Use Halo-Portable-<version>.exe (check for updates manually).",
    "Install Ollama (required, free): download OllamaSetup.exe from ollama.com/download/windows and run it. Ollama then runs quietly in the background — no need to open anything; Halo starts and uses it automatically.",
  ]],
  ["Linux", [
    "Install Ollama (required, free): run curl -fsSL https://ollama.com/install.sh | sh in a terminal. This is the official installer script; it installs Ollama as a background service and needs your password. On servers or without systemd, download the tarball from ollama.com/download and extract it instead.",
    "AppImage: chmod +x Halo-*.AppImage, then run it.",
    "Debian/Ubuntu: sudo apt install ./halo-agent_*_amd64.deb",
    "Fedora/RHEL: sudo dnf install ./halo-agent-*.rpm",
    "On Wayland, typing into other apps may need X11 or XWayland.",
  ]],
  ["Local model (offline)", [
    "Ollama must be installed first — see the step for your operating system above.",
    "With Ollama running, the first message you send makes Halo download its local model (default qwen2.5:7b-instruct, about 4.7 GB) and shows progress. Keep internet on for this first download only.",
    "To pre-download it in a terminal: ollama pull qwen2.5:7b-instruct",
    "Try llama3.1, deepseek-r1 or qwen3 in Halo's settings. If Ollama is missing, Halo shows a Download Ollama prompt instead of answering.",
  ]],
  ["Cloud models (optional)", [
    "Click ⚙ in Halo, choose Anthropic, OpenAI, DeepSeek or OpenRouter, and paste your API key.",
    "Keys use OS-backed encryption. Cloud is disabled by default; each request needs approval with the provider, model, payload size and estimated cost. Configure rates and an estimated task budget; actual billing requires provider-side limits.",
  ]],
  ["Contacts and message schedules", [
    "Open Contacts & tasks in the desktop app. Configure your own verified SendGrid or Twilio account; credentials are encrypted using your OS keychain, not stored in chat.",
    "Import a CSV with channel,address,consent,consent_evidence,consent_date,name. Channels are email, sms and whatsapp; phone numbers must use E.164 format. Dated opt-in is required. Research is not consent.",
    "Set content, timezone, allowed hours, daily cap, per-message upper cost estimate and total estimated budget. Review and approve before sending. Each contact receives at most one message per task; missed windows are skipped.",
    "Pause, cancel, suppress recipients and inspect delivery history. SendGrid acceptance is not delivery; check its console. Twilio delivery status can be refreshed. Uncertain sends are not retried automatically.",
    "WhatsApp requires an approved static Content SID and exact matching preview text; template variables are not supported yet. SMS is limited to 160 ASCII characters. Verify sender registration and provider opt-out settings before enabling schedules.",
    "Calendar access, conversational calls, iMessage and owner notifications are not connected yet. Calendars need authorized preview access; incoming calls need a reachable service, disclosure, consent and an offline fallback. No numbers are purchased automatically.",
  ]],
  ["Using Halo", [
    "Ctrl/Cmd+Shift+Space shows or hides the panel. Press – to shrink it to a floating orb.",
    "Pick File access: Minimal (apps + Desktop/Documents/Downloads) or Entire file system.",
    "Halo asks before moving files or typing. You can switch this off in settings.",
    "Enable Launch at login from the tray icon.",
  ]],
  ["Build from source", [
    "Download the source zip, install Node.js 20+, then run npm install.",
    "npm start to run, or npm run dist:mac / dist:win / dist:linux to build installers.",
    "Pushing a tag such as v1.4.0 to GitHub builds every platform automatically.",
  ]],
  ["Daily updates", [
    "Update-enabled builds check published releases at github.com/asgeorgia/haloagents once every 24 hours while Halo is running, and when it next opens or wakes if a check is overdue.",
    "New releases download in the background on installed Windows builds, signed macOS builds and writable Linux AppImages. Halo asks before restarting; active tasks are not interrupted.",
    "Use Check for updates or Install update and restart in the tray menu. If you are offline, Halo retries later without stopping local work.",
    "Portable Windows builds and Linux .deb/.rpm packages check daily too, but require you to download and install the new release yourself.",
    "A code push alone does not distribute an update: increase the desktop app version and push its matching v-prefixed tag. The release must include installers and latest*.yml update metadata.",
    "macOS automatic updates require a Developer ID signing certificate. Versions installed before update support was added need a one-time manual upgrade.",
  ]],
];

function Docs() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-5xl font-bold">Install guide</h1>
      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Command-line downloads</h2>
        <p className="mt-4 text-muted-foreground">On macOS or Linux, install GitHub CLI (gh) from cli.github.com. These commands list actual published installers and download the filename you choose. A release must exist first.</p>
        <pre className="mt-4 max-w-full overflow-x-auto rounded-md border border-border bg-muted p-4 text-sm"><code>{`gh release view --repo asgeorgia/haloagents --json tagName,assets --jq '.tagName, (.assets[].name)'
uname -sm
mkdir -p "$HOME/Downloads/Halo"
printf 'Enter the exact installer filename: '
IFS= read -r HALO_ASSET
if [ -n "$HALO_ASSET" ]; then
  gh release download --repo asgeorgia/haloagents --pattern "$HALO_ASSET" --dir "$HOME/Downloads/Halo"
fi`}</code></pre>
        <p className="mt-4 text-muted-foreground">Choose a macOS DMG for Apple Silicon (arm64) or Intel (x64), or a Linux AppImage, DEB or RPM matching your processor. Check the release notes if a filename omits its architecture. Verify the publisher before opening. Run only the matching command below, in the same terminal session.</p>
        <pre className="mt-4 max-w-full overflow-x-auto rounded-md border border-border bg-muted p-4 text-sm"><code>{`# macOS DMG: then drag Halo to Applications
open "$HOME/Downloads/Halo/$HALO_ASSET"

# Linux AppImage
chmod +x "$HOME/Downloads/Halo/$HALO_ASSET"
"$HOME/Downloads/Halo/$HALO_ASSET"

# Debian / Ubuntu DEB (alternative)
sudo apt install "$HOME/Downloads/Halo/$HALO_ASSET"

# Fedora / RHEL RPM (alternative)
sudo dnf install "$HOME/Downloads/Halo/$HALO_ASSET"`}</code></pre>
        <p className="mt-4 text-muted-foreground">The repository README includes downloads for specific versions. Public releases need no private token; private access requires gh auth login. Halo needs a graphical desktop. Other Unix systems, including BSD and Solaris, have no native Halo installers; downloading a Linux package does not make them supported.</p>
      </section>
      {sections.map(([title, steps]) => (
        <section key={title} className="mt-12">
          <h2 className="text-2xl font-semibold">{title}</h2>
          <ol className="mt-4 space-y-3">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-4">
                <span className="font-mono text-primary">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-muted-foreground">{s}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}
