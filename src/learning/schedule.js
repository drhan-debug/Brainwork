/** Sentence review is independent of the legacy word review schedule. */
export const SENTENCE_REVIEW_INTERVAL_DAYS = Object.freeze([3, 7, 14, 30, 60]);

function asDate(at = Date.now()) {
  const date = new Date(at);
  if (!Number.isFinite(date.getTime())) {
    throw new TypeError('A valid review date is required.');
  }
  return date;
}

/**
 * Return a new sentence-progress map after one completed session outcome.
 * The caller must combine all attempts first: any failure makes passed false.
 * Failed sentences are due at the start of the next local calendar day.
 * Successful sentences advance through 3, 7, 14, 30, and 60 local days.
 */
export function recordSentenceOutcome(progress = {}, id, { passed, at = Date.now() } = {}) {
  if (typeof id !== 'string' || !id) {
    throw new TypeError('A sentence ID is required.');
  }
  if (typeof passed !== 'boolean') {
    throw new TypeError('A boolean passed outcome is required.');
  }

  const reviewedAt = asDate(at);
  const previous = Object.hasOwn(progress, id) ? progress[id] : undefined;
  const previousStage = Number.isInteger(previous?.stage)
    ? Math.max(0, Math.min(previous.stage, SENTENCE_REVIEW_INTERVAL_DAYS.length))
    : 0;
  const stage = passed
    ? Math.min(previousStage + 1, SENTENCE_REVIEW_INTERVAL_DAYS.length)
    : 0;
  const dueAt = passed
    ? new Date(
      reviewedAt.getFullYear(),
      reviewedAt.getMonth(),
      reviewedAt.getDate() + SENTENCE_REVIEW_INTERVAL_DAYS[stage - 1],
      reviewedAt.getHours(),
      reviewedAt.getMinutes(),
      reviewedAt.getSeconds(),
      reviewedAt.getMilliseconds(),
    )
    : new Date(reviewedAt.getFullYear(), reviewedAt.getMonth(), reviewedAt.getDate() + 1);

  return {
    ...progress,
    [id]: {
      ...previous,
      stage,
      dueAt: dueAt.getTime(),
      lastOutcome: passed ? 'passed' : 'failed',
      lastReviewedAt: reviewedAt.getTime(),
    },
  };
}

/** Return only due, still-valid sentence IDs, oldest first; ties retain map order. */
export function getDueSentenceIds(progress = {}, at = Date.now(), validIds) {
  const now = asDate(at).getTime();
  const valid = new Set(validIds ?? []);
  return Object.entries(progress)
    .map(([id, entry], index) => ({ id, dueAt: entry?.dueAt, index }))
    .filter(({ id, dueAt }) => valid.has(id) && Number.isFinite(dueAt) && dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt || a.index - b.index)
    .map(({ id }) => id);
}

/**
 * Collapse shadowing, recall, and quiz attempts to one outcome per sentence.
 * Accepts { sentenceId, passed } (or { id, passed }); incomplete attempts are
 * ignored, and a failed attempt cannot be overwritten by a later success.
 */
export function aggregateSentenceResults(results = []) {
  const outcomes = new Map();
  for (const result of results) {
    const sentenceId = result?.sentenceId ?? result?.id;
    if (typeof sentenceId !== 'string' || !sentenceId || typeof result?.passed !== 'boolean') {
      continue;
    }
    outcomes.set(sentenceId, (outcomes.get(sentenceId) ?? true) && result.passed);
  }
  return Array.from(outcomes, ([sentenceId, passed]) => ({ sentenceId, passed }));
}
