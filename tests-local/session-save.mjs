import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const repo = fileURLToPath(new URL('../', import.meta.url));
const generated = new URL('./.generated/', import.meta.url);
await mkdir(generated, { recursive: true });
await build({ stdin: { contents: `import { act } from 'react'; import './src/main.jsx'; import { englishScenarios } from './src/content/scenarios.en.js'; window.__test = { act, scenarios: englishScenarios };`, resolveDir: repo, loader: 'jsx' }, bundle: true, format: 'iife', outfile: fileURLToPath(new URL('app.js', generated)), loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"development"' } });
const bundle = await readFile(new URL('app.js', generated), 'utf8');
const blank = (name='Tester') => ({ name, goal:10, learned:[], reviews:{}, reviewStages:{}, sessions:0, minutes:0, dates:[], dailyMinutes:{}, sentenceProgress:{} });
const json = (value, status=200) => ({ ok:status<400, status, json:async()=>value });

async function fixture({account=false}={}) {
 const dom = new JSDOM('<!doctype html><div id="root"></div>', { url:'https://bloom.test', runScripts:'outside-only', pretendToBeVisual:true });
 const w=dom.window; const errors=[];
 // The real entry schedules its initial root render before exposing act.
 w.IS_REACT_ACT_ENVIRONMENT=false;
 w.MessageChannel=class { constructor(){ this.port1={onmessage:null};this.port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)} } };
 w.console.error=(...args)=>errors.push(args.join(' '));
 let time=Date.UTC(2026,10,14,12); w.Date.now=()=>time;
 Object.defineProperty(w.HTMLElement.prototype,'inert',{get(){return this.hasAttribute('inert')},set(v){this.toggleAttribute('inert',v)}});
 w.HTMLElement.prototype.getClientRects=function(){return [{width:100,height:40}]};
 w.HTMLElement.prototype.scrollIntoView=()=>{};
 const originalSet=w.Storage.prototype.setItem; let failStorage=false; let storageAttempts=0;
 w.Storage.prototype.setItem=function(key,value){ if(key==='bloom-profiles-v2'){storageAttempts++;if(failStorage)throw new w.DOMException('Quota exceeded','QuotaExceededError')}return originalSet.call(this,key,value)};
 const state={ authenticated:true, account:{id:'qa-account',email:'qa@example.test'}, profile:{language:'en',name:'Tester',goal:10,timezone:'UTC'}, learner:blank(),revision:0,imports:[] };
 const requests=[]; let release;
 w.fetch=async(path,options={})=>{
  if(path==='/api/session')return json(account?state:{authenticated:false});
  assert.equal(path,'/api/progress'); const body=JSON.parse(options.body); requests.push(body);
  if(requests.length===1)return json({code:'STORAGE_UNAVAILABLE'},503);
  return new Promise(resolve=>{release=()=>{state.revision++;state.learner.sessions++;for(const r of body.results)state.learner.sentenceProgress[r.sentenceId]={stage:1,dueAt:time+3*86400000,lastOutcome:'passed'};resolve(json(structuredClone(state)))}});
 };
 w.eval(bundle);
 w.IS_REACT_ACT_ENVIRONMENT=true;
 const act=async(fn=()=>{})=>{await w.__test.act(async()=>{await fn();await Promise.resolve()})};
 await act();
 const button=(label,root=w.document)=>{const found=[...root.querySelectorAll('button')].find(el=>el.textContent.trim()===label||el.getAttribute('aria-label')===label);assert.ok(found,`Button ${label} exists`);return found};
 const click=async(label,root=w.document)=>{time+=500;await act(()=>button(label,root).click())};
 if(!account)await click('이 브라우저의 로컬 데모 열기');
 const overlay=()=>w.document.querySelector('.session-overlay');
 const complete=async()=>{
  const sentences=w.__test.scenarios[0].sentences;
  await click('문장 세션 시작하기');
  await click('뜻을 확인했어요 · 듣기 시작',overlay());
  for(const s of sentences)await click('다음으로 →',overlay());
  for(const phase of ['shadow','recall','quiz'])for(let i=0;i<(phase==='quiz'?3:sentences.length);i++){
   const input=overlay().querySelector('textarea'); assert.ok(input);
   await act(()=>{Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype,'value').set.call(input,sentences[i%sentences.length].text);input.dispatchEvent(new w.Event('input',{bubbles:true}))});
   time+=500;await act(()=>input.form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})));
   await click(phase==='quiz'&&i===2?'결과 보기':'다음으로 →',overlay());
  }
  assert.equal(overlay().querySelector('h1').textContent,'세션 완료');
 };
 const retry=()=>button('다시 저장',overlay());
 function assertRetryInDialog(){
  const r=retry();assert.ok(r.closest('[role="dialog"]'),'retry belongs to active modal dialog');
  assert.equal(r.closest('[inert]'),null,'retry is outside inert background');
  assert.ok(w.document.getElementById('root').inert,'background stays inert');
  r.focus();assert.equal(w.document.activeElement,r,'retry accepts focus');
  const focusable=[...r.closest('[role="dialog"]').querySelectorAll('button:not(:disabled),textarea:not(:disabled),[tabindex="0"]')];
  focusable.at(-1).focus();w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal(w.document.activeElement,focusable[0],'forward Tab stays in portal');
  focusable[0].focus();w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));assert.equal(w.document.activeElement,focusable.at(-1),'reverse Tab reaches final portal control');
 }
 return {w,errors,act,click,button,overlay,complete,retry,assertRetryInDialog,requests,state,setStorageFailure:v=>{failStorage=v},get storageAttempts(){return storageAttempts},release:()=>release(),close:()=>dom.window.close()};
}

test('account failure exposes retry inside fullscreen portal, retains operation ID and saves once',async()=>{
 const f=await fixture({account:true});try{
  await f.complete();assert.equal(f.requests.length,1);f.assertRetryInDialog();
  assert.match(f.overlay().textContent,/서버 저장 실패/);
  await f.act(()=>{f.retry().click();f.retry()?.click()});
  assert.equal(f.requests.length,2,'double retry only sends one in-flight request');
  assert.equal(f.requests[1].operationId,f.requests[0].operationId,'retry reuses idempotency key');
  assert.deepEqual(f.requests[1],f.requests[0],'retry preserves the original completion operation');
  assert.equal(f.requests[1].type,'sentenceSession');assert.equal(f.requests[1].results.length,5);
  assert.match(f.overlay().textContent,/저장 중/);
  await f.act(()=>f.release());
  assert.match(f.overlay().textContent,/계정에 저장됨/);assert.equal(f.state.learner.sessions,1);
  assert.equal(Object.keys(f.state.learner.sentenceProgress).length,5);
  assert.equal([...f.overlay().querySelectorAll('button')].some(b=>b.textContent==='다시 저장'),false);
  await f.click('세션 닫기',f.overlay());assert.equal(f.overlay(),null);assert.equal(f.w.document.getElementById('root').inert,false);
  assert.deepEqual(f.errors,[],'no React or runtime errors');
 }finally{f.close()}
});

test('local demo storage failure retries inside fullscreen portal without duplicating completion',async()=>{
 const f=await fixture();try{
  f.setStorageFailure(true);await f.complete();f.assertRetryInDialog();
  const failedAttempts=f.storageAttempts;assert.ok(failedAttempts>=2);
  f.setStorageFailure(false);await f.act(()=>f.retry().click());
  const saved=JSON.parse(f.w.localStorage.getItem('bloom-profiles-v2'));assert.equal(saved.learners.wife.sessions,1);
  assert.equal(Object.keys(saved.learners.wife.sentenceProgress).length,5);assert.equal(saved.learners.husband.sessions,0);
  assert.ok(Object.values(saved.learners.wife.sentenceProgress).every(record=>record.stage===1),'retry does not advance sentence stages twice');
  assert.equal(f.storageAttempts,failedAttempts+1,'retry performs one storage write');
  assert.equal([...f.overlay().querySelectorAll('button')].some(b=>b.textContent==='다시 저장'),false);
  await f.click('세션 닫기',f.overlay());assert.equal(f.overlay(),null);assert.equal(f.w.document.getElementById('root').inert,false);
  assert.equal(JSON.parse(f.w.localStorage.getItem('bloom-profiles-v2')).learners.wife.sessions,1);
  assert.deepEqual(f.errors,[],'no React or runtime errors');
 }finally{f.close()}
});
