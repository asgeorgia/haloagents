export const REPO = "https://github.com/asgeorgia/haloagents";

export type Platform = "mac" | "windows" | "linux";
export type Release = {
  version: string;
  date: string;
  channel: "stable" | "beta";
  notes: string[];
};

// Source snapshot, not a published installer release.
export const latest: Release =
  { version: "1.4.2", date: "2026-10-09", channel: "stable", notes: [
    "First-launch setup screen with a one-click Ollama download for your operating system",
    "Start Ollama automatically when it is installed but not running",
    "Show local model download progress",
    "Provide setup guidance when Ollama is unavailable",
  ] };

// Add history only after verifying the corresponding published GitHub release.
export const releases: Release[] = [];

export const assets = (v: string) => [
  { platform: "mac" as Platform, label: "macOS · Apple Silicon", file: `Halo-${v}-arm64.dmg` },
  { platform: "mac" as Platform, label: "macOS · Intel", file: `Halo-${v}.dmg` },
  { platform: "windows" as Platform, label: "Windows · Installer", file: `Halo-Setup-${v}.exe` },
  { platform: "windows" as Platform, label: "Windows · Portable", file: `Halo-${v}.exe` },
  { platform: "linux" as Platform, label: "Linux · AppImage", file: `Halo-${v}.AppImage` },
  { platform: "linux" as Platform, label: "Linux · Debian/Ubuntu", file: `halo-agent_${v}_amd64.deb` },
  { platform: "linux" as Platform, label: "Linux · Fedora/RHEL", file: `halo-agent-${v}.x86_64.rpm` },
];

export const assetUrl = (v: string, file: string) => `${REPO}/releases/download/v${v}/${file}`;
export const sourceUrl = "/account";
