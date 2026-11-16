import React, {useEffect, useState} from 'react';
import {ArrowLeft, Copy, Download, Sprout} from 'lucide-react';
import './admin-reset.css';

const messages={
 INVALID_EMAIL:'올바른 이메일 주소를 입력해 주세요.',
 INVALID_PASSWORD:'새 비밀번호는 4~128자로 입력해 주세요.',
 INVALID_ADMIN_KEY:'관리자 키를 확인해 주세요.',
 AUTH_REQUIRED:'관리자 키를 확인해 주세요. 키가 설정되지 않았다면 사이트 소유자에게 문의해 주세요.',
 ADMIN_UNAVAILABLE:'관리자 키가 설정되지 않았어요. 사이트 소유자에게 문의해 주세요.',
 ADMIN_NOT_CONFIGURED:'관리자 키가 설정되지 않았어요. 사이트 소유자에게 문의해 주세요.',
 ACCOUNT_NOT_FOUND:'해당 이메일의 계정을 찾을 수 없어요.',
 RESET_CONFLICT:'계정 정보가 변경되었어요. 다시 시도해 주세요.',
 RATE_LIMITED:'요청이 많아요. 잠시 후 다시 시도해 주세요.',
 STORAGE_UNAVAILABLE:'서버 저장소에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.'
};

export default function AdminReset(){
 const [email,setEmail]=useState('');
 const [adminKey,setAdminKey]=useState('');
 const [password,setPassword]=useState('');
 const [confirm,setConfirm]=useState('');
 const [recoveryCode,setRecoveryCode]=useState('');
 const [error,setError]=useState('');
 const [copied,setCopied]=useState(false);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  const clearCode=()=>setRecoveryCode('');
  const clearRestoredCode=event=>{if(event.persisted)clearCode()};
  window.addEventListener('pagehide',clearCode);
  window.addEventListener('pageshow',clearRestoredCode);
  return ()=>{window.removeEventListener('pagehide',clearCode);window.removeEventListener('pageshow',clearRestoredCode)};
 },[]);

 async function submit(event){
  event.preventDefault();
  if(busy)return;
  setError('');
  setCopied(false);
  const request={email:email.trim(),newPassword:password};
  const key=adminKey.trim();
  if(password!==confirm){setError('새 비밀번호가 서로 달라요.');return}
  if(!/^[a-fA-F0-9]{64}$/.test(key)){setError('관리자 키는 64자리 16진수여야 해요.');return}
  setAdminKey('');setPassword('');setConfirm('');
  setBusy(true);
  try{
   const response=await fetch('/api/admin/password-reset',{
    method:'POST',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},
    body:JSON.stringify(request)
   });
   let data;
   try{data=await response.json()}catch{throw new Error('서버 응답을 확인할 수 없어요. 잠시 후 다시 시도해 주세요.')}
   if(!response.ok)throw new Error(messages[data?.code]||'비밀번호를 변경하지 못했어요. 이메일과 관리자 키를 확인해 주세요.');
   if(typeof data?.recoveryCode!=='string'||!data.recoveryCode)throw new Error('변경 결과의 복구 코드를 확인할 수 없어요. 사이트 소유자에게 문의해 주세요.');
   setRecoveryCode(data.recoveryCode);
  }catch(cause){setError(cause instanceof Error?cause.message:'서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.')}
  finally{setBusy(false)}
 }

 async function copyCode(){
  try{await navigator.clipboard.writeText(recoveryCode);setCopied(true)}
  catch{setError('복사하지 못했어요. 코드를 직접 선택해 복사해 주세요.')}
 }
 function downloadCode(){
  const url=URL.createObjectURL(new Blob([`Bloom 복구 코드\n${recoveryCode}\n안전한 곳에 보관하세요.\n`],{type:'text/plain;charset=utf-8'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download='bloom-recovery-code.txt';anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),0);
 }

 return <main className="admin-reset-screen">
  <div className="admin-reset-wrap">
   <header className="admin-reset-header"><a className="admin-reset-brand" href="/"><Sprout size={28} aria-hidden="true"/>bloom.</a><a className="admin-reset-back" href="/"><ArrowLeft size={16} aria-hidden="true"/>학습 공간으로</a></header>
   <section className="admin-reset-panel" aria-labelledby="admin-reset-title">
    <p className="admin-reset-eyebrow">BLOOM ADMIN</p>
    <h1 id="admin-reset-title">계정 비밀번호 재설정</h1>
    {recoveryCode?<div className="admin-reset-result" role="status">
      <h2>비밀번호가 변경되었어요</h2>
      <p>기존 로그인 세션은 모두 종료돼요. 학습 기록은 그대로 유지돼요.</p>
      <div className="admin-reset-warning"><strong>새 복구 코드를 지금 안전하게 보관해 주세요.</strong><span>이 코드는 이 화면에서만 한 번 보여요. 새로고침하거나 이동하면 다시 볼 수 없어요. 이전 복구 코드는 사용할 수 없어요.</span></div>
      <code className="admin-reset-code">{recoveryCode}</code>
      <div className="admin-reset-actions"><button type="button" onClick={copyCode}><Copy size={16} aria-hidden="true"/>{copied?'복사했어요':'복구 코드 복사'}</button><button type="button" onClick={downloadCode}><Download size={16} aria-hidden="true"/>파일로 저장</button></div>
      {error&&<p className="admin-reset-error" role="alert">{error}</p>}
      <button type="button" className="admin-reset-again" onClick={()=>{setRecoveryCode('');setError('');setCopied(false);setEmail('')}}>다른 계정 재설정</button>
     </div>:<>
      <p className="admin-reset-lead">사이트 관리자가 계정의 새 비밀번호와 복구 코드를 발급합니다.</p>
      <div className="admin-reset-info">재설정하면 기존 로그인 세션이 모두 종료돼요. 기존 학습 기록은 유지돼요.</div>
      <form className="admin-reset-form" onSubmit={submit}>
       <label>계정 이메일<input type="email" required autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="name@example.com"/></label>
       <label>관리자 키<input type="password" required autoComplete="off" spellCheck="false" value={adminKey} onChange={event=>setAdminKey(event.target.value)} placeholder="64자리 관리자 키"/></label>
       <label>새 비밀번호<input type="password" required minLength={4} maxLength={128} autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="4~128자"/></label>
       <label>새 비밀번호 확인<input type="password" required minLength={4} maxLength={128} autoComplete="new-password" value={confirm} onChange={event=>setConfirm(event.target.value)}/></label>
       {error&&<p className="admin-reset-error" role="alert">{error}</p>}
       <button type="submit" className="admin-reset-submit" disabled={busy}>{busy?'재설정하고 있어요…':'비밀번호 재설정'}</button>
      </form>
      <p className="admin-reset-help">관리자 키가 설정되지 않았거나 키를 모른다면 사이트 소유자에게 문의해 주세요.</p>
     </>}
   </section>
  </div>
 </main>;
}
