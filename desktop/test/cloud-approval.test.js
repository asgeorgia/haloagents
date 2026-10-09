const test=require('node:test');const assert=require('node:assert/strict');const {complete}=require('../src/models');
const cfg={ollamaUrl:'http://localhost:11434',localModel:'local',escalate:true,keys:{openai:'secret'},cloudProvider:'openai',cloudModel:'example',cloudInputRate:1,cloudOutputRate:1,cloudBudget:1};
test('Disabled, missing budget, denied and exhausted cloud approval do not call cloud',async()=>{
 const original=global.fetch;let clouds=0;
 global.fetch=async(url)=>{if(String(url).includes('api.openai.com'))clouds++;throw new Error('offline');};
 try{for(const config of [{...cfg,escalate:false},{...cfg,cloudBudget:0},cfg,{...cfg,cloudSpent:1}])await assert.rejects(complete([{role:'user',content:'hello'}],config,()=>{},async()=>false));assert.equal(clouds,0);}finally{global.fetch=original;}
});
test('Explicit approval shows provider, model, payload and bounded estimate',async()=>{
 const original=global.fetch;let approved=0;
 global.fetch=async(url,o)=>{if(String(url).includes('localhost'))throw new Error('offline');assert.equal(JSON.parse(o.body).max_tokens,1024);return{ok:true,json:async()=>({choices:[{message:{content:'{"final":"ok"}'}}]})};};
 try{const c={...cfg};await complete([{role:'user',content:'hello'}],c,()=>{},async(detail)=>{approved++;assert.match(detail,/openai \/ example/);assert.match(detail,/5 characters/);assert.match(detail,/Actual billing may differ/);return true;});assert.equal(approved,1);assert.ok(c.cloudSpent>0);}finally{global.fetch=original;}
});
