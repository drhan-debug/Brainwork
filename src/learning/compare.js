// This compares recognized/typed words only. It cannot assess pronunciation,
// final sounds, rhythm, or intonation from a transcript.

const isJapanese = (locale) => /^ja(?:[-_]|$)/i.test(locale || '');

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[‘’ʼ]/gu, "'");
}

function tokenize(value, japanese) {
  const normalized = normalize(value);
  if (japanese) {
    // Keep voiced marks: が and か must never become equivalent. NFKC also
    // combines half-width kana and decomposed dakuten into their full forms.
    return Array.from(normalized.replace(/[\p{P}\p{Z}\s]/gu, ''));
  }
  // Preserve apostrophes inside words, so "we're" cannot match "were".
  return normalized.match(/[\p{L}\p{M}\p{N}]+(?:'[\p{L}\p{M}\p{N}]+)*/gu) || [];
}

function align(expected, actual) {
  const width = actual.length + 1;
  const rows = Array.from({ length: expected.length + 1 }, () => new Uint32Array(width));
  for (let i = 0; i <= expected.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= actual.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= expected.length; i += 1) {
    for (let j = 1; j <= actual.length; j += 1) {
      rows[i][j] = Math.min(
        rows[i - 1][j - 1] + (expected[i - 1] === actual[j - 1] ? 0 : 1),
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
      );
    }
  }
  let i = expected.length;
  let j = actual.length;
  const steps = [];
  while (i || j) {
    if (i && j && expected[i - 1] === actual[j - 1] && rows[i][j] === rows[i - 1][j - 1]) {
      steps.push({ type: 'equal', expected: expected[--i], actual: actual[--j] });
    } else if (i && j && rows[i][j] === rows[i - 1][j - 1] + 1) {
      steps.push({ type: 'substituted', expected: expected[--i], actual: actual[--j] });
    } else if (i && rows[i][j] === rows[i - 1][j] + 1) {
      steps.push({ type: 'missing', expected: expected[--i], actual: '' });
    } else {
      steps.push({ type: 'extra', expected: '', actual: actual[--j] });
    }
  }
  return { distance: rows[expected.length][actual.length], steps: steps.reverse() };
}

function combineSegments(steps, japanese) {
  const groups = [];
  for (const step of steps) {
    const previous = groups[groups.length - 1];
    if (previous?.type === step.type) {
      if (step.expected) previous.expected.push(step.expected);
      if (step.actual) previous.actual.push(step.actual);
    } else {
      groups.push({
        type: step.type,
        expected: step.expected ? [step.expected] : [],
        actual: step.actual ? [step.actual] : [],
      });
    }
  }
  const separator = japanese ? '' : ' ';
  return groups.map(({ type, expected, actual }) => ({
    type,
    expected: expected.join(separator),
    actual: actual.join(separator),
  }));
}

/**
 * Compare a transcript or typed answer with a sentence's text, Japanese kana,
 * or explicitly accepted complete forms. Segments are plain text, never HTML.
 * Missing = target text omitted; extra = input absent from the target;
 * substituted = differing text. Punctuation/case are ignored, not word choices.
 */
export function compareSentence({ input = '', sentence, locale } = {}) {
  const data = typeof sentence === 'string' ? { text: sentence } : sentence || {};
  const japanese = isJapanese(locale || data.locale || data.language);
  const actual = tokenize(input, japanese);
  const forms = [data.text, ...(japanese ? [data.kana] : []), ...(Array.isArray(data.accepted) ? data.accepted : [])];
  const candidates = forms
    .filter((form) => typeof form === 'string')
    .map((form) => tokenize(form, japanese))
    .filter((tokens) => tokens.length > 0);

  if (!candidates.length) {
    return { matched: false, segments: [], mismatchText: '', message: 'No target sentence is available to compare.' };
  }

  let best;
  for (const expected of candidates) {
    const result = align(expected, actual);
    if (!best || result.distance < best.distance) best = result;
    if (result.distance === 0) break;
  }
  const segments = combineSegments(best.steps, japanese);
  const matched = best.distance === 0;
  const mismatchText = segments
    .filter(({ type }) => type !== 'equal')
    .map(({ type, expected, actual: received }) => {
      if (type === 'missing') return `Missing: “${expected}”`;
      if (type === 'extra') return `Extra: “${received}”`;
      return `Expected “${expected}”; received “${received}”`;
    })
    .join(' · ');

  return {
    matched,
    segments,
    mismatchText,
    message: matched
      ? 'The text matches an accepted form. This checks text only, not pronunciation.'
      : actual.length === 0
        ? 'No words to compare yet. Speak or type the sentence first.'
        : 'Some text differs from the sentence. Review the highlighted segments.',
  };
}
