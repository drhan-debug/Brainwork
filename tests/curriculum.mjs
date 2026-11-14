import assert from 'node:assert/strict';
import { test } from 'node:test';
import { englishScenarios, englishReviewScenarios } from '../src/content/scenarios.en.js';
import { japaneseScenarios } from '../src/content/scenarios.ja.js';
import { validateCurriculum, sentenceIdsForLanguage, isKnownSentenceId, makeSentenceId, getSentence, getNextSentence } from '../src/learning/schema.js';
import { applyProgress, blankLearner, importLearner } from '../server/domain.js';
import { getDueSentenceIds } from '../src/learning/schedule.js';

test('active maternal curriculum has twenty five-sentence days and valid Korean cues/target speech', () => {
  assert.deepEqual(validateCurriculum(englishScenarios, 'en'), { valid: true, errors: [] });
  assert.equal(englishScenarios.length, 20);
  const ids = englishScenarios.flatMap(s => s.sentences.map(sentence => sentence.id));
  assert.equal(ids.length, 100); assert.equal(new Set(ids).size, 100);
  for (const scenario of englishScenarios) {
    assert.match(scenario.id, /^mom_v1_/); assert.equal(scenario.sentences.length, 5);
    for (const sentence of scenario.sentences) {
      assert.match(sentence.meaningKo, /[가-힣]/u); assert.match(sentence.cueKo, /[가-힣]/u);
      assert.equal(sentence.audioText, sentence.text);
    }
  }
  assert.equal(getNextSentence(englishScenarios, ids[4]).id, ids[5]);
});

test('permanent registry preserves eighty legacy English IDs and eighty Japanese IDs beside new English IDs', () => {
  assert.equal(sentenceIdsForLanguage('en').length, 180); assert.equal(sentenceIdsForLanguage('ja').length, 80);
  assert.equal(englishReviewScenarios.length, 40);
  const reviewIds = englishReviewScenarios.flatMap(s => s.sentences.map(sentence => sentence.id));
  assert.deepEqual([...reviewIds].sort(), [...sentenceIdsForLanguage('en')].sort());
  assert.deepEqual(validateCurriculum(japaneseScenarios, 'ja'), { valid: true, errors: [] });
  assert.equal(getSentence(englishReviewScenarios, 'en:cafe_order:1').text, 'Can I have a small latte?');
  assert.equal(makeSentenceId('en', englishScenarios[0].id, 5), englishScenarios[0].sentences[4].id);
  assert.throws(() => makeSentenceId('ja', englishScenarios[0].id, 1));
  assert.throws(() => makeSentenceId('en', 'cafe_order', 5));
  for (const id of ['en:cafe_order:5', 'en:mom_v1_morning_start:6', 'en:mom_v2_unknown:1', 'ja:mom_v1_morning_start:1', 'en:cafe_order:01']) assert.equal(isKnownSentenceId(id, id.split(':')[0]), false, id);
});

test('full English import capacity preserves all old and new progress and schedules both for review', () => {
  const profile = { name: 'Mom', language: 'en', goal: 10, timezone: 'Asia/Seoul' };
  const input = blankLearner(profile);
  for (const id of sentenceIdsForLanguage('en')) input.sentenceProgress[id] = { stage: 1, dueAt: 1000, lastReviewedAt: 500, lastOutcome: 'passed' };
  const imported = importLearner(input, profile);
  assert.deepEqual(imported.sentenceProgress, input.sentenceProgress);
  const due = getDueSentenceIds(imported.sentenceProgress, 2000, englishReviewScenarios.flatMap(s => s.sentences.map(x => x.id)));
  assert.equal(due.length, 180);
  const progressed = applyProgress(imported, { type: 'sentenceSession', elapsedMs: 30000, results: [{ sentenceId: 'en:cafe_order:1', passed: true }, { sentenceId: englishScenarios[0].sentences[4].id, passed: true }] }, profile, 2000);
  assert.equal(Object.keys(progressed.sentenceProgress).length, 180);
  assert.equal(progressed.sentenceProgress['en:cafe_order:1'].stage, 2);
  assert.equal(progressed.sentenceProgress[englishScenarios[0].sentences[4].id].stage, 2);
  assert.equal(input.sentenceProgress['en:cafe_order:1'].stage, 1);
});

test('Japanese import/progress rejects maternal English IDs and preserves existing Japanese review', () => {
  const profile = { name: 'Learner', language: 'ja', goal: 10, timezone: 'Asia/Seoul' };
  const input = blankLearner(profile);
  for (const id of sentenceIdsForLanguage('ja')) input.sentenceProgress[id] = { stage: 1, dueAt: 1000, lastReviewedAt: 500, lastOutcome: 'passed' };
  assert.equal(Object.keys(importLearner(input, profile).sentenceProgress).length, 80);
  assert.equal(getDueSentenceIds(input.sentenceProgress, 2000, sentenceIdsForLanguage('ja')).length, 80);
  const foreign = englishScenarios[0].sentences[0].id;
  assert.throws(() => importLearner({ ...input, sentenceProgress: { [foreign]: input.sentenceProgress['ja:cafe_order:1'] } }, profile));
  assert.throws(() => applyProgress(input, { type: 'sentenceSession', elapsedMs: 1000, results: [{ sentenceId: foreign, passed: true }] }, profile));
});
