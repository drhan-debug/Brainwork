// Exercises the real build artifact with the host-provided ASSETS binding that
// previously hid the embedded frontend. Run through npm run test:static.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import builtWorker from '../dist/server/index.js';
import sourceWorker from '../server/index.js';

const dist = new URL('../dist/', import.meta.url);
const html = await readFile(new URL('index.html', dist), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(match => match[1]);
const styles = [...html.matchAll(/<link\b[^>]*\bhref=["']([^"']+\.css)["']/gi)].map(match => match[1]);
assert.ok(scripts.some(path => path.startsWith('/assets/')), 'Build must include a generated script asset');
assert.ok(styles.some(path => path.startsWith('/assets/')), 'Build must include a generated stylesheet');
function host() {
  const calls = [];
  return { calls, env: { ASSETS: { async fetch(request) { calls.push(new URL(request.url).pathname); return new Response('host fallback', { status: 404 }); } } } };
}
function request(path, method = 'GET') { return new Request(`https://bloom.test${path}`, { method }); }

test('built root serves the actual Vite HTML despite injected ASSETS returning 404', async () => {
  const { env, calls } = host();
  const response = await builtWorker.fetch(request('/'), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/html/);
  assert.equal(await response.text(), html);
  assert.deepEqual(calls, []);
});

test('built hashed scripts and styles serve exact packaged bytes before injected ASSETS', async () => {
  const { env, calls } = host();
  for (const path of [...scripts, ...styles]) {
    const response = await builtWorker.fetch(request(path), env);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type'), path.endsWith('.css') ? /^text\/css/ : /^text\/javascript/);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(new URL(path.slice(1), dist)));
  }
  assert.deepEqual(calls, []);
});

test('built HEAD serves HTML metadata without a body or host fallback', async () => {
  const { env, calls } = host();
  const response = await builtWorker.fetch(request('/', 'HEAD'), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/html/);
  assert.equal(await response.text(), '');
  assert.deepEqual(calls, []);
});

test('built application deep links serve the packaged HTML', async () => {
  const { env, calls } = host();
  const response = await builtWorker.fetch(request('/learning/review'), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), html);
  assert.deepEqual(calls, []);
});

test('built static routes reject mutations without delegating to host assets', async () => {
  const { env, calls } = host();
  const response = await builtWorker.fetch(request('/', 'POST'), env);
  assert.equal(response.status, 405);
  assert.deepEqual(calls, []);
});

test('missing file uses injected host fallback', async () => {
  const { env, calls } = host();
  const response = await builtWorker.fetch(request('/missing-file.xyz'), env);
  assert.equal(response.status, 404);
  assert.equal(await response.text(), 'host fallback');
  assert.deepEqual(calls, ['/missing-file.xyz']);
});

test('missing file without host binding returns application 404', async () => {
  const response = await builtWorker.fetch(request('/missing-file.xyz'), {});
  assert.equal(response.status, 404);
  assert.equal(await response.text(), 'Not found');
});

test('unbundled local worker continues delegating frontend requests to ASSETS', async () => {
  const { env, calls } = host();
  const response = await sourceWorker.fetch(request('/'), env);
  assert.equal(response.status, 404);
  assert.equal(await response.text(), 'host fallback');
  assert.deepEqual(calls, ['/']);
});

test('API session retains precedence over embedded SPA and host assets', async () => {
  const { env, calls } = host();
  env.DB = { prepare() { throw new Error('Anonymous session must not query the database'); } };
  const response = await builtWorker.fetch(request('/api/session'), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: false });
  assert.deepEqual(calls, []);
});
