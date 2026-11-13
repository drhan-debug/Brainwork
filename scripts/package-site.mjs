import { mkdir, readFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, '.openai/hosting.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (!manifest.project_id || manifest.static) throw new Error('Expected a registered Worker Site manifest.');
const workerPath = resolve(root, 'dist/server/index.js');
await stat(workerPath);
const worker = await import(pathToFileURL(workerPath));
if (typeof worker.default?.fetch !== 'function') throw new Error('Worker must default-export fetch.');
// Include the generated schema migrations and journal at archive root.
const journal = JSON.parse(await readFile(resolve(root, 'drizzle/meta/_journal.json'), 'utf8'));
if (!Array.isArray(journal.entries) || !journal.entries.length) throw new Error('Expected generated D1 migration metadata.');
for (const entry of journal.entries) {
  if (typeof entry.tag !== 'string' || !/^[\w-]+$/.test(entry.tag)) throw new Error('Invalid D1 migration tag.');
  await stat(resolve(root, 'drizzle', `${entry.tag}.sql`));
}
const archivePath = resolve(process.argv[2] || resolve(root, 'outputs/bloom-deploy.tar.gz'));
await mkdir(dirname(archivePath), { recursive: true });
// Sites resolves Worker entrypoints relative to the archive root.
const result = spawnSync('tar', ['-czf', archivePath, '-C', root, '.openai/hosting.json', 'dist', 'drizzle'], { stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
console.log(JSON.stringify({ project_id: manifest.project_id, archive: archivePath }));
