// Agent loop: model proposes JSON actions, Halo executes tools, results fed back until "final".
const os = require('os');
const { complete } = require('./models');
const { tools, roots } = require('./tools');

function systemPrompt(cfg) {
  return `You are Halo, a desktop agent on ${process.platform} acting for the user. Home: ${os.homedir()}.
Access scope (${cfg.accessMode}): ${roots(cfg.accessMode).join(', ')}.
Reply ONLY with JSON. To act: {"thought":"...","tool":"name","args":{...}}. When done: {"final":"answer for the user"}.
Tools:\n${Object.entries(tools).map(([n, t]) => `- ${n}: ${t.desc}`).join('\n')}
Playbooks: organize files -> organize_folder on Desktop, Downloads, Documents. Essays -> open_url https://docs.new or open_app a word processor, then type_text.
Research -> find_files/read_file locally first, then web_search + fetch_page; cite sources. Best price -> web_search several retailers, fetch_page, compare, give a table.
Communications: never invent working recipient emails/phone numbers or treat research as consent. For email/SMS/WhatsApp campaigns ask for opted-in CSV, channel, sender account, dated consent evidence, message, timezone, daily cap, allowed hours and spending approval. Then call communication_setup to open the private task controls. Never request secrets in chat, purchase numbers, send messages, submit forms or book appointments via general tools. Communications execute only through approved task controls, once per contact. Incoming conversational calls, calendars and iMessage are not connected; explain the required service setup rather than pretending to act. Owner notifications are not connected yet.
Job applications -> find_files for resume (cv|resume), read it, search postings, open them and prepare tailored answers; never submit without the user's confirmation.`;
}

async function runAgent(history, cfg, { send, confirm }) {
  const messages = [{ role: 'system', content: systemPrompt(cfg) }, ...history];
  for (let step = 0; step < 30; step++) {
    const raw = await complete(messages, cfg, send, confirm);
    let act; try { act = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch { send('final', { text: raw }); return raw; }
    messages.push({ role: 'assistant', content: JSON.stringify(act) });
    if (act.final) { send('final', { text: act.final }); return act.final; }
    const tool = tools[act.tool];
    let result;
    if (!tool) result = `Unknown tool ${act.tool}`;
    else {
      send('step', { thought: act.thought, tool: act.tool, args: act.args });
      if (tool.destructive && cfg.confirmDestructive && !(await confirm(`${act.tool} ${JSON.stringify(act.args)}`))) result = 'User declined this action.';
      else { try { result = await tool.run(act.args || {}, cfg); } catch (e) { result = `Error: ${e.message}`; } }
    }
    send('result', { tool: act.tool, result: typeof result === 'string' ? result.slice(0, 400) : JSON.stringify(result).slice(0, 400) });
    messages.push({ role: 'user', content: `Tool result:\n${typeof result === 'string' ? result : JSON.stringify(result)}` });
  }
  send('final', { text: 'Stopped after 30 steps.' });
}
module.exports = { runAgent };
