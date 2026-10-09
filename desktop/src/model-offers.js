const fs = require('fs');
const path = require('path');
const os = require('os');
const { createUpdateScheduler } = require('./update-scheduler');
const CATALOGUE = 'https://haloagents.app/api/public/models';
function validateCatalogue(value) {
  if (value?.schema !== 1 || !Array.isArray(value.models) || value.models.length > 100) throw new Error('Invalid model catalogue');
  return value.models.filter(m => m && typeof m.id === 'string' && typeof m.name === 'string' && m.name.length <= 100 && typeof m.version === 'string' && m.version.length <= 60 && typeof m.ollama_model === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._/:@-]{0,199}$/.test(m.ollama_model) && typeof m.license === 'string' && m.license.length <= 500 && typeof m.notes === 'string' && m.notes.length <= 5000 && Number.isInteger(m.minimum_ram_gb) && m.minimum_ram_gb > 0 && m.minimum_ram_gb <= 1024);
}
function startModelOffers({ app, settings, dialog, isBusy, onStatus = () => {}, request = fetch }) {
  const file = path.join(app.getPath('userData'), 'model-offers.json');
  let state = { lastCheck: 0, models: [] }; let pulling = false;
  try { const saved = JSON.parse(fs.readFileSync(file, 'utf8')); state = { lastCheck: Number(saved.lastCheck) || 0, models: validateCatalogue({schema:1,models:saved.models}) }; } catch {}
  const persist = () => { fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, JSON.stringify(state), {mode:0o600}); };
  const scheduler = createUpdateScheduler({readLastCheck:()=>state.lastCheck,writeLastCheck:n=>{state.lastCheck=n;persist();onStatus();},check:async()=>{
    const response = await request(CATALOGUE,{signal:AbortSignal.timeout(20000)}); if(!response.ok) throw new Error('Catalogue unavailable');
    const body = await response.text(); if(body.length>1000000) throw new Error('Catalogue too large'); state.models=validateCatalogue(JSON.parse(body));
  }});
  async function choose(model) {
    if(pulling || isBusy()) return dialog.showMessageBox({message:'Finish active tasks before changing models.'});
    const cfg=settings.get();
    const answer=await dialog.showMessageBox({type:'question',title:'Halo local model',message:`Download and select ${model.name}?`,detail:`Ollama tag: ${model.ollama_model}\nLicense: ${model.license}\nMinimum RAM: ${model.minimum_ram_gb} GB\n${model.notes}\n\nThis contacts Ollama's model distributor and uses internet bandwidth and disk space. Model licensing and hardware suitability remain your responsibility.`,buttons:['Cancel','Download and select'],defaultId:0,cancelId:0});
    if(answer.response!==1 || isBusy() || pulling) return;
    pulling=true;onStatus();
    try {
      const endpoint = new URL(cfg.ollamaUrl); if(!['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname) || endpoint.protocol!=='http:') throw new Error('Model downloads require a local Ollama endpoint.');
      const response=await request(new URL('/api/pull',endpoint),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:model.ollama_model,stream:false}),signal:AbortSignal.timeout(1800000)});
      if(!response.ok) throw new Error('Ollama model download failed.'); const result=await response.json(); if(result.error || result.status!=='success') throw new Error('Ollama did not confirm a successful download.');
      if(isBusy() || settings.get().localModel!==cfg.localModel) {await dialog.showMessageBox({message:'Model downloaded. Your model was not changed because a task started or settings changed.'});return;}
      settings.set({localModel:model.ollama_model}); await dialog.showMessageBox({message:`Selected ${model.name} for local tasks.`});
    } catch(error) { await dialog.showMessageBox({type:'error',message:error.message || 'Model download failed.'}); }
    finally {pulling=false;onStatus();}
  }
  scheduler.start();
  return {stop:()=>scheduler.stop(),menu:()=>[{label:'Check model offers',enabled:!pulling,click:()=>void scheduler.run(true)},{label:pulling?'Downloading model…':'Local model offers',submenu:state.models.filter(m=>m.minimum_ram_gb<=os.totalmem()/1024**3).map(m=>({label:`${m.name} · ${m.version}`,enabled:!pulling,click:()=>void choose(m)}))}],choose};
}
module.exports={startModelOffers,validateCatalogue};
