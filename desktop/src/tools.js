// Tools the agent may call. Every path is checked against the access scope.
const fs = require('fs/promises'); const path = require('path'); const os = require('os');
const { shell } = require('electron'); const { exec } = require('child_process');

function roots(mode) {
  if (mode === 'full') return [path.parse(os.homedir()).root];
  const h = os.homedir();
  const apps = { darwin: ['/Applications'], win32: [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean), linux: ['/usr/share/applications', '/opt'] }[process.platform] || [];
  return [...['Desktop', 'Documents', 'Downloads'].map((d) => path.join(h, d)), ...apps];
}
function resolve(p, cfg) {
  const abs = path.resolve(p.replace(/^~(?=$|[\\/])/, os.homedir()));
  if (!roots(cfg.accessMode).some((r) => abs.toLowerCase().startsWith(path.resolve(r).toLowerCase())))
    throw new Error(`Access denied: ${abs} is outside the "${cfg.accessMode}" scope. Switch to Full access in settings.`);
  return abs;
}
const CATS = { Images: /\.(png|jpe?g|gif|webp|heic|svg|bmp)$/i, Documents: /\.(pdf|docx?|txt|rtf|odt|md|pages)$/i,
  Spreadsheets: /\.(xlsx?|csv|ods|numbers)$/i, Slides: /\.(pptx?|key|odp)$/i, Archives: /\.(zip|rar|7z|tar|gz)$/i,
  Audio: /\.(mp3|wav|flac|m4a|aac)$/i, Video: /\.(mp4|mov|mkv|avi|webm)$/i, Installers: /\.(dmg|pkg|exe|msi|deb|rpm|appimage)$/i,
  Code: /\.(js|ts|py|java|c|cpp|go|rs|html|css|json)$/i };

const tools = {
  list_dir: { desc: 'List files in a folder. args: {path}', async run({ path: p }, cfg) {
    const d = resolve(p, cfg); return (await fs.readdir(d, { withFileTypes: true })).slice(0, 300).map((e) => (e.isDirectory() ? '[dir] ' : '') + e.name); } },
  read_file: { desc: 'Read a text file (first 20k chars). args: {path}', async run({ path: p }, cfg) {
    return (await fs.readFile(resolve(p, cfg), 'utf8')).slice(0, 20000); } },
  write_file: { desc: 'Create/overwrite a text file. args: {path, content}', destructive: true, async run({ path: p, content }, cfg) {
    const f = resolve(p, cfg); await fs.mkdir(path.dirname(f), { recursive: true }); await fs.writeFile(f, content); return `wrote ${f}`; } },
  move_file: { desc: 'Move or rename. args: {from, to}', destructive: true, async run({ from, to }, cfg) {
    const a = resolve(from, cfg), b = resolve(to, cfg); await fs.mkdir(path.dirname(b), { recursive: true }); await fs.rename(a, b); return `moved ${a} -> ${b}`; } },
  organize_folder: { desc: 'Sort loose files in a folder into category subfolders (Images, Documents, ...). args: {path}', destructive: true,
    async run({ path: p }, cfg) {
      const d = resolve(p, cfg); const moved = [];
      for (const e of await fs.readdir(d, { withFileTypes: true })) {
        if (!e.isFile()) continue;
        const cat = Object.keys(CATS).find((k) => CATS[k].test(e.name)) || 'Other';
        await fs.mkdir(path.join(d, cat), { recursive: true });
        await fs.rename(path.join(d, e.name), path.join(d, cat, e.name)); moved.push(`${e.name} -> ${cat}/`);
      }
      return moved.length ? moved : 'nothing to organize'; } },
  find_files: { desc: 'Find files whose name matches a regex under a folder (depth 4). args: {path, pattern}', async run({ path: p, pattern }, cfg) {
    const re = new RegExp(pattern, 'i'); const out = [];
    async function walk(d, depth) { if (depth > 4 || out.length > 100) return;
      for (const e of await fs.readdir(d, { withFileTypes: true }).catch(() => [])) {
        const f = path.join(d, e.name); if (e.isDirectory() && !e.name.startsWith('.')) await walk(f, depth + 1); else if (re.test(e.name)) out.push(f); } }
    await walk(resolve(p, cfg), 0); return out; } },
  open_url: { desc: 'Open a website in the default browser (e.g. https://docs.new for a Google Doc). args: {url}', async run({ url }) { await shell.openExternal(url); return `opened ${url}`; } },
  open_app: { desc: 'Launch an installed application by name. args: {name}', async run({ name }) {
    const cmd = process.platform === 'darwin' ? `open -a "${name}"` : process.platform === 'win32' ? `start "" "${name}"` : `${name} &`;
    await new Promise((res, rej) => exec(cmd, (err) => (err ? rej(err) : res()))); return `launched ${name}`; } },
  type_text: { desc: 'Type text into the currently focused app (e.g. a word processor). args: {text}', destructive: true, async run({ text }) {
    const { keyboard } = require('@nut-tree-fork/nut-js'); keyboard.config.autoDelayMs = 5; await keyboard.type(text); return `typed ${text.length} chars`; } },
  web_search: { desc: 'Search the web. Returns titles, urls and snippets. args: {query}', async run({ query }) {
    const html = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query), { headers: { 'user-agent': 'Mozilla/5.0' } }).then((r) => r.text());
    return [...html.matchAll(/class="result__a" href="([^"]+)"[^>]*>(.*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>(.*?)<\/a>/g)].slice(0, 8)
      .map((m) => ({ url: decodeURIComponent((m[1].match(/uddg=([^&]+)/) || [, m[1]])[1]), title: m[2].replace(/<[^>]+>/g, ''), snippet: m[3].replace(/<[^>]+>/g, '') })); } },
  fetch_page: { desc: 'Fetch readable text of a web page (prices, job posts...). args: {url}', async run({ url }) {
    const t = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } }).then((r) => r.text());
    return t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 15000); } },
};
module.exports = { tools, roots };
