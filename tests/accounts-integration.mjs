// Real Workers runtime + D1 integration. Does not start the application preview.
// Run after npm ci in the checkout: node tests/accounts-integration.mjs
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { applyProgress, blankLearner } from '../server/domain.js';
import { sentenceIdsForLanguage } from '../src/learning/schema.js';

const root = new URL('..', import.meta.url).pathname;
const temporary = await mkdtemp(join(tmpdir(), 'brainwork-accounts-test-'));
let worker;
let failures = 0;
let passes = 0;
async function test(name, fn) {
  try { await fn(); passes++; console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}\n${error.stack}`); }
}
const origin = 'https://brainwork.test';
function client() {
  let cookie = '';
  let expectedAccountId;
  return {
    get cookie() { return cookie; },
    async request(path, { method = 'GET', body, headers = {}, cookie: override } = {}) {
      const response = await worker.dispatchFetch(`${origin}${path}`, {
        method,
        headers: { ...(method === 'GET' ? {} : { Origin: origin, 'Content-Type': 'application/json' }), ...(override ?? cookie ? { Cookie: override ?? cookie } : {}), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(expectedAccountId && ['/api/profile', '/api/progress', '/api/import', '/api/auth/logout'].includes(path) ? { expectedAccountId, ...body } : body) }),
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
  worker = new Miniflare(convertV4MiniflareOptions({ modules: true, modulesRoot: temporary, scriptPath: join(temporary, 'worker.mjs'), compatibilityDate: '2026-11-01', d1Databases: ['DB'] }));
  const db = await worker.getD1Database('DB');
  const schema = await readFile(join(root, 'migrations/0001_accounts.sql'), 'utf8');
  for (const statement of schema.split(';').map(s => s.trim()).filter(Boolean)) await db.prepare(statement).run();

  const a = client(), b = client(), anonymous = client();
  const password = 'correct horse battery staple';
  const account = (email, language = 'en') => ({ email, password, name: email.split('@')[0], language, timezone: 'America/New_York', goal: 15 });
  const expectStatus = (response, status) => { assert.equal(response.status, status, JSON.stringify(response.data)); return response.data; };
  const session = async actor => expectStatus(await actor.request('/api/session'), 200);
  const op = (number, revision, extra = {}) => ({ operationId: `integration-operation-${number}`, revision, type: 'dialogueSession', elapsedMs: 90000, ...extra });
  let initialA, initialB, recoveryCode;
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
  await worker?.dispose();
  await rm(temporary, { recursive: true, force: true });
}
console.log(`${passes} passed; ${failures} failed`);
if (failures) process.exitCode = 1;
