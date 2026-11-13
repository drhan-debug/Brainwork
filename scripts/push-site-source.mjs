// Fallback for environments without the Sites source-workflow helper.
// Credential JSON is accepted through hidden stdin only; it is never persisted.
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let echoHidden = false;
function restoreEcho() {
  if (echoHidden) {
    spawnSync('stty', ['echo'], { stdio: ['inherit', 'ignore', 'ignore'] });
    echoHidden = false;
  }
}
process.on('exit', restoreEcho);
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => { restoreEcho(); process.exit(1); });
}
function git(args, env = process.env) {
  const result = spawnSync('git', args, {
    cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000, maxBuffer: 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    // Git output can contain an authentication header in diagnostic modes.
    throw new Error(`Git ${args[0]} failed (status ${result.status ?? 'unavailable'}).`);
  }
  return result.stdout.trim();
}

try {
  if (process.stdin.isTTY) {
    const hidden = spawnSync('stty', ['-echo'], { stdio: ['inherit', 'ignore', 'ignore'] });
    if (hidden.status !== 0) throw new Error('Could not hide credential input.');
    echoHidden = true;
  }
  console.log('Ready for Site credential JSON on stdin (input is hidden).');
  const line = await new Promise((resolveLine, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      input += chunk;
      if (input.length > 64 * 1024) reject(new Error('Credential input is too large.'));
      const end = input.indexOf('\n');
      if (end !== -1) { process.stdin.pause(); resolveLine(input.slice(0, end)); }
    });
    process.stdin.on('end', () => reject(new Error('Expected one newline-terminated JSON object.')));
    process.stdin.on('error', () => reject(new Error('Could not read credential input.')));
  });
  restoreEcho();
  let credential;
  try { credential = JSON.parse(line); } catch { throw new Error('Invalid credential JSON.'); }
  const manifest = JSON.parse(await readFile(resolve(root, '.openai/hosting.json'), 'utf8'));
  let remote;
  try { remote = new URL(credential.remote_url); } catch { throw new Error('Invalid source remote.'); }
  if (remote.protocol !== 'https:' || remote.hostname !== 'git.chatgpt-team.site' ||
      remote.port || remote.username || remote.password || remote.search || remote.hash ||
      !remote.pathname.endsWith(`/${manifest.project_id}.git`)) {
    throw new Error('Source remote does not match this Site.');
  }
  if (typeof credential.branch !== 'string' || !credential.branch || credential.branch.startsWith('-')) {
    throw new Error('Invalid source branch.');
  }
  git(['check-ref-format', `refs/heads/${credential.branch}`]);
  if (git(['status', '--porcelain']).length) throw new Error('Commit all source changes before pushing.');
  const commitSha = git(['rev-parse', 'HEAD']);
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  // Prevent inherited tracing from writing secret HTTP headers.
  for (const key of Object.keys(env)) if (key.startsWith('GIT_TRACE') || key === 'GIT_CURL_VERBOSE' || key.startsWith('GIT_CONFIG_')) delete env[key];
  if (credential.auth_mode === 'http_extra_header') {
    if (typeof credential.token !== 'string' || !credential.token || /[\r\n\0]/.test(credential.token)) {
      throw new Error('Missing or invalid source credential.');
    }
    Object.assign(env, {
      GIT_CONFIG_COUNT: '2',
      GIT_CONFIG_KEY_0: 'http.extraHeader', GIT_CONFIG_VALUE_0: '',
      GIT_CONFIG_KEY_1: `http.${remote.href}.extraHeader`,
      GIT_CONFIG_VALUE_1: `Authorization: Bearer ${credential.token}`,
    });
  } else if (credential.auth_mode !== 'work_proxy') {
    throw new Error('Unsupported source authentication mode.');
  }
  git(['push', '--porcelain', remote.href, `${commitSha}:refs/heads/${credential.branch}`], env);
  const pushed = git(['ls-remote', remote.href, `refs/heads/${credential.branch}`], env).split(/\s+/)[0];
  if (pushed !== commitSha) throw new Error('Remote source verification failed.');
  console.log(JSON.stringify({ project_id: manifest.project_id, commit_sha: commitSha, branch: credential.branch, pushed: true }));
} catch (error) {
  restoreEcho();
  console.error(error.message);
  process.exitCode = 1;
}
