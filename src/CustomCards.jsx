import React, {useEffect, useRef, useState} from 'react';
import {ArrowRight, Check, Plus, RotateCcw, Trash2, X} from 'lucide-react';
import './custom-cards.css';

const dateLabel=(value,timezone)=>new Intl.DateTimeFormat('ko-KR',{timeZone:timezone,dateStyle:'medium'}).format(new Date(value));
const maskedCue=front=>front.split(/(\s+)/u).map(part=>/^\s+$/u.test(part)?part:Array.from(part).map((character,index)=>index===0?character:'•').join('')).join('');
const sourceLinks={
 'mymemory+dictionaryapi':[['MyMemory','https://mymemory.translated.net/'],['Dictionary API','https://dictionaryapi.dev/']],
 'mymemory+jisho':[['MyMemory','https://mymemory.translated.net/'],['Jisho','https://jisho.org/'],['JMdict','https://www.edrdg.org/jmdict/j_jmdict.html']]
};
function SourceAttribution({source}){const links=sourceLinks[source];if(!links)return null;return <span className="custom-source">처음 조회한 출처: {links.map(([name,url],index)=><React.Fragment key={name}>{index>0&&' · '}<a href={url} target="_blank" rel="noopener noreferrer">{name}</a></React.Fragment>)}</span>}
const canLookUp=front=>Array.from(front).length<=80&&!/\s/u.test(front)&&new TextEncoder().encode(front).length<=200;

export default function CustomCards({cards,now,timezone,account,onAdd,onEdit,onReview,onDelete}){
 const [front,setFront]=useState(''),[back,setBack]=useState(''),[hint,setHint]=useState('');
 const [editing,setEditing]=useState(null),[editFront,setEditFront]=useState(''),[editBack,setEditBack]=useState(''),[editHint,setEditHint]=useState('');
 const [revealed,setRevealed]=useState(false),[lookingUp,setLookingUp]=useState(false),[lookupError,setLookupError]=useState(''),[lookupResult,setLookupResult]=useState(null);
 const submitting=useRef(false),listRef=useRef(null),editFrontRef=useRef(null);
 const ordered=[...cards].sort((a,b)=>a.dueAt-b.dueAt||a.createdAt-b.createdAt);
 const due=ordered.filter(card=>card.dueAt<=now);
 const current=due[0];
 const next=ordered.find(card=>card.dueAt>now);
 useEffect(()=>setRevealed(false),[current?.id]);
 useEffect(()=>{if(listRef.current)listRef.current.open=false},[current?.id]);
 useEffect(()=>{if(editing)editFrontRef.current?.focus()},[editing]);
 async function add(event){
  event.preventDefault();if(submitting.current)return;
  const text=front.trim(),meaning=back.trim(),cue=hint.trim();
  if(!text||Array.from(text).length>180||Array.from(meaning).length>360||Array.from(cue).length>240)return;
  const auto=account&&!meaning&&!cue;
  setLookupError('');setLookupResult(null);
  if(auto&&!canLookUp(text)){setLookupError('자동 뜻 찾기는 띄어쓰기 없는 단어 하나(80자 이내)만 가능해요. 뜻이나 힌트를 직접 적어 추가할 수 있어요.');return}
  submitting.current=true;setLookingUp(auto);
  try{
   const result=await onAdd(text,meaning,cue);
   if(!result)return;
   setFront('');setBack('');setHint('');
   if(result.lookup)setLookupResult({front:text,...result.lookup});
  }catch(error){if(error.name!=='AbortError')setLookupError(`${error.message} 다시 시도하거나 뜻/힌트를 직접 적어 추가해 주세요.`)}
  finally{submitting.current=false;setLookingUp(false)}
 }
 function beginEdit(card){setEditing(card.id);setEditFront(card.front);setEditBack(card.back);setEditHint(card.hint||'')}
 function finishEdit(event){event.preventDefault();const text=editFront.trim(),meaning=editBack.trim(),cue=editHint.trim();if(!text||Array.from(text).length>180||Array.from(meaning).length>360||Array.from(cue).length>240)return;if(!onEdit(editing,text,meaning,cue))return;if(lookupResult?.cardId===editing)setLookupResult(null);setEditing(null)}
 function editLookupResult(){const card=cards.find(item=>item.id===lookupResult?.cardId);if(!card){setLookupError('이 항목이 현재 암기장에 없어요. 계정 저장 상태를 확인해 주세요.');return}listRef.current.open=true;beginEdit(card)}
 function remove(card){if(window.confirm(`“${card.front}” 항목을 삭제할까요?`)){onDelete(card.id);if(editing===card.id)setEditing(null)}}
 return <section className="custom-cards" aria-label="내 암기장">
  <div className="custom-intro"><div><span className="custom-eyebrow">MY MEMORY CARDS</span><h2>내 암기장</h2><p>외우고 싶은 내용을 직접 적고, 알맞은 날에 다시 떠올려 보세요.</p></div><div className="custom-summary"><strong>{due.length}<small>개</small></strong><span>지금 복습할 항목</span></div></div>
  <div className="custom-overview"><span>전체 {cards.length}개</span><span>{next?<>다음 복습 <time dateTime={new Date(next.dueAt).toISOString()}>{dateLabel(next.dueAt,timezone)}</time></>:cards.length?'예정된 복습을 모두 마쳤어요':'새 항목을 추가해 보세요'}</span></div>
  <section className="custom-panel" aria-labelledby="custom-add-heading">
   <h3 id="custom-add-heading"><Plus size={19}/>새 항목 추가</h3>
   <p>{account?'단어 하나만 적으면 온라인에서 한국어 뜻과 힌트를 찾아요. 뜻이나 힌트를 직접 적어 추가할 수도 있어요.':'로컬 데모는 뜻과 힌트를 직접 적어 이 브라우저에만 저장해요.'} 추가한 항목은 이틀 뒤 처음 복습해요.{cards.length>=200&&' 암기장에 저장할 수 있는 200개를 모두 사용했어요.'}</p>
   <form onSubmit={add} className="custom-form">
    <label>외울 내용 <span>필수</span><textarea value={front} maxLength={180} required rows={2} disabled={lookingUp} onChange={e=>{setFront(e.target.value);setLookupError('')}} placeholder="예: bloom"/><small>{front.length}/180</small></label>
    <label>뜻 <span>{account?'선택 · 비워 두면 자동으로 찾기':'선택'}</span><textarea value={back} maxLength={360} rows={2} disabled={lookingUp} onChange={e=>setBack(e.target.value)} placeholder="예: 꽃이 피다"/><small>{back.length}/360</small></label>
    <label>힌트 <span>선택</span><textarea value={hint} maxLength={240} rows={2} disabled={lookingUp} onChange={e=>setHint(e.target.value)} placeholder="복습할 때 떠올릴 단서"/><small>{hint.length}/240</small></label>
    <button className="primary" type="submit" disabled={!front.trim()||cards.length>=200||lookingUp}><Plus size={16}/>{lookingUp?'뜻과 힌트를 찾고 있어요…':account&&!back.trim()&&!hint.trim()?'뜻과 힌트 찾아 추가':'암기장에 추가'}</button>
   </form>
   {lookingUp&&<p className="custom-lookup-status" role="status">뜻과 힌트를 찾고 있어요…</p>}
   {lookupError&&<p className="custom-lookup-error" role="alert">{lookupError}</p>}
   {lookupResult&&cards.some(card=>card.id===lookupResult.cardId)&&<div className="custom-lookup-result" role="status"><strong>찾은 뜻과 힌트</strong><p>{lookupResult.front} · {lookupResult.back}</p><p>{lookupResult.hint}</p><p className="custom-lookup-caution">자동 조회한 뜻·힌트예요. 맞는지 확인하고 필요하면 수정하세요.</p><small><SourceAttribution source={lookupResult.source}/> · 계정 저장 상태는 위에서 확인해 주세요.</small><button type="button" className="custom-secondary" onClick={editLookupResult}>이 항목 수정하기</button></div>}
  </section>
  <section className="custom-panel" aria-labelledby="custom-review-heading"><div className="custom-panel-heading"><h3 id="custom-review-heading"><RotateCcw size={19}/>오늘의 복습</h3><span>{due.length}개 남음</span></div>{current?<div className="custom-review" key={current.id}><span className="custom-review-step">한 번에 하나씩 떠올려요</span><p className="custom-review-prompt">{current.back||current.hint?'뜻과 힌트를 보고 외울 내용을 떠올려 보세요.':'기억 단서를 보고 외울 내용을 떠올려 보세요.'}</p><div className="custom-cue"><small>{current.back||current.hint?'뜻 / 힌트':'기억 단서'}</small>{current.back&&<p>{current.back}</p>}{current.hint&&<p>{current.hint}</p>}{!current.back&&!current.hint&&<p>{maskedCue(current.front)}</p>}</div>{!revealed?<button className="primary" onClick={()=>setRevealed(true)}>외울 내용 보기<ArrowRight size={16}/></button>:<><div className="custom-answer" aria-live="polite"><small>외울 내용</small><p>{current.front}</p></div><p className="custom-assess">기억했나요? 직접 판단해 주세요.</p><div className="custom-review-actions"><button className="primary" onClick={()=>{onReview(current.id,true);setRevealed(false)}}><Check size={16}/>기억했어요</button><button className="custom-secondary" onClick={()=>{onReview(current.id,false);setRevealed(false)}}><RotateCcw size={16}/>다시 볼게요</button></div></>}</div>:<div className="custom-empty"><p>지금 복습할 항목이 없어요.</p>{next&&<p>다음 복습은 <time dateTime={new Date(next.dueAt).toISOString()}>{dateLabel(next.dueAt,timezone)}</time>이에요.</p>}</div>}</section>
  <details ref={listRef} className="custom-panel custom-list-panel"><summary className="custom-panel-heading"><span>저장한 항목</span><span>{cards.length}개</span></summary>{ordered.length?<div className="custom-list">{ordered.map(card=><div className="custom-row" key={card.id}>{editing===card.id?<form onSubmit={finishEdit} className="custom-form custom-edit-form"><label>외울 내용<textarea ref={editFrontRef} value={editFront} maxLength={180} required rows={2} onChange={e=>setEditFront(e.target.value)}/><small>{editFront.length}/180</small></label><label>뜻<textarea value={editBack} maxLength={360} rows={2} onChange={e=>setEditBack(e.target.value)}/><small>{editBack.length}/360</small></label><label>힌트<textarea value={editHint} maxLength={240} rows={2} onChange={e=>setEditHint(e.target.value)}/><small>{editHint.length}/240</small></label><div className="custom-row-actions"><button className="primary" disabled={!editFront.trim()} type="submit"><Check size={15}/>저장</button><button className="custom-secondary" type="button" onClick={()=>setEditing(null)}><X size={15}/>취소</button></div></form>:<><div className="custom-row-body"><strong>{card.front}</strong>{card.back&&<p>뜻: {card.back}</p>}{card.hint&&<p>힌트: {card.hint}</p>}{card.source&&<small><SourceAttribution source={card.source}/></small>}<small>{card.dueAt<=now?'지금 복습할 시간':`다음 복습 ${dateLabel(card.dueAt,timezone)}`}</small></div><div className="custom-row-actions"><button className="custom-secondary" onClick={()=>beginEdit(card)} aria-label={`${card.front} 수정`}>수정</button><button className="custom-danger" onClick={()=>remove(card)} aria-label={`${card.front} 삭제`}><Trash2 size={15}/>삭제</button></div></>}</div>)}</div>:<p className="custom-empty">아직 저장한 항목이 없어요. 첫 항목을 적어 보세요.</p>}</details>
  <p className="custom-footnote">기억한 항목은 3 → 7 → 14 → 30 → 60일 간격으로, 다시 볼 항목은 다음 날 복습해요. 날짜는 {timezone} 기준이에요.</p>
 </section>
}
