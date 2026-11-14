import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSpeechController, speechAvailability, recognitionError, selectVoice, inAppBrowserGuide, copyPageUrl } from '../src/speech.js';

function fixture(extra = {}) {
  const instances = [], spoken = [], listeners = new Map();
  class Recognition {
    constructor() { instances.push(this); }
    start() { this.started = true; }
    stop() { this.stopped = true; }
    abort() { this.aborted = true; }
  }
  const voices = [{ name: 'Samantha', lang: 'en-US' }, { name: 'Kyoko', lang: 'ja-JP' }];
  const host = { isSecureContext: true, SpeechRecognition: Recognition, SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } }, speechSynthesis: {
    getVoices: () => voices, cancel() {}, resume() {}, speak(utterance) { spoken.push(utterance); },
    addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); },
  }, ...extra };
  return { host, instances, spoken, listeners, voices, controller: createSpeechController(host) };
}
function callbacks() {
  const statuses = [], listening = [], transcripts = [];
  return { statuses, listening, transcripts, options: { locale: 'en-US', onStatus: s => statuses.push(s), onListening: s => listening.push(s), onTranscript: s => transcripts.push(s) } };
}

test('secure context, microphone policy and unavailable ASR explain actionable alternatives without a transcript', () => {
  for (const host of [{ isSecureContext: false }, { document: { permissionsPolicy: { allowsFeature: () => false } } }, {}]) {
    const c = callbacks();
    const controller = createSpeechController(host);
    assert.ok(speechAvailability(host));
    controller.startRecognition(c.options);
    assert.deepEqual(c.transcripts, []);
    assert.deepEqual(c.listening, [false]);
    assert.match(c.statuses.at(-1), /입력/);
    controller.dispose();
  }
});

test('recognition starts synchronously, uses selected locale, ignores interim/empty results and never awards a score', () => {
  const f = fixture(), c = callbacks();
  try {
    f.controller.startRecognition(c.options);
    const r = f.instances[0];
    assert.equal(r.started, true); assert.equal(r.lang, 'en-US'); assert.equal(r.interimResults, false);
    r.onstart(); assert.equal(c.listening.at(-1), true);
    r.onresult({ results: [Object.assign([{ transcript: 'interim' }], { isFinal: false })] });
    r.onresult({ results: [[{ transcript: '  ' }]] });
    assert.deepEqual(c.transcripts, []);
    r.onresult({ results: [Object.assign([{ transcript: '  Time to get up.  ' }], { isFinal: true })] });
    assert.deepEqual(c.transcripts, ['Time to get up.']);
    assert.match(c.statuses.at(-1), /발음 점수는 제공하지 않아요/);
    r.onend(); assert.equal(c.listening.at(-1), false); assert.equal(r.aborted, true);
  } finally { f.controller.dispose(); }
});

test('duplicate microphone clicks do not create competing recognizers; stop asks browser to finalize', () => {
  const f = fixture(), c = callbacks();
  try {
    f.controller.startRecognition(c.options); f.controller.startRecognition(c.options);
    assert.equal(f.instances.length, 1);
    f.controller.finishRecognition(); assert.equal(f.instances[0].stopped, true);
    f.instances[0].onend(); assert.match(c.statuses.at(-1), /인식된 문장이 없어요/);
    f.controller.startRecognition({ ...c.options, locale: 'ja-JP' }); assert.equal(f.instances[1].lang, 'ja-JP');
  } finally { f.controller.dispose(); }
});

test('denied microphone, capture failure and service errors persist after end and produce no transcript', () => {
  for (const code of ['not-allowed', 'service-not-allowed', 'audio-capture', 'no-speech', 'network', 'language-not-supported', 'aborted', 'unknown']) {
    const f = fixture(), c = callbacks();
    try {
      f.controller.startRecognition(c.options);
      const end = f.instances[0].onend;
      f.instances[0].onerror({ error: code }); end();
      assert.equal(c.statuses.at(-1), recognitionError(code)); assert.equal(c.listening.at(-1), false);
      assert.deepEqual(c.transcripts, []);
    } finally { f.controller.dispose(); }
  }
});

test('synchronous permission exceptions release recognizer and permit retry', () => {
  const f = fixture(), c = callbacks();
  f.host.SpeechRecognition.prototype.start = function () { throw Object.assign(new Error(), { name: 'NotAllowedError' }); };
  try {
    f.controller.startRecognition(c.options); f.controller.startRecognition(c.options);
    assert.equal(f.instances.length, 2); assert.ok(f.instances.every(r => r.aborted));
    assert.equal(c.statuses.at(-1), recognitionError('not-allowed'));
  } finally { f.controller.dispose(); }
});

test('dispose detaches browser callbacks so stale recognition cannot update the next sentence', () => {
  const f = fixture(), c = callbacks();
  f.controller.startRecognition(c.options); const r = f.instances[0], stale = r.onresult;
  f.controller.dispose();
  assert.equal(r.onresult, null); assert.equal(r.aborted, true);
  stale({ results: [[{ transcript: 'stale words' }]] }); assert.deepEqual(c.transcripts, []);
});

test('voice selection prefers exact locale and natural voices while never crossing languages', () => {
  const voices = [{ name: 'Default', lang: 'en-US' }, { name: 'Microsoft Natural', lang: 'en-GB' }, { name: 'Ava Enhanced', lang: 'en-US' }, { name: 'Kyoko', lang: 'ja-JP' }];
  assert.equal(selectVoice(voices, 'en-US'), voices[2]);
  assert.equal(selectVoice(voices, 'ja-JP'), voices[3]);
  assert.equal(selectVoice(voices, 'fr-FR'), undefined);
});

test('playback uses native locale, natural normal rate and separate slow rate, then reports completion', async () => {
  const f = fixture(), statuses = [];
  try {
    await f.controller.speak({ text: 'Time to get up.', locale: 'en-US', onStatus: s => statuses.push(s) });
    const normal = f.spoken[0]; assert.equal(normal.voice, f.voices[0]); assert.equal(normal.rate, 1); assert.equal(normal.lang, 'en-US');
    normal.onend(); assert.match(statuses.at(-1), /재생이 끝났어요/);
    await f.controller.speak({ text: 'おはよう。', locale: 'ja-JP', slow: true });
    assert.equal(f.spoken[1].voice, f.voices[1]); assert.equal(f.spoken[1].rate, 0.78);
  } finally { f.controller.dispose(); }
});

test('playback errors explain autoplay limits; stale playback callbacks are detached', async () => {
  const f = fixture(), statuses = [];
  try {
    await f.controller.speak({ text: 'Hello', locale: 'en-US', onStatus: s => statuses.push(s) });
    f.spoken[0].onerror({ error: 'not-allowed' }); assert.match(statuses.at(-1), /자동 재생/);
    await f.controller.speak({ text: 'Again', locale: 'en-US' });
    f.controller.stopPlayback(); assert.equal(f.spoken[1].onend, null); assert.equal(f.spoken[1].onerror, null);
  } finally { f.controller.dispose(); }
});

test('empty initial voice list speaks synchronously, refreshes voice on next tap, and removes listener on dispose', () => {
  const f = fixture(); let available = []; f.host.speechSynthesis.getVoices = () => available;
  f.controller.speak({ text: 'First sentence', locale: 'en-US' });
  assert.equal(f.spoken.length, 1); assert.equal(f.spoken[0].voice, undefined);
  available = f.voices; f.listeners.get('voiceschanged')();
  f.controller.speak({ text: 'Next sentence', locale: 'en-US' });
  assert.equal(f.spoken[1].voice, f.voices[0]);
  f.controller.dispose(); assert.equal(f.listeners.size, 0);
});

test('iPhone Kakao guide prevents recognition construction while Safari remains available', () => {
  const f = fixture({ navigator: { userAgent: 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 KAKAOTALK 26.1' } }), c = callbacks();
  assert.match(inAppBrowserGuide(f.host), /Safari/);
  f.controller.startRecognition(c.options); assert.equal(f.instances.length, 0); assert.deepEqual(c.transcripts, []);
  assert.match(c.statuses.at(-1), /주소를 복사/);
  f.host.navigator.userAgent = 'Mozilla/5.0 (iPhone) Version/18.0 Mobile Safari/604.1';
  assert.equal(speechAvailability(f.host), '');
  f.controller.dispose();
});

test('copy URL reports successful clipboard write and graceful manual fallback', async () => {
  let copied;
  assert.equal(await copyPageUrl({ location: { href: 'https://brainwork.test/' }, navigator: { clipboard: { async writeText(value) { copied = value; } } } }), true);
  assert.equal(copied, 'https://brainwork.test/');
  assert.equal(await copyPageUrl({ navigator: {} }), false);
  assert.equal(await copyPageUrl({ location: { href: 'https://brainwork.test/' }, navigator: { clipboard: { async writeText() { throw new Error('denied'); } } } }), false);
});
