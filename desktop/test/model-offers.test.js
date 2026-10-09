const {test}=require('node:test'); const assert=require('node:assert/strict');
const {validateCatalogue}=require('../src/model-offers');
const model={id:'abc',name:'Qwen',version:'1',ollama_model:'qwen2.5:7b-instruct',license:'Apache-2.0',notes:'Local model',minimum_ram_gb:8};
test('accepts well-formed model offers',()=>assert.equal(validateCatalogue({schema:1,models:[model]}).length,1));
test('rejects invalid schema and oversized catalogue',()=>{assert.throws(()=>validateCatalogue({models:[]}));assert.throws(()=>validateCatalogue({schema:1,models:Array(101).fill(model)}));});
test('filters unsafe model identifiers and malformed requirements',()=>{assert.equal(validateCatalogue({schema:1,models:[{...model,ollama_model:'qwen; rm -rf /'},{...model,minimum_ram_gb:-1},model]}).length,1);});
