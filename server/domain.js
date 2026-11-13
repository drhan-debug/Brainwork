import { SCENARIO_IDS } from '../src/learning/schema.js';

export class ApiError extends Error {
  constructor(status, code, message, state) { super(message); Object.assign(this, { status, code, state }); }
}
export const fail = (code, message, status = 400) => { throw new ApiError(status, code, message); };
export const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const integer = (x, min, max) => Number.isInteger(x) && x >= min && x <= max;
const finite = (x, min = 0, max = 8640000000000000) => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
export const WORDS = {
  en: ['Serendipity','Bloom','Unwind','Wander','Savor','Reservation','Boarding pass','Destination','Luggage','Explore','Favorite','Hobby','Curious','Prefer','Grateful'],
  ja: ['ja-cafe-order','ja-cafe-takeout','ja-cafe-pay','ja-travel-station','ja-travel-ticket','ja-travel-reserve','ja-me-name','ja-me-hobby','ja-me-thanks'],
};
export function validSentence(id, lang) {
  if (typeof id !== 'string') return false;
  const parts = id.split(':');
  return parts.length === 3 && parts[0] === lang && SCENARIO_IDS.includes(parts[1]) && /^[1-4]$/.test(parts[2]);
}
export function profileInput(input) {
  if (!record(input)) fail('INVALID_PROFILE', 'A profile is required.');
  const {name, language, goal = 10, timezone = 'Asia/Seoul'} = input;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 60 || /[\u0000-\u001f]/u.test(name)) fail('INVALID_NAME', 'Name must contain 1–60 characters.');
  if (!['en','ja'].includes(language)) fail('INVALID_LANGUAGE', 'Choose English or Japanese.');
  if (!integer(goal, 1, 120)) fail('INVALID_GOAL', 'Daily goal must be 1–120 whole minutes.');
  if (typeof timezone !== 'string' || timezone.length > 80) fail('INVALID_TIMEZONE', 'Choose a valid time zone.');
  try { new Intl.DateTimeFormat('en', {timeZone: timezone}); } catch { fail('INVALID_TIMEZONE', 'Choose a valid time zone.'); }
  return {name:name.trim(), language, goal, timezone};
}
export function blankLearner(profile) {
  return {learned:[],reviews:{},reviewStages:{},sessions:0,minutes:0,name:profile.name,goal:profile.goal,dates:[],dailyMinutes:{},sentenceProgress:{}};
}
export function hasActivity(learner) {
  return learner.sessions > 0 || learner.minutes > 0 || learner.learned.length > 0 || Object.keys(learner.reviews).length > 0 || Object.keys(learner.sentenceProgress).length > 0;
}
export function localParts(at, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone:timezone, year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',second:'numeric',hourCycle:'h23'}).formatToParts(at);
  return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type,Number(p.value)]));
}
function calendarAt(at, days, timezone, midnight = false) {
  const p = localParts(at, timezone);
  const target = Date.UTC(p.year,p.month-1,p.day+days,midnight?0:p.hour,midnight?0:p.minute,midnight?0:p.second,midnight?0:at%1000);
  let guess = target;
  for (let i=0;i<4;i++) {
    const q = localParts(guess, timezone);
    const represented = Date.UTC(q.year,q.month-1,q.day,q.hour,q.minute,q.second,guess%1000);
    const next = guess + target - represented;
    if (next === guess) break;
    guess = next;
  }
  return guess;
}
const round = n => Math.round(n*10)/10;
function session(learner, elapsedMs, profile, at) {
  if (!finite(elapsedMs,0,7200000)) fail('INVALID_DURATION','Session duration must be between 0 and 2 hours.');
  const p = localParts(at,profile.timezone), day = `${p.year}-${p.month}-${p.day}`, minutes = round(elapsedMs/60000);
  learner.sessions += 1;
  learner.minutes = round(learner.minutes + minutes);
  learner.dates = [...new Set([...learner.dates,day])];
  learner.dailyMinutes[day] = round((learner.dailyMinutes[day]||0)+minutes);
}
export function applyProgress(previous, input, profile, at = Date.now()) {
  const learner = structuredClone(previous);
  if (input.type === 'sentenceSession') {
    if (!Array.isArray(input.results) || input.results.length < 1 || input.results.length > 240) fail('INVALID_RESULTS','Provide 1–240 sentence attempts.');
    const outcomes = new Map();
    for (const r of input.results) {
      if (!record(r) || !validSentence(r.sentenceId,profile.language) || typeof r.passed !== 'boolean') fail('INVALID_RESULTS','Sentence results must belong to your language.');
      outcomes.set(r.sentenceId,(outcomes.get(r.sentenceId)??true)&&r.passed);
    }
    for (const [id,passed] of outcomes) {
      const old = learner.sentenceProgress[id];
      if (passed && old?.dueAt > at) { learner.sentenceProgress[id] = {...old,lastOutcome:'passed',lastReviewedAt:at}; continue; }
      const stage = passed ? Math.min((old?.stage||0)+1,5) : 0;
      learner.sentenceProgress[id] = {stage,dueAt:calendarAt(at,passed?[3,7,14,30,60][stage-1]:1,profile.timezone,!passed),lastOutcome:passed?'passed':'failed',lastReviewedAt:at};
    }
    session(learner,input.elapsedMs,profile,at);
  } else if (input.type === 'wordAnswer') {
    if (!WORDS[profile.language].includes(input.wordKey) || typeof input.known !== 'boolean' || typeof input.completed !== 'boolean' || !finite(input.elapsedMs,0,7200000)) fail('INVALID_WORD_RESULT','Provide a valid word answer.');
    const key = input.wordKey;
    if (input.known) learner.learned = [...new Set([...learner.learned,key])];
    if (!input.known || !(learner.reviews[key] > at)) {
      const stage = input.known ? Math.min((learner.reviewStages[key]||0)+1,5) : 0;
      learner.reviewStages[key] = stage;
      learner.reviews[key] = at+(input.known?[0,1,3,7,14,30][stage]*86400000:600000);
    }
    if (input.completed) session(learner,input.elapsedMs,profile,at);
  } else if (input.type === 'dialogueSession') session(learner,input.elapsedMs,profile,at);
  else fail('INVALID_OPERATION','Unknown progress operation.');
  return learner;
}
function dateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(value)) return false;
  const [y,m,d] = value.split('-').map(Number), date = new Date(Date.UTC(y,m-1,d));
  return y>=2000 && y<=2200 && date.getUTCFullYear()===y && date.getUTCMonth()===m-1 && date.getUTCDate()===d;
}
export function importLearner(input, profile) {
  if (!record(input)) fail('INVALID_IMPORT','Choose one local learner.');
  const out = blankLearner(profile);
  if (!Array.isArray(input.learned) || input.learned.length > 100 || input.learned.some(x=>!WORDS[profile.language].includes(x))) fail('INVALID_IMPORT','Local words do not match your account language.');
  out.learned = [...new Set(input.learned)];
  for (const [field,max] of [['reviews',8640000000000000],['reviewStages',5]]) {
    if (!record(input[field]) || Object.keys(input[field]).length > 100) fail('INVALID_IMPORT','Invalid local word progress.');
    for (const [key,value] of Object.entries(input[field])) {
      if (!WORDS[profile.language].includes(key) || !finite(value,0,max) || (field==='reviewStages'&&!Number.isInteger(value))) fail('INVALID_IMPORT','Invalid local word progress.');
      out[field][key] = value;
    }
  }
  if (!integer(input.sessions,0,1000000) || !finite(input.minutes,0,10000000)) fail('INVALID_IMPORT','Invalid local totals.');
  out.sessions=input.sessions; out.minutes=input.minutes;
  if (!Array.isArray(input.dates) || input.dates.length>10000 || input.dates.some(x=>!dateKey(x)) || !record(input.dailyMinutes) || Object.keys(input.dailyMinutes).length>10000) fail('INVALID_IMPORT','Invalid local learning dates.');
  out.dates=[...new Set(input.dates)];
  for (const [key,value] of Object.entries(input.dailyMinutes)) {
    if (!dateKey(key) || !finite(value,0,1440)) fail('INVALID_IMPORT','Invalid local daily minutes.');
    out.dailyMinutes[key]=value;
  }
  if (!record(input.sentenceProgress) || Object.keys(input.sentenceProgress).length>80) fail('INVALID_IMPORT','Invalid local sentence progress.');
  for (const [id,entry] of Object.entries(input.sentenceProgress)) {
    if (!validSentence(id,profile.language) || !record(entry) || !integer(entry.stage,0,5) || !finite(entry.dueAt) || !finite(entry.lastReviewedAt) || !['passed','failed'].includes(entry.lastOutcome)) fail('INVALID_IMPORT','Invalid local sentence progress.');
    out.sentenceProgress[id] = {stage:entry.stage,dueAt:entry.dueAt,lastReviewedAt:entry.lastReviewedAt,lastOutcome:entry.lastOutcome};
  }
  return out;
}
