import React, {useEffect, useState} from 'react';
import {ArrowLeft, Copy, Download, Sprout} from 'lucide-react';
import './admin-reset.css';

const messages={
 INVALID_EMAIL:'올바른 이메일 주소를 입력해 주세요.',
 INVALID_PASSWORD:'계정의 새 비밀번호는 4~128자로 입력해 주세요.',
 INVALID_ADMIN_PASSWORD:'관리자 비밀번호는 12~128자, UTF-8 기준 512바이트 이하로 입력해 주세요.',
 INVALID_ADMIN_KEY:'관리자 키를 확인해 주세요.',
 AUTH_REQUIRED:'관리자 인증 정보를 확인해 주세요.',
 ADMIN_UNAVAILABLE:'관리자 기능을 사용할 수 없어요. 사이트 소유자에게 문의해 주세요.',
 ADMIN_NOT_CONFIGURED:'관리자 비밀번호를 먼저 설정해 주세요.',
 ADMIN_ALREADY_CONFIGURED:'관리자 비밀번호가 이미 설정되어 있어요.',
 ACCOUNT_NOT_FOUND:'해당 이메일의 계정을 찾을 수 없어요.',
 RESET_CONFLICT:'계정 정보가 변경되었어요. 다시 시도해 주세요.',
 RATE_LIMITED:'요청이 많아요. 잠시 후 다시 시도해 주세요.',
 STORAGE_UNAVAILABLE:'서버 저장소에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.'
};
const adminPasswordValid=value=>{const length=Array.from(value).length;return length>=12&&length<=128&&new TextEncoder().encode(value).length<=512};
const keyValid=value=>/^[a-fA-F0-9]{64}$/.test(value);
const adminPasswordHint='12~128자, UTF-8 기준 512바이트 이하. 공백도 비밀번호에 포함돼요.';

async function request(path,body,key){
 const response=await fetch(path,{method:'POST',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',
  headers:{'Content-Type':'application/json',...(key?{Authorization:`Bearer ${key}`}:{})},body:JSON.stringify(body)});
 let data;try{data=await response.json()}catch{throw new Error('서버 응답을 확인할 수 없어요. 잠시 후 다시 시도해 주세요.')}
 if(!response.ok)throw new Error(messages[data?.code]||'요청을 완료하지 못했어요. 입력한 정보를 확인해 주세요.');
 return data;
}

export default function AdminReset(){
 const [configured,setConfigured]=useState(null);
 const [statusError,setStatusError]=useState('');
 const [fields,setFields]=useState({email:'',adminPassword:'',password:'',confirm:'',setupKey:'',setupPassword:'',setupConfirm:'',changeCurrent:'',changeNew:'',changeConfirm:'',recoverKey:'',recoverNew:'',recoverConfirm:''});
 const [recoveryCode,setRecoveryCode]=useState('');
 const [errors,setErrors]=useState({});
 const [done,setDone]=useState({});
 const [copied,setCopied]=useState(false);
 const [busy,setBusy]=useState('');
 const field=(name,label,type='password',props={})=><label key={name}>{label}<input type={type} required value={fields[name]} onChange={event=>setFields(current=>({...current,[name]:event.target.value}))} {...props}/></label>;
 const clear=(names)=>setFields(current=>({...current,...Object.fromEntries(names.map(name=>[name,'']))}));
 const fail=(name,message)=>setErrors(current=>({...current,[name]:message}));

 useEffect(()=>{
  let active=true;
  fetch('/api/admin/status',{credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'})
   .then(async response=>{if(!response.ok)throw new Error();const data=await response.json();if(typeof data?.configured!=='boolean')throw new Error();return data.configured})
   .then(value=>{if(active)setConfigured(value)})
   .catch(()=>{if(active)setStatusError('관리자 설정 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.')});
  const clearCode=()=>setRecoveryCode('');
  const clearRestoredCode=event=>{if(event.persisted)clearCode()};
  window.addEventListener('pagehide',clearCode);window.addEventListener('pageshow',clearRestoredCode);
  return ()=>{active=false;window.removeEventListener('pagehide',clearCode);window.removeEventListener('pageshow',clearRestoredCode)};
 },[]);

 async function submit(event,kind){
  event.preventDefault();if(busy)return;
  fail(kind,'');setDone(current=>({...current,[kind]:false}));
  let path,body,key,names;
  if(kind==='reset'){
   if(fields.password!==fields.confirm){fail(kind,'계정의 새 비밀번호가 서로 달라요.');return}
   if(!adminPasswordValid(fields.adminPassword)){fail(kind,messages.INVALID_ADMIN_PASSWORD);return}
   path='/api/admin/password-reset';body={email:fields.email.trim(),newPassword:fields.password,adminPassword:fields.adminPassword};
   names=['adminPassword','password','confirm'];setCopied(false);
  }else if(kind==='setup'){
   if(fields.setupPassword!==fields.setupConfirm){fail(kind,'관리자 비밀번호가 서로 달라요.');return}
   if(!adminPasswordValid(fields.setupPassword)){fail(kind,messages.INVALID_ADMIN_PASSWORD);return}
   key=fields.setupKey.trim();if(!keyValid(key)){fail(kind,'관리자 키는 64자리 16진수여야 해요.');return}
   path='/api/admin/setup';body={adminPassword:fields.setupPassword};names=['setupKey','setupPassword','setupConfirm'];
  }else if(kind==='change'){
   if(fields.changeNew!==fields.changeConfirm){fail(kind,'새 관리자 비밀번호가 서로 달라요.');return}
   if(!adminPasswordValid(fields.changeCurrent)||!adminPasswordValid(fields.changeNew)){fail(kind,messages.INVALID_ADMIN_PASSWORD);return}
   path='/api/admin/password-change';body={currentPassword:fields.changeCurrent,newPassword:fields.changeNew};names=['changeCurrent','changeNew','changeConfirm'];
  }else{
   if(fields.recoverNew!==fields.recoverConfirm){fail(kind,'새 관리자 비밀번호가 서로 달라요.');return}
   if(!adminPasswordValid(fields.recoverNew)){fail(kind,messages.INVALID_ADMIN_PASSWORD);return}
   key=fields.recoverKey.trim();if(!keyValid(key)){fail(kind,'관리자 키는 64자리 16진수여야 해요.');return}
   path='/api/admin/password-recover';body={newPassword:fields.recoverNew};names=['recoverKey','recoverNew','recoverConfirm'];
  }
  clear(names);setBusy(kind);
  try{
   const data=await request(path,body,key);
   if(kind==='reset'){
    if(typeof data?.recoveryCode!=='string'||!data.recoveryCode)throw new Error('변경 결과의 복구 코드를 확인할 수 없어요. 사이트 소유자에게 문의해 주세요.');
    setRecoveryCode(data.recoveryCode);
   }else{if(kind==='setup'||kind==='recover')setConfigured(true);setDone(current=>({...current,[kind]:true}))}
  }catch(cause){fail(kind,cause instanceof Error?cause.message:'서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.')}
  finally{setBusy('')}
 }
 async function copyCode(){try{await navigator.clipboard.writeText(recoveryCode);setCopied(true)}catch{fail('reset','복사하지 못했어요. 코드를 직접 선택해 복사해 주세요.')}}
 function downloadCode(){
  const url=URL.createObjectURL(new Blob([`Bloom 복구 코드\n${recoveryCode}\n안전한 곳에 보관하세요.\n`],{type:'text/plain;charset=utf-8'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download='bloom-recovery-code.txt';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),0);
 }
 const feedback=(kind,success)=> <>{errors[kind]&&<p className="admin-reset-error" role="alert">{errors[kind]}</p>}{done[kind]&&<p className="admin-reset-success" role="status">{success}</p>}</>;
 const hint=<p className="admin-reset-hint">{adminPasswordHint}</p>;
 return <main className="admin-reset-screen"><div className="admin-reset-wrap">
  <header className="admin-reset-header"><a className="admin-reset-brand" href="/"><Sprout size={28} aria-hidden="true"/>bloom.</a><a className="admin-reset-back" href="/"><ArrowLeft size={16} aria-hidden="true"/>학습 공간으로</a></header>
  <section className="admin-reset-panel" aria-labelledby="admin-reset-title"><p className="admin-reset-eyebrow">BLOOM ADMIN</p><h1 id="admin-reset-title">계정 비밀번호 재설정</h1>
   {recoveryCode?<div className="admin-reset-result" role="status"><h2>비밀번호가 변경되었어요</h2><p>기존 로그인 세션은 모두 종료돼요. 학습 기록은 그대로 유지돼요.</p>
    <div className="admin-reset-warning"><strong>새 복구 코드를 지금 안전하게 보관해 주세요.</strong><span>이 코드는 이 화면에서만 한 번 보여요. 새로고침하거나 이동하면 다시 볼 수 없어요. 이전 복구 코드는 사용할 수 없어요.</span></div>
    <code className="admin-reset-code">{recoveryCode}</code>
    <div className="admin-reset-actions"><button type="button" onClick={copyCode}><Copy size={16} aria-hidden="true"/>{copied?'복사했어요':'복구 코드 복사'}</button><button type="button" onClick={downloadCode}><Download size={16} aria-hidden="true"/>파일로 저장</button></div>
    {feedback('reset','')}<button type="button" className="admin-reset-again" onClick={()=>{setRecoveryCode('');fail('reset','');setCopied(false);clear(['email'])}}>다른 계정 재설정</button>
   </div>:<><p className="admin-reset-lead">관리자 비밀번호로 계정의 새 비밀번호와 복구 코드를 발급합니다.</p><div className="admin-reset-info">재설정하면 기존 로그인 세션이 모두 종료돼요. 기존 학습 기록은 유지돼요.</div>
    <form className="admin-reset-form" onSubmit={event=>submit(event,'reset')}>
     {field('email','계정 이메일','email',{autoComplete:'email',placeholder:'name@example.com'})}
     {field('adminPassword','관리자 비밀번호','password',{autoComplete:'off'})}
     {field('password','계정의 새 비밀번호','password',{autoComplete:'new-password',minLength:4,maxLength:128,placeholder:'4~128자'})}
     {field('confirm','계정의 새 비밀번호 확인','password',{autoComplete:'new-password',minLength:4,maxLength:128})}
     {feedback('reset','')}<button type="submit" className="admin-reset-submit" disabled={!!busy}>{busy==='reset'?'재설정하고 있어요…':'계정 비밀번호 재설정'}</button>
    </form></>}
  </section>
  <section className="admin-reset-manage" aria-label="관리자 비밀번호 관리">
   <details className="admin-reset-panel admin-reset-details" open={configured===false?true:undefined}><summary>처음 설정하기 <span>사이트 소유자용 · 64자리 관리자 키 필요</span></summary>
    <p>사이트 소유자는 기존 64자리 키를 한 번 입력해 관리자 비밀번호를 설정하세요. 설정 후 계정 재설정에는 관리자 비밀번호를 사용해요.</p>
    {configured===true&&<p className="admin-reset-note">관리자 비밀번호가 이미 설정되어 있어요. 변경하려면 아래의 비밀번호 변경을 이용하세요.</p>}
    {statusError&&<p className="admin-reset-error" role="alert">{statusError}</p>}
    <form className="admin-reset-form" onSubmit={event=>submit(event,'setup')}>
     {field('setupKey','기존 64자리 관리자 키','password',{autoComplete:'off',spellCheck:false})}
     {field('setupPassword','새 관리자 비밀번호','password',{autoComplete:'new-password'})}
     {field('setupConfirm','새 관리자 비밀번호 확인','password',{autoComplete:'new-password'})}
     {hint}{errors.setup&&<p className="admin-reset-error" role="alert">{errors.setup}</p>}
     <button type="submit" className="admin-reset-submit" disabled={!!busy||configured===true}>{busy==='setup'?'설정하고 있어요…':'관리자 비밀번호 설정'}</button>
    </form>
   </details>
   {done.setup&&<p className="admin-reset-success" role="status">관리자 비밀번호를 설정했어요. 이제 위에서 계정 비밀번호를 재설정할 수 있어요.</p>}
   <details className="admin-reset-panel admin-reset-details"><summary>관리자 비밀번호 변경 <span>현재 비밀번호 필요</span></summary>
    <p>현재 관리자 비밀번호를 알고 있다면 새 비밀번호로 변경할 수 있어요.</p>
    <form className="admin-reset-form" onSubmit={event=>submit(event,'change')}>
     {field('changeCurrent','현재 관리자 비밀번호','password',{autoComplete:'current-password'})}
     {field('changeNew','새 관리자 비밀번호','password',{autoComplete:'new-password'})}
     {field('changeConfirm','새 관리자 비밀번호 확인','password',{autoComplete:'new-password'})}
     {hint}{feedback('change','관리자 비밀번호를 변경했어요.')}
     <button type="submit" className="admin-reset-submit" disabled={!!busy}>{busy==='change'?'변경하고 있어요…':'관리자 비밀번호 변경'}</button>
    </form>
   </details>
   <details className="admin-reset-panel admin-reset-details"><summary>긴급 비밀번호 복구 <span>기존 64자리 관리자 키 필요</span></summary>
    <p>관리자 비밀번호를 잊었다면 사이트 소유자가 기존 64자리 키로 새 관리자 비밀번호를 지정할 수 있어요. 이 키로 계정을 직접 재설정할 수는 없어요.</p>
    <form className="admin-reset-form" onSubmit={event=>submit(event,'recover')}>
     {field('recoverKey','기존 64자리 관리자 키','password',{autoComplete:'off',spellCheck:false})}
     {field('recoverNew','새 관리자 비밀번호','password',{autoComplete:'new-password'})}
     {field('recoverConfirm','새 관리자 비밀번호 확인','password',{autoComplete:'new-password'})}
     {hint}{feedback('recover','관리자 비밀번호를 복구했어요.')}
     <button type="submit" className="admin-reset-submit" disabled={!!busy}>{busy==='recover'?'복구하고 있어요…':'관리자 비밀번호 복구'}</button>
    </form>
   </details>
  </section>
 </div></main>;
}
