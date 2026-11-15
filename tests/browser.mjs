// npm ci --prefix tests && npm test --prefix tests
// TEST_FILTER="mobile|favicon" node tests/browser.mjs runs focused regressions.
// Speech mocks verify routing/transcription, never acoustic or phoneme quality.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { applyProgress, blankLearner } from '../server/domain.js';
import { englishScenarios } from '../src/content/scenarios.en.js';
import { japaneseScenarios } from '../src/content/scenarios.ja.js';
import { validateCurriculum, SCENARIO_IDS, EN_MATERNAL_SCENARIO_IDS, makeSentenceId, getNextSentence } from '../src/learning/schema.js';
import { recordSentenceOutcome, getDueSentenceIds, aggregateSentenceResults } from '../src/learning/schedule.js';
const port=process.env.TEST_PORT||'4179';
const server=spawn('npm',['run','dev','--','--port',port],{cwd:new URL('..',import.meta.url),stdio:'pipe',detached:true});
let serverLog='';server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
const base=`http://127.0.0.1:${port}`;
// v5 enters the existing local learner experience through the account gateway.
async function enterLocalDemo(page) {
 await page.getByRole('button',{name:'이 브라우저의 로컬 데모 열기',exact:true}).click();
 await page.getByLabel('학습자 선택').waitFor();
}

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[];let failures=0;let passes=0;
const fixed=Date.parse('2026-11-14T04:30:00Z'); // 23:30 in America/New_York: next local day != +24h.
const legacy={learned:['Bloom','Reservation'],reviews:{Bloom:fixed-60000,Reservation:fixed+86400000},reviewStages:{Bloom:2},sessions:7,minutes:42.5,name:'기존 학습자',goal:20,dates:['2026-11-12'],dailyMinutes:{'2026-11-12':5.5},custom:{preserve:true}};
async function fixture({saved=legacy,profiles=null,mobile=false,apiRoute=null}={}){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},timezoneId:'America/New_York'});context.setDefaultTimeout(7000);
 await context.addInitScript(({saved,profiles})=>{
  if(!localStorage.getItem('test-seeded')){localStorage.clear();if(saved!==null)localStorage.setItem('bloom-state',JSON.stringify(saved));if(profiles)localStorage.setItem('bloom-profiles-v2',JSON.stringify(profiles));localStorage.setItem('test-seeded','true');}
  window.__utterances=[];window.__recognitionLanguages=[];window.__transcript='';
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},getVoices(){return[];},speak(u){window.__utterances.push({text:u.text,lang:u.lang});u.onend?.();}}});
  window.SpeechRecognition=class{start(){window.__recognitionLanguages.push(this.lang);this.onstart?.();setTimeout(()=>{this.onresult?.({results:[[{transcript:window.__transcript}]]});this.onend?.();},10);}stop(){this.onend?.();}abort(){this.onend?.();}};
 },{saved,profiles});
 if(apiRoute)await context.route('**/api/**',apiRoute);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:fixed});await page.goto(base);if(apiRoute)await page.getByRole('button',{name:'문장 세션 시작하기',exact:true}).waitFor();else await enterLocalDemo(page);if(!apiRoute)await page.getByLabel('학습자 선택').waitFor();return{page,context};
}
const state=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bloom-profiles-v2')));
const choose=(page,id)=>page.getByLabel('학습자 선택').selectOption(id);
const click=async(page,locator)=>{await page.clock.runFor(500);await locator.click();await page.clock.runFor(20);};
const dialog=page=>page.getByRole('dialog');
async function start(page,{learner='wife',scenario,review=false}={}){
 await choose(page,learner);
 scenario ??= (learner==='husband'?japaneseScenarios:englishScenarios)[0].id;
 if(review){await page.getByRole('button',{name:'복습 노트',exact:true}).click();await page.getByRole('button',{name:(learner==='husband'?japaneseScenarios:englishScenarios).find(s=>s.id===scenario).titleKo+' 문장 복습 시작',exact:true}).click();}
 else {await page.getByRole('button',{name:'홈',exact:true}).click();await page.getByLabel('오늘의 문장 상황').selectOption(scenario);await page.getByRole('button',{name:'문장 세션 시작하기',exact:true}).click();}
 await dialog(page).getByRole('heading',{name:'장면 이해',exact:true}).waitFor();
}
async function answer(page,sentence,{wrong=false,microphone=false}={}){
 const d=dialog(page),input=d.locator('textarea');
 if(microphone){await page.evaluate(text=>window.__transcript=text,sentence.text);await click(page,d.getByRole('button',{name:'마이크로 말하기',exact:true}));assert.equal(await input.inputValue(),sentence.text);}
 else await input.fill(wrong?'deliberately incorrect':sentence.text);
 await click(page,d.getByRole('button',{name:'답안 확인',exact:true}));
 if(wrong){await d.getByRole('heading',{name:'다른 부분을 확인해 보세요'}).waitFor();assert.ok(await d.getByText(/입력한 글자와 단어를 비교한 결과예요/).isVisible());await click(page,d.getByRole('button',{name:'한 번 더 시도하기'}));await input.fill(sentence.text);await click(page,d.getByRole('button',{name:'답안 확인',exact:true}));}
 await d.getByRole('heading',{name:'문장이 일치해요',exact:true}).waitFor();
}
async function complete(page,sentences,{failFirst=false,checkFlow=false,microphone=false}={}){
 const d=dialog(page);
 if(checkFlow)assert.equal(await d.locator('.session-context li').count(),sentences.length);
 await click(page,d.getByRole('button',{name:'뜻을 확인했어요 · 듣기 시작'}));
 for(const [i,s] of sentences.entries()){
  await d.getByRole('heading',{name:'듣기',exact:true}).waitFor();
  if(checkFlow)assert.deepEqual(await page.evaluate(()=>window.__utterances.map(u=>u.text)),sentences.slice(0,i+1).map(item=>item.audioText),'one synchronous playback for each selected listen sentence');
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
 await test('curricula contain twenty stable scenarios with five maternal or four Japanese sentences and exact ruby',async()=>{
  for(const [lang,scenarios]of [['en',englishScenarios],['ja',japaneseScenarios]]){assert.deepEqual(validateCurriculum(scenarios,lang),{valid:true,errors:[]});assert.deepEqual(scenarios.map(s=>s.id),lang==='en'?EN_MATERNAL_SCENARIO_IDS:SCENARIO_IDS);const ids=new Set();for(const scene of scenarios)for(const [i,s]of scene.sentences.entries()){assert.equal(s.id,makeSentenceId(lang,scene.id,i+1));assert.ok(!ids.has(s.id));ids.add(s.id);if(lang==='ja'){assert.ok(s.ruby?.length);assert.equal(s.ruby.map(p=>Array.isArray(p)?p[0]:p).join(''),s.text);assert.equal(s.ruby.map(p=>Array.isArray(p)?p[1]:p).join(''),s.kana);}}assert.equal(ids.size,lang==='en'?100:80);assert.equal(getNextSentence(scenarios,scenarios[0].sentences.at(-1).id).id,scenarios[1].sentences[0].id);}
 });
 await test('legacy migration and malformed storage retain healthy records and original legacy key',async()=>{
  const {page,context}=await fixture();const s=await state(page);for(const[k,v]of Object.entries(legacy))assert.deepEqual(s.learners.wife[k],v,k);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('bloom-state'))),legacy);await page.reload();await enterLocalDemo(page);assert.deepEqual((await state(page)).learners,s.learners);await context.close();
  const f=await fixture({saved:null,profiles:{version:2,active:'wife',learners:{wife:{learned:null,reviews:[],sessions:-1,minutes:'bad',custom:{keep:true}},husband:legacy}}});await f.page.getByRole('button',{name:'설정',exact:true}).click();await f.page.getByLabel('이름',{exact:true}).fill('Repaired');await f.page.getByRole('button',{name:'설정 완료'}).click();const repaired=(await state(f.page)).learners;assert.deepEqual(repaired.husband,{...legacy,sentenceProgress:{}});assert.deepEqual(repaired.wife.learned,[]);assert.equal(repaired.wife.sessions,0);assert.deepEqual(repaired.wife.custom,{keep:true});await f.context.close();
 });
 for(const[learner,lang,scenarios]of [['wife','en',englishScenarios],['husband','ja',japaneseScenarios]])await test(`${lang} full session reuses selected sentences across all phases and three quizzes; completion writes once`,async()=>{
  const{page,context}=await fixture();const before=(await state(page)).learners;const scene=scenarios[7];await start(page,{learner,scenario:scene.id});assert.ok((await page.title()).includes(lang==='ja'?'일본어':'영어'));await complete(page,scene.sentences,{checkFlow:true,microphone:true});const stored=(await state(page)).learners;assert.equal(stored[learner].sessions,before[learner].sessions+1);assert.equal(Object.keys(stored[learner].sentenceProgress).length,scene.sentences.length);for(const s of scene.sentences){assert.equal(stored[learner].sentenceProgress[s.id].stage,1);assert.equal(stored[learner].sentenceProgress[s.id].lastOutcome,'passed');}for(const key of ['learned','reviews','reviewStages'])assert.deepEqual(stored[learner][key],before[learner][key]);assert.deepEqual(stored[learner==='wife'?'husband':'wife'],before[learner==='wife'?'husband':'wife']);const utterances=await page.evaluate(()=>window.__utterances);assert.deepEqual(utterances.map(u=>u.text),scene.sentences.map(s=>s.audioText));assert.ok(utterances.every(u=>u.lang===(lang==='ja'?'ja-JP':'en-US')));assert.deepEqual(await page.evaluate(()=>window.__recognitionLanguages),[lang==='ja'?'ja-JP':'en-US']);await click(page,dialog(page).getByRole('button',{name:'세션 닫기',exact:true}).last());assert.equal(await dialog(page).count(),0);await page.reload();await enterLocalDemo(page);assert.equal((await state(page)).learners[learner].sessions,before[learner].sessions+1);await context.close();
 });
 await test('a failed attempt then correct retry schedules next LOCAL day; other sentences schedule three local days',async()=>{
  const{page,context}=await fixture({saved:null});await start(page);await complete(page,englishScenarios[0].sentences,{failFirst:true});const p=(await state(page)).learners.wife.sentenceProgress;const now=await page.evaluate(()=>Date.now());const expected=await page.evaluate(()=>{const d=new Date();return{next:new Date(d.getFullYear(),d.getMonth(),d.getDate()+1).getTime(),three:new Date(d.getFullYear(),d.getMonth(),d.getDate()+3,d.getHours(),d.getMinutes(),d.getSeconds(),d.getMilliseconds()).getTime()};});assert.equal(p[englishScenarios[0].sentences[0].id].dueAt,expected.next);assert.equal(p[englishScenarios[0].sentences[0].id].stage,0);assert.ok(p[englishScenarios[0].sentences[0].id].dueAt-now<3600000,'midnight is less than one hour away');for(const s of englishScenarios[0].sentences.slice(1))assert.ok(Math.abs(p[s.id].dueAt-expected.three)<100);await context.close();
 });
 await test('due sentence review filters selected scenario, advances 3/7/14/30/60 days and never revives legacy word IDs',async()=>{
  const{page,context}=await fixture({saved:null});await choose(page,'husband');
  for(const[stage,days]of [[0,3],[1,7],[2,14],[3,30],[4,60],[5,60]]){
   await page.evaluate(({fixed,stage})=>{const s=JSON.parse(localStorage.getItem('bloom-profiles-v2'));s.learners.husband.sentenceProgress={'ja:cafe_order:1':{dueAt:fixed-1,stage},'ja:cafe_order:2':{dueAt:fixed+86400000,stage:2},'ja:directions:1':{dueAt:fixed-1,stage:1},'ja-cafe-order':{dueAt:fixed-1,stage:1}};localStorage.setItem('bloom-profiles-v2',JSON.stringify(s));},{fixed,stage});await page.reload();await enterLocalDemo(page);await start(page,{learner:'husband',review:true});assert.equal(await dialog(page).locator('.session-context li').count(),1);await complete(page,[japaneseScenarios[0].sentences[0]]);const p=(await state(page)).learners.husband.sentenceProgress;assert.equal(p['ja:cafe_order:1'].stage,Math.min(stage+1,5));const delta=await page.evaluate(({due,days})=>{const d=new Date();const target=new Date(d.getFullYear(),d.getMonth(),d.getDate()+days,d.getHours(),d.getMinutes(),d.getSeconds(),d.getMilliseconds());return Math.abs(due-target.getTime());},{due:p['ja:cafe_order:1'].dueAt,days});assert.ok(delta<100);assert.equal(p['ja:cafe_order:2'].dueAt,fixed+86400000);assert.equal(p['ja:directions:1'].dueAt,fixed-1);await click(page,dialog(page).getByRole('button',{name:'세션 닫기',exact:true}).last());}
  await context.close();
 });
 await test('scheduling retains early due dates and aggregates any failure across attempts',async()=>{
  const id='en:cafe_order:1',original={[id]:{stage:3,dueAt:fixed+86400000,custom:'keep'}};const next=recordSentenceOutcome(original,id,{passed:true,at:fixed});assert.equal(next[id].dueAt,original[id].dueAt);assert.equal(next[id].stage,3);assert.equal(next[id].custom,'keep');assert.deepEqual(aggregateSentenceResults([{sentenceId:id,passed:true},{sentenceId:id,passed:false},{sentenceId:id,passed:true}]),[{sentenceId:id,passed:false}]);assert.deepEqual(getDueSentenceIds({...original,'en:cafe_order:2':{dueAt:fixed},obsolete:{dueAt:0}},fixed,[id,'en:cafe_order:2']),['en:cafe_order:2']);
 });
 await test('review due IDs are oldest first with stable insertion ties and exclude invalid schedules',async()=>{
  const [first,second,third,fourth]=englishScenarios[0].sentences.map(s=>s.id);
  const progress={[third]:{dueAt:fixed-100},[second]:{dueAt:fixed-100},[first]:{dueAt:fixed-300},[fourth]:{dueAt:fixed+1},obsolete:{dueAt:0},invalid:{dueAt:NaN}};
  assert.deepEqual(getDueSentenceIds(progress,fixed,[first,second,third,fourth,'invalid']),[first,third,second]);
 });
 await test('review priority orders due scenes by failed count, due date, and curriculum and launches each due subset at 390px',async()=>{
  const scenes=englishScenarios.slice(0,5),profile={name:'우선 복습 학습자',goal:10};
  const dueSpecs=[
   [[-1000,'failed'],[-2000,'failed'],[-3000,'passed']],
   [[-8000,'failed'],[-9000,'passed']],
   [[-12000,'failed'],[-11000,'passed']],
   [[-12000,'failed'],[-10000,'passed']],
   [[-20000,'passed']],
  ];
  const progress={};
  for(const[sceneIndex,specs]of dueSpecs.entries())for(const[sentenceIndex,[offset,lastOutcome]]of specs.entries())progress[scenes[sceneIndex].sentences[sentenceIndex].id]={stage:1,dueAt:fixed+offset,lastOutcome};
  progress[scenes[4].sentences[1].id]={stage:1,dueAt:fixed+86400000,lastOutcome:'failed'};
  const learner={...blankLearner(profile),sentenceProgress:progress};
  const{page,context}=await fixture({saved:null,mobile:true,profiles:{version:2,active:'wife',learners:{wife:learner,husband:blankLearner(profile)}}});
  try{
   await page.getByRole('button',{name:'복습 노트',exact:true}).click();
   const section=page.getByRole('region',{name:'문장 복습',exact:true}),rows=section.locator('.sentence-review-row');
   const ordered=[scenes[0],scenes[2],scenes[3],scenes[1],scenes[4]];
   assert.deepEqual(await rows.locator('h3').allTextContents(),ordered.map(scene=>scene.titleKo),'failed count wins, then earliest due date, then curriculum order');
   assert.equal(await rows.count(),5,'future-only failures do not create a review row');
   assert.match(await section.locator('.section-heading h2').innerText(),/10개/,'total counts only currently due sentences');
   assert.deepEqual(await rows.locator('p').allTextContents(),[
    '3문장 · 다시 연습할 문장 2개 · 이 상황의 복습 문장만 연습해요.',
    '2문장 · 다시 연습할 문장 1개 · 이 상황의 복습 문장만 연습해요.',
    '2문장 · 다시 연습할 문장 1개 · 이 상황의 복습 문장만 연습해요.',
    '2문장 · 다시 연습할 문장 1개 · 이 상황의 복습 문장만 연습해요.',
    '1문장 · 이 상황의 복습 문장만 연습해요.',
   ],'row counts include only currently due retries');
   assert.equal(await rows.first().locator('.sentence-review-recommended').innerText(),'먼저 복습 추천');
   assert.equal(await rows.locator('.sentence-review-recommended').count(),1,'only the first row carries the recommendation cue');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'priority list fits 390px');
   for(const scene of ordered){
    await rows.filter({has:page.getByRole('heading',{name:scene.titleKo,exact:true})}).getByRole('button',{name:scene.titleKo+' 문장 복습 시작',exact:true}).click();
    const due=scene.sentences.filter(sentence=>progress[sentence.id]?.dueAt<=fixed);
    assert.deepEqual(await dialog(page).locator('.session-context li p').allTextContents(),due.map(sentence=>sentence.meaningKo),`${scene.id} launches exactly its due subset`);
    await click(page,dialog(page).getByRole('button',{name:'세션 취소하고 닫기',exact:true}));
   }
  }finally{await context.close();}
 });
 await test('review mobile cues use accessible collapsed details with Korean meanings and no target answers',async()=>{
  const scene=englishScenarios[0],sentences=scene.sentences.slice(0,3),profile={name:'복습 학습자',goal:10};
  const learner={...blankLearner(profile),sentenceProgress:Object.fromEntries(sentences.map((s,i)=>[s.id,{stage:1,dueAt:fixed-(i+1)*1000}]))};
  const{page,context}=await fixture({saved:null,mobile:true,profiles:{version:2,active:'wife',learners:{wife:learner,husband:blankLearner(profile)}}});
  try{
   await page.getByRole('button',{name:'복습 노트',exact:true}).click();
   const row=page.locator('.sentence-review-row').filter({has:page.getByRole('heading',{name:scene.titleKo,exact:true})});
   const details=row.locator('details'),summary=row.getByLabel(scene.titleKo+' 한국어 뜻 보기',{exact:true});
   assert.equal(await details.count(),1);
   assert.equal(await details.getAttribute('open'),null,'recall cues begin collapsed');
   for(const sentence of sentences)assert.equal(await row.getByText(sentence.meaningKo,{exact:true}).isVisible(),false);
   await summary.focus();await page.keyboard.press('Enter');
   assert.notEqual(await details.getAttribute('open'),null,'keyboard activates native details');
   for(const sentence of sentences)assert.ok(await details.getByText(sentence.meaningKo,{exact:true}).isVisible());
   const text=await row.innerText();for(const sentence of scene.sentences)assert.ok(!text.includes(sentence.text),'due scenario does not reveal English target');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'expanded cues fit 390px');
   await summary.focus();await page.keyboard.press('Enter');assert.equal(await details.getAttribute('open'),null);
   await row.getByRole('button',{name:scene.titleKo+' 문장 복습 시작',exact:true}).click();
   assert.equal(await dialog(page).locator('.session-context li').count(),sentences.length,'review action still opens only due sentences');
  }finally{await context.close();}
 });
 for(const account of [false,true])await test(`review ${account?'account timezone differs from browser':'demo browser timezone'} schedule is earliest first with stable ties and upcoming catalog CTA at 390px`,async()=>{
  const scene=englishScenarios[0],sentences=scene.sentences.slice(0,4),early=fixed+60000,late=fixed+86400000;
  const profile={name:'일정 학습자',language:'en',goal:10,timezone:'Asia/Seoul'};
  // Insert reversed tie IDs: equal dates must keep curriculum order, not map insertion order.
  const learner={...blankLearner(profile),sentenceProgress:{[sentences[3].id]:{stage:1,dueAt:late},[sentences[2].id]:{stage:1,dueAt:early},[sentences[1].id]:{stage:1,dueAt:early},[sentences[0].id]:{stage:1,dueAt:late}}};
  const remote={authenticated:true,account:{id:'review-test-account',email:'review@example.test'},profile,learner,revision:0,imports:[]};
  const unexpected=[];
  const apiRoute=account?async route=>{const req=route.request();if(new URL(req.url()).pathname==='/api/session'&&req.method()==='GET')return route.fulfill({json:remote});unexpected.push(req.method()+' '+new URL(req.url()).pathname);return route.fulfill({status:500,json:{code:'UNEXPECTED_TEST_REQUEST'}});}:null;
  const{page,context}=await fixture({saved:null,mobile:true,apiRoute,profiles:account?null:{version:2,active:'wife',learners:{wife:learner,husband:blankLearner(profile)}}});
  try{
   await page.getByRole('button',{name:'복습 노트',exact:true}).click();
   const section=page.getByRole('region',{name:'문장 복습',exact:true}),empty=section.locator('.sentence-empty');
   assert.equal(await section.locator('.sentence-review-row').count(),0,'all scheduled reviews are in the future');
   const upcoming=empty.locator('time');assert.equal(await upcoming.count(),1);assert.equal(await upcoming.getAttribute('datetime'),new Date(early).toISOString());
   const zone=account?profile.timezone:'America/New_York';
   const expected=new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short',timeZone:zone}).format(early);
   assert.equal(await upcoming.innerText(),expected,'next review uses learner timezone, including the local date boundary');
   if(account)assert.notEqual(expected,new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/New_York'}).format(early));
   const schedule=section.locator('details.sentence-schedule');await schedule.locator('summary').click();
   assert.deepEqual(await schedule.locator('.sentence-schedule-row strong').allTextContents(),[sentences[1].text,sentences[2].text,sentences[0].text,sentences[3].text],'earliest future schedule first, tied dates keep curriculum order');
   for(const row of await schedule.locator('.sentence-schedule-row').all()){
    const target=await row.locator('strong').innerText(),at=learner.sentenceProgress[sentences.find(s=>s.text===target).id].dueAt;
    assert.ok((await row.innerText()).includes(new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short',timeZone:zone}).format(at)));
   }
   assert.ok((await section.innerText()).includes(zone),'display identifies the timezone');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'expanded schedule fits 390px');
   const cta=empty.getByRole('button',{name:'새로운 상황 배우기',exact:true});await cta.focus();await page.keyboard.press('Enter');
   assert.ok(await page.getByRole('heading',{name:'아이와 함께하는 20가지 상황',exact:true}).isVisible(),'empty-state CTA opens learning catalog');
   assert.equal(await dialog(page).count(),0,'catalog CTA lets the learner choose a situation');assert.deepEqual(unexpected,[]);
  }finally{await context.close();}
 });
 await test('review unstarted learner has catalog CTA without a fabricated next review',async()=>{
  const{page,context}=await fixture({saved:null,mobile:true});
  try{
   await page.getByRole('button',{name:'복습 노트',exact:true}).click();const empty=page.locator('.sentence-empty');
   assert.equal(await empty.locator('time').count(),0);
   await empty.getByRole('button',{name:'새로운 상황 배우기',exact:true}).click();
   assert.ok(await page.getByRole('heading',{name:'아이와 함께하는 20가지 상황',exact:true}).isVisible());
  }finally{await context.close();}
 });
 await test('unavailable speech APIs offer typed fallback and textual mismatch feedback',async()=>{
  const{page,context}=await fixture({saved:null});await page.evaluate(()=>{delete window.SpeechRecognition;delete window.webkitSpeechRecognition;delete window.SpeechSynthesisUtterance;});await start(page,{learner:'husband'});await click(page,dialog(page).getByRole('button',{name:'뜻을 확인했어요 · 듣기 시작'}));assert.ok(await dialog(page).getByText(/음성 재생을 지원하지 않아요/).isVisible());for(let i=0;i<4;i++)await click(page,dialog(page).getByRole('button',{name:'다음으로 →'}));await click(page,dialog(page).getByRole('button',{name:'마이크로 말하기'}));assert.ok(await dialog(page).getByText(/음성 인식을 지원하지 않아요/).isVisible());await answer(page,japaneseScenarios[0].sentences[0],{wrong:true});assert.ok(await dialog(page).locator('ruby rt').count()>0);await context.close();
 });
 await test('two tabs isolate selected learners, preserve settings/progress and legacy data across reload',async()=>{
  const{page:en,context}=await fixture();const ja=await context.newPage();ja.on('pageerror',e=>errors.push(e.message));await ja.clock.install({time:fixed});await ja.goto(base);await enterLocalDemo(ja);await choose(ja,'husband');assert.equal(await en.getByLabel('학습자 선택').inputValue(),'wife');await start(en);await complete(en,englishScenarios[0].sentences);await click(en,dialog(en).getByRole('button',{name:'세션 닫기',exact:true}).last());await ja.getByRole('button',{name:'설정',exact:true}).click();await ja.getByLabel('이름',{exact:true}).fill('Japanese tab');await ja.getByRole('button',{name:'설정 완료'}).click();await start(ja,{learner:'husband'});await complete(ja,japaneseScenarios[0].sentences);const expected=(await state(en)).learners;assert.equal(expected.wife.sessions,8);assert.equal(expected.husband.sessions,1);assert.equal(expected.husband.name,'Japanese tab');assert.deepEqual(expected.wife.learned,legacy.learned);assert.deepEqual(expected.wife.reviews,legacy.reviews);for(const p of [en,ja]){await p.reload();await enterLocalDemo(p);await p.getByLabel('학습자 선택').waitFor();assert.deepEqual((await state(p)).learners,expected);assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('bloom-state'))),legacy);}await context.close();
 });
 await test('mobile full-screen modal traps focus, restores prior page/opener and avoids horizontal overflow',async()=>{
  const{page,context}=await fixture({saved:null,mobile:true});await page.getByRole('button',{name:'나의 학습',exact:true}).click();const opener=page.getByRole('button',{name:englishScenarios[0].titleKo+' 문장 세션 시작',exact:true});await opener.click();const d=dialog(page);assert.ok(await d.getByRole('heading',{name:'장면 이해'}).evaluate(el=>el===document.activeElement));const rect=await d.boundingBox();assert.ok(rect.width<=390&&rect.height>=800);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));for(let i=0;i<12;i++){await page.keyboard.press('Tab');assert.ok(await d.evaluate(el=>el.contains(document.activeElement)));}await complete(page,englishScenarios[0].sentences);await click(page,d.getByRole('button',{name:'세션 닫기',exact:true}).last());assert.equal(await d.count(),0);assert.ok(await opener.evaluate(el=>el===document.activeElement));assert.ok(await page.getByRole('heading',{name:'아이와 함께하는 20가지 상황'}).isVisible());assert.equal(await page.evaluate(()=>document.body.style.overflow),'');await context.close();
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
 await test('mobile 390px fullscreen summary exposes failed local save and retries exactly once',async()=>{
  const{page,context}=await fixture({saved:null,mobile:true});
  try{
   await start(page);
   const before=(await state(page)).learners.wife.sessions;
   await page.evaluate(()=>{
    window.__originalSetItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){if(key==='bloom-profiles-v2')throw new DOMException('Simulated quota failure','QuotaExceededError');return window.__originalSetItem.call(this,key,value);};
   });
   await complete(page,englishScenarios[0].sentences);
   const d=dialog(page),status=d.locator('.session-save-status');
   assert.match(await status.innerText(),/브라우저 저장 실패/);
   const retry=status.getByRole('button',{name:'다시 저장',exact:true});
   assert.equal((await state(page)).learners.wife.sessions,before,'failed write leaves durable sessions unchanged');
   await retry.scrollIntoViewIfNeeded();
   const rect=await retry.boundingBox();
   assert.ok(rect&&rect.x>=0&&rect.x+rect.width<=390&&rect.y>=0&&rect.y+rect.height<=844,'retry is reachable inside mobile fullscreen dialog');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.evaluate(()=>{Storage.prototype.setItem=window.__originalSetItem;});
   await retry.click();
   assert.equal(await status.innerText(),'이 브라우저에 저장됨');
   assert.equal(await status.getByRole('button',{name:'다시 저장'}).count(),0);
   assert.equal((await state(page)).learners.wife.sessions,before+1);
   assert.equal(Object.keys((await state(page)).learners.wife.sentenceProgress).length,5);
   await click(page,d.getByRole('button',{name:'세션 닫기',exact:true}).last());
   await page.reload();await enterLocalDemo(page);
   assert.equal((await state(page)).learners.wife.sessions,before+1,'retry survives reload without duplicate completion');
  }finally{await context.close();}
 });
 await test('mobile 390px account fullscreen retries failed API save with the same operation ID',async()=>{
  const profile={name:'계정 학습자',language:'en',goal:10,timezone:'America/New_York'};
  let remote={authenticated:true,account:{id:'browser-test-account',email:'browser-test@example.test'},profile,learner:blankLearner(profile),revision:0,imports:[]};
  const requests=[],applied=new Set(),unexpected=[];
  const apiRoute=async route=>{
   const request=route.request(),path=new URL(request.url()).pathname;
   if(path==='/api/session'&&request.method()==='GET')return route.fulfill({json:remote});
   if(path!=='/api/progress'||request.method()!=='POST'){unexpected.push(request.method()+' '+path);return route.fulfill({status:500,json:{code:'UNEXPECTED_TEST_REQUEST'}});}
   const body=request.postDataJSON();requests.push(body);
   if(requests.length===1)return route.fulfill({status:503,json:{code:'STORAGE_UNAVAILABLE'}});
   if(!applied.has(body.operationId)){
    remote={...remote,revision:remote.revision+1,learner:applyProgress(remote.learner,body,profile,fixed)};
    applied.add(body.operationId);
   }
   return route.fulfill({json:remote});
  };
  const{page,context}=await fixture({saved:null,mobile:true,apiRoute});
  try{
   await page.getByLabel('오늘의 문장 상황').selectOption(englishScenarios[0].id);
   await page.getByRole('button',{name:'문장 세션 시작하기',exact:true}).click();
   await complete(page,englishScenarios[0].sentences);
   const d=dialog(page),status=d.locator('.session-save-status');
   await status.filter({hasText:'서버 저장 실패'}).waitFor();
   assert.equal(await d.getAttribute('aria-modal'),'true');
   assert.equal(remote.learner.sessions,0,'503 leaves server state unchanged');
   assert.deepEqual(remote.learner.sentenceProgress,{});
   assert.equal(requests.length,1,'failed save waits for an explicit retry');
   const retry=status.getByRole('button',{name:'다시 저장',exact:true});
   await d.locator('.session-close').focus();
   await page.keyboard.press('Tab');
   assert.ok(await retry.evaluate(el=>el===document.activeElement),'retry is in the fullscreen dialog keyboard tab order');
   const rect=await retry.boundingBox();
   assert.ok(rect&&rect.x>=0&&rect.x+rect.width<=390&&rect.y>=0&&rect.y+rect.height<=844,'focused retry is reachable within the mobile viewport');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.keyboard.press('Enter');
   await status.filter({hasText:'계정에 저장됨'}).waitFor();
   assert.equal(await status.getByRole('button',{name:'다시 저장'}).count(),0);
   assert.equal(await d.getByRole('heading',{name:'세션 완료',exact:true}).count(),1);
   assert.equal(requests.length,2);
   assert.match(requests[0].operationId,/^[A-Za-z0-9_-]{16,100}$/);
   assert.deepEqual(requests[1],requests[0],'retry preserves operation ID and complete request payload');
   assert.equal(requests[0].expectedAccountId,remote.account.id);
   assert.equal(requests[0].type,'sentenceSession');
   assert.equal(remote.learner.sessions,1);
   assert.equal(applied.size,1);
   assert.deepEqual(Object.keys(remote.learner.sentenceProgress).sort(),englishScenarios[0].sentences.map(s=>s.id).sort());
   assert.deepEqual(unexpected,[]);
   await click(page,d.getByRole('button',{name:'세션 닫기',exact:true}).last());
   await page.reload();
   await page.getByRole('button',{name:'문장 세션 시작하기',exact:true}).waitFor();
   assert.equal(remote.learner.sessions,1,'reopening the mocked server account does not resubmit completion');
   assert.equal(requests.length,2);
  }finally{await context.close();}
 });
 for(const [learner,lang,scenes] of [['wife','en',englishScenarios],['husband','ja',japaneseScenarios]])await test(`daily ${lang} recommends first incomplete scene, preserves manual choice, then advances after one full session at 390px`,async()=>{
  const profile={name:'계속 학습자',goal:10};
  const progress=Object.fromEntries([...scenes[0].sentences,...scenes[1].sentences.slice(0,1)].map(sentence=>[sentence.id,{stage:1,dueAt:fixed+86400000}]));
  const learners={wife:blankLearner(profile),husband:blankLearner(profile)};
  learners[learner]={...learners[learner],sentenceProgress:progress};
  const{page,context}=await fixture({saved:null,mobile:true,profiles:{version:2,active:learner,learners}});
  try{
   await choose(page,learner);
   const selection=page.getByLabel('오늘의 문장 상황');
   assert.equal(await selection.inputValue(),scenes[1].id,'a partial imported scene is the next daily scene');
   await selection.selectOption(scenes[3].id);
   await page.getByRole('button',{name:'나의 학습',exact:true}).click();
   await page.getByRole('button',{name:'홈',exact:true}).click();
   assert.equal(await selection.inputValue(),scenes[3].id,'navigation keeps the learner’s manual choice');
   await page.getByRole('button',{name:'문장 세션 시작하기',exact:true}).click();
   assert.equal(await dialog(page).locator('.session-context li').count(),scenes[3].sentences.length);
   await complete(page,scenes[3].sentences);
   const sessions=(await state(page)).learners[learner].sessions;
   assert.equal(sessions,1);
   await click(page,dialog(page).getByRole('button',{name:'세션 닫기',exact:true}).last());
   assert.equal(await selection.inputValue(),scenes[1].id,'completion advances to first still incomplete scene');
   await page.reload();await enterLocalDemo(page);await choose(page,learner);
   assert.equal(await selection.inputValue(),scenes[1].id,'recommendation survives reload');
   assert.equal((await state(page)).learners[learner].sessions,sessions,'completion is recorded once');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'home fits 390px');
  }finally{await context.close();}
 });
 await test('daily recommendations stay separate for demo learners and fully recorded curricula stay usable',async()=>{
  const profile={name:'학습자',goal:10};
  const recorded=scenes=>Object.fromEntries(scenes.flatMap(scene=>scene.sentences.map(sentence=>[sentence.id,{stage:1,dueAt:fixed+86400000}])));
  const wife={...blankLearner(profile),sentenceProgress:recorded(englishScenarios)};
  const husband={...blankLearner(profile),sentenceProgress:recorded(japaneseScenarios.slice(0,2))};
  const{page,context}=await fixture({saved:null,profiles:{version:2,active:'wife',learners:{wife,husband}}});
  try{
   const selection=page.getByLabel('오늘의 문장 상황');
   assert.equal(await selection.inputValue(),englishScenarios[0].id,'all complete retains a valid selectable scene');
   assert.match(await page.locator('.hero').innerText(),/모두 학습했어요/,'home acknowledges completed curriculum');
   await selection.selectOption(englishScenarios[6].id);
   await page.getByRole('button',{name:'문장 세션 시작하기',exact:true}).click();
   assert.equal(await dialog(page).locator('.session-context li').count(),englishScenarios[6].sentences.length,'completed learner can practice again');
   await click(page,dialog(page).locator('.session-close'));
   await choose(page,'husband');
   assert.equal(await selection.inputValue(),japaneseScenarios[2].id,'other learner recommends their own first incomplete scene');
   await choose(page,'wife');
   assert.equal(await selection.inputValue(),englishScenarios[0].id,'switching learner recomputes the completed state');
  }finally{await context.close();}
 });
 await test('daily account recommendation uses account progress and due home action opens review note at 390px',async()=>{
  const profile={name:'계정 학습자',language:'ja',goal:10,timezone:'Asia/Seoul'};
  const recorded=Object.fromEntries([...japaneseScenarios[0].sentences,...japaneseScenarios[1].sentences.slice(0,1)].map((sentence,i)=>[sentence.id,{stage:1,dueAt:i===0?fixed-1000:fixed+86400000}]));
  const learner={...blankLearner(profile),sentenceProgress:recorded};
  const remote={authenticated:true,account:{id:'daily-account',email:'daily@example.test'},profile,learner,revision:0,imports:[]};
  const requests=[];
  const apiRoute=async route=>{const request=route.request();requests.push(request.method()+' '+new URL(request.url()).pathname);return route.fulfill({json:remote});};
  const localProfile={name:'다른 로컬 학습자',goal:10};
  const localJa={...blankLearner(localProfile),sentenceProgress:Object.fromEntries(japaneseScenarios.flatMap(scene=>scene.sentences.map(sentence=>[sentence.id,{stage:1,dueAt:fixed+86400000}])))};
  const{page,context}=await fixture({saved:null,mobile:true,apiRoute,profiles:{version:2,active:'husband',learners:{wife:blankLearner(localProfile),husband:localJa}}});
  try{
   assert.equal(await page.getByLabel('오늘의 문장 상황').inputValue(),japaneseScenarios[1].id);
   assert.ok((await page.locator('.hero').innerText()).includes('1'),'home shows a due review count');
   const dueAction=page.locator('.hero').getByRole('button',{name:/복습/});
   await dueAction.click();
   assert.ok(await page.getByRole('region',{name:'문장 복습',exact:true}).isVisible(),'due action opens the review note');
   assert.equal(await dialog(page).count(),0);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.deepEqual(requests,['GET /api/session']);
  }finally{await context.close();}
 });
 await test('daily account failed save discard restores selected scene from uncommitted completion',async()=>{
  const profile={name:'계정 학습자',language:'en',goal:10,timezone:'America/New_York'};
  const recorded=Object.fromEntries(englishScenarios[0].sentences.map(sentence=>[sentence.id,{stage:1,dueAt:fixed+86400000}]));
  const learner={...blankLearner(profile),sentenceProgress:recorded};
  const remote={authenticated:true,account:{id:'daily-failed-account',email:'daily-failed@example.test'},profile,learner,revision:0,imports:[]};
  const requests=[];
  const apiRoute=async route=>{const request=route.request(),path=new URL(request.url()).pathname;requests.push(request.method()+' '+path);if(path==='/api/session')return route.fulfill({json:remote});return route.fulfill({status:503,json:{code:'STORAGE_UNAVAILABLE'}});};
  const{page,context}=await fixture({saved:null,apiRoute});
  try{
   const selection=page.getByLabel('오늘의 문장 상황');
   assert.equal(await selection.inputValue(),englishScenarios[1].id);
   await selection.selectOption(englishScenarios[1].id);
   await page.getByRole('button',{name:'문장 세션 시작하기',exact:true}).click();
   await complete(page,englishScenarios[1].sentences);
   await dialog(page).locator('.session-save-status').filter({hasText:'서버 저장 실패'}).waitFor();
   await click(page,dialog(page).getByRole('button',{name:'세션 닫기',exact:true}).last());
   assert.equal(await selection.inputValue(),englishScenarios[1].id,'failed save preserves the selected scene');
   await page.getByRole('button',{name:'저장 안 된 변경 취소',exact:true}).click();
   assert.equal(await selection.inputValue(),englishScenarios[1].id,'discard restores the unfinished selected scene');
   assert.deepEqual(requests,['GET /api/session','POST /api/progress']);
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
