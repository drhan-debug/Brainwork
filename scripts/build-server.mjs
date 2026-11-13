import { build } from 'esbuild';
import { readdir, readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd(),dist=path.join(root,'dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.json':'application/json; charset=utf-8','.woff2':'font/woff2'};
const assets={};
async function collect(directory,prefix='') {
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    if(entry.name==='server'||entry.name==='migrations'||entry.name.startsWith('.'))continue;
    const relative=prefix+'/'+entry.name,absolute=path.join(directory,entry.name);
    if(entry.isDirectory())await collect(absolute,relative);
    else assets[relative]={type:types[path.extname(entry.name)]||'application/octet-stream',body:(await readFile(absolute)).toString('base64')};
  }
}
await collect(dist);
await mkdir(path.join(dist,'server'),{recursive:true});
await build({entryPoints:[path.join(root,'server/index.js')],outfile:path.join(dist,'server/index.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,define:{__BLOOM_ASSETS__:JSON.stringify(assets)},legalComments:'inline'});
await cp(path.join(root,'migrations'),path.join(dist,'migrations'),{recursive:true});
await writeFile(path.join(dist,'server/wrangler.json'),JSON.stringify({name:'bloom-english',main:'index.js',compatibility_date:'2026-11-13',limits:{cpu_ms:30000},d1_databases:[{binding:'DB',database_name:'bloom-accounts',migrations_dir:'../migrations'}]},null,2)+'\n');
console.log(`Bundled account Worker with ${Object.keys(assets).length} frontend assets and D1 migrations.`);
