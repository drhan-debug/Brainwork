import test from 'node:test';
import assert from 'node:assert/strict';
import {englishScenarios} from '../src/content/scenarios.en.js';
import {japaneseScenarios} from '../src/content/scenarios.ja.js';
import {spanishScenarios,italianScenarios} from '../src/content/scenarios.romance.js';
import {validateCurriculum,SCENARIO_IDS} from '../src/learning/schema.js';
import {learningPath,LEVELS,isScenarioComplete,LANGUAGES} from '../src/learning/path.js';
import {compareSentence} from '../src/learning/compare.js';
import {applyProgress,blankLearner,profileInput} from '../server/domain.js';
const curricula={en:englishScenarios,ja:japaneseScenarios,es:spanishScenarios,it:italianScenarios};
for(const [lang,scenarios] of Object.entries(curricula)){
 test(`${lang}: thirty aligned situations, 120 unique valid sentences, correct answer accepted`,()=>{
  assert.deepEqual(validateCurriculum(scenarios,lang),{valid:true,errors:[]});
  assert.deepEqual(scenarios.map(s=>s.id),SCENARIO_IDS);assert.equal(scenarios.length,30);
  const sentences=scenarios.flatMap(s=>s.sentences);assert.equal(new Set(sentences.map(s=>s.id)).size,120);
  for(const sentence of sentences){assert.ok(compareSentence({input:sentence.text,sentence,locale:LANGUAGES[lang].locale}).matched);if(lang==='ja')assert.ok(compareSentence({input:sentence.kana,sentence,locale:'ja-JP'}).matched);}
 });
 test(`${lang}: learning path starts easy, progresses, and revisits failed situations`,()=>{
  const empty=learningPath(scenarios);assert.equal(empty.next.id,'meeting_intro');assert.equal(empty.total,30);assert.equal(empty.completed,0);
  assert.deepEqual(empty.ordered.map(s=>s.id),LEVELS.flatMap(l=>l.ids));
  const progress=Object.fromEntries(empty.ordered.slice(0,10).flatMap(s=>s.sentences).map(s=>[s.id,{stage:1,lastOutcome:'passed'}]));
  const next=learningPath(scenarios,progress);assert.equal(next.completed,10);assert.equal(next.next.id,LEVELS[1].ids[0]);
  progress[empty.ordered[0].sentences[0].id]={stage:0,lastOutcome:'failed'};
  assert.equal(learningPath(scenarios,progress).next.id,'meeting_intro');assert.equal(isScenarioComplete(empty.ordered[0],progress),false);
 });
 test(`${lang}: account validator and server accept new situations and isolate languages`,()=>{
  const profile=profileInput({name:'Learner',language:lang,timezone:'Asia/Seoul'}),id=`${lang}:sharing_opinions:1`;
  const result=applyProgress(blankLearner(profile),{type:'sentenceSession',elapsedMs:60000,results:[{sentenceId:id,passed:true}]},profile);
  assert.equal(result.sentenceProgress[id].stage,1);assert.equal(result.sessions,1);
  assert.throws(()=>applyProgress(result,{type:'sentenceSession',elapsedMs:60000,results:[{sentenceId:`${lang==='es'?'it':'es'}:sharing_opinions:1`,passed:true}]},profile),e=>e.code==='INVALID_RESULTS');
 });
}
test('levels cover every stable situation once and retain original IDs',()=>{
 const ids=LEVELS.flatMap(l=>l.ids);assert.equal(new Set(ids).size,30);assert.deepEqual([...ids].sort(),[...SCENARIO_IDS].sort());
 assert.equal(englishScenarios[0].sentences[0].id,'en:cafe_order:1');assert.equal(japaneseScenarios[19].sentences[3].id,'ja:asking_help:4');
});
