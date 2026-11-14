// Server-render actual React components to catch account/language integration
// errors without claiming browser interaction or speech-device coverage.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const root=new URL('..',import.meta.url).pathname;
const temporary=await mkdtemp(join(tmpdir(),'bloom-ui-render-'));
const source=await readFile(join(root,'src/main.jsx'),'utf8');
try{
 await build({stdin:{contents:source.slice(0,source.lastIndexOf('createRoot(document'))+`
 import {renderToStaticMarkup} from 'react-dom/server';
 export function renderLanguage(language){
  const account={account:{id:'test-account',email:'test@example.com'},profile:{name:'Test',language,goal:10,timezone:'Asia/Seoul'},learner:blank('Test'),revision:0,imports:[]};
  return renderToStaticMarkup(<App account={account} onLogout={()=>{}} onAccountChanged={()=>{}}/>);
 }
 export function renderFeedback(){return renderToStaticMarkup(<Feedback account={{account:{id:'test-account'}}} lang="es" scenarios={curricula.es} page="피드백"/>);}
 `,resolveDir:join(root,'src'),loader:'jsx'},outfile:join(temporary,'render.mjs'),bundle:true,platform:'node',format:'esm',banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"},loader:{'.css':'empty'}});
 const {renderLanguage,renderFeedback}=await import(pathToFileURL(join(temporary,'render.mjs')).href);
 for(const [lang,label] of [['en','영어'],['ja','일본어'],['es','스페인어'],['it','이탈리아어']])await test(`${label} account renders three levels and beginner recommendations`,()=>{
  const html=renderLanguage(lang);assert.ok(html.includes(label));assert.ok(html.includes('30가지 상황'));assert.ok(html.includes('120문장'));assert.ok(html.includes('다음 추천'));assert.ok(html.includes('1단계 · 입문'));assert.ok(html.includes('2단계 · 기초'));assert.ok(html.includes('3단계 · 응용'));
  assert.equal((html.match(/class="sentence-scene"/g)||[]).length,10);
  assert.equal(html.includes('기존 단어 코스와 짧은 대화'),['en','ja'].includes(lang));
 });
 await test('feedback form and own-history render without exposing operator controls by default',()=>{const html=renderFeedback();assert.ok(html.includes('피드백 보내기'));assert.ok(html.includes('내가 보낸 피드백'));assert.ok(!html.includes('전체 피드백 확인'));});
}finally{await rm(temporary,{recursive:true,force:true});}
