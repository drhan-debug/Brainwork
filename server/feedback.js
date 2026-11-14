import {fail} from './domain.js';
import {SCENARIO_IDS,SUPPORTED_LANGUAGES} from '../src/learning/schema.js';
export const canReviewFeedback=(env,accountId)=>typeof env.FEEDBACK_ADMIN_ACCOUNT_ID==='string'&&env.FEEDBACK_ADMIN_ACCOUNT_ID===accountId;
const statuses=['new','planned','shipped'];
function textInput(value,max){return typeof value==='string'&&value.trim().length>0&&value.trim().length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value);}
export async function feedbackApi(request,db,row,body,env){
 const url=new URL(request.url),inbox=url.pathname==='/api/feedback/inbox',admin=canReviewFeedback(env,row.id);
 if((inbox||request.method==='PATCH')&&!admin)fail('FORBIDDEN','Only the configured operator can review feedback.',403);
 if(request.method==='GET'){
  const cursor=url.searchParams.get('before'),status=url.searchParams.get('status');
  if(cursor!==null&&(!/^\d+$/.test(cursor)||!Number.isSafeInteger(Number(cursor))))fail('INVALID_CURSOR','Invalid feedback cursor.');
  if(status&&!statuses.includes(status))fail('INVALID_FEEDBACK','Invalid feedback status.');
  const conditions=[],values=[];
  if(!inbox){conditions.push('f.account_id=?');values.push(row.id);}
  if(cursor!==null){conditions.push('f.id<?');values.push(Number(cursor));}
  if(status){conditions.push('f.status=?');values.push(status);}
  const fields='f.id,f.category,f.message,f.language,f.scenario_id AS scenarioId,f.page,f.status,f.created_at AS createdAt';
  const rows=await db.prepare(`SELECT ${fields}${inbox?',a.email AS authorEmail':''} FROM feedback f ${inbox?'JOIN accounts a ON a.id=f.account_id':''} ${conditions.length?'WHERE '+conditions.join(' AND '):''} ORDER BY f.id DESC LIMIT 26`).bind(...values).all();
  const items=rows.results.slice(0,25);
  return {items,nextCursor:rows.results.length>25?items.at(-1).id:null,canReview:admin};
 }
 if(request.method==='PATCH'){
  if(!Number.isSafeInteger(body.feedbackId)||body.feedbackId<1||!statuses.includes(body.status))fail('INVALID_FEEDBACK','Invalid feedback status.');
  const result=await db.prepare('UPDATE feedback SET status=? WHERE id=?').bind(body.status,body.feedbackId).run();
  if(!result.meta.changes)fail('NOT_FOUND','Feedback not found.',404);
  return {id:body.feedbackId,status:body.status};
 }
 const {submissionId,category,message,language,scenarioId=null,page=''}=body;
 if(!textInput(submissionId,100)||!/^[A-Za-z0-9_-]{16,100}$/.test(submissionId)||!['bug','content','suggestion'].includes(category)||!textInput(message,2000)||!SUPPORTED_LANGUAGES.includes(language)||(scenarioId!==null&&!SCENARIO_IDS.includes(scenarioId))||typeof page!=='string'||page.length>100)fail('INVALID_FEEDBACK','Provide a category, language and feedback of 1–2000 characters.');
 const previous=await db.prepare('SELECT id,category,message,language,scenario_id,page FROM feedback WHERE account_id=? AND submission_id=?').bind(row.id,submissionId).first();
 if(previous){
  if(previous.category!==category||previous.message!==message.trim()||previous.language!==language||previous.scenario_id!==scenarioId||previous.page!==page)fail('OPERATION_REUSED','Submission identifier was used for different feedback.',409);
  return {id:previous.id,saved:true};
 }
 const now=Date.now();
 const result=await db.prepare('INSERT INTO feedback(account_id,submission_id,category,message,language,scenario_id,page,status,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM feedback WHERE account_id=? AND created_at>?)<10 ON CONFLICT(account_id,submission_id) DO NOTHING RETURNING id').bind(row.id,submissionId,category,message.trim(),language,scenarioId,page,'new',now,row.id,now-86400000).first();
 if(result)return {id:result.id,saved:true};
 const duplicate=await db.prepare('SELECT id,category,message,language,scenario_id,page FROM feedback WHERE account_id=? AND submission_id=?').bind(row.id,submissionId).first();
 if(duplicate){if(duplicate.category!==category||duplicate.message!==message.trim()||duplicate.language!==language||duplicate.scenario_id!==scenarioId||duplicate.page!==page)fail('OPERATION_REUSED','Submission identifier was used for different feedback.',409);return {id:duplicate.id,saved:true};}
 fail('FEEDBACK_LIMIT','You can submit up to ten feedback messages per day.',429);
}
