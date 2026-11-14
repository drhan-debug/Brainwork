// npm ci --prefix tests && npm test --prefix tests
// TEST_FILTER="mobile|favicon" node tests/browser.mjs runs focused regressions.
// Speech mocks verify routing/transcription, never acoustic or phoneme quality.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { englishScenarios } from '../src/content/scenarios.en.js';
import {spanishScenarios,italianScenarios} from '../src/content/scenarios.romance.js';
import {LANGUAGES} from '../src/learning/path.js';
import { japaneseScenarios } from '../src/content/scenarios.ja.js';
import { validateCurriculum, SCENARIO_IDS, makeSentenceId, getNextSentence } from '../src/learning/schema.js';
import { recordSentenceOutcome, getDueSentenceIds, aggregateSentenceResults } from '../src/learning/schedule.js';
const server=spawn('npm',['run','dev','--','--port','4179'],{cwd:new URL('..',import.meta.url),stdio:'pipe',detached:true});
let serverLog='';server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
const base='http://127.0.0.1:4179';
async function enterDemo(page){await page.getByRole('button',{name:'이 브라우저의 로컬 데모 열기',exact:true}).click();await page.getByLabel('학습자 선택').waitFor();}

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[];let failures=0;let passes=0;
const fixed=Date.parse('2026-11-14T04:30:00Z'); // 23:30 in America/New_York: next local day != +24h.
const legacy={learned:['Bloom','Reservation'],reviews:{Bloom:fixed-60000,Reservation:fixed+86400000},reviewStages:{Bloom:2},sessions:7,minutes:42.5,name:'기존 학습자',goal:20,dates:['2026-11-12'],dailyMinutes:{'2026-11-12':5.5},custom:{preserve:true}};
async function fixture({saved=legacy,profiles=null,mobile=false}={}){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},timezoneId:'America/New_York'});context.setDefaultTimeout(7000);
 await context.addInitScript(({saved,profiles})=>{
  if(!localStorage.getItem('test-seeded')){localStorage.clear();if(saved!==null)localStorage.setItem('bloom-state',JSON.stringify(saved));if(profiles)localStorage.setItem('bloom-profiles-v2',JSON.stringify(profiles));localStorage.setItem('test-seeded','true');}
  window.__utterances=[];window.__recognitionLanguages=[];window.__transcript='';
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},getVoices(){return[];},speak(u){window.__utterances.push({text:u.text,lang:u.lang});u.onend?.();}}});
  window.SpeechRecognition=class{start(){window.__recognitionLanguages.push(this.lang);this.onstart?.();setTimeout(()=>{this.onresult?.({results:[[{transcript:window.__transcript}]]});this.onend?.();},10);}stop(){this.onend?.();}abort(){this.onend?.();}};
 },{saved,profiles});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:fixed});await page.goto(base);await enterDemo(page);await page.getByLabel('학습자 선택').waitFor();return{page,context};
}
const state=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bloom-profiles-v2')));
const choose=(page,id)=>page.getByLabel('학습자 선택').selectOption(id);
const click=async(page,locator)=>{await page.clock.runFor(500);await locator.click();await page.clock.runFor(20);};
const dialog=page=>page.getByRole('dialog');
async function start(page,{learner='wife',scenario='cafe_order',review=false}={}){
 await choose(page,learner);
 if(review){await page.getByRole('button',{name:'복습 노트',exact:true}).click();await page.getByRole('button',{name:(learner==='husband'?japaneseScenarios:englishScenarios).find(s=>s.id===scenario).titleKo+' 문장 복습 시작',exact:true}).click();}
 else {await page.getByRole('button',{name:'홈',exact:true}).click();await page.getByLabel('오늘의 문장 상황').selectOption(scenario);await page.getByRole('button',{name:'문장 세션 시작하기',exact:true}).click();}
 await dialog(page).getByRole('heading',{name:'장면 이해',exact:true}).waitFor();
}
async function answer(page,sentence,{wrong=false,microphone=false}={}){
 const d=dialog(page),input=d.locator('textarea');
 if(microphone){await page.evaluate(text=>window.__transcript=text,sentence.text);await click(page,d.getByRole('button',{name:'마이크로 말하기',exact:true}));assert.equal(await input.inputValue(),sentence.text);}
 else await input.fill(wrong?'deliberately incorrect':sentence.text);
 await click(page,d.getByRole('button',{name:'답안 확인',exact:true}));
 if(wrong){await d.getByRole('heading',{name:'다른 부분을 확인해 보세요'}).waitFor();assert.ok(await d.getByText('인식된 글자와 단어를 비교한 결과예요.').isVisible());await click(page,d.getByRole('button',{name:'한 번 더 시도하기'}));await input.fill(sentence.text);await click(page,d.getByRole('button',{name:'답안 확인',exact:true}));}
 await d.getByRole('heading',{name:'문장이 일치해요',exact:true}).waitFor();
}
async function complete(page,sentences,{failFirst=false,checkFlow=false,microphone=false}={}){
 const d=dialog(page);
 if(checkFlow)assert.equal(await d.locator('.session-context li').count(),sentences.length);
 await click(page,d.getByRole('button',{name:'뜻을 확인했어요 · 듣기 시작'}));
 for(const [i,s] of sentences.entries()){
  await d.getByRole('heading',{name:'듣기',exact:true}).waitFor();
  if(checkFlow)assert.equal(await d.locator('.session-target').innerText(),s.ruby?s.ruby.map(x=>typeof x==='string'?x:x[0]+x[1]).join(''):s.text);
  await click(page,d.getByRole('button',{name:'다음으로 →'}));
 }
 for(const phase of ['따라 말하기','기억해서 말하기','오늘의 퀴즈']){
  const count=phase==='오늘의 퀴즈'?3:sentences.length;
  for(let i=0;i<count;i++){
   const s=sentences[i%sentences.length];await d.getByRole('heading',{name:phase,exact:true}).waitFor();
   if(phase!=='따라 말하기'){assert.equal(await d.locator('.session-target').count(),0,'target hidden before recall/quiz attempt');assert.ok(!(await d.innerText()).includes(s.text));assert.equal(await d.getByText(s.meaningKo,{exact:true}).count(),0,'full translation stays in context');}
   await answer(page,s,{wrong:failFirst&&phase==='따라 말하기'&&i===0,microphone:microphone&&phase==='따라 말하기'&&i===0});
   const next=d.getByRole('button',{name:phase==='오늘의 퀴즈'&&i===2?'결과 보기':'다음으로 →',exact:true});
   await page.clock.runFor(500);
   if(phase==='오늘의 퀴즈'&&i===2)await next.dblclick();else await next.click();
   await page.clock.runFor(20);
  }
 }
 await d.getByRole('heading',{name:'세션 완료',exact:true}).waitFor();
}
async function test(name,fn){if(process.env.TEST_FILTER&&!new RegExp(process.env.TEST_FILTER).test(name))return;try{await fn();passes++;console.log(`PASS ${name}`);}catch(e){failures++;console.error(`FAIL ${name}\n${e.stack}`);}}
try{
 for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}if(i===99)throw Error(serverLog);await new Promise(r=>setTimeout(r,100));}
 await test('all curricula contain 30 stable aligned scenarios and 120 valid sentences with exact Japanese ruby',async()=>{
  for(const [lang,scenarios]of [['en',englishScenarios],['ja',japaneseScenarios],['es',spanishScenarios],['it',italianScenarios]]){assert.deepEqual(validateCurriculum(scenarios,lang),{valid:true,errors:[]});assert.deepEqual(scenarios.map(s=>s.id),SCENARIO_IDS);const ids=new Set();for(const scene of scenarios)for(const [i,s]of scene.sentences.entries()){assert.equal(s.id,makeSentenceId(lang,scene.id,i+1));assert.ok(!ids.has(s.id));ids.add(s.id);if(lang==='ja'){assert.ok(s.ruby?.length);assert.equal(s.ruby.map(p=>Array.isArray(p)?p[0]:p).join(''),s.text);assert.equal(s.ruby.map(p=>Array.isArray(p)?p[1]:p).join(''),s.kana);}}assert.equal(ids.size,120);assert.equal(getNextSentence(scenarios,scenarios[0].sentences[3].id).id,scenarios[1].sentences[0].id);}
 });
 await test('legacy migration and malformed storage retain healthy records and original legacy key',async()=>{
  const {page,context}=await fixture();const s=await state(page);for(const[k,v]of Object.entries(legacy))assert.deepEqual(s.learners.wife[k],v,k);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('bloom-state'))),legacy);await page.reload();await enterDemo(page);assert.deepEqual((await state(page)).learners,s.learners);await context.close();
  const f=await fixture({saved:null,profiles:{version:2,active:'wife',learners:{wife:{learned:null,reviews:[],sessions:-1,minutes:'bad',custom:{keep:true}},husband:legacy}}});await f.page.getByRole('button',{name:'설정',exact:true}).click();await f.page.getByLabel('이름',{exact:true}).fill('Repaired');await f.page.getByRole('button',{name:'설정 완료'}).click();const repaired=(await state(f.page)).learners;assert.deepEqual(repaired.husband,{...legacy,sentenceProgress:{}});assert.deepEqual(repaired.wife.learned,[]);assert.equal(repaired.wife.sessions,0);assert.deepEqual(repaired.wife.custom,{keep:true});await f.context.close();
 });
 for(const[learner,lang,scenarios]of [['wife','en',englishScenarios],['husband','ja',japaneseScenarios],['es','es',spanishScenarios],['it','it',italianScenarios]])await test(`${lang} full session reuses selected sentences across all phases and three quizzes; completion writes once`,async()=>{
  const{page,context}=await fixture();const before=(await state(page)).learners;const scene=scenarios[7];await start(page,{learner,scenario:scene.id});assert.ok((await page.title()).includes(LANGUAGES[lang].name));await complete(page,scene.sentences,{checkFlow:true,microphone:true});const stored=(await state(page)).learners;assert.equal(stored[learner].sessions,before[learner].sessions+1);assert.equal(Object.keys(stored[learner].sentenceProgress).length,4);for(const s of scene.sentences){assert.equal(stored[learner].sentenceProgress[s.id].stage,1);assert.equal(stored[learner].sentenceProgress[s.id].lastOutcome,'passed');}for(const key of ['learned','reviews','reviewStages'])assert.deepEqual(stored[learner][key],before[learner][key]);assert.deepEqual(stored[learner==='wife'?'husband':'wife'],before[learner==='wife'?'husband':'wife']);const utterances=await page.evaluate(()=>window.__utterances);assert.deepEqual(utterances.map(u=>u.text),scene.sentences.map(s=>s.audioText));assert.ok(utterances.every(u=>u.lang===LANGUAGES[lang].locale));assert.deepEqual(await page.evaluate(()=>window.__recognitionLanguages),[LANGUAGES[lang].locale]);await click(page,dialog(page).getByRole('button',{name:'세션 닫기',exact:true}).last());assert.equal(await dialog(page).count(),0);await page.reload();await enterDemo(page);assert.equal((await state(page)).learners[learner].sessions,before[learner].sessions+1);await context.close();
 });
 await test('a failed attempt then correct retry schedules next LOCAL day; other sentences schedule three local days',async()=>{
  const{page,context}=await fixture({saved:null});await start(page);await complete(page,englishScenarios[0].sentences,{failFirst:true});const p=(await state(page)).learners.wife.sentenceProgress;const now=await page.evaluate(()=>Date.now());const expected=await page.evaluate(()=>{const d=new Date();return{next:new Date(d.getFullYear(),d.getMonth(),d.getDate()+1).getTime(),three:new Date(d.getFullYear(),d.getMonth(),d.getDate()+3,d.getHours(),d.getMinutes(),d.getSeconds(),d.getMilliseconds()).getTime()};});assert.equal(p['en:cafe_order:1'].dueAt,expected.next);assert.equal(p['en:cafe_order:1'].stage,0);assert.ok(p['en:cafe_order:1'].dueAt-now<3600000,'midnight is less than one hour away');for(const s of englishScenarios[0].sentences.slice(1))assert.ok(Math.abs(p[s.id].dueAt-expected.three)<100);await context.close();
 });
 await test('due sentence review filters selected scenario, advances 3/7/14/30/60 days and never revives legacy word IDs',async()=>{
  const{page,context}=await fixture({saved:null});await choose(page,'husband');
  for(const[stage,days]of [[0,3],[1,7],[2,14],[3,30],[4,60],[5,60]]){
   await page.evaluate(({fixed,stage})=>{const s=JSON.parse(localStorage.getItem('bloom-profiles-v2'));s.learners.husband.sentenceProgress={'ja:cafe_order:1':{dueAt:fixed-1,stage},'ja:cafe_order:2':{dueAt:fixed+86400000,stage:2},'ja:directions:1':{dueAt:fixed-1,stage:1},'ja-cafe-order':{dueAt:fixed-1,stage:1}};localStorage.setItem('bloom-profiles-v2',JSON.stringify(s));},{fixed,stage});await page.reload();await enterDemo(page);await start(page,{learner:'husband',review:true});assert.equal(await dialog(page).locator('.session-context li').count(),1);await complete(page,[japaneseScenarios[0].sentences[0]]);const p=(await state(page)).learners.husband.sentenceProgress;assert.equal(p['ja:cafe_order:1'].stage,Math.min(stage+1,5));const delta=await page.evaluate(({due,days})=>{const d=new Date();const target=new Date(d.getFullYear(),d.getMonth(),d.getDate()+days,d.getHours(),d.getMinutes(),d.getSeconds(),d.getMilliseconds());return Math.abs(due-target.getTime());},{due:p['ja:cafe_order:1'].dueAt,days});assert.ok(delta<100);assert.equal(p['ja:cafe_order:2'].dueAt,fixed+86400000);assert.equal(p['ja:directions:1'].dueAt,fixed-1);await click(page,dialog(page).getByRole('button',{name:'세션 닫기',exact:true}).last());}
  await context.close();
 });
 await test('scheduling retains early due dates and aggregates any failure across attempts',async()=>{
  const id='en:cafe_order:1',original={[id]:{stage:3,dueAt:fixed+86400000,custom:'keep'}};const next=recordSentenceOutcome(original,id,{passed:true,at:fixed});assert.equal(next[id].dueAt,original[id].dueAt);assert.equal(next[id].stage,3);assert.equal(next[id].custom,'keep');assert.deepEqual(aggregateSentenceResults([{sentenceId:id,passed:true},{sentenceId:id,passed:false},{sentenceId:id,passed:true}]),[{sentenceId:id,passed:false}]);assert.deepEqual(getDueSentenceIds({...original,'en:cafe_order:2':{dueAt:fixed},obsolete:{dueAt:0}},fixed,[id,'en:cafe_order:2']),['en:cafe_order:2']);
 });
 await test('unavailable speech APIs offer typed fallback and textual mismatch feedback',async()=>{
  const{page,context}=await fixture({saved:null});await page.evaluate(()=>{delete window.SpeechRecognition;delete window.webkitSpeechRecognition;delete window.SpeechSynthesisUtterance;});await start(page,{learner:'husband'});await click(page,dialog(page).getByRole('button',{name:'뜻을 확인했어요 · 듣기 시작'}));assert.ok(await dialog(page).getByText(/このブラウザ|음성 재생을 사용할 수 없어요/).isVisible());for(let i=0;i<4;i++)await click(page,dialog(page).getByRole('button',{name:'다음으로 →'}));await click(page,dialog(page).getByRole('button',{name:'마이크로 말하기'}));assert.ok(await dialog(page).getByText(/음성 인식이 지원되지 않아요/).isVisible());await answer(page,japaneseScenarios[0].sentences[0],{wrong:true});assert.ok(await dialog(page).locator('ruby rt').count()>0);await context.close();
 });
 await test('two tabs isolate selected learners, preserve settings/progress and legacy data across reload',async()=>{
  const{page:en,context}=await fixture();const ja=await context.newPage();ja.on('pageerror',e=>errors.push(e.message));await ja.clock.install({time:fixed});await ja.goto(base);await enterDemo(ja);await choose(ja,'husband');assert.equal(await en.getByLabel('학습자 선택').inputValue(),'wife');await start(en);await complete(en,englishScenarios[0].sentences);await click(en,dialog(en).getByRole('button',{name:'세션 닫기',exact:true}).last());await ja.getByRole('button',{name:'설정',exact:true}).click();await ja.getByLabel('이름',{exact:true}).fill('Japanese tab');await ja.getByRole('button',{name:'설정 완료'}).click();await start(ja,{learner:'husband'});await complete(ja,japaneseScenarios[0].sentences);const expected=(await state(en)).learners;assert.equal(expected.wife.sessions,8);assert.equal(expected.husband.sessions,1);assert.equal(expected.husband.name,'Japanese tab');assert.deepEqual(expected.wife.learned,legacy.learned);assert.deepEqual(expected.wife.reviews,legacy.reviews);for(const p of [en,ja]){await p.reload();await enterDemo(p);await p.getByLabel('학습자 선택').waitFor();assert.deepEqual((await state(p)).learners,expected);assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('bloom-state'))),legacy);}await context.close();
 });
 await test('mobile full-screen modal traps focus, restores prior page/opener and avoids horizontal overflow',async()=>{
  const{page,context}=await fixture({saved:null,mobile:true});await page.getByRole('button',{name:'나의 학습',exact:true}).click();const opener=page.getByRole('button',{name:englishScenarios[0].titleKo+' 문장 세션 시작',exact:true});await opener.click();const d=dialog(page);assert.ok(await d.getByRole('heading',{name:'장면 이해'}).evaluate(el=>el===document.activeElement));const rect=await d.boundingBox();assert.ok(rect.width<=390&&rect.height>=800);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));for(let i=0;i<12;i++){await page.keyboard.press('Tab');assert.ok(await d.evaluate(el=>el.contains(document.activeElement)));}await complete(page,englishScenarios[0].sentences);await click(page,d.getByRole('button',{name:'세션 닫기',exact:true}).last());assert.equal(await d.count(),0);assert.ok(await opener.evaluate(el=>el===document.activeElement));assert.ok(await page.getByRole('heading',{name:'1단계 · 입문 상황'}).isVisible());assert.equal(await page.evaluate(()=>document.body.style.overflow),'');await context.close();
 });
 await test('mobile 390x960 session resets overlay scroll on phase, item and summary transitions',async()=>{
  const{page,context}=await fixture({saved:null,mobile:true});
  try{
   await page.setViewportSize({width:390,height:960});
   await start(page);
   const d=dialog(page),overlay=page.locator('.session-overlay'),sentences=englishScenarios[0].sentences;
   async function topVisible(phase){
    await d.getByRole('heading',{name:phase,exact:true}).waitFor();
    const position=await overlay.evaluate(el=>el.scrollTop);
    assert.ok(position<=1,`${phase}: overlay scrollTop was ${position}`);
    for(const locator of [d.locator('.session-header'),d.locator('.session-close'),d.getByRole('heading',{name:phase,exact:true})]){
     const rect=await locator.boundingBox();assert.ok(rect&&rect.y>=0&&rect.y+rect.height<=960,`${phase}: heading/header/close must be in viewport`);
    }
   }
   async function scrollBottom(){
    const position=await overlay.evaluate(el=>{el.scrollTop=el.scrollHeight;return el.scrollTop;});
    assert.ok(position>50,`fixture must actually scroll before advancing; got ${position}`);
   }
   await click(page,d.getByRole('button',{name:'뜻을 확인했어요 · 듣기 시작'}));
   for(let i=0;i<sentences.length;i++)await click(page,d.getByRole('button',{name:'다음으로 →',exact:true}));
   for(const sentence of sentences){await answer(page,sentence);await scrollBottom();await click(page,d.getByRole('button',{name:'다음으로 →',exact:true}));}
   await topVisible('기억해서 말하기');
   for(const[phase,count]of [['기억해서 말하기',sentences.length],['오늘의 퀴즈',3]]){
    for(let i=0;i<count;i++){
     await answer(page,sentences[i%sentences.length]);await scrollBottom();
     const last=phase==='오늘의 퀴즈'&&i===count-1;
     await click(page,d.getByRole('button',{name:last?'결과 보기':'다음으로 →',exact:true}));
     await topVisible(last?'세션 완료':i===count-1?'오늘의 퀴즈':phase);
    }
   }
  }finally{await context.close();}
 });
 await test('linked SVG favicon is served successfully as an SVG image',async()=>{
  const{page,context}=await fixture({saved:null});
  try{
   const icon=page.locator('link[rel="icon"][type="image/svg+xml"]');assert.equal(await icon.count(),1);
   const href=await icon.evaluate(el=>el.href);assert.ok(new URL(href).pathname.endsWith('.svg'));
   const response=await page.request.get(href);assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/image\/svg\+xml/);assert.match(await response.text(),/<svg[\s>]/);
  }finally{await context.close();}
 });
 assert.deepEqual(errors,[],'no uncaught browser errors');
}finally{await browser.close();try{process.kill(-server.pid,'SIGTERM');}catch{}}
console.log(`${passes} passed; ${failures} failed`);if(failures)process.exitCode=1;
