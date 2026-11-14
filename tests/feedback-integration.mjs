import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
const temporary=await mkdtemp(join(tmpdir(),'bloom-feedback-'));
const root=new URL('..',import.meta.url).pathname;
await build({entryPoints:[join(root,'server/index.js')],outfile:join(temporary,'worker.mjs'),bundle:true,format:'esm',platform:'browser',target:'es2022'});
const options=admin=>convertV4MiniflareOptions({modules:true,modulesRoot:temporary,scriptPath:join(temporary,'worker.mjs'),compatibilityDate:'2026-11-01',d1Databases:['DB'],d1Persist:join(temporary,'data'),bindings:{FEEDBACK_ADMIN_ACCOUNT_ID:admin||''}});
const worker=new Miniflare(options());
const db=await worker.getD1Database('DB');
for(const migration of ['0001_accounts.sql','0002_feedback.sql'])for(const sql of (await readFile(join(root,'migrations',migration),'utf8')).split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(sql.replaceAll('--> statement-breakpoint','')).run();
const origin='https://feedback.test';
function client(){let cookie='',id;return {get id(){return id},async request(path,method='GET',body,extra={}){const result=await worker.dispatchFetch(origin+path,{method,headers:{...(method==='GET'?{}:{Origin:origin,'Content-Type':'application/json'}),Cookie:cookie,...extra},...(body===undefined?{}:{body:JSON.stringify({expectedAccountId:id,...body})})});if(result.headers.get('set-cookie'))cookie=result.headers.get('set-cookie').split(';')[0];const data=await result.json();if(data.authenticated)id=data.account.id;return {status:result.status,data}}};}
const a=client(),b=client(),anon=client();
const signup=(email,language)=>({email,password:'test password long enough',name:'Tester',language,timezone:'Asia/Seoul'});
const payload=(number,extra={})=>({submissionId:`feedback-test-${String(number).padStart(16,'0')}`,category:'suggestion',message:'공항에서 일정이 바뀌었을 때 연습하고 싶어요.',language:'es',scenarioId:'travel_disruption',page:'피드백',...extra});
const expectStatus=(r,status)=>{assert.equal(r.status,status,JSON.stringify(r.data));return r.data};
try{
 await test('Spanish and Italian accounts register and persist new sentence progress',async()=>{
  expectStatus(await a.request('/api/auth/register','POST',signup('owner@example.test','es')),201);
  expectStatus(await b.request('/api/auth/register','POST',signup('learner@example.test','it')),201);
  for(const [actor,lang] of [[a,'es'],[b,'it']]){const state=expectStatus(await actor.request('/api/session'),200);const saved=expectStatus(await actor.request('/api/progress','POST',{operationId:`language-progress-${lang}`,revision:state.revision,type:'sentenceSession',elapsedMs:1000,results:[{sentenceId:`${lang}:sharing_opinions:1`,passed:true}]}),200);assert.equal(saved.learner.sentenceProgress[`${lang}:sharing_opinions:1`].stage,1);}
 });
 await test('feedback requires authentication, same origin, and expected account',async()=>{
  expectStatus(await anon.request('/api/feedback'),401);expectStatus(await anon.request('/api/feedback','POST',payload(1)),401);
  expectStatus(await a.request('/api/feedback','POST',payload(1),{Origin:'https://foreign.test'}),403);
  expectStatus(await a.request('/api/feedback','POST',{...payload(1),expectedAccountId:b.id}),409);
 });
 await test('feedback is durable, repeat-safe, and isolated between users',async()=>{
  const [one,two]=await Promise.all([a.request('/api/feedback','POST',payload(1)),a.request('/api/feedback','POST',payload(1))]);
  const first=expectStatus(one,200);assert.equal(expectStatus(two,200).id,first.id);
  const own=expectStatus(await a.request('/api/feedback'),200);assert.equal(own.items.length,1);assert.equal(own.items[0].message,payload(1).message);assert.equal(own.canReview,false);assert.ok(!JSON.stringify(own).includes('authorEmail'));
  assert.equal(expectStatus(await b.request('/api/feedback'),200).items.length,0);
  expectStatus(await a.request('/api/feedback','POST',payload(1,{message:'different'})),409);
  assert.equal(expectStatus(await a.request('/api/session'),200).learner.sessions,1);
 });
 await test('validation rejects oversized, empty, unknown categories and foreign situations',async()=>{
  for(const extra of [{message:' '},{message:'a'.repeat(2001)},{category:'other'},{language:'xx'},{scenarioId:'unknown'},{submissionId:'short'}])expectStatus(await a.request('/api/feedback','POST',payload(2,extra)),400);
  expectStatus(await a.request('/api/feedback?before=-1'),400);
 });
 await test('ordinary users cannot read inbox or change feedback status',async()=>{
  expectStatus(await a.request('/api/feedback/inbox'),403);
  expectStatus(await b.request('/api/feedback/status','PATCH',{feedbackId:1,status:'shipped'}),403);
 });
 await test('ten per day limit is enforced atomically without blocking duplicate retries',async()=>{
  const responses=await Promise.all(Array.from({length:12},(_,i)=>a.request('/api/feedback','POST',payload(i+10))));
  assert.equal(responses.filter(r=>r.status===200).length,9);assert.equal(responses.filter(r=>r.status===429).length,3);
  expectStatus(await a.request('/api/feedback','POST',payload(1)),200);
 });
 // Reopen the same persisted D1 with an explicit immutable administrator ID.
 await worker.setOptions(options(a.id));
 await test('only configured account can review inbox and mark feedback as shipped',async()=>{
  const inbox=expectStatus(await a.request('/api/feedback/inbox'),200);assert.equal(inbox.canReview,true);assert.equal(inbox.items.length,10);assert.ok(inbox.items.every(item=>item.authorEmail==='owner@example.test'));
  const id=inbox.items[0].id;
  expectStatus(await a.request('/api/feedback/status','PATCH',{feedbackId:id,status:'shipped'}),200);
  assert.equal(expectStatus(await a.request('/api/feedback?status=shipped'),200).items[0].id,id);
  expectStatus(await a.request('/api/feedback/status','PATCH',{feedbackId:id,status:'deleted'}),400);
  expectStatus(await b.request('/api/feedback/inbox'),403);
 });
 await test('cursor pagination returns older items without duplicates or leaking another account',async()=>{
  const current=await worker.getD1Database('DB');
  for(let i=0;i<30;i++)await current.prepare('INSERT INTO feedback(account_id,submission_id,category,message,language,page,status,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(b.id,`seed-${i}`,'content',`Feedback ${i}`,'it','피드백','new',Date.now()).run();
  const first=expectStatus(await b.request('/api/feedback'),200);assert.equal(first.items.length,25);assert.ok(first.nextCursor);
  const second=expectStatus(await b.request('/api/feedback?before='+first.nextCursor),200);assert.equal(second.items.length,5);assert.equal(second.nextCursor,null);
  assert.equal(new Set([...first.items,...second.items].map(i=>i.id)).size,30);
  assert.equal(expectStatus(await a.request('/api/feedback'),200).items.length,10);
 });
}finally{await worker.dispose();await rm(temporary,{recursive:true,force:true});}
