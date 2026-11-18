// Real Workers runtime + D1 integration. Does not start the application preview.
// Run after npm ci in the checkout: node tests/accounts-integration.mjs
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { api } from '../server/index.js';
import { applyProgress, blankLearner } from '../server/domain.js';
import { sentenceIdsForLanguage } from '../src/learning/schema.js';
import { applyCustomCardOperation, calendarAt, validateCustomCards } from '../src/learning/customCards.js';

const root = new URL('..', import.meta.url).pathname;
const temporary = await mkdtemp(join(tmpdir(), 'brainwork-accounts-test-'));
let worker;
let workerWithoutAdminSecret;
let failures = 0;
let passes = 0;
async function test(name, fn) {
  try { await fn(); passes++; console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}\n${error.stack}`); }
}
const origin = 'https://brainwork.test';
const adminSecret = randomBytes(32).toString('hex');
function client() {
  let cookie = '';
  let expectedAccountId;
  return {
    get cookie() { return cookie; },
    async request(path, { method = 'GET', body, headers = {}, cookie: override } = {}) {
      const response = await worker.dispatchFetch(`${origin}${path}`, {
        method,
        headers: { ...(method === 'GET' ? {} : { Origin: origin, 'Content-Type': 'application/json' }), ...(override ?? cookie ? { Cookie: override ?? cookie } : {}), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(expectedAccountId && ['/api/profile', '/api/progress', '/api/import', '/api/auth/logout', '/api/card-lookup'].includes(path) ? { expectedAccountId, ...body } : body) }),
      });
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      if (data?.authenticated && data?.account?.id) expectedAccountId = data.account.id;
      return { status: response.status, data, headers: response.headers };
    },
  };
}

try {
  await build({ entryPoints: [join(root, 'server/index.js')], outfile: join(temporary, 'worker.mjs'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022' });
  const upstream=[];let providerMode='ok';
  const provider=async request=>{
    const url=new URL(request.url);upstream.push(url.toString());
    if(providerMode==='unavailable')return new Response('unavailable',{status:503});
    if(providerMode==='oversize')return new Response('x'.repeat(131073),{status:200});
    if(providerMode==='dictionary-404'&&url.hostname==='api.dictionaryapi.dev')return new Response('{}',{status:404});
    let data;
    if(url.hostname==='api.mymemory.translated.net')data={responseStatus:providerMode==='bad-status'?403:200,quotaFinished:providerMode==='quota',responseData:{translatedText:providerMode==='missing'?'hello':providerMode==='excessive'?'가'.repeat(361):providerMode==='html'?'<b>안녕</b>':'안녕하세요'}};
    else if(url.hostname==='api.dictionaryapi.dev')data=[{word:'hello',meanings:providerMode==='malformed'?'wrong':[{definitions:[{definition:'A greeting.'}]}]}];
    else if(url.hostname==='jisho.org')data={data:providerMode==='malformed'?'wrong':providerMode==='jisho-empty'?[]:[{japanese:[{word:'猫',reading:'ねこ'}],senses:[{english_definitions:['cat']}]}]};
    else throw new Error('Unexpected upstream host');
    return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
  };
  const workerOptions = { modules: true, modulesRoot: temporary, scriptPath: join(temporary, 'worker.mjs'), compatibilityDate: '2026-11-01', d1Databases: ['DB'], outboundService: provider };
  worker = new Miniflare(convertV4MiniflareOptions({ ...workerOptions, bindings: { BLOOM_ADMIN_RESET_SECRET: adminSecret } }));
  const db = await worker.getD1Database('DB');
  const schema = await readFile(join(root, 'migrations/0001_accounts.sql'), 'utf8');
  for (const statement of schema.split(';').map(s => s.trim()).filter(Boolean)) await db.prepare(statement).run();
  const adminMigration = await readFile(join(root, 'migrations/0002_admin_audit_events.sql'), 'utf8');
  for (const statement of adminMigration.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)) await db.prepare(statement).run();
  const credentialMigration = await readFile(join(root, 'migrations/0003_admin_credentials.sql'), 'utf8');
  for (const statement of credentialMigration.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)) await db.prepare(statement).run();

  const a = client(), b = client(), anonymous = client();
  const password = 'correct horse battery staple';
  const account = (email, language = 'en') => ({ email, password, name: email.split('@')[0], language, timezone: 'America/New_York', goal: 15 });
  const expectStatus = (response, status) => { assert.equal(response.status, status, JSON.stringify(response.data)); return response.data; };
  const session = async actor => expectStatus(await actor.request('/api/session'), 200);
  const op = (number, revision, extra = {}) => ({ operationId: `integration-operation-${number}`, revision, type: 'dialogueSession', elapsedMs: 90000, ...extra });
  let initialA, initialB, recoveryCode;
  await test('custom card calendar scheduling crosses DST and preserves early due dates', async () => {
    const id='123e4567-e89b-42d3-a456-426614174000', timezone='America/New_York', at=Date.parse('2026-03-07T14:30:00Z');
    let cards=applyCustomCardOperation([], {type:'customCardAdd',cardId:id,front:' Hello ',back:' World '}, timezone, at);
    assert.equal(cards[0].dueAt,Date.parse('2026-03-09T13:30:00Z'));
    assert.equal(cards[0].front,'Hello');assert.equal(cards[0].back,'World');
    cards=applyCustomCardOperation(cards,{type:'customCardReview',cardId:id,remembered:true},timezone,at+1000);
    assert.equal(cards[0].dueAt,Date.parse('2026-03-09T13:30:00Z'));assert.equal(cards[0].stage,0);
    const due=cards[0].dueAt;
    cards=applyCustomCardOperation(cards,{type:'customCardReview',cardId:id,remembered:true},timezone,due);
    assert.equal(cards[0].stage,1);assert.equal(cards[0].dueAt,Date.parse('2026-03-12T13:30:00Z'));
    for(const [stage,days] of [[2,7],[3,14],[4,30],[5,60],[5,60]]){
      const reviewAt=cards[0].dueAt;
      cards=applyCustomCardOperation(cards,{type:'customCardReview',cardId:id,remembered:true},timezone,reviewAt);
      assert.equal(cards[0].stage,stage);assert.equal(cards[0].dueAt,calendarAt(reviewAt,days,timezone));
    }
    cards=applyCustomCardOperation(cards,{type:'customCardReview',cardId:id,remembered:false},timezone,Date.parse('2026-11-01T04:30:00Z'));
    assert.equal(cards[0].stage,0);assert.equal(cards[0].dueAt,Date.parse('2026-11-02T05:00:00Z'));
  });
  await test('review scheduling follows account-local midnight/calendar days across DST and early practice', async () => {
    for (const [timezone, at, midnight, threeDays] of [
      ['America/New_York', '2026-03-08T04:30:00Z', '2026-03-08T05:00:00Z', '2026-03-11T03:30:00Z'],
      ['Asia/Seoul', '2026-11-13T14:30:00Z', '2026-11-13T15:00:00Z', '2026-11-16T14:30:00Z'],
    ]) {
      const profile = { name: 'Scheduler', language: 'en', goal: 10, timezone };
      const first = applyProgress(blankLearner(profile), { type: 'sentenceSession', elapsedMs: 1000, results: [{ sentenceId: 'en:cafe_order:1', passed: false }, { sentenceId: 'en:cafe_order:2', passed: true }] }, profile, Date.parse(at));
      assert.equal(first.sentenceProgress['en:cafe_order:1'].dueAt, Date.parse(midnight));
      assert.equal(first.sentenceProgress['en:cafe_order:2'].dueAt, Date.parse(threeDays));
      const early = applyProgress(first, { type: 'sentenceSession', elapsedMs: 1000, results: [{ sentenceId: 'en:cafe_order:2', passed: true }] }, profile, Date.parse(at) + 60000);
      assert.equal(early.sentenceProgress['en:cafe_order:2'].dueAt, Date.parse(threeDays));
      assert.equal(early.sentenceProgress['en:cafe_order:2'].stage, 1);
    }
  });
  await test('anonymous requests cannot read or mutate personal learning state', async () => {
    assert.deepEqual(await session(anonymous), { authenticated: false });
    for (const [path, method, body] of [['/api/profile', 'PATCH', {}], ['/api/progress', 'POST', op('anon', 0)], ['/api/import', 'POST', {}]]) {
      expectStatus(await anonymous.request(path, { method, body }), 401);
    }
  });
  await test('registration creates separate empty D1 accounts and secure opaque cookies', async () => {
    const response = await a.request('/api/auth/register', { method: 'POST', body: account('alice@example.test') });
    initialA = expectStatus(response, 201); recoveryCode = initialA.recoveryCode;
    assert.ok(recoveryCode?.length >= 16);
    assert.equal(initialA.authenticated, true); assert.equal(initialA.revision, 0); assert.equal(initialA.learner.sessions, 0);
    assert.match(response.headers.get('set-cookie'), /^__Host-bloom_session=/);
    for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert.ok(response.headers.get('set-cookie').includes(attribute), attribute);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok(!JSON.stringify(initialA).includes('password_hash'));
    initialB = expectStatus(await b.request('/api/auth/register', { method: 'POST', body: account('bob@example.test', 'ja') }), 201);
    assert.notEqual(initialA.account.id, initialB.account.id);
    const rows = await db.prepare('SELECT password_hash, recovery_hash FROM accounts').all();
    assert.equal(rows.results.length, 2);
    for (const row of rows.results) { assert.notEqual(row.password_hash, password); assert.notEqual(row.recovery_hash, recoveryCode); }
  });
  await test('authenticated lookup uses hardcoded providers and saves hint/source through progress', async () => {
    const actor=client();expectStatus(await actor.request('/api/auth/register',{method:'POST',body:account('saved-lookup@example.test')}),201);
    const before=await session(actor),calls=upstream.length;
    const result=expectStatus(await actor.request('/api/card-lookup',{method:'POST',body:{front:'hello'}}),200);
    assert.deepEqual(result,{back:'안녕하세요',hint:'A greeting.',source:'mymemory+dictionaryapi'});
    assert.equal((await session(actor)).revision,before.revision);
    assert.equal(upstream.length,calls+2);
    assert.ok(upstream.slice(calls).every(url=>['api.mymemory.translated.net','api.dictionaryapi.dev'].includes(new URL(url).hostname)));
    assert.ok(upstream.slice(calls).every(url=>!url.includes(before.account.id)&&!url.includes(before.account.email)));
    const id='123e4567-e89b-42d3-a456-426614174006';
    const input=op('lookup-save',before.revision,{type:'customCardAdd',cardId:id,front:'hello',...result});
    const saved=expectStatus(await actor.request('/api/progress',{method:'POST',body:input}),200);
    assert.equal(saved.learner.customCards[0].hint,'A greeting.');assert.equal(saved.learner.customCards[0].source,'mymemory+dictionaryapi');
    const replay=expectStatus(await actor.request('/api/progress',{method:'POST',body:{...input,revision:saved.revision}}),200);
    assert.equal(replay.learner.customCards.filter(c=>c.id===id).length,1);
    const ja=expectStatus(await b.request('/api/card-lookup',{method:'POST',body:{front:'猫'}}),200);
    assert.deepEqual(ja,{back:'안녕하세요',hint:'cat (JMdict)',source:'mymemory+jisho'});
    assert.ok(upstream.at(-1).startsWith('https://jisho.org/api/v1/search/words?keyword='));
  });
  await test('lookup rejects unauthenticated, invalid, missing, and unavailable results', async () => {
    const count=upstream.length;
    expectStatus(await anonymous.request('/api/card-lookup',{method:'POST',body:{front:'hello'}}),401);
    for(const front of ['two words','x'.repeat(81),'あ'.repeat(70),'<script>'])expectStatus(await a.request('/api/card-lookup',{method:'POST',body:{front}}),400);
    assert.equal(upstream.length,count);
    for(const mode of ['missing','bad-status','quota','excessive','html']){providerMode=mode;expectStatus(await a.request('/api/card-lookup',{method:'POST',body:{front:'hello'}}),404);}
    for(const mode of ['dictionary-404','malformed']){providerMode=mode;expectStatus(await a.request('/api/card-lookup',{method:'POST',body:{front:'hello'}}),404);}
    for(const mode of ['malformed','jisho-empty']){providerMode=mode;expectStatus(await b.request('/api/card-lookup',{method:'POST',body:{front:'猫'}}),404);}
    providerMode='unavailable';expectStatus(await a.request('/api/card-lookup',{method:'POST',body:{front:'hello'}}),503);
    providerMode='oversize';expectStatus(await a.request('/api/card-lookup',{method:'POST',body:{front:'hello'}}),503);
    providerMode='ok';
    const actor=client(),registered=expectStatus(await actor.request('/api/auth/register',{method:'POST',body:account('lookup-owner@example.test')}),201);
    const other=await session(b);
    const changed=expectStatus(await actor.request('/api/card-lookup',{method:'POST',body:{expectedAccountId:registered.account.id,front:'hello'},cookie:b.cookie}),409);
    assert.equal(changed.code,'ACCOUNT_CHANGED');assert.equal(changed.state,undefined);assert.notEqual(registered.account.id,other.account.id);
  });
  await test('lookup rate limit caps account requests before another provider call', async () => {
    const actor=client();expectStatus(await actor.request('/api/auth/register',{method:'POST',body:account('lookup-limited@example.test')}),201);
    for(let i=0;i<30;i++)expectStatus(await actor.request('/api/card-lookup',{method:'POST',body:{front:'hello'}}),200);
    const count=upstream.length;
    expectStatus(await actor.request('/api/card-lookup',{method:'POST',body:{front:'hello'}}),429);
    assert.equal(upstream.length,count);
  });
  await test('custom cards persist through D1, edit, review, delete, and account isolation', async () => {
    const id='123e4567-e89b-42d3-a456-426614174001';let state=await session(a);
    assert.deepEqual(state.learner.customCards,[]);
    state=expectStatus(await a.request('/api/progress',{method:'POST',body:op('card-add',state.revision,{type:'customCardAdd',cardId:id,front:'  Morning  ',back:'  아침  '})}),200);
    assert.equal(state.learner.customCards[0].front,'Morning');assert.equal(state.learner.customCards[0].back,'아침');
    assert.deepEqual((await session(b)).learner.customCards,[]);
    const created=state.learner.customCards[0];
    state=expectStatus(await a.request('/api/progress',{method:'POST',body:op('card-edit',state.revision,{type:'customCardEdit',cardId:id,front:'Morning!',back:''})}),200);
    assert.equal(state.learner.customCards[0].createdAt,created.createdAt);assert.equal(state.learner.customCards[0].dueAt,created.dueAt);
    state=expectStatus(await a.request('/api/progress',{method:'POST',body:op('card-review',state.revision,{type:'customCardReview',cardId:id,remembered:false})}),200);
    assert.equal(state.learner.customCards[0].stage,0);assert.equal(state.learner.customCards[0].lastOutcome,'forgotten');
    state=expectStatus(await a.request('/api/progress',{method:'POST',body:op('card-delete',state.revision,{type:'customCardDelete',cardId:id})}),200);
    assert.deepEqual(state.learner.customCards,[]);
    assert.deepEqual((await session(b)).learner.customCards,[]);
  });
  await test('custom card validation rejects bad text, duplicate IDs, and the 201st card', async () => {
    const id='123e4567-e89b-42d3-a456-426614174002',base=await session(a);
    for(const [label,front,back] of [['blank','  ',''],['long','a'.repeat(181),''],['control','bad\nline',''],['back','ok','b'.repeat(361)],['null-back','ok',null]]){
      expectStatus(await a.request('/api/progress',{method:'POST',body:op(`card-invalid-${label}`,base.revision,{type:'customCardAdd',cardId:id,front,back})}),400);
    }
    let state=expectStatus(await a.request('/api/progress',{method:'POST',body:op('card-valid',base.revision,{type:'customCardAdd',cardId:id,front:'Valid',back:''})}),200);
    expectStatus(await a.request('/api/progress',{method:'POST',body:op('card-duplicate',state.revision,{type:'customCardAdd',cardId:id,front:'Another'})}),409);
    const many=Array.from({length:200},(_,i)=>({...state.learner.customCards[0],id:`123e4567-e89b-42d3-a456-${String(i).padStart(12,'0')}`}));
    assert.equal(validateCustomCards(many).length,200);
    assert.throws(()=>applyCustomCardOperation(many,{type:'customCardAdd',cardId:'123e4567-e89b-42d3-a456-426614174003',front:'Extra'},'UTC'),e=>e.code==='CUSTOM_CARD_LIMIT');
    const full=client(),registered=expectStatus(await full.request('/api/auth/register',{method:'POST',body:account('full-cards@example.test')}),201);
    const seeded={...registered.learner,customCards:many};
    await db.prepare('UPDATE accounts SET learner_json=? WHERE id=?').bind(JSON.stringify(seeded),registered.account.id).run();
    expectStatus(await full.request('/api/progress',{method:'POST',body:op('card-over-limit',registered.revision,{type:'customCardAdd',cardId:'123e4567-e89b-42d3-a456-426614174003',front:'Extra'})}),409);
    assert.equal((await session(full)).learner.customCards.length,200);
    assert.equal((await session(a)).revision,state.revision);
  });
  await test('custom card idempotency and revision rebase preserve one card', async () => {
    const id='123e4567-e89b-42d3-a456-426614174004',before=await session(a);
    const first=op('card-replay',before.revision,{type:'customCardAdd',cardId:id,front:'Replay'});
    const applied=expectStatus(await a.request('/api/progress',{method:'POST',body:first}),200);
    const replay=expectStatus(await a.request('/api/progress',{method:'POST',body:{...first,revision:applied.revision}}),200);
    assert.equal(replay.revision,applied.revision);assert.equal(replay.learner.customCards.filter(c=>c.id===id).length,1);
    expectStatus(await a.request('/api/progress',{method:'POST',body:{...first,front:'Different',revision:applied.revision}}),409);
    const pending=op('card-rebase',before.revision,{type:'customCardEdit',cardId:id,front:'Rebased'});
    const conflict=expectStatus(await a.request('/api/progress',{method:'POST',body:pending}),409);
    assert.equal(conflict.code,'REVISION_CONFLICT');
    const rebased=expectStatus(await a.request('/api/progress',{method:'POST',body:{...pending,revision:conflict.state.revision}}),200);
    assert.equal(rebased.learner.customCards.find(c=>c.id===id).front,'Rebased');
  });
  await test('legacy account JSON normalizes cards and old/new imports validate cards', async () => {
    const legacy=client(),old=expectStatus(await legacy.request('/api/auth/register',{method:'POST',body:account('legacy-cards@example.test')}),201);
    const raw=structuredClone(old.learner);delete raw.customCards;
    await db.prepare('UPDATE accounts SET learner_json=? WHERE id=?').bind(JSON.stringify(raw),old.account.id).run();
    assert.deepEqual((await session(legacy)).learner.customCards,[]);
    const updated=expectStatus(await legacy.request('/api/progress',{method:'POST',body:op('legacy-card-add',old.revision,{type:'customCardAdd',cardId:'123e4567-e89b-42d3-a456-426614174005',front:'Legacy'})}),200);
    assert.equal(updated.learner.customCards.length,1);
    const oldImport=client(),registered=expectStatus(await oldImport.request('/api/auth/register',{method:'POST',body:account('old-import-cards@example.test')}),201);
    const imported=expectStatus(await oldImport.request('/api/import',{method:'POST',body:{operationId:'integration-card-old-import',revision:registered.revision,source:'wife',learner:raw}}),200);
    assert.deepEqual(imported.learner.customCards,[]);
    const newImport=client(),fresh=expectStatus(await newImport.request('/api/auth/register',{method:'POST',body:account('new-import-cards@example.test')}),201);
    const card={...updated.learner.customCards[0],hint:'A previously checked hint.',source:'mymemory+dictionaryapi'};
    const malformed={...raw,customCards:[{...card,front:'bad\ntext'}]};
    expectStatus(await newImport.request('/api/import',{method:'POST',body:{operationId:'integration-card-invalid-import',revision:fresh.revision,source:'wife',learner:malformed}}),400);
    const importedNew=expectStatus(await newImport.request('/api/import',{method:'POST',body:{operationId:'integration-card-new-import',revision:fresh.revision,source:'wife',learner:{...raw,customCards:[card]}}}),200);
    assert.deepEqual(importedNew.learner.customCards,[card]);
    assert.equal(importedNew.learner.customCards[0].id,card.id);
  });
  await test('four-character passwords register, log in and recover; three-character new passwords fail without consuming recovery', async () => {
    const actor = client(), login = client(), recoverer = client();
    const email = 'short-password@example.test';
    expectStatus(await actor.request('/api/auth/register', { method: 'POST', body: { ...account(email), password: 'abc' } }), 400);
    const registered = expectStatus(await actor.request('/api/auth/register', { method: 'POST', body: { ...account(email), password: 'abcd' } }), 201);
    const code = registered.recoveryCode;
    expectStatus(await login.request('/api/auth/login', { method: 'POST', body: { email, password: 'abc' } }), 401);
    const logged = expectStatus(await login.request('/api/auth/login', { method: 'POST', body: { email, password: 'abcd' } }), 200);
    assert.equal(logged.account.id, registered.account.id);
    expectStatus(await recoverer.request('/api/auth/recover', { method: 'POST', body: { email, recoveryCode: code, newPassword: 'xyz' } }), 400);
    assert.equal((await session(actor)).account.id, registered.account.id);
    const recovered = expectStatus(await recoverer.request('/api/auth/recover', { method: 'POST', body: { email, recoveryCode: code, newPassword: 'wxyz' } }), 200);
    assert.equal(recovered.account.id, registered.account.id);
    assert.deepEqual(await session(actor), { authenticated: false });
    expectStatus(await login.request('/api/auth/login', { method: 'POST', body: { email, password: 'abcd' } }), 401);
    expectStatus(await login.request('/api/auth/login', { method: 'POST', body: { email, password: 'wxyz' } }), 200);
  });
  await test('four Unicode characters count as four and three Unicode characters remain too short', async () => {
    const actor = client(), email = 'unicode-password@example.test';
    expectStatus(await actor.request('/api/auth/register', { method: 'POST', body: { ...account(email), password: '😀😀😀' } }), 400);
    expectStatus(await actor.request('/api/auth/register', { method: 'POST', body: { ...account(email), password: '😀😀😀😀' } }), 201);
    expectStatus(await client().request('/api/auth/login', { method: 'POST', body: { email, password: '😀😀😀😀' } }), 200);
  });
  await test('CSRF rejects foreign/missing origins and non-JSON mutations', async () => {
    const before = await session(a);
    for (const Origin of ['https://evil.test', 'null', '']) expectStatus(await a.request('/api/progress', { method: 'POST', body: op('csrf', before.revision), headers: { Origin } }), 403);
    expectStatus(await a.request('/api/progress', { method: 'POST', body: op('content', before.revision), headers: { 'Content-Type': 'text/plain' } }), 415);
    assert.deepEqual(await session(a), before);
  });
  await test('profile edits can change unused language and reject stale revisions without losing settings', async () => {
    const before = await session(b), profile = { ...before.profile, name: 'Bob revised', language: 'en', goal: 20 };
    const updated = expectStatus(await b.request('/api/profile', { method: 'PATCH', body: { revision: before.revision, profile } }), 200);
    assert.deepEqual(updated.profile, profile); assert.equal(updated.learner.name, profile.name); assert.equal(updated.learner.goal, 20);
    const conflict = expectStatus(await b.request('/api/profile', { method: 'PATCH', body: { revision: before.revision, profile: before.profile } }), 409);
    assert.equal(conflict.code, 'REVISION_CONFLICT'); assert.deepEqual(conflict.state, updated);
    const restored = expectStatus(await b.request('/api/profile', { method: 'PATCH', body: { revision: updated.revision, profile: { ...profile, language: 'ja' } } }), 200);
    assert.equal(restored.profile.language, 'ja'); assert.equal(restored.profile.goal, 20);
  });
  await test('spoofed owner IDs cannot read or write another account', async () => {
    const own = await session(a), other = await session(b);
    const read = await a.request(`/api/session?accountId=${other.account.id}&userId=${other.account.id}`);
    assert.equal(expectStatus(read, 200).account.id, own.account.id);
    const result = await a.request('/api/progress', { method: 'POST', body: op('spoof', own.revision, { accountId: other.account.id, userId: other.account.id, ownerId: other.account.id }) });
    assert.ok([200, 400].includes(result.status), JSON.stringify(result.data));
    assert.deepEqual(await session(b), other);
    assert.equal((await session(a)).account.id, own.account.id);
  });
  await test('concurrent duplicate semantic operations commit once; altered replay is rejected', async () => {
    const before = await session(a), body = op('duplicate', before.revision);
    const responses = await Promise.all(Array.from({ length: 8 }, () => a.request('/api/progress', { method: 'POST', body })));
    for (const response of responses) expectStatus(response, 200);
    const after = await session(a);
    assert.equal(after.learner.sessions, before.learner.sessions + 1); assert.equal(after.learner.minutes, before.learner.minutes + 1.5); assert.equal(after.revision, before.revision + 1);
    const replay = expectStatus(await a.request('/api/progress', { method: 'POST', body: { ...body, revision: after.revision } }), 200);
    assert.equal(replay.revision, after.revision);
    const changed = expectStatus(await a.request('/api/progress', { method: 'POST', body: { ...body, elapsedMs: 1000 } }), 409);
    assert.equal(changed.code, 'OPERATION_REUSED');
  });
  await test('concurrent distinct operations return conflict then safely replay against current revision', async () => {
    const before = await session(a), first = op('race-one', before.revision), second = op('race-two', before.revision);
    const responses = await Promise.all([first, second].map(body => a.request('/api/progress', { method: 'POST', body })));
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    const i = responses.findIndex(r => r.status === 409), conflict = responses[i].data;
    assert.equal(conflict.code, 'REVISION_CONFLICT'); assert.equal(conflict.state.account.id, before.account.id);
    expectStatus(await a.request('/api/progress', { method: 'POST', body: { ...[first, second][i], revision: conflict.state.revision } }), 200);
    const after = await session(a); assert.equal(after.learner.sessions, before.learner.sessions + 2); assert.equal(after.revision, before.revision + 2);
  });
  await test('sentence completion aggregates failed attempts, persists reload state, and rejects foreign language', async () => {
    const before = await session(a);
    const body = op('sentences', before.revision, { type: 'sentenceSession', results: [{ sentenceId: 'en:cafe_order:1', passed: true }, { sentenceId: 'en:cafe_order:1', passed: false }, { sentenceId: 'en:cafe_order:2', passed: true }] });
    const after = expectStatus(await a.request('/api/progress', { method: 'POST', body }), 200);
    assert.equal(after.learner.sentenceProgress['en:cafe_order:1'].lastOutcome, 'failed'); assert.equal(after.learner.sentenceProgress['en:cafe_order:1'].stage, 0);
    assert.equal(after.learner.sentenceProgress['en:cafe_order:2'].stage, 1);
    assert.deepEqual(await session(a), after);
    expectStatus(await a.request('/api/progress', { method: 'POST', body: op('wrong-language', after.revision, { type: 'sentenceSession', results: [{ sentenceId: 'ja:cafe_order:1', passed: true }] }) }), 400);
    expectStatus(await a.request('/api/profile', { method: 'PATCH', body: { revision: after.revision, profile: { ...after.profile, language: 'ja' } } }), 409);
    assert.deepEqual(await session(a), after);
  });
  await test('explicit single-profile import is repeat safe and rejects second source/foreign language', async () => {
    const before = await session(b);
    const learner = { learned: ['ja-cafe-order'], reviews: { 'ja-cafe-order': Date.now() + 86400000 }, reviewStages: { 'ja-cafe-order': 1 }, sessions: 7, minutes: 42.5, dates: ['2026-11-12'], dailyMinutes: { '2026-11-12': 42.5 }, sentenceProgress: {}, name: 'old local name', goal: 99 };
    const original = structuredClone(learner);
    expectStatus(await b.request('/api/import', { method: 'POST', body: { operationId: 'integration-import-wrong', revision: before.revision, source: 'wife', learner } }), 409);
    assert.deepEqual(await session(b), before);
    const body = { operationId: 'integration-import-first', revision: before.revision, source: 'husband', learner };
    const after = expectStatus(await b.request('/api/import', { method: 'POST', body }), 200);
    assert.deepEqual(learner, original); assert.equal(after.learner.sessions, 7); assert.equal(after.learner.name, before.profile.name); assert.equal(after.learner.goal, before.profile.goal); assert.equal(after.imports.length, 1);
    const repeat = expectStatus(await b.request('/api/import', { method: 'POST', body: { ...body, revision: after.revision } }), 200);
    assert.equal(repeat.learner.sessions, 7); assert.equal(repeat.revision, after.revision);
    expectStatus(await b.request('/api/import', { method: 'POST', body: { ...body, operationId: 'integration-import-second', revision: after.revision } }), 409);
    expectStatus(await b.request('/api/profile', { method: 'PATCH', body: { revision: after.revision, profile: { ...after.profile, language: 'en' } } }), 409);
    assert.deepEqual(await session(b), after);
  });
  await test('D1 import retains all 180 English sentence records and new fifth-sentence outcomes coexist with legacy history', async () => {
    const actor = client();
    const initial = expectStatus(await actor.request('/api/auth/register', { method: 'POST', body: account('full-curriculum@example.test') }), 201);
    const learner = blankLearner(initial.profile);
    for (const id of sentenceIdsForLanguage('en')) learner.sentenceProgress[id] = { stage: 1, dueAt: 1000, lastReviewedAt: 500, lastOutcome: 'passed' };
    const imported = expectStatus(await actor.request('/api/import', { method: 'POST', body: { operationId: 'integration-full-curriculum-import', revision: initial.revision, source: 'wife', learner } }), 200);
    assert.deepEqual(imported.learner.sentenceProgress, learner.sentenceProgress);
    const maternal = 'en:mom_v1_morning_start:5';
    const after = expectStatus(await actor.request('/api/progress', { method: 'POST', body: op('maternal-with-legacy', imported.revision, { type: 'sentenceSession', results: [{ sentenceId: maternal, passed: true }, { sentenceId: 'en:cafe_order:1', passed: true }] }) }), 200);
    assert.equal(after.learner.sentenceProgress[maternal].stage, 2);
    assert.equal(after.learner.sentenceProgress['en:cafe_order:1'].stage, 2);
    assert.equal(Object.keys(after.learner.sentenceProgress).length, 180);
    assert.deepEqual(await session(actor), after);
    for (const sentenceId of ['en:cafe_order:5', 'en:mom_v1_morning_start:6', 'ja:mom_v1_morning_start:1']) expectStatus(await actor.request('/api/progress', { method: 'POST', body: op(`invalid-id-${sentenceId.replaceAll(':', '-')}`, after.revision, { type: 'sentenceSession', results: [{ sentenceId, passed: true }] }) }), 400);
    assert.deepEqual(await session(actor), after);
  });
  await test('invalid durations/results and full snapshot attempts cannot overwrite server learning state', async () => {
    const before = await session(a);
    for (const [number, extra] of [['negative', { elapsedMs: -1 }], ['excessive', { elapsedMs: 7200001 }], ['snapshot', { type: 'replace', learner: { sessions: 99999 } }], ['sentences', { type: 'sentenceSession', results: [] }]]) {
      expectStatus(await a.request('/api/progress', { method: 'POST', body: op(`invalid-${number}`, before.revision, extra) }), 400);
    }
    assert.deepEqual(await session(a), before);
    expectStatus(await a.request('/api/progress', { method: 'POST', body: op('oversized', before.revision, { padding: 'x'.repeat(300000) }) }), 413);
    assert.deepEqual(await session(a), before);
  });
  await test('stale account intent with another account cookie rejects every mutation without a state leak', async () => {
    const own = await session(a), other = await session(b);
    const mutations = [
      ['/api/progress', 'POST', op('stale-owner', other.revision)],
      ['/api/profile', 'PATCH', { revision: other.revision, profile: own.profile }],
      ['/api/import', 'POST', { operationId: 'integration-stale-import', revision: other.revision, source: 'wife', learner: own.learner }],
      ['/api/auth/logout', 'POST', {}],
    ];
    for (const [path, method, body] of mutations) {
      const result = expectStatus(await a.request(path, { method, body: { ...body, expectedAccountId: own.account.id }, cookie: b.cookie }), 409);
      assert.equal(result.code, 'ACCOUNT_CHANGED');
      assert.equal(result.state, undefined);
      assert.ok(!JSON.stringify(result).includes(other.account.id));
    }
    assert.deepEqual(await session(a), own); assert.deepEqual(await session(b), other);
  });
  await test('logout revokes session, login is case-insensitive, and account data stays isolated', async () => {
    const own = await session(a), other = await session(b), stolenCookie = a.cookie;
    expectStatus(await a.request('/api/auth/logout', { method: 'POST', body: {} }), 200);
    assert.deepEqual(await session(a), { authenticated: false });
    assert.deepEqual(expectStatus(await anonymous.request('/api/session', { cookie: stolenCookie }), 200), { authenticated: false });
    expectStatus(await a.request('/api/auth/login', { method: 'POST', body: { email: 'alice@example.test', password: 'incorrect-password' } }), 401);
    const login = expectStatus(await a.request('/api/auth/login', { method: 'POST', body: { email: 'ALICE@EXAMPLE.TEST', password } }), 200);
    assert.deepEqual(login, own); assert.deepEqual(await session(b), other);
  });
  await test('recovery rotates one-time code/password and revokes all prior sessions', async () => {
    const oldCookie = a.cookie, oldState = await session(a), otherState = await session(b), recoverer = client();
    const secondDevice = client();
    expectStatus(await secondDevice.request('/api/auth/login', { method: 'POST', body: { email: 'alice@example.test', password } }), 200);
    expectStatus(await recoverer.request('/api/auth/recover', { method: 'POST', body: { email: 'alice@example.test', recoveryCode: 'invalid-code', newPassword: 'new correct password 123' } }), 401);
    const recovered = expectStatus(await recoverer.request('/api/auth/recover', { method: 'POST', body: { email: 'alice@example.test', recoveryCode, newPassword: 'new correct password 123' } }), 200);
    assert.notEqual(recovered.recoveryCode, recoveryCode); assert.equal(recovered.account.id, oldState.account.id); assert.deepEqual(recovered.learner, oldState.learner);
    assert.deepEqual(expectStatus(await anonymous.request('/api/session', { cookie: oldCookie }), 200), { authenticated: false });
    assert.deepEqual(await session(secondDevice), { authenticated: false });
    expectStatus(await a.request('/api/auth/login', { method: 'POST', body: { email: 'alice@example.test', password } }), 401);
    expectStatus(await a.request('/api/auth/login', { method: 'POST', body: { email: 'alice@example.test', password: 'new correct password 123' } }), 200);
    expectStatus(await anonymous.request('/api/auth/recover', { method: 'POST', body: { email: 'alice@example.test', recoveryCode, newPassword: password } }), 401);
    const contenders = [client(), client()];
    const raced = await Promise.all(contenders.map(actor => actor.request('/api/auth/recover', { method: 'POST', body: { email: 'alice@example.test', recoveryCode: recovered.recoveryCode, newPassword: 'concurrent recovery password 123' } })));
    assert.deepEqual(raced.map(result => result.status).sort(), [200, 401], 'a one-time recovery code has exactly one concurrent winner');
    const winner = raced.findIndex(result => result.status === 200);
    assert.equal((await session(contenders[winner])).account.id, oldState.account.id);
    assert.deepEqual((await session(contenders[winner])).learner, oldState.learner);
    assert.deepEqual(await session(contenders[1 - winner]), { authenticated: false });
    assert.deepEqual(await session(recoverer), { authenticated: false });
    assert.deepEqual(await session(a), { authenticated: false });
    assert.deepEqual(await session(b), otherState);
  });
  await test('administrator setup, reset, change, and key recovery protect accounts', async () => {
    const owner = client(), secondDevice = client(), admin = client(), login = client();
    const email = 'admin-reset-integration@example.test';
    const oldPassword = 'original password 123';
    const newPassword = 'replacement password 456';
    const adminPassword = 'chosen administrator 🔒 password';
    const changedPassword = 'changed administrator 🔐 password';
    const recoveredPassword = 'recovered administrator 🔑 password';
    const authorization = `Bearer ${adminSecret}`;
    const adminPost = (path, body, headers = {}) => admin.request(path, { method: 'POST', body, headers: { 'CF-Connecting-IP': '198.51.100.91', ...headers } });
    assert.deepEqual(expectStatus(await admin.request('/api/admin/status'), 200), { configured: false });
    expectStatus(await adminPost('/api/admin/setup', { adminPassword }, { Authorization: `Bearer ${randomBytes(32).toString('hex')}` }), 401);
    expectStatus(await adminPost('/api/admin/setup', { adminPassword: 'too short' }, { Authorization: authorization }), 400);
    const setupRace = await Promise.all([adminPost('/api/admin/setup', { adminPassword }, { Authorization: authorization }), adminPost('/api/admin/setup', { adminPassword }, { Authorization: authorization })]);
    assert.deepEqual(setupRace.map(result => result.status).sort(), [201, 409]);
    assert.deepEqual(setupRace.find(result => result.status === 201).data, { configured: true });
    assert.deepEqual(expectStatus(await admin.request('/api/admin/status'), 200), { configured: true });
    expectStatus(await adminPost('/api/admin/setup', { adminPassword: changedPassword }, { Authorization: authorization }), 409);
    const stored = await db.prepare('SELECT * FROM admin_credentials').all();
    assert.equal(stored.results.length, 1);
    assert.match(stored.results[0].password_hash, /^scrypt-v1\$/);
    assert.ok(!JSON.stringify(stored.results).includes(adminPassword));

    const registered = expectStatus(await owner.request('/api/auth/register', { method: 'POST', body: { ...account(email), password: oldPassword } }), 201);
    const oldRecoveryCode = registered.recoveryCode;
    const oldCookie = owner.cookie;
    expectStatus(await secondDevice.request('/api/auth/login', { method: 'POST', body: { email, password: oldPassword } }), 200);
    const progressed = expectStatus(await owner.request('/api/progress', { method: 'POST', body: op('admin-reset-learning', registered.revision) }), 200);
    const before = await db.prepare('SELECT * FROM accounts WHERE id=?').bind(registered.account.id).first();
    const resetBody = { email, newPassword };
    const postReset = (body, headers = {}) => adminPost('/api/admin/password-reset', body, headers);
    expectStatus(await postReset(resetBody, { Authorization: authorization }), 401);
    expectStatus(await postReset({ ...resetBody, adminPassword: 'wrong administrator password' }), 401);
    expectStatus(await postReset({ ...resetBody, adminPassword }, { Origin: 'https://foreign.test' }), 403);
    assert.deepEqual(await db.prepare('SELECT * FROM accounts WHERE id=?').bind(registered.account.id).first(), before);
    const resetResponse = await postReset({ ...resetBody, adminPassword });
    const reset = expectStatus(resetResponse, 200);
    assert.match(reset.recoveryCode, /^[a-f0-9]{64}$/);
    assert.notEqual(reset.recoveryCode, oldRecoveryCode);
    assert.deepEqual(Object.keys(reset), ['recoveryCode']);
    assert.equal(resetResponse.headers.get('set-cookie'), null);
    assert.equal(resetResponse.headers.get('cache-control'), 'no-store');
    assert.equal(resetResponse.headers.get('referrer-policy'), 'no-referrer');
    assert.deepEqual(await session(owner), { authenticated: false });
    assert.deepEqual(await session(secondDevice), { authenticated: false });
    assert.deepEqual(expectStatus(await admin.request('/api/session', { cookie: oldCookie }), 200), { authenticated: false });
    const after = await db.prepare('SELECT * FROM accounts WHERE id=?').bind(registered.account.id).first();
    for (const field of ['id', 'email', 'profile_json', 'learner_json', 'imports_json', 'revision', 'created_at']) assert.deepEqual(after[field], before[field], field);
    assert.notEqual(after.password_hash, before.password_hash);
    assert.notEqual(after.recovery_hash, before.recovery_hash);
    assert.equal((await db.prepare('SELECT count(*) AS count FROM sessions WHERE account_id=?').bind(after.id).first()).count, 0);
    const audit = await db.prepare('SELECT * FROM admin_audit_events WHERE account_id=?').bind(after.id).all();
    assert.equal(audit.results.length, 1);
    assert.equal(audit.results[0].event_type, 'password_reset');
    const auditText = JSON.stringify(audit.results);
    for (const forbidden of [email, adminSecret, adminPassword, oldPassword, newPassword, oldRecoveryCode, reset.recoveryCode]) assert.ok(!auditText.includes(forbidden));
    assert.deepEqual(progressed.learner, JSON.parse(after.learner_json));
    expectStatus(await login.request('/api/auth/login', { method: 'POST', body: { email, password: oldPassword }, headers: { 'CF-Connecting-IP': '198.51.100.92' } }), 401);
    const logged = expectStatus(await login.request('/api/auth/login', { method: 'POST', body: { email, password: newPassword }, headers: { 'CF-Connecting-IP': '198.51.100.92' } }), 200);
    assert.equal(logged.account.id, before.id);
    expectStatus(await adminPost('/api/admin/password-change', { currentPassword: 'wrong administrator password', newPassword: changedPassword }), 401);
    assert.deepEqual(expectStatus(await adminPost('/api/admin/password-change', { currentPassword: adminPassword, newPassword: changedPassword }), 200), { configured: true });
    expectStatus(await postReset({ ...resetBody, adminPassword }), 401);
    expectStatus(await adminPost('/api/admin/password-recover', { newPassword: recoveredPassword }, { Authorization: `Bearer ${randomBytes(32).toString('hex')}` }), 401);
    assert.deepEqual(expectStatus(await adminPost('/api/admin/password-recover', { newPassword: recoveredPassword }, { Authorization: authorization }), 200), { configured: true });
    expectStatus(await postReset({ ...resetBody, adminPassword: changedPassword }), 401);
    expectStatus(await postReset({ ...resetBody, adminPassword: recoveredPassword }), 200);
    expectStatus(await client().request('/api/auth/recover', { method: 'POST', body: { email, recoveryCode: oldRecoveryCode, newPassword: 'should not work' }, headers: { 'CF-Connecting-IP': '198.51.100.93' } }), 401);
  });
  await test('administrator rotation invalidates a reset already verified against the prior hash', async () => {
    // Pause only the reset's D1 batch. Its credential check and new hash are
    // complete; the rotation then commits through the real Worker and D1.
    // Releasing the batch exercises the SQL EXISTS guard without timing sleeps.
    let currentPassword = 'race initial administrator password';
    const actor = client();
    expectStatus(await actor.request('/api/admin/password-recover', { method: 'POST', body: { newPassword: currentPassword }, headers: { Authorization: `Bearer ${adminSecret}`, 'CF-Connecting-IP': '198.51.100.240' } }), 200);
    for (const mode of ['change', 'recover']) {
      const email = `admin-race-${mode}@example.test`;
      const owner = client();
      const registered = expectStatus(await owner.request('/api/auth/register', { method: 'POST', body: account(email) }), 201);
      const before = await db.prepare('SELECT * FROM accounts WHERE id=?').bind(registered.account.id).first();
      const auditBefore = (await db.prepare('SELECT count(*) AS count FROM admin_audit_events WHERE account_id=?').bind(before.id).first()).count;
      let reachedBatch, releaseBatch;
      const reached = new Promise(resolve => { reachedBatch = resolve; });
      const release = new Promise(resolve => { releaseBatch = resolve; });
      const gatedDb = {
        prepare: sql => db.prepare(sql),
        batch: async statements => { reachedBatch(); await release; return db.batch(statements); },
      };
      const request = new Request(`${origin}/api/admin/password-reset`, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': mode === 'change' ? '198.51.100.241' : '198.51.100.242' },
        body: JSON.stringify({ email, newPassword: 'late account reset password', adminPassword: currentPassword }),
      });
      const pendingReset = api(request, { DB: gatedDb });
      await Promise.race([reached, pendingReset.then(() => { throw new Error('Reset completed before D1 batch gate.'); })]);
      const nextPassword = `race ${mode} administrator password`;
      try {
        const rotation = mode === 'change'
          ? await actor.request('/api/admin/password-change', { method: 'POST', body: { currentPassword, newPassword: nextPassword }, headers: { 'CF-Connecting-IP': '198.51.100.243' } })
          : await actor.request('/api/admin/password-recover', { method: 'POST', body: { newPassword: nextPassword }, headers: { Authorization: `Bearer ${adminSecret}`, 'CF-Connecting-IP': '198.51.100.244' } });
        expectStatus(rotation, 200);
      } finally { releaseBatch(); }
      await assert.rejects(pendingReset, error => error?.status === 401 && error?.code === 'AUTH_REQUIRED');
      assert.deepEqual(await db.prepare('SELECT * FROM accounts WHERE id=?').bind(before.id).first(), before);
      assert.equal((await db.prepare('SELECT count(*) AS count FROM sessions WHERE account_id=?').bind(before.id).first()).count, 1);
      assert.equal((await db.prepare('SELECT count(*) AS count FROM admin_audit_events WHERE account_id=?').bind(before.id).first()).count, auditBefore);
      assert.equal((await session(owner)).account.id, before.id);
      currentPassword = nextPassword;
    }
  });
  await test('administrator authentication is IP throttled before password hashing', async () => {
    const actor = client();
    let limited = false;
    for (let i = 0; i < 15; i++) {
      const result = await actor.request('/api/admin/password-change', { method: 'POST', body: { currentPassword: 'wrong administrator password', newPassword: 'another administrator password' }, headers: { 'CF-Connecting-IP': '198.51.100.211' } });
      assert.ok([401, 429].includes(result.status), JSON.stringify(result.data));
      if (result.status === 429) { limited = true; break; }
    }
    assert.equal(limited, true);
  });
  await test('authentication attempts are rate limited without leaking account state', async () => {
    let limited = false;
    for (let i = 0; i < 25; i++) {
      const result = await anonymous.request('/api/auth/login', { method: 'POST', body: { email: 'absent@example.test', password: 'incorrect password 123' } });
      assert.ok([401, 429].includes(result.status), JSON.stringify(result.data));
      if (result.status === 429) { limited = true; assert.equal(result.data.account, undefined); break; }
    }
    assert.ok(limited, 'auth limit should trigger within 25 attempts');
  });
} finally {
  await workerWithoutAdminSecret?.dispose();
  await worker?.dispose();
  await rm(temporary, { recursive: true, force: true });
}
console.log(`${passes} passed; ${failures} failed`);
if (failures) process.exitCode = 1;
