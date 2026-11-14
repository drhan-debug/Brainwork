/** Shared, presentation-independent contract for the sentence-first curriculum. */
export const SUPPORTED_LANGUAGES = Object.freeze(['en', 'ja']);
export const SENTENCES_PER_SCENARIO = 4;
export const SCENARIO_IDS = Object.freeze([
  'cafe_order', 'restaurant_order', 'grocery_store', 'convenience_store',
  'bakery', 'pharmacy', 'doctor_visit', 'directions', 'train_station',
  'airport_checkin', 'hotel_checkin', 'taxi_ride', 'shopping_size',
  'return_exchange', 'meeting_intro', 'hobbies', 'family_plans',
  'work_schedule', 'weather_plans', 'asking_help',
]);
// IDs are permanent: the maternal catalog never reuses a legacy English ID.
export const EN_MATERNAL_SCENARIO_IDS = Object.freeze([
  'mom_v1_morning_start', 'mom_v1_get_dressed', 'mom_v1_breakfast',
  'mom_v1_brushing_teeth', 'mom_v1_preschool_dropoff', 'mom_v1_preschool_pickup',
  'mom_v1_talking_teacher', 'mom_v1_playground_turns', 'mom_v1_playground_safety',
  'mom_v1_playdate_arranging', 'mom_v1_playdate_welcome', 'mom_v1_toy_conflict',
  'mom_v1_big_feelings', 'mom_v1_tidying_up', 'mom_v1_meal_out',
  'mom_v1_shopping_together', 'mom_v1_road_safety', 'mom_v1_bath_time',
  'mom_v1_bedtime', 'mom_v1_doctor_allergy',
]);
export function scenarioSentenceCount(lang, scenarioId) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) return 0;
  if (SCENARIO_IDS.includes(scenarioId)) return SENTENCES_PER_SCENARIO;
  return lang === 'en' && EN_MATERNAL_SCENARIO_IDS.includes(scenarioId) ? 5 : 0;
}
export function sentenceIdsForLanguage(lang) {
  const scenarios = lang === 'en' ? [...EN_MATERNAL_SCENARIO_IDS, ...SCENARIO_IDS] : lang === 'ja' ? SCENARIO_IDS : [];
  return scenarios.flatMap(id => Array.from({length:scenarioSentenceCount(lang,id)}, (_,i) => `${lang}:${id}:${i+1}`));
}
export function isKnownSentenceId(id, lang) {
  if (typeof id !== 'string') return false;
  const parts = id.split(':');
  return parts.length === 3 && parts[0] === lang && /^[1-5]$/u.test(parts[2]) && Number(parts[2]) <= scenarioSentenceCount(lang, parts[1]);
}
export const SCENARIO_IMAGES = Object.freeze([
  '/images/books.svg', '/images/tea.svg', '/images/luggage.svg',
  '/images/travel.svg', '/images/forest.svg', '/images/airport.svg',
  '/images/flowers.svg', '/images/coffee.svg',
]);

/**
 * @typedef {Object} Sentence
 * @property {string} id Language, shared scenario ID, and one-based position.
 * @property {string} text A single target-language utterance.
 * @property {string} meaningKo Korean meaning for the initial context screen.
 * @property {string} cueKo Short role/context cue for later recall screens.
 * @property {string} audioText Text spoken by browser TTS (not an audio URL).
 * @property {string[]} [accepted] Equivalent complete utterances.
 * @property {(string|[string,string])[]} [ruby] Plain text or [surface, reading].
 * @property {string} [kana] Full Japanese reading, including punctuation.
 * @property {string} [audioUrl] Optional future recorded audio asset.
 */

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isLine = value => typeof value === 'string' && value.trim().length > 0 && !/[\r\n]/u.test(value);
const result = errors => ({ valid: errors.length === 0, errors });

export function makeSentenceId(lang, scenarioId, position) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) throw new RangeError(`Unsupported language: ${lang}`);
  if (!scenarioSentenceCount(lang, scenarioId)) throw new RangeError(`Unknown scenario: ${scenarioId}`);
  if (!Number.isInteger(position) || position < 1 || position > scenarioSentenceCount(lang, scenarioId)) {
    throw new RangeError(`Sentence position must be 1–${scenarioSentenceCount(lang, scenarioId)}`);
  }
  return `${lang}:${scenarioId}:${position}`;
}

export function validateSentence(sentence, { lang, scenarioId, position } = {}) {
  const errors = [];
  if (!isRecord(sentence)) return result(['Sentence must be an object.']);
  for (const field of ['id', 'text', 'meaningKo', 'cueKo', 'audioText']) {
    if (!isLine(sentence[field])) errors.push(`${field} must be a nonempty single-line string.`);
  }
  const parts = typeof sentence.id === 'string' ? sentence.id.split(':') : [];
  if (parts.length !== 3 || !SUPPORTED_LANGUAGES.includes(parts[0]) ||
      !isKnownSentenceId(sentence.id, parts[0])) {
    errors.push('id must have the form language:scenarioId:position (within the registered catalog).');
  }
  if (lang !== undefined && parts[0] !== lang) errors.push(`id language must be ${lang}.`);
  if (scenarioId !== undefined && parts[1] !== scenarioId) errors.push(`id scenario must be ${scenarioId}.`);
  if (position !== undefined && parts[2] !== String(position)) errors.push(`id position must be ${position}.`);
  if (sentence.accepted !== undefined &&
      (!Array.isArray(sentence.accepted) || !sentence.accepted.every(isLine))) {
    errors.push('accepted must be an array of nonempty single-line strings.');
  }
  if (sentence.kana !== undefined && !isLine(sentence.kana)) {
    errors.push('kana must be a nonempty single-line string.');
  }
  if (sentence.audioUrl !== undefined && !isLine(sentence.audioUrl)) {
    errors.push('audioUrl must be a nonempty single-line string.');
  }
  if (sentence.ruby !== undefined) {
    const validRuby = Array.isArray(sentence.ruby) && sentence.ruby.length > 0 &&
      sentence.ruby.every(segment => isLine(segment) ||
        (Array.isArray(segment) && segment.length === 2 && segment.every(isLine)));
    if (!validRuby) {
      errors.push('ruby must contain plain strings or [surface, reading] pairs.');
    } else {
      const surface = sentence.ruby.map(segment => Array.isArray(segment) ? segment[0] : segment).join('');
      if (surface !== sentence.text) errors.push('ruby surface must reproduce text exactly.');
      const reading = sentence.ruby.map(segment => Array.isArray(segment) ? segment[1] : segment).join('');
      if (sentence.kana !== undefined && reading !== sentence.kana) {
        errors.push('ruby reading must reproduce kana exactly.');
      }
    }
  }
  return result(errors);
}

export function validateScenario(scenario, { lang, index } = {}) {
  const errors = [];
  if (!isRecord(scenario)) return result(['Scenario must be an object.']);
  const scenarioLang = lang ?? scenario.sentences?.[0]?.id?.split(':')[0];
  const count = scenarioSentenceCount(scenarioLang, scenario.id);
  if (!count) errors.push('id must belong to the language catalog.');
  const expectedIds = scenarioLang === 'en' && EN_MATERNAL_SCENARIO_IDS.includes(scenario.id) ? EN_MATERNAL_SCENARIO_IDS : SCENARIO_IDS;
  if (index !== undefined && scenario.id !== expectedIds[index]) errors.push(`Scenario ${index + 1} must be ${expectedIds[index]}.`);
  if (!isLine(scenario.titleKo)) errors.push('titleKo must be a nonempty single-line string.');
  if (!SCENARIO_IMAGES.includes(scenario.image)) errors.push('image must use an existing original /images SVG.');
  if (!Array.isArray(scenario.sentences)) return result([...errors, 'sentences must be an array.']);
  if (scenario.sentences.length !== count) {
    errors.push(`Scenario must contain exactly ${count} sentences.`);
  }
  scenario.sentences.forEach((sentence, sentenceIndex) => {
    const checked = validateSentence(sentence, { lang, scenarioId: scenario.id, position: sentenceIndex + 1 });
    errors.push(...checked.errors.map(error => `Sentence ${sentenceIndex + 1}: ${error}`));
  });
  return result(errors);
}

export function validateCurriculum(scenarios, lang) {
  const errors = [];
  if (!SUPPORTED_LANGUAGES.includes(lang)) errors.push(`Unsupported language: ${lang}.`);
  if (!Array.isArray(scenarios)) return result([...errors, 'Curriculum must be an array of scenarios.']);
  if (scenarios.length !== SCENARIO_IDS.length) errors.push(`Curriculum must contain ${SCENARIO_IDS.length} scenarios.`);
  const expectedIds = lang === 'en' && scenarios.some(scene => EN_MATERNAL_SCENARIO_IDS.includes(scene?.id)) ? EN_MATERNAL_SCENARIO_IDS : SCENARIO_IDS;
  scenarios.forEach((scenario, index) => {
    if (scenario?.id !== expectedIds[index]) errors.push(`Scenario ${index + 1} must be ${expectedIds[index]}.`);
    const checked = validateScenario(scenario, { lang, index });
    errors.push(...checked.errors.map(error => `Scenario ${index + 1}: ${error}`));
  });
  return result(errors);
}

export function assertValidCurriculum(scenarios, lang) {
  const checked = validateCurriculum(scenarios, lang);
  if (!checked.valid) throw new Error(`Invalid ${lang} curriculum:\n${checked.errors.join('\n')}`);
  return scenarios;
}

export function getScenario(scenarios, scenarioId) {
  return scenarios?.find(scenario => scenario.id === scenarioId);
}

export function getSentence(scenarios, sentenceId) {
  return scenarios?.flatMap(scenario => scenario.sentences).find(sentence => sentence.id === sentenceId);
}

/** Returns the next sentence across scenario boundaries, or undefined at the end. */
export function getNextSentence(scenarios, sentenceId) {
  const sentences = scenarios?.flatMap(scenario => scenario.sentences) || [];
  const index = sentences.findIndex(sentence => sentence.id === sentenceId);
  return index < 0 ? undefined : sentences[index + 1];
}

export function getSentenceText(sentence) {
  return sentence?.text || '';
}

export function getSentenceAudioText(sentence) {
  return sentence?.audioText || sentence?.text || '';
}
