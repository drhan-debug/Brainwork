// Shared, pure card rules for local previews and account writes.
export const MAX_CUSTOM_CARDS = 200;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const fields = ['id','front','back','hint','source','createdAt','dueAt','stage','lastReviewedAt','lastOutcome'];
const legacyFields = fields.filter(key=>key!=='hint'&&key!=='source');
const sources = ['', 'mymemory+dictionaryapi', 'mymemory+jisho'];
const clock = timezone => new Intl.DateTimeFormat('en-US', {timeZone:timezone,year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',second:'numeric',hourCycle:'h23'});
const parts = (at, formatter) => Object.fromEntries(formatter.formatToParts(at).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
const wall = (p, ms=0) => Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second,ms);
const error = (code, message) => { const e = new Error(message); e.code = code; throw e; };
const validTime = n => Number.isSafeInteger(n) && n >= 0 && n <= 8640000000000000;
const clean = (value, max, required, field) => {
  if (typeof value !== 'string') error('INVALID_CUSTOM_CARD', `${field} must be text.`);
  const text = value.trim();
  if ((required && !text) || Array.from(text).length > max || /\p{Cc}/u.test(text)) error('INVALID_CUSTOM_CARD', `${field} must be ${required?'1–':'0–'}${max} characters without control characters.`);
  return text;
};

// Calendar addition preserves account-local time, including 23/25-hour DST days.
// In an offset gap, use the first valid local instant after the requested time.
export function calendarAt(at, days, timezone, midnight=false) {
  const formatter = clock(timezone), p=parts(at,formatter);
  const target=Date.UTC(p.year,p.month-1,p.day+days,midnight?0:p.hour,midnight?0:p.minute,midnight?0:p.second,midnight?0:at%1000);
  const offsets=new Set();
  for(let h=-36;h<=36;h+=3){const instant=target+h*3600000;offsets.add(wall(parts(instant,formatter),instant%1000)-instant);}
  const exact=[];
  for(const offset of offsets){const candidate=target-offset;if(wall(parts(candidate,formatter),candidate%1000)===target)exact.push(candidate);}
  if(exact.length)return Math.min(...exact);
  // Rare local clock gaps (for example, 02:30 on a spring DST change).
  let best=Infinity;
  for(let minute=-180;minute<=180;minute++){
    const candidate=target-[...offsets][0]+minute*60000;
    if(wall(parts(candidate,formatter),candidate%1000)>=target && candidate<best)best=candidate;
  }
  if(Number.isFinite(best))return best;
  error('INVALID_TIMEZONE','Cannot schedule in this time zone.');
}

export function validateCustomCards(cards) {
  if(!Array.isArray(cards)||cards.length>MAX_CUSTOM_CARDS)error('INVALID_CUSTOM_CARDS','Custom cards must be an array of at most 200 cards.');
  const seen=new Set();
  return cards.map(card=>{
    if(!card||typeof card!=='object'||Array.isArray(card))error('INVALID_CUSTOM_CARDS','Invalid custom card.');
    const legacy=Object.keys(card).length===legacyFields.length&&legacyFields.every(key=>Object.hasOwn(card,key));
    if(!legacy&&(Object.keys(card).length!==fields.length||fields.some(key=>!Object.hasOwn(card,key))))error('INVALID_CUSTOM_CARDS','Invalid custom card.');
    if(legacy)card={...card,hint:'',source:''};
    if(typeof card.id!=='string'||!uuid.test(card.id)||seen.has(card.id))error('INVALID_CUSTOM_CARDS','Custom card IDs must be unique UUIDs.');
    seen.add(card.id);
    let front,back;
    let hint;
    try{front=clean(card.front,180,true,'Front');back=clean(card.back,360,false,'Back');hint=clean(card.hint,240,false,'Hint');}catch{error('INVALID_CUSTOM_CARDS','Invalid custom card text.');}
    if(front!==card.front||back!==card.back||hint!==card.hint||!sources.includes(card.source)||!validTime(card.createdAt)||!validTime(card.dueAt)||!Number.isInteger(card.stage)||card.stage<0||card.stage>5||!(card.lastReviewedAt===null||validTime(card.lastReviewedAt))||!([null,'remembered','forgotten'].includes(card.lastOutcome))||(card.lastReviewedAt===null)!==(card.lastOutcome===null))error('INVALID_CUSTOM_CARDS','Invalid custom card schedule.');
    return {...card};
  });
}
export function normalizeCustomCards(cards) { return validateCustomCards(cards===undefined?[]:cards); }

export function applyCustomCardOperation(cards,input,timezone,at=Date.now()) {
  const next=normalizeCustomCards(cards);
  if(!input||typeof input!=='object'||typeof input.cardId!=='string'||!uuid.test(input.cardId))error('INVALID_CUSTOM_CARD','A UUID card ID is required.');
  const index=next.findIndex(card=>card.id===input.cardId);
  if(input.type==='customCardAdd'){
    if(index>=0)error('CUSTOM_CARD_EXISTS','That card already exists.');
    if(next.length>=MAX_CUSTOM_CARDS)error('CUSTOM_CARD_LIMIT','You can save up to 200 cards.');
    const front=clean(input.front,180,true,'Front'),back=clean(input.back===undefined?'':input.back,360,false,'Back'),hint=clean(input.hint===undefined?'':input.hint,240,false,'Hint');
    if(!sources.includes(input.source===undefined?'':input.source))error('INVALID_CUSTOM_CARD','Invalid card source.');
    next.push({id:input.cardId,front,back,hint,source:input.source??'',createdAt:at,dueAt:calendarAt(at,2,timezone),stage:0,lastReviewedAt:null,lastOutcome:null});
  }else if(input.type==='customCardEdit'){
    if(index<0)error('CUSTOM_CARD_NOT_FOUND','Card not found.');
    const hint=clean(input.hint===undefined?next[index].hint:input.hint,240,false,'Hint');
    const source=input.source===undefined?next[index].source:input.source;
    if(!sources.includes(source))error('INVALID_CUSTOM_CARD','Invalid card source.');
    next[index]={...next[index],front:clean(input.front,180,true,'Front'),back:clean(input.back===undefined?'':input.back,360,false,'Back'),hint,source};
  }else if(input.type==='customCardReview'){
    if(index<0)error('CUSTOM_CARD_NOT_FOUND','Card not found.');
    if(typeof input.remembered!=='boolean')error('INVALID_CUSTOM_CARD','Review outcome must be a boolean.');
    const old=next[index];
    if(input.remembered){
      const early=old.dueAt>at;
      const stage=early?old.stage:Math.min(old.stage+1,5);
      next[index]={...old,stage,dueAt:early?old.dueAt:calendarAt(at,[3,7,14,30,60][stage-1],timezone),lastReviewedAt:at,lastOutcome:'remembered'};
    }else next[index]={...old,stage:0,dueAt:calendarAt(at,1,timezone,true),lastReviewedAt:at,lastOutcome:'forgotten'};
  }else if(input.type==='customCardDelete'){
    if(index<0)error('CUSTOM_CARD_NOT_FOUND','Card not found.');
    next.splice(index,1);
  }else error('INVALID_OPERATION','Unknown custom card operation.');
  return next;
}
