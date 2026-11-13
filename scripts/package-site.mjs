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
const archivePath = resolve(process.argv[2] || resolve(root, 'outputs/bloom-deploy.tar.gz'));
await mkdir(dirname(archivePath), { recursive: true });
// Sites resolves Worker entrypoints relative to the archive root.
const result = spawnSync('tar', ['-czf', archivePath, '-C', root, '.openai/hosting.json', 'dist'], { stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
console.log(JSON.stringify({ project_id: manifest.project_id, archive: archivePath }));
