import React,{useEffect,useRef,useState} from 'react';
import {accountApi} from './Accounts';
import {LANGUAGES} from './learning/path';
import './feedback.css';
const categories={bug:'오류 신고',content:'학습 내용 수정',suggestion:'새 상황·기능 제안'};
const statuses={new:'접수됨',planned:'검토·개선 예정',shipped:'반영 완료'};
export default function Feedback({account,lang,scenarios,page,onAccountChanged}){
 const [category,setCategory]=useState('suggestion'),[message,setMessage]=useState(''),[scenarioId,setScenarioId]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const [items,setItems]=useState([]),[canReview,setCanReview]=useState(false),[inbox,setInbox]=useState(false),[filter,setFilter]=useState(''),[cursor,setCursor]=useState(null),[loading,setLoading]=useState(false),[listError,setListError]=useState(''),[refresh,setRefresh]=useState(0);
 const submission=useRef(null),controller=useRef(null);
 const accountId=account?.account.id;
 const checkError=e=>{if(e.code==='ACCOUNT_CHANGED'||e.status===401)onAccountChanged?.();return e.message;};
 const path=(before)=>`feedback${inbox?'/inbox':''}?${new URLSearchParams({...filter?{status:filter}:{},...before?{before:String(before)}:{}})}`;
 useEffect(()=>{
  if(!accountId)return;
  const abort=new AbortController();controller.current=abort;setLoading(true);setListError('');setItems([]);setCursor(null);
  accountApi(path(),undefined,abort.signal).then(data=>{setItems(data.items);setCanReview(data.canReview);setCursor(data.nextCursor)}).catch(e=>{if(e.name!=='AbortError')setListError(checkError(e))}).finally(()=>{if(!abort.signal.aborted)setLoading(false)});
  return()=>abort.abort();
 },[accountId,inbox,filter,refresh]);
 async function send(event){
  event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');
  const payload={category,message:message.trim(),language:lang,scenarioId:scenarioId||null,page};
  const signature=JSON.stringify(payload);
  if(submission.current?.signature!==signature)submission.current={signature,id:crypto.randomUUID()};
  try{await accountApi('feedback',{...payload,submissionId:submission.current.id,expectedAccountId:accountId},controller.current?.signal);setMessage('');submission.current=null;setNotice('피드백을 서버에 저장했어요. 아래에서 처리 상태를 확인할 수 있어요.');setRefresh(n=>n+1)}catch(e){if(e.name!=='AbortError')setError(checkError(e))}finally{setBusy(false)}
 }
 async function more(){if(loading||!cursor)return;setLoading(true);setListError('');try{const data=await accountApi(path(cursor),undefined,controller.current?.signal);setItems(current=>[...current,...data.items]);setCursor(data.nextCursor)}catch(e){if(e.name!=='AbortError')setListError(checkError(e))}finally{setLoading(false)}}
 async function update(id,status){if(busy)return;setBusy(true);setListError('');try{await accountApi('feedback/status',{feedbackId:id,status,expectedAccountId:accountId},controller.current?.signal,'PATCH');setRefresh(n=>n+1)}catch(e){if(e.name!=='AbortError')setListError(checkError(e))}finally{setBusy(false)}}
 if(!account)return <section className="feedback-panel"><h2>함께 만드는 Bloom</h2><p>피드백을 남기려면 Bloom 계정으로 로그인해 주세요. 로컬 데모에서는 피드백을 서버에 보내지 않아요.</p></section>;
 return <section className="feedback-panel"><h2>함께 만드는 Bloom</h2><p>어려웠던 표현, 필요한 상황, 사용 중 불편한 점을 알려 주세요. 운영자가 확인해 학습 내용과 기능을 개선해요.</p>
 <form onSubmit={send}><fieldset disabled={busy}><label>피드백 종류<select value={category} onChange={e=>setCategory(e.target.value)}>{Object.entries(categories).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>관련 상황<select value={scenarioId} onChange={e=>setScenarioId(e.target.value)}><option value="">앱 전체 / 새로운 상황</option>{scenarios.map(scene=><option key={scene.id} value={scene.id}>{scene.titleKo}</option>)}</select></label><label>내용<textarea required maxLength={2000} rows={5} value={message} onChange={e=>setMessage(e.target.value)} placeholder="어떤 상황에서 무엇이 필요했는지 알려 주세요."/></label><small>{message.length} / 2,000자 · 하루 최대 10건</small><p>현재 학습 언어({LANGUAGES[lang].name})와 선택한 상황을 함께 저장해요. 비밀번호나 민감한 개인정보는 적지 마세요.</p><button className="primary" disabled={!message.trim()||busy}>{busy?'저장 중…':'피드백 보내기'}</button></fieldset></form>
 {notice&&<p role="status">{notice}</p>}{error&&<p className="account-error" role="alert">{error}</p>}
 <div className="feedback-heading"><h3>{inbox?'운영자 피드백함':'내가 보낸 피드백'}</h3><div className="feedback-actions">{canReview&&<button disabled={loading||busy} onClick={()=>setInbox(v=>!v)}>{inbox?'내 피드백 보기':'전체 피드백 확인'}</button>}<button disabled={loading||busy} onClick={()=>setRefresh(n=>n+1)}>새로고침</button></div></div>
 {canReview&&inbox&&<label>처리 상태<select aria-label="피드백 처리 상태 필터" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">전체</option>{Object.entries(statuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}
 {listError&&<p className="account-error" role="alert">{listError}</p>}{loading&&<p role="status">피드백을 불러오고 있어요…</p>}{!loading&&!listError&&!items.length&&<p>아직 접수된 피드백이 없어요.</p>}
 <ul className="feedback-list">{items.map(item=><li key={item.id}><div className="feedback-heading"><strong>{categories[item.category]} · {LANGUAGES[item.language]?.name}</strong><span>{statuses[item.status]}</span></div><small>{new Date(item.createdAt).toLocaleString('ko-KR')} · {scenarios.find(scene=>scene.id===item.scenarioId)?.titleKo||'앱 전체'}{inbox&&` · ${item.authorEmail}`}</small><p>{item.message}</p>{inbox&&<label>처리 상태<select disabled={busy||loading} aria-label={`피드백 ${item.id} 처리 상태`} value={item.status} onChange={e=>update(item.id,e.target.value)}>{Object.entries(statuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}</li>)}</ul>
 {cursor&&<button className="feedback-more" disabled={loading||busy} onClick={more}>이전 피드백 더 보기</button>}
 </section>;
}
