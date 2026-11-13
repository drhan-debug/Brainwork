import { scryptAsync } from '@noble/hashes/scrypt.js';
import { ApiError, fail, record, profileInput, blankLearner, hasActivity, applyProgress, importLearner } from './domain.js';

const SESSION_MS = 30*86400000;
const COOKIE = '__Host-bloom_session';
const MAX_BODY = 262144;
const encoder = new TextEncoder();
const scryptOptions = {N:32768,r:8,p:3,dkLen:32,maxmem:64*1024*1024,asyncTick:8};
const hex = bytes => Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const fromHex = str => Uint8Array.from(str.match(/../g)||[],x=>parseInt(x,16));
const random = (size=32) => hex(crypto.getRandomValues(new Uint8Array(size)));
const digest = async value => hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));
function passwordInput(password) {
  if (typeof password !== 'string' || [...password].length<12 || [...password].length>128 || encoder.encode(password).length>512) fail('INVALID_PASSWORD','Use a password of 12–128 characters.');
  return password;
}
async function passwordHash(password) {
  const salt = random(16);
  const key = await scryptAsync(encoder.encode(password),fromHex(salt),scryptOptions);
  return `scrypt-v1$${salt}$${hex(key)}`;
}
async function passwordMatches(password, stored) {
  const [version,salt,key] = stored.split('$');
  if (version !== 'scrypt-v1' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{64}$/.test(key)) return false;
  const calculated = await scryptAsync(encoder.encode(password),fromHex(salt),scryptOptions);
  const expected = fromHex(key);
  let diff=0;
  for (let i=0;i<calculated.length;i++) diff|=calculated[i]^expected[i];
  return diff===0;
}
function emailInput(value) {
  if (typeof value !== 'string') fail('INVALID_EMAIL','Enter a valid email address.');
  const email = value.trim().toLowerCase();
  if (email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) fail('INVALID_EMAIL','Enter a valid email address.');
  return email;
}
function response(value,status=200,headers={}) {
  return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin',...headers}});
}
const cookie = (token, age=SESSION_MS/1000) => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
async function readBody(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||'')) fail('JSON_REQUIRED','Send a JSON request.',415);
  if (Number(request.headers.get('content-length'))>MAX_BODY) fail('PAYLOAD_TOO_LARGE','Request is too large.',413);
  const reader = request.body?.getReader();
  if (!reader) fail('INVALID_JSON','A JSON object is required.');
  const chunks=[];let length=0;
  while (true) {
    const {done,value}=await reader.read();
    if(done)break;
    length+=value.byteLength;
    if(length>MAX_BODY){await reader.cancel();fail('PAYLOAD_TOO_LARGE','Request is too large.',413);}
    chunks.push(value);
  }
  const data=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
  let body;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data));}catch{fail('INVALID_JSON','A valid JSON object is required.');}
  if(!record(body))fail('INVALID_JSON','A JSON object is required.');
  return body;
}
const state = row => ({authenticated:true,account:{id:row.id,email:row.email},profile:JSON.parse(row.profile_json),learner:JSON.parse(row.learner_json),revision:row.revision,imports:JSON.parse(row.imports_json)});
async function findSession(request,db) {
  const matches = (request.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(`${COOKIE}=`));
  const token=matches.length===1?matches[0].slice(COOKIE.length+1):'';
  if(!/^[a-f0-9]{64}$/.test(token))return null;
  const tokenHash = await digest(token);
  const row=await db.prepare('SELECT accounts.* FROM sessions JOIN accounts ON accounts.id=sessions.account_id WHERE sessions.token_hash=? AND sessions.expires_at>?').bind(tokenHash,Date.now()).first();
  return row?{row,tokenHash}:null;
}
async function rateLimit(request,db,email) {
  const now=Date.now(), window=15*60000;
  // Only the platform-provided header is trusted. Local preview shares one limit.
  const ip=request.headers.get('cf-connecting-ip')||'local';
  for (const [kind,value,max] of [['ip',ip,40],['email',email,12]]) {
    const key=await digest(`${kind}:${value}`);
    const result=await db.prepare('INSERT INTO auth_limits(key,window_start,attempts) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN auth_limits.window_start<? THEN 1 ELSE auth_limits.attempts+1 END, window_start=CASE WHEN auth_limits.window_start<? THEN excluded.window_start ELSE auth_limits.window_start END RETURNING attempts').bind(key,now,now-window,now-window).first();
    if(result.attempts>max)fail('RATE_LIMITED','Too many attempts. Try again in 15 minutes.',429);
  }
  // Bounded cleanup avoids unbounded accumulation from transient IP/email keys.
  await db.prepare('DELETE FROM auth_limits WHERE key IN (SELECT key FROM auth_limits WHERE window_start<? LIMIT 100)').bind(now-86400000).run();
  await db.prepare('DELETE FROM sessions WHERE token_hash IN (SELECT token_hash FROM sessions WHERE expires_at<? LIMIT 100)').bind(now).run();
}
async function sessionStatement(db,accountId,token,at=Date.now()) {
  return db.prepare('INSERT INTO sessions(token_hash,account_id,expires_at) VALUES(?,?,?)').bind(await digest(token),accountId,at+SESSION_MS);
}
async function authenticate(request,db,body,kind) {
  const email=emailInput(body.email);
  await rateLimit(request,db,email);
  if(kind==='register') {
    passwordInput(body.password);
    const profile=profileInput(body), id=crypto.randomUUID(), token=random(), recoveryCode=random();
    const existing=await db.prepare('SELECT id FROM accounts WHERE email=?').bind(email).first();
    if(existing)fail('EMAIL_EXISTS','An account with this email already exists.',409);
    const row={id,email,password_hash:await passwordHash(body.password),recovery_hash:await digest(recoveryCode),profile_json:JSON.stringify(profile),learner_json:JSON.stringify(blankLearner(profile)),imports_json:'[]',revision:0};
    const old=await findSession(request,db);
    const statements=[db.prepare('INSERT INTO accounts(id,email,password_hash,recovery_hash,profile_json,learner_json,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,email,row.password_hash,row.recovery_hash,row.profile_json,row.learner_json,Date.now()),await sessionStatement(db,id,token)];
    if(old)statements.push(db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(old.tokenHash));
    try{await db.batch(statements);}catch(error){
      if(await db.prepare('SELECT id FROM accounts WHERE email=?').bind(email).first())fail('EMAIL_EXISTS','An account with this email already exists.',409);
      throw error;
    }
    return response({...state(row),recoveryCode},201,{'Set-Cookie':cookie(token)});
  }
  const row=await db.prepare('SELECT * FROM accounts WHERE email=?').bind(email).first();
  if(kind==='recover') {
    passwordInput(body.newPassword);
    if(typeof body.recoveryCode!=='string'||!/^[a-f0-9]{64}$/.test(body.recoveryCode)||!row||await digest(body.recoveryCode)!==row.recovery_hash)fail('INVALID_RECOVERY','Email or recovery code is incorrect.',401);
    const token=random(),recoveryCode=random(),hash=await passwordHash(body.newPassword),recoveryHash=await digest(recoveryCode);
    const results=await db.batch([
      db.prepare('UPDATE accounts SET password_hash=?,recovery_hash=? WHERE id=? AND recovery_hash=?').bind(hash,recoveryHash,row.id,row.recovery_hash),
      db.prepare('DELETE FROM sessions WHERE account_id=? AND EXISTS(SELECT 1 FROM accounts WHERE id=? AND recovery_hash=?)').bind(row.id,row.id,recoveryHash),
      db.prepare('INSERT INTO sessions(token_hash,account_id,expires_at) SELECT ?,id,? FROM accounts WHERE id=? AND recovery_hash=?').bind(await digest(token),Date.now()+SESSION_MS,row.id,recoveryHash),
    ]);
    if(results[0].meta.changes!==1)fail('INVALID_RECOVERY','Recovery code has already been used.',401);
    const latest=await db.prepare('SELECT * FROM accounts WHERE id=?').bind(row.id).first();
    return response({...state(latest),recoveryCode},200,{'Set-Cookie':cookie(token)});
  }
  // Bound hashing input, and perform the same expensive KDF for nonexistent accounts.
  if(typeof body.password!=='string'||encoder.encode(body.password).length>512)fail('INVALID_CREDENTIALS','Email or password is incorrect.',401);
  const dummy='scrypt-v1$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000';
  const matches=await passwordMatches(body.password,row?.password_hash||dummy);
  if(!row||!matches)fail('INVALID_CREDENTIALS','Email or password is incorrect.',401);
  const token=random(),old=await findSession(request,db);
  const statements=[db.prepare('INSERT INTO sessions(token_hash,account_id,expires_at) SELECT ?,id,? FROM accounts WHERE id=? AND password_hash=?').bind(await digest(token),Date.now()+SESSION_MS,row.id,row.password_hash)];
  if(old)statements.push(db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(old.tokenHash));
  const results=await db.batch(statements);
  if(results[0].meta.changes!==1)fail('INVALID_CREDENTIALS','Password changed. Sign in again.',401);
  const latest=await db.prepare('SELECT * FROM accounts WHERE id=?').bind(row.id).first();
  return response(state(latest),200,{'Set-Cookie':cookie(token)});
}
function revisionInput(body) {
  if(!Number.isSafeInteger(body.revision)||body.revision<0)fail('INVALID_REVISION','A valid revision is required.');
}
async function updateAccount(db,row,body,path,sessionHash) {
  revisionInput(body);
  const current=state(row);
  let requestHash;
  if(path!=='/api/profile') {
    if(typeof body.operationId!=='string'||!/^[A-Za-z0-9_-]{16,100}$/.test(body.operationId))fail('INVALID_OPERATION_ID','Use a unique operation identifier.');
    const {revision,...payload}=body;
    requestHash=await digest(JSON.stringify(payload));
    const previous=await db.prepare('SELECT request_hash FROM operations WHERE account_id=? AND operation_id=?').bind(row.id,body.operationId).first();
    if(previous){if(previous.request_hash!==requestHash)fail('OPERATION_REUSED','Operation identifier was used for different data.',409);return response(current);}
  }
  if(body.revision!==row.revision)throw new ApiError(409,'REVISION_CONFLICT','Your account changed on another device. Retry this action using the latest state.',current);
  let profile=current.profile,learner=current.learner,imports=current.imports;
  if(path==='/api/profile') {
    profile=profileInput(body.profile);
    if(profile.language!==current.profile.language&&(hasActivity(learner)||imports.length))fail('LANGUAGE_LOCKED','Language cannot change after learning or importing progress.',409);
    learner={...learner,name:profile.name,goal:profile.goal};
  } else if(path==='/api/import') {
    if(imports.length)fail('IMPORT_ALREADY_USED','This account has already imported a local learner.',409);
    if(hasActivity(learner))fail('IMPORT_REQUIRES_EMPTY_ACCOUNT','Import is available only before cloud learning starts.',409);
    if(!['wife','husband','legacy'].includes(body.source))fail('INVALID_IMPORT_SOURCE','Choose one local learner.');
    if((body.source==='husband'?'ja':'en')!==profile.language)fail('IMPORT_LANGUAGE_MISMATCH','The selected local learner uses another language.',409);
    learner=importLearner(body.learner,profile);
    imports=[{source:body.source,importedAt:Date.now()}];
  } else learner=applyProgress(learner,body,profile);
  const update=db.prepare('UPDATE accounts SET profile_json=?,learner_json=?,imports_json=?,revision=revision+1 WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM sessions WHERE token_hash=? AND account_id=accounts.id AND expires_at>?)').bind(JSON.stringify(profile),JSON.stringify(learner),JSON.stringify(imports),row.id,row.revision,sessionHash,Date.now());
  let results;
  if(requestHash)results=await db.batch([update,db.prepare('INSERT INTO operations(account_id,operation_id,request_hash,created_at) SELECT ?,?,?,? WHERE changes()=1').bind(row.id,body.operationId,requestHash,Date.now())]);
  else results=[await update.run()];
  const latest=await db.prepare('SELECT * FROM accounts WHERE id=?').bind(row.id).first();
  if(results[0].meta.changes!==1) {
    if(!await db.prepare('SELECT token_hash FROM sessions WHERE token_hash=? AND account_id=? AND expires_at>?').bind(sessionHash,row.id,Date.now()).first())fail('AUTH_REQUIRED','Your session expired. Sign in again.',401);
    if(requestHash){const op=await db.prepare('SELECT request_hash FROM operations WHERE account_id=? AND operation_id=?').bind(row.id,body.operationId).first();if(op?.request_hash===requestHash)return response(state(latest));}
    throw new ApiError(409,'REVISION_CONFLICT','Your account changed on another device. Retry this action using the latest state.',state(latest));
  }
  return response(state(latest));
}
export async function api(request,env) {
  const url=new URL(request.url),path=url.pathname;
  const methods={'/api/session':'GET','/api/auth/register':'POST','/api/auth/login':'POST','/api/auth/logout':'POST','/api/auth/recover':'POST','/api/profile':'PATCH','/api/progress':'POST','/api/import':'POST'};
  if(!methods[path])fail('NOT_FOUND','API endpoint not found.',404);
  if(request.method!==methods[path])fail('METHOD_NOT_ALLOWED','Method not allowed.',405);
  if(!env.DB)fail('STORAGE_UNAVAILABLE','Account storage is not configured.',503);
  const db=env.DB;
  if(request.method!=='GET') {
    if(request.headers.get('origin')!==url.origin || request.headers.get('sec-fetch-site')==='cross-site')fail('ORIGIN_FORBIDDEN','Cross-origin account requests are not allowed.',403);
  }
  const body=request.method==='GET'?null:await readBody(request);
  if(['/api/auth/register','/api/auth/login','/api/auth/recover'].includes(path))return authenticate(request,db,body,path.split('/').at(-1));
  const session=await findSession(request,db);
  if(path==='/api/session')return response(session?state(session.row):{authenticated:false});
  if(session && body.expectedAccountId!==session.row.id)fail('ACCOUNT_CHANGED','The signed-in account changed. Sign in again before continuing.',409);
  if(path==='/api/auth/logout'){
    if(session)await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(session.tokenHash).run();
    return response({authenticated:false},200,{'Set-Cookie':cookie('',0)});
  }
  if(!session)fail('AUTH_REQUIRED','Sign in to your Bloom account.',401);
  return updateAccount(db,session.row,body,path,session.tokenHash);
}
export default {
  async fetch(request,env,ctx) {
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/')){
      try{return await api(request,env);}catch(error){
        if(error instanceof ApiError)return response({code:error.code,error:error.message,...(error.state?{state:error.state}:{})},error.status,error.status===429?{'Retry-After':'900'}:{});
        // Deliberately do not log requests, credentials, cookie values, or SQL parameters.
        return response({code:'INTERNAL_ERROR',error:'The account service could not complete this request. Please try again.'},500);
      }
    }
    if(env.ASSETS)return env.ASSETS.fetch(request);
    // Build-time replacement embeds the Vite output for Sites' single Worker format.
    if(typeof __BLOOM_ASSETS__!=='undefined'){
      let path;try{path=decodeURIComponent(url.pathname);}catch{return new Response('Bad path',{status:400});}
      const assets=__BLOOM_ASSETS__;
      const asset=assets[path]||(!path.split('/').at(-1).includes('.')?assets['/index.html']:null);
      if(asset){
        if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
        const bytes=Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0));
        return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset.type,'Cache-Control':path.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
      }
    }
    return new Response('Not found',{status:404});
  },
};
