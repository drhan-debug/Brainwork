import React, {useState, useEffect, useLayoutEffect, useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowUpRight, ArrowRight, BookOpen, ChartNoAxesCombined, Check, ChevronLeft, ChevronRight, CircleHelp, Flame, Headphones, Home, Leaf, Lightbulb, Mic, Play, Plus, Settings, Sparkles, Sprout, Target, Volume2, X, RotateCcw, CheckCircle2, Clock3} from 'lucide-react';
import './style.css';
import SentenceSession from './SessionPlayer';
import {AccountGateway, accountApi, RecoveryNotice} from './Accounts';
import {englishScenarios} from './content/scenarios.en';
import {japaneseScenarios} from './content/scenarios.ja';
import {assertValidCurriculum, getScenario} from './learning/schema';
import {recordSentenceOutcome, getDueSentenceIds, aggregateSentenceResults} from './learning/schedule';
import {dateKey, recentCalendarDays, streak} from './learning/calendar';

const curricula={en:assertValidCurriculum(englishScenarios,'en'),ja:assertValidCurriculum(japaneseScenarios,'ja')};
function normalizeSentenceProgress(value,lang){
 if(!value||typeof value!=='object'||Array.isArray(value))return {};
 const valid=new Set(curricula[lang].flatMap(scene=>scene.sentences.map(sentence=>sentence.id)));
 return Object.fromEntries(Object.entries(value).filter(([id,entry])=>valid.has(id)&&entry&&typeof entry==='object'&&!Array.isArray(entry)&&Number.isFinite(entry.dueAt)&&entry.dueAt>=0&&entry.dueAt<=8640000000000000).map(([id,entry])=>[id,{
  ...entry,stage:Number.isInteger(entry.stage)&&entry.stage>=0&&entry.stage<=5?entry.stage:0,
  lastOutcome:['passed','failed'].includes(entry.lastOutcome)?entry.lastOutcome:'failed',
  ...(Number.isFinite(entry.lastReviewedAt)&&entry.lastReviewedAt>=0&&entry.lastReviewedAt<=8640000000000000?{lastReviewedAt:entry.lastReviewedAt}:{lastReviewedAt:0})
 }]));
}

const artwork={
 'photo-1442512595331-e89e73853f31':'coffee',
 'photo-1490750967868-88aa4486c946':'flowers',
 'photo-1544787219-7f47ccb76574':'tea',
 'photo-1441974231531-c6227db76b6e':'forest',
 'photo-1509042239860-f550ce710b93':'coffee',
 'photo-1476514525535-07fb3b4ae5f1':'travel',
 'photo-1436491865332-7a61a109cc05':'airport',
 'photo-1488646953014-85cb44e25828':'luggage',
 'photo-1507842217343-583bb7270b66':'books'
};
const photo=(id)=>`/images/${artwork[id]||'coffee'}.svg`;
const words=[
 {word:'Serendipity',pron:'/ˌser.ənˈdɪp.ə.ti/',meaning:'뜻밖의 행운, 우연한 발견',example:'Finding this little café was pure serendipity.',ko:'이 작은 카페를 발견한 건 뜻밖의 행운이었어요.',image:'photo-1442512595331-e89e73853f31',hint:'산책 중 우연히 만난, 나만 알고 싶은 작은 카페를 떠올려 보세요.'},
 {word:'Bloom',pron:'/bluːm/',meaning:'꽃이 피다, 활짝 피어나다',example:'The flowers bloom in spring.',ko:'봄이면 꽃이 활짝 피어요.',image:'photo-1490750967868-88aa4486c946',hint:'조금씩 꽃을 피우는 나의 영어 실력을 떠올려 보세요.'},
 {word:'Unwind',pron:'/ʌnˈwaɪnd/',meaning:'긴장을 풀다, 편히 쉬다',example:'I like to unwind with a cup of tea.',ko:'저는 차 한 잔을 마시며 쉬는 걸 좋아해요.',image:'photo-1544787219-7f47ccb76574',hint:'길었던 하루 끝에 따뜻한 차 한 잔과 함께 쉬는 순간이에요.'},
 {word:'Wander',pron:'/ˈwɑːn.dɚ/',meaning:'거닐다, 정처 없이 걷다',example:'Let’s wander around the neighborhood.',ko:'동네를 천천히 거닐어 봐요.',image:'photo-1441974231531-c6227db76b6e',hint:'목적지를 정하지 않고 초록빛 숲길을 걸어 보세요.'},
 {word:'Savor',pron:'/ˈseɪ.vɚ/',meaning:'음미하다, 만끽하다',example:'Take a moment to savor your coffee.',ko:'잠시 커피를 음미하는 시간을 가져 보세요.',image:'photo-1509042239860-f550ce710b93',hint:'커피의 향과 맛을 천천히 느껴 보세요.'}
];
const travelWords=[
 {word:'Reservation',pron:'/ˌrez.ɚˈveɪ.ʃən/',meaning:'예약',example:'I have a reservation under Kim.',ko:'김이라는 이름으로 예약했어요.',image:'photo-1476514525535-07fb3b4ae5f1',hint:'호텔 프런트에서 내 이름으로 된 예약을 확인하는 장면이에요.'},
 {word:'Boarding pass',pron:'/ˈbɔːr.dɪŋ pæs/',meaning:'탑승권',example:'Here is my boarding pass.',ko:'여기 제 탑승권이에요.',image:'photo-1436491865332-7a61a109cc05',hint:'비행기에 오르기 전 탑승권을 보여주는 장면을 떠올려 보세요.'},
 {word:'Destination',pron:'/ˌdes.təˈneɪ.ʃən/',meaning:'목적지',example:'What is your final destination?',ko:'최종 목적지가 어디인가요?',image:'photo-1476514525535-07fb3b4ae5f1',hint:'설레는 여행의 마지막 도착지를 지도에서 찾아보세요.'},
 {word:'Luggage',pron:'/ˈlʌɡ.ɪdʒ/',meaning:'여행 가방, 수하물',example:'Where can I collect my luggage?',ko:'제 수하물은 어디서 찾을 수 있나요?',image:'photo-1488646953014-85cb44e25828',hint:'공항에서 돌아오는 내 여행 가방을 기다리는 순간이에요.'},
 {word:'Explore',pron:'/ɪkˈsplɔːr/',meaning:'탐험하다, 둘러보다',example:'Let’s explore the old town.',ko:'구시가지를 둘러봐요.',image:'photo-1476514525535-07fb3b4ae5f1',hint:'처음 만나는 도시의 골목을 하나씩 걸어보세요.'}
];
const personalWords=[
 {word:'Favorite',pron:'/ˈfeɪ.vər.ɪt/',meaning:'가장 좋아하는',example:'What is your favorite book?',ko:'가장 좋아하는 책은 무엇인가요?',image:'photo-1507842217343-583bb7270b66',hint:'책장 속에서 내가 가장 자주 꺼내 읽는 책을 떠올려요.'},
 {word:'Hobby',pron:'/ˈhɑː.bi/',meaning:'취미',example:'My hobby is taking photos.',ko:'제 취미는 사진 찍기예요.',image:'photo-1476514525535-07fb3b4ae5f1',hint:'쉬는 날 나를 즐겁게 해주는 활동을 떠올려 보세요.'},
 {word:'Curious',pron:'/ˈkjʊr.i.əs/',meaning:'호기심이 많은',example:'I am curious about new cultures.',ko:'저는 새로운 문화가 궁금해요.',image:'photo-1441974231531-c6227db76b6e',hint:'숲에서 처음 보는 식물을 발견한 순간이에요.'},
 {word:'Prefer',pron:'/prɪˈfɝː/',meaning:'더 좋아하다, 선호하다',example:'I prefer tea to coffee.',ko:'저는 커피보다 차를 더 좋아해요.',image:'photo-1544787219-7f47ccb76574',hint:'차와 커피 중 내가 더 좋아하는 음료를 골라보세요.'},
 {word:'Grateful',pron:'/ˈɡreɪt.fəl/',meaning:'감사하는',example:'I am grateful for your help.',ko:'도와주셔서 감사해요.',image:'photo-1490750967868-88aa4486c946',hint:'고마운 사람에게 꽃 한 송이를 건네는 장면이에요.'}
];
const englishGroups=[words,travelWords,personalWords].map((group,i)=>group.map((w,j)=>({...w,id:`en-${i}-${j}`,key:w.word})));
// Segments pair written Japanese with its kana reading. Plain strings have no ruby.
const japaneseGroups=[[
 {id:'ja-cafe-order',word:'注文',reading:'ちゅうもん',parts:[['注文','ちゅうもん']],meaning:'주문',example:'コーヒーを一つください。',sentence:['コーヒーを',['一','ひと'],'つください。'],kana:'コーヒーをひとつください。',ko:'커피 한 잔 주세요.'},
 {id:'ja-cafe-takeout',word:'持ち帰り',reading:'もちかえり',parts:[['持','も'],'ち',['帰','かえ'],'り'],meaning:'포장, 가져가기',example:'持ち帰りでお願いします。',sentence:[['持','も'],'ち',['帰','かえ'],'りでお',['願','ねが'],'いします。'],kana:'もちかえりでおねがいします。',ko:'포장해 주세요.'},
 {id:'ja-cafe-pay',word:'会計',reading:'かいけい',parts:[['会計','かいけい']],meaning:'계산',example:'お会計をお願いします。',sentence:['お',['会計','かいけい'],'をお',['願','ねが'],'いします。'],kana:'おかいけいをおねがいします。',ko:'계산 부탁합니다.'}
],[
 {id:'ja-travel-station',word:'駅',reading:'えき',parts:[['駅','えき']],meaning:'역',example:'駅はどこですか。',sentence:[['駅','えき'],'はどこですか。'],kana:'えきはどこですか。',ko:'역은 어디인가요?'},
 {id:'ja-travel-ticket',word:'切符',reading:'きっぷ',parts:[['切符','きっぷ']],meaning:'표, 승차권',example:'東京までの切符をください。',sentence:[['東京','とうきょう'],'までの',['切符','きっぷ'],'をください。'],kana:'とうきょうまでのきっぷをください。',ko:'도쿄까지 가는 표를 주세요.'},
 {id:'ja-travel-reserve',word:'予約',reading:'よやく',parts:[['予約','よやく']],meaning:'예약',example:'予約しています。',sentence:[['予約','よやく'],'しています。'],kana:'よやくしています。',ko:'예약했습니다.'}
],[
 {id:'ja-me-name',word:'名前',reading:'なまえ',parts:[['名前','なまえ']],meaning:'이름',example:'私の名前はキムです。',sentence:[['私','わたし'],'の',['名前','なまえ'],'はキムです。'],kana:'わたしのなまえはキムです。',ko:'제 이름은 김입니다.'},
 {id:'ja-me-hobby',word:'趣味',reading:'しゅみ',parts:[['趣味','しゅみ']],meaning:'취미',example:'趣味は旅行です。',sentence:[['趣味','しゅみ'],'は',['旅行','りょこう'],'です。'],kana:'しゅみはりょこうです。',ko:'취미는 여행입니다.'},
 {id:'ja-me-thanks',word:'ありがとう',reading:'ありがとう',parts:['ありがとう'],meaning:'고마워요',example:'ありがとうございます。',sentence:['ありがとうございます。'],kana:'ありがとうございます。',ko:'감사합니다.'}
]].map((group,i)=>group.map(w=>({...w,key:w.id,pron:w.reading,hint:w.ko,image:['photo-1442512595331-e89e73853f31','photo-1476514525535-07fb3b4ae5f1','photo-1441974231531-c6227db76b6e'][i]})));
const profiles={wife:{label:'아내 · 영어',language:'영어',locale:'en-US',groups:englishGroups,titles:['일상에 스며드는 영어','설레는 여행의 시작','나를 위한 작은 대화']},husband:{label:'남편 · 일본어',language:'일본어',locale:'ja-JP',groups:japaneseGroups,titles:['카페에서 주문하기','여행에서 길 찾기','처음 만나 인사하기']}};
const STORAGE='bloom-profiles-v2';
const blank=(name)=>({learned:[],reviews:{},reviewStages:{},sessions:0,minutes:0,name,goal:10,dates:[],dailyMinutes:{},sentenceProgress:{}});
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const nonnegative=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
function normalizeLearner(value,name,lang='en'){
 const source=isRecord(value)?value:{},defaults=blank(name);
 const strings=value=>Array.isArray(value)?value.filter(entry=>typeof entry==='string'):[];
 const numbers=(value,valid=nonnegative)=>isRecord(value)?Object.fromEntries(Object.entries(value).filter(([,entry])=>valid(entry))):{};
 return {...source,...defaults,
  learned:strings(source.learned),reviews:numbers(source.reviews),
  reviewStages:numbers(source.reviewStages,value=>Number.isInteger(value)&&value>=0&&value<=5),
  sessions:nonnegative(source.sessions)&&Number.isInteger(source.sessions)?source.sessions:defaults.sessions,
  minutes:nonnegative(source.minutes)?source.minutes:defaults.minutes,
  name:typeof source.name==='string'?source.name:defaults.name,
  goal:nonnegative(source.goal)&&source.goal>0?source.goal:defaults.goal,
  dates:strings(source.dates),dailyMinutes:numbers(source.dailyMinutes),sentenceProgress:normalizeSentenceProgress(source.sentenceProgress,lang)};
}
function readSavedStore(){try{
 const saved=JSON.parse(localStorage.getItem(STORAGE));
 if(saved?.version===2&&isRecord(saved.learners))return {...saved,active:Object.hasOwn(profiles,saved.active)?saved.active:'wife',learners:{wife:normalizeLearner(saved.learners.wife,'지은'),husband:normalizeLearner(saved.learners.husband,'남편','ja')}};
}catch{}return null;}
function readStore(){const saved=readSavedStore();if(saved)return saved;let legacy;try{legacy=JSON.parse(localStorage.getItem('bloom-state'));}catch{}const initial={version:2,active:'wife',learners:{wife:normalizeLearner(legacy,'지은'),husband:blank('남편')}};try{localStorage.setItem(STORAGE,JSON.stringify(initial));}catch{}return initial;}
function readImportCandidates(){try{const saved=JSON.parse(localStorage.getItem(STORAGE));if(saved?.version===2&&isRecord(saved.learners))return Object.entries(profiles).filter(([key])=>isRecord(saved.learners[key])).map(([key,profile])=>({key,source:key,label:profile.label,language:key==='husband'?'ja':'en',learner:normalizeLearner(saved.learners[key],saved.learners[key].name||profile.label,key==='husband'?'ja':'en')}));const legacy=JSON.parse(localStorage.getItem('bloom-state'));if(isRecord(legacy))return [{key:'wife',source:'legacy',label:'기존 영어 기록',language:'en',learner:normalizeLearner(legacy,legacy.name||'나')}]}catch{}return []}
function Ruby({parts,fallback}){return <>{parts?parts.map((p,i)=>Array.isArray(p)?<ruby key={i}>{p[0]}<rt>{p[1]}</rt></ruby>:<React.Fragment key={i}>{p}</React.Fragment>):fallback}</>;}
const normalized=(s)=>s.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{Z}\s]/gu,'');
function matches(input,item){return [item.example,item.kana].filter(Boolean).some(t=>normalized(t)===normalized(input));}
const cafeDialogues={wife:[{prompt:'Welcome! What would you like?',ko:'어서 오세요! 무엇을 드릴까요?',answer:'A coffee, please.',meaning:'커피 한 잔 주세요.',accept:['a coffee please','I would like a coffee please','coffee please']},{prompt:'For here or to go?',ko:'드시고 가시나요, 가져가시나요?',answer:'To go, please.',meaning:'가져갈게요.',accept:['to go please','to go']},{prompt:'Anything else?',ko:'더 필요한 것이 있나요?',answer:'That is all, thank you.',meaning:'그게 다예요. 감사합니다.',accept:['that is all thank you','no thank you','thats all thank you']}],husband:[{prompt:'いらっしゃいませ。ご注文は？',parts:['いらっしゃいませ。ご',['注文','ちゅうもん'],'は？'],ko:'어서 오세요. 주문하시겠어요?',answer:'コーヒーを一つください。',kana:'コーヒーをひとつください。',meaning:'커피 한 잔 주세요.'},{prompt:'こちらでお召し上がりですか。',parts:['こちらでお',['召','め'],'し',['上','あ'],'がりですか。'],ko:'여기서 드시나요?',answer:'持ち帰りでお願いします。',kana:'もちかえりでおねがいします。',meaning:'포장해 주세요.'},{prompt:'ほかにご注文はありますか。',parts:['ほかにご',['注文','ちゅうもん'],'はありますか。'],ko:'다른 주문도 있으신가요?',answer:'大丈夫です。ありがとうございます。',kana:'だいじょうぶです。ありがとうございます。',meaning:'괜찮습니다. 감사합니다.'}]};
const dialogues={wife:[cafeDialogues.wife,[
 {prompt:'Hello! Do you have a reservation?',ko:'안녕하세요! 예약하셨나요?',answer:'I have a reservation under Kim.',meaning:'김이라는 이름으로 예약했어요.',accept:['I have a reservation under Kim']},
 {prompt:'May I see your boarding pass?',ko:'탑승권을 보여주시겠어요?',answer:'Here is my boarding pass.',meaning:'여기 제 탑승권이에요.',accept:['Here is my boarding pass']},
 {prompt:'What would you like to do today?',ko:'오늘 무엇을 하고 싶으세요?',answer:'Let’s explore the old town.',meaning:'구시가지를 둘러봐요.',accept:['Let’s explore the old town','Let us explore the old town']}
],[
 {prompt:'What is your favorite book?',ko:'가장 좋아하는 책이 무엇인가요?',answer:'My favorite book is The Little Prince.',meaning:'제가 가장 좋아하는 책은 어린 왕자예요.',accept:['My favorite book is The Little Prince']},
 {prompt:'What is your hobby?',ko:'취미가 무엇인가요?',answer:'My hobby is taking photos.',meaning:'제 취미는 사진 찍기예요.',accept:['My hobby is taking photos']},
 {prompt:'Would you like tea or coffee?',ko:'차와 커피 중 무엇을 드릴까요?',answer:'I prefer tea to coffee.',meaning:'저는 커피보다 차를 더 좋아해요.',accept:['I prefer tea to coffee']}
]],husband:[cafeDialogues.husband,[
 {prompt:'どうしましたか。',parts:['どうしましたか。'],ko:'무슨 일이신가요?',answer:'駅はどこですか。',kana:'えきはどこですか。',meaning:'역은 어디인가요?',answerParts:[['駅','えき'],'はどこですか。']},
 {prompt:'どこまでですか。',parts:['どこまでですか。'],ko:'어디까지 가시나요?',answer:'東京までの切符をください。',kana:'とうきょうまでのきっぷをください。',meaning:'도쿄까지 가는 표를 주세요.',answerParts:[['東京','とうきょう'],'までの',['切符','きっぷ'],'をください。']},
 {prompt:'ホテルの予約はありますか。',parts:['ホテルの',['予約','よやく'],'はありますか。'],ko:'호텔을 예약하셨나요?',answer:'予約しています。',kana:'よやくしています。',meaning:'예약했습니다.',answerParts:[['予約','よやく'],'しています。']}
],[
 {prompt:'お名前は何ですか。',parts:['お',['名前','なまえ'],'は',['何','なん'],'ですか。'],ko:'이름이 무엇인가요?',answer:'私の名前はキムです。',kana:'わたしのなまえはキムです。',meaning:'제 이름은 김입니다.',answerParts:[['私','わたし'],'の',['名前','なまえ'],'はキムです。']},
 {prompt:'趣味は何ですか。',parts:[['趣味','しゅみ'],'は',['何','なん'],'ですか。'],ko:'취미가 무엇인가요?',answer:'趣味は旅行です。',kana:'しゅみはりょこうです。',meaning:'취미는 여행입니다.',answerParts:[['趣味','しゅみ'],'は',['旅行','りょこう'],'です。']},
 {prompt:'よろしくお願いします。',parts:['よろしくお',['願','ねが'],'いします。'],ko:'잘 부탁드립니다.',answer:'こちらこそ、よろしくお願いします。',kana:'こちらこそ、よろしくおねがいします。',meaning:'저야말로 잘 부탁드립니다.',answerParts:['こちらこそ、よろしくお',['願','ねが'],'いします。']}
]]};
cafeDialogues.husband.forEach((t,i)=>{t.answerParts=[japaneseGroups[0][0].sentence,japaneseGroups[0][1].sentence,[['大丈夫','だいじょうぶ'],'です。ありがとうございます。']][i]});

// Keep a single focus session across lesson → completion, but focus each new dialog.
function useModalFocus(modal,appRef,dialogRef,onClose){
 const closeRef=useRef(onClose);closeRef.current=onClose;
 const visible=Boolean(modal);
 useLayoutEffect(()=>{
  if(!visible)return;
  const opener=document.activeElement;
  const dialog=dialogRef.current;
  const backgrounds=[...appRef.current.children].filter(element=>!element.contains(dialog));
  const previousInert=backgrounds.map(element=>element.inert);
  backgrounds.forEach(element=>{element.inert=true});
  const focusable=()=>[...dialog.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')]
   .filter(element=>!element.disabled&&element.tabIndex>=0&&!element.closest('[inert]')&&element.getClientRects().length);
  const focusFirst=()=>{(focusable()[0]||dialog).focus({preventScroll:true})};
  const keydown=event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeRef.current();return}
   if(event.key!=='Tab')return;
   const targets=focusable(),first=targets[0],last=targets[targets.length-1];
   if(!first){event.preventDefault();dialog.focus();return}
   if(!dialog.contains(document.activeElement)||event.shiftKey&&document.activeElement===first||!event.shiftKey&&document.activeElement===last){
    event.preventDefault();(event.shiftKey?last:first).focus();
   }
  };
  const containFocus=event=>{if(!dialog.contains(event.target))focusFirst()};
  document.addEventListener('keydown',keydown,true);
  document.addEventListener('focusin',containFocus,true);
  return()=>{
   document.removeEventListener('keydown',keydown,true);
   document.removeEventListener('focusin',containFocus,true);
   backgrounds.forEach((element,index)=>{element.inert=previousInert[index]});
   const canRestore=opener instanceof HTMLElement&&opener.isConnected&&!opener.closest('[inert]')&&!opener.disabled&&opener.getClientRects().length;
   const target=canRestore?opener:appRef.current?.querySelector('.nav-item.active');
   target?.focus({preventScroll:true});
  };
 },[visible]);
 useLayoutEffect(()=>{
  if(modal)dialogRef.current?.querySelector('.close-modal')?.focus({preventScroll:true});
 },[modal]);
}

function App({account,onLogout,onAccountChanged,demo=false}){
 const ownKey=account?.profile.language==='ja'?'husband':'wife';
 const initialStore=()=>account?{version:2,active:ownKey,learners:{[ownKey]:normalizeLearner({...account.learner,name:account.profile.name,goal:account.profile.goal},account.profile.name,account.profile.language)}}:readStore();
 const [syncStatus,setSyncStatus]=useState('saved'),[syncError,setSyncError]=useState(''),[logoutBusy,setLogoutBusy]=useState(false),[showImport,setShowImport]=useState(false),[importSource,setImportSource]=useState(''),[imports,setImports]=useState(account?.imports||[]),[accountProfile,setAccountProfile]=useState(account?.profile),[settingsDraft,setSettingsDraft]=useState(null);
 const importCandidates=readImportCandidates();
 const remote=useRef(account),sending=useRef(null),loggingOut=useRef(false),alive=useRef(true),requestController=useRef(new AbortController());
 const timezone=accountProfile?.timezone;
 const dayKey=(date=new Date())=>dateKey(date,timezone);

 const [store,setStore]=useState(initialStore),[page,setPage]=useState('홈'),[modal,setModal]=useState(null),[lesson,setLesson]=useState(null),[index,setIndex]=useState(0),[revealed,setRevealed]=useState(false),[answer,setAnswer]=useState(''),[feedback,setFeedback]=useState(null),[speech,setSpeech]=useState(''),[listening,setListening]=useState(false),[query,setQuery]=useState(''),[filter,setFilter]=useState('전체'),[scenario,setScenario]=useState(0),[now,setNow]=useState(Date.now()),[toast,setToast]=useState(''),[saveFailed,setSaveFailed]=useState(false),[sentenceSession,setSentenceSession]=useState(null),[sentenceScenario,setSentenceScenario]=useState('cafe_order');
 const appRef=useRef(null),dialogRef=useRef(null);
 useModalFocus(modal,appRef,dialogRef,close);
 const started=useRef(0),recognition=useRef(null),generation=useRef(0),storeRef=useRef(store),committed=useRef(store),pending=useRef([]);storeRef.current=store;
 const active=store.active,profile=account?{...profiles[active],label:profiles[active].language}:profiles[active],data=store.learners[active],allWords=profile.groups.flat(),todayMinutes=data.dailyMinutes?.[dayKey()]||0;
 const lang=active==='husband'?'ja':'en',scenarios=curricula[lang];
 const validSentenceIds=scenarios.flatMap(scene=>scene.sentences.map(sentence=>sentence.id));
 const dueSentenceIds=getDueSentenceIds(data.sentenceProgress,now,validSentenceIds);
 const dueScenes=scenarios.map(scene=>({...scene,dueSentences:scene.sentences.filter(sentence=>dueSentenceIds.includes(sentence.id))})).filter(scene=>scene.dueSentences.length);
 const plannedSentences=scenarios.flatMap(scene=>scene.sentences.map(sentence=>({...sentence,progress:data.sentenceProgress[sentence.id]}))).filter(sentence=>sentence.progress);
 useEffect(()=>{document.title=`Bloom — ${profile.label} · ${data.name||profile.label}의 문장 학습`},[active,data.name]);
 const due=allWords.filter(w=>Number(data.reviews[w.key])>0&&Number(data.reviews[w.key])<=now);
 const item=lesson?.items[index];const conversation=dialogues[active][lesson?.group||0];const turn=conversation[index];
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(t)},[]);
 useEffect(()=>()=>{alive.current=false;requestController.current.abort();pending.current=[];generation.current++;recognition.current?.abort();window.speechSynthesis?.cancel()},[]);
 useEffect(()=>{if(!account)return;const warn=event=>{if(pending.current.length){event.preventDefault();event.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[]);
 useEffect(()=>{if(account)return;const sync=e=>{if(e.key!==STORAGE)return;const latest=readSavedStore();if(!latest)return;if(pending.current.length){persist();return}const next={...latest,active:storeRef.current.active};committed.current=next;storeRef.current=next;setStore(next);setNow(Date.now())};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync)},[]);
 // Retry operations, never optimistic learner snapshots: rebase onto the latest saved data.
 // Each queued update captures its learner and immutable input before it can be replayed.
 function publish(next){storeRef.current=next;setStore(next);setNow(Date.now())}
 function serverStore(state){return {version:2,active:ownKey,learners:{[ownKey]:normalizeLearner({...state.learner,name:state.profile.name,goal:state.profile.goal},state.profile.name,state.profile.language)}}}
 function rebase(state){remote.current=state;committed.current=serverStore(state);setAccountProfile(state.profile);setImports(state.imports||[]);const next=pending.current.reduce((current,{learnerId,update})=>({...current,learners:{...current.learners,[learnerId]:update(current.learners[learnerId])}}),committed.current);publish(next)}
 function flush(){
  if(sending.current)return sending.current;
  if(!account||!pending.current.length||!alive.current)return Promise.resolve();
  setSyncStatus('saving');setSyncError('');
  sending.current=(async()=>{try{while(pending.current.length&&alive.current){
   const operation=pending.current[0];let response;let conflicts=0;
   while(true){try{response=await accountApi(operation.path,{...operation.payload,revision:remote.current.revision,expectedAccountId:account.account.id},requestController.current.signal,operation.method||'POST');break}catch(error){if(error.code==='ACCOUNT_CHANGED'||error.status===401){onAccountChanged();return}if(error.status===409&&error.state&&conflicts++<3){rebase(error.state);continue}throw error}}
   if(!alive.current)return;pending.current.shift();rebase(response);
  }if(alive.current){setSaveFailed(false);setSyncStatus('saved')}}catch(error){if(error.name!=='AbortError'&&alive.current){setSaveFailed(true);setSyncStatus('failed');setSyncError(error.message)}}finally{sending.current=null}})();
  return sending.current;
 }
 function persist(operation,active=storeRef.current.active){
  if(loggingOut.current)return;
  if(account){if(!operation)return;pending.current.push({...operation,payload:{...operation.payload,operationId:crypto.randomUUID()}});publish({...storeRef.current,learners:{...storeRef.current.learners,[operation.learnerId]:operation.update(storeRef.current.learners[operation.learnerId])}});setSyncStatus('saving');flush();return}
  if(operation)pending.current.push(operation);
  const latest=readSavedStore()||committed.current;
  const next=pending.current.reduce((current,{learnerId,update})=>({...current,learners:{...current.learners,[learnerId]:update(current.learners[learnerId])}}),{...latest,active});
  publish(next);
  try{localStorage.setItem(STORAGE,JSON.stringify(next));committed.current=next;pending.current=[];setSaveFailed(false)}
  catch{setSaveFailed(true);notify('저장하지 못했어요. 변경 사항은 이 창에 보관하고 다음 변경 때 다시 저장해요. 창을 닫으면 저장되지 않은 기록은 사라져요.')}
 }
 function save(update,payload,path='progress',method='POST'){persist({learnerId:storeRef.current.active,update,payload,path,method})}
 function saveProfile(values){const next={...accountProfile,name:data.name,goal:data.goal,...values};try{new Intl.DateTimeFormat('ko-KR',{timeZone:next.timezone}).format()}catch{notify('올바른 시간대를 입력해 주세요. 예: Asia/Seoul');return false}save(current=>({...current,name:next.name,goal:next.goal}),{profile:next},'profile','PATCH');return true}
 async function logout(){
  if(loggingOut.current)return;
  loggingOut.current=true;stop();setSentenceSession(null);setModal(null);setLesson(null);setLogoutBusy(true);
  try{
   if(account){await flush();if(!alive.current)return;if(pending.current.length){notify('저장하지 못한 변경이 있어요. 다시 저장하거나 변경을 취소한 뒤 로그아웃해 주세요.');return}}
   await onLogout();pending.current=[];
  }catch(error){if(error.code==='ACCOUNT_CHANGED'||error.status===401){onAccountChanged();return}setSyncError('로그아웃하지 못했어요. '+error.message);notify('로그아웃하지 못했어요. 다시 시도해 주세요.')}
  finally{loggingOut.current=false;if(alive.current)setLogoutBusy(false)}
 }
 function importLocal(){const selected=importCandidates.find(item=>item.key===importSource);if(!selected)return;persist({learnerId:active,update:current=>current,path:'import',payload:{source:selected.source,learner:selected.learner}});setShowImport(false);setImportSource('')}
 function startSentenceSession(sceneId=sentenceScenario,subset){
  stop();setModal(null);setLesson(null);
  const chosen=getScenario(scenarios,sceneId);if(!chosen)return;
  const sentences=subset||chosen.sentences;
  if(!sentences.length)return;
  setSentenceSession({scenario:chosen,sentences,lang,learnerId:active,completed:false});
 }
 function completeSentenceSession(session,payload){
  if(session.completed)return;
  const allowed=new Set(session.sentences.map(sentence=>sentence.id));
  const outcomes=aggregateSentenceResults(payload.results).filter(result=>allowed.has(result.sentenceId));
  if(outcomes.length!==allowed.size)return;
  session.completed=true;
  const at=Date.now(),day=dayKey(new Date(at)),elapsed=Math.round((Number.isFinite(payload.elapsedMs)?Math.max(0,payload.elapsedMs):0)/6000)/10;
  persist({learnerId:session.learnerId,path:'progress',payload:{type:'sentenceSession',results:outcomes,elapsedMs:payload.elapsedMs},update:current=>{
   let sentenceProgress=current.sentenceProgress;
   outcomes.forEach(({sentenceId,passed})=>{sentenceProgress=recordSentenceOutcome(sentenceProgress,sentenceId,{passed,at})});
   return {...current,sentenceProgress,sessions:current.sessions+1,minutes:Math.round((current.minutes+elapsed)*10)/10,
    dates:[...new Set([...current.dates,day])],dailyMinutes:{...current.dailyMinutes,[day]:Math.round(((current.dailyMinutes[day]||0)+elapsed)*10)/10}};
  }});
 }
 function notify(message){setToast(message);setTimeout(()=>setToast(''),3500)}
 function stop(){generation.current++;recognition.current?.abort();recognition.current=null;setListening(false);window.speechSynthesis?.cancel()}
 function close(){stop();setModal(null);setLesson(null)}
 function switchLearner(value){stop();persist(null,value);setModal(null);setLesson(null);setPage('홈');setQuery('');setFilter('전체');setScenario(0);setSentenceScenario('cafe_order');reset();}
 function reset(){setAnswer('');setFeedback(null);setSpeech('');setRevealed(false)}
 function speak(text){if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){notify('이 브라우저는 음성 재생을 지원하지 않아요. 문장을 읽고 연습해 주세요.');return}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=profile.locale;u.rate=.8;u.onerror=()=>notify('음성을 재생할 수 없어요. 기기의 음성 설정을 확인해 주세요.');speechSynthesis.speak(u)}
 function open(mode='단어 학습',group=0){stop();setLesson({mode,items:mode==='복습'?due:[...profile.groups[group]],group});setIndex(0);reset();started.current=Date.now();setModal('lesson')}
 function record(){const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition){setSpeech('음성인식을 지원하지 않는 브라우저예요. 아래 입력창으로 연습해 주세요.');return}stop();const token=generation.current;const r=new Recognition();recognition.current=r;r.lang=profile.locale;r.interimResults=false;r.onstart=()=>{if(token===generation.current)setListening(true)};r.onend=()=>{if(token===generation.current)setListening(false)};r.onerror=()=>{if(token===generation.current){setListening(false);setSpeech('마이크를 사용할 수 없어요. 권한을 확인하거나 아래에 직접 입력해 주세요.')}};r.onresult=e=>{if(token!==generation.current)return;setAnswer(e.results[0][0].transcript);setSpeech('인식한 문장을 입력창에 넣었어요. 문장 확인을 눌러 비교하세요.');setFeedback(null)};try{r.start()}catch{setListening(false);setSpeech('음성인식을 시작하지 못했어요. 아래에 직접 입력해 주세요.')}}
 function attempt(){if(!answer.trim())return;const ok=lesson.mode==='짧은 대화'?(active==='wife'?turn.accept.some(a=>normalized(a)===normalized(answer)):matches(answer,{example:turn.answer,kana:turn.kana})):matches(answer,item);setFeedback({ok});setRevealed(true)}
 function finish(known=true){
  stop();const total=lesson.mode==='짧은 대화'?conversation.length:lesson.items.length;const completed=index===total-1;const answeredAt=Date.now(),day=dayKey(new Date(answeredAt)),elapsed=Math.round((answeredAt-started.current)/6000)/10,wordKey=item?.key,isDialogue=lesson.mode==='짧은 대화';
  if(!isDialogue||completed)save(current=>{
   let next={...current};
   if(!isDialogue){
    const dueAt=Number(current.reviews[wordKey]);
    // Extra practice may mark a word learned, but cannot postpone an existing review.
    const schedule=!known||!(dueAt>answeredAt);
    next.learned=known?[...new Set([...current.learned,wordKey])]:current.learned;
    if(schedule){const stage=known?Math.min((current.reviewStages?.[wordKey]||0)+1,5):0;const days=[0,1,3,7,14,30];next.reviews={...current.reviews,[wordKey]:answeredAt+(known?days[stage]*86400000:600000)};next.reviewStages={...current.reviewStages,[wordKey]:stage}}
   }
   if(completed){next={...next,sessions:current.sessions+1,minutes:Math.round((current.minutes+elapsed)*10)/10,dates:[...new Set([...(current.dates||[]),day])],dailyMinutes:{...current.dailyMinutes,[day]:Math.round(((current.dailyMinutes?.[day]||0)+elapsed)*10)/10}}}
   return next;
  },isDialogue?{type:'dialogueSession',elapsedMs:answeredAt-started.current}:{type:'wordAnswer',wordKey,known,completed,elapsedMs:completed?answeredAt-started.current:0});
  if(completed){setModal('완료');setLesson(null)}else{setIndex(i=>i+1);reset()}
 }
 const nav=[{label:'홈',icon:Home},{label:'나의 학습',icon:BookOpen},{label:'복습 노트',icon:RotateCcw},{label:'학습 리포트',icon:ChartNoAxesCombined}];
 return <div className="app" ref={appRef}><aside className="sidebar"><a href="#" className="brand" onClick={e=>{e.preventDefault();setPage('홈')}}><span className="brand-icon"><Sprout/></span>bloom<span className="brand-dot">.</span></a><div className="brand-caption">함께 자라는 언어 습관</div><div className="workspace-label">OUR LEARNING SPACE</div><nav>{nav.map(({label,icon:Icon})=><button aria-label={label} className={'nav-item '+(page===label?'active':'')} key={label} onClick={()=>setPage(label)}><Icon size={19}/>{label}{label==='복습 노트'&&dueSentenceIds.length+due.length>0&&<span className="count">{dueSentenceIds.length+due.length}</span>}</button>)}</nav><div className="sidebar-note"><Sprout/><p>서로 다른 언어,<br/><strong>함께 자라는 매일.</strong></p><span>작은 걸음도 소중한 배움이에요.</span></div><div className="sidebar-bottom"><button aria-label="도움말" onClick={()=>setModal('도움말')}><CircleHelp size={18}/>도움말</button><button aria-label="설정" onClick={()=>{setSettingsDraft({name:data.name,goal:data.goal,timezone:accountProfile?.timezone});setModal('설정')}}><Settings size={18}/>설정</button><button className="profile" aria-label="학습 설정 열기" onClick={()=>{setSettingsDraft({name:data.name,goal:data.goal,timezone:accountProfile?.timezone});setModal('설정')}}><span className="avatar">{data.name.slice(0,1)||'🌱'}</span><span><strong>{data.name||profile.label}님</strong><small>{profile.label}</small></span></button></div></aside>
 <div className="main-shell"><header><span className="header-title">나의 학습 공간</span><div className="header-right">{!account&&<label className="learner-select">학습자 선택<select aria-label="학습자 선택" value={active} onChange={e=>switchLearner(e.target.value)}><option value="wife">아내 · 영어</option><option value="husband">남편 · 일본어</option></select></label>}{account?<div className="account-actions"><span>{account.account.email}</span><button onClick={()=>setShowImport(value=>!value)}>기존 기록 가져오기</button><button disabled={logoutBusy} onClick={logout}>{logoutBusy?'로그아웃 중…':'로그아웃'}</button></div>:<div className="account-actions"><span className="demo-badge">로컬 데모</span><button onClick={logout}>계정 화면으로</button></div>}<span className="streak"><Flame size={16}/>{streak(data.dates,timezone)}일 연속 학습</span></div></header><main>
 {account&&<><RecoveryNotice code={account.recoveryCode}/><div className={'account-status '+(syncStatus==='failed'?'failed':'')} role="status"><span>{syncStatus==='saved'?'내 계정에 저장되어 있어요.':syncStatus==='saving'?'서버에 저장하고 있어요…':`아직 서버에 저장하지 못했어요. ${syncError} 이 창을 닫으면 저장되지 않은 변경은 사라져요.`}</span>{syncStatus==='failed'&&<div className="account-actions"><button onClick={flush}>다시 저장</button><button onClick={()=>{pending.current=[];publish(committed.current);setSaveFailed(false);setSyncStatus('saved');setSyncError('')}}>저장 안 된 변경 취소</button></div>}</div>{showImport&&<section className="import-panel"><h2>이 브라우저의 기록을 내 계정으로</h2><p>계정에 학습 기록이 없을 때 한 번만 가져올 수 있어요. 내 기록 하나를 직접 선택하고 내용을 확인해 주세요. 원본 로컬 기록은 그대로 남아요.</p>{imports.length>0?<p>이미 기록을 가져왔어요. 중복해서 가져오지 않아요.</p>:<><div className="import-options">{importCandidates.length===0&&<p>이 브라우저에 가져올 로컬 기록이 없어요.</p>}{importCandidates.map(item=><button key={item.key} disabled={item.language!==accountProfile.language} className={importSource===item.key?'selected':''} onClick={()=>setImportSource(item.key)}>{item.label}{item.language!==accountProfile.language?' · 다른 언어':''}</button>)}</div>{importSource&&(()=>{const local=importCandidates.find(item=>item.key===importSource)?.learner;return local?<div className="import-preview"><strong>{profiles[importSource].label} · {local.name}</strong><dl><div><dt>완료한 학습</dt><dd>{local.sessions}회</dd></div><div><dt>누적 시간</dt><dd>{local.minutes}분</dd></div><div><dt>문장 기록</dt><dd>{Object.keys(local.sentenceProgress).length}개</dd></div></dl><p>선택한 한 사람의 기록만 가져와요. 계정 이름과 목표는 유지돼요. 계정에서 이미 학습했다면 가져올 수 없어요.</p><button className="primary" disabled={syncStatus!=='saved'||data.sessions>0||data.minutes>0||data.learned.length>0||Object.keys(data.reviews).length>0||Object.keys(data.sentenceProgress).length>0} onClick={importLocal}>이 기록을 내 계정으로 가져오기</button></div>:null})()}</>}</section>}</>}
 <div className="greeting"><div><div className="eyebrow">{profile.label} · A LITTLE EVERY DAY</div><h1>{page==='홈'?`안녕하세요, ${data.name||profile.label}님 ☀`:page==='나의 학습'?`오늘은 어떤 ${profile.language}를 만나볼까요?`:page==='복습 노트'?'기억을 더 단단하게.':'차곡차곡 쌓이는 나의 성장.'}</h1><p>{profile.language}를 보고, 듣고, 말하며 나의 속도로 배워요.</p></div><span className="date-pill">{profile.label}의 성장 일기</span></div>
 {page==='홈'&&<><section className="hero"><div className="hero-content"><div className="hero-badge"><Sparkles size={13}/>오늘의 문장 세션</div><h2>한 상황, 네 문장.<br/><em>끝까지 말해 봐요.</em></h2><p>장면 이해 → 듣기 → 따라 말하기 → 회상 → 퀴즈.<br/>하나의 세션에서 차근차근 연결해요.</p><label className="sentence-choice">오늘의 상황<select aria-label="오늘의 문장 상황" value={sentenceScenario} onChange={e=>setSentenceScenario(e.target.value)}>{scenarios.map(scene=><option key={scene.id} value={scene.id}>{scene.titleKo}</option>)}</select></label><button className="primary" onClick={()=>startSentenceSession()}><Play size={16}/>문장 세션 시작하기<ArrowRight size={17}/></button><div className="hero-meta"><span><BookOpen size={13}/>{profile.language} · 기초</span><span><Clock3 size={13}/>나의 속도로</span></div></div><div className="hero-art"><div className="circle circle-one"/><div className="circle circle-two"/><img className="hero-photo" src={photo('photo-1442512595331-e89e73853f31')} alt="커피와 함께하는 학습"/><div className="photo-note"><Leaf size={20}/><div><small>오늘의 한마디</small><strong>{active==='wife'?'Small steps, big changes.':<Ruby parts={['ゆっくり、',['一歩','いっぽ'],'ずつ。']}/>}</strong><span>천천히, 한 걸음씩 자라나요.</span></div></div></div></section><section className="stats"><Stat icon={Target} color="green" label="오늘의 학습" value={todayMinutes} unit={`/ ${data.goal}분`} bottom="나의 하루 학습 목표" progress={Math.min(todayMinutes/data.goal*100,100)}/><Stat icon={BookOpen} color="orange" label="연습한 문장" value={plannedSentences.length} unit="개" bottom="내 목소리로 익힌 생활 문장"/><Stat icon={RotateCcw} color="purple" label="복습할 문장" value={dueSentenceIds.length} unit="개" bottom="상황별로 다시 말해 봐요"/><Stat icon={Sprout} color="sage" label="완료한 학습" value={data.sessions} unit="회" bottom="한 뼘 더 자라는 매일"/></section></>}
 {(page==='홈'||page==='나의 학습')&&<><section className="sentence-catalog" aria-label="문장 상황 선택"><div className="section-heading"><div><h2>생활 속 20가지 상황</h2><p>상황마다 네 문장 · {profile.language} · 한 번에 한 상황</p></div></div><div className="sentence-scene-grid">{scenarios.map(scene=><button className="sentence-scene" key={scene.id} onClick={()=>startSentenceSession(scene.id)} aria-label={scene.titleKo+' 문장 세션 시작'}><img src={scene.image} alt=""/><span><strong>{scene.titleKo}</strong><small>4문장 · {scene.sentences.filter(sentence=>data.sentenceProgress[sentence.id]).length}/4 학습 기록</small></span><ArrowRight size={17}/></button>)}</div></section><details className="legacy-learning"><summary>기존 단어 코스와 짧은 대화</summary><section className="courses"><div className="section-heading"><div><h2>나를 위한 {profile.language} 코스 <span className="small-spark">✧</span></h2><p>장면 속에서 바로 쓸 수 있는 표현을 배워요.</p></div><button className="text-button" onClick={()=>setPage('나의 학습')}>전체 보기<ArrowRight size={15}/></button></div>{page==='나의 학습'&&<div className="filters">{['전체','일상','여행'].map(f=><button className={filter===f?'selected':''} key={f} onClick={()=>setFilter(f)}>{f}</button>)}</div>}<div className="course-grid">{profile.groups.map((group,i)=>(filter==='전체'||page==='홈'||(filter==='여행'?i===1:i!==1))&&<button className="course-card" key={profile.titles[i]} onClick={()=>open('단어 학습',i)}><div className="course-image"><img src={photo(group[0].image)} alt={profile.titles[i]}/><span className="course-tag">{['DAILY LIFE','TRAVEL','ABOUT ME'][i]}</span><span className="image-arrow"><ArrowUpRight size={19}/></span></div><div className="course-info"><h3>{profile.titles[i]}</h3><p>{i===0?'카페에서 만나는 작은 대화':i===1?'여행지에서 자신 있게 말하기':'나의 생각과 취향 표현하기'}</p><div><span><BookOpen size={13}/>{group.length}개의 단어</span><span className="level">기초</span></div></div></button>)}</div></section><div className="scenario-picker"><label>연습할 상황<select aria-label="연습할 상황" value={scenario} onChange={e=>setScenario(Number(e.target.value))}>{profile.titles.map((title,i)=><option value={i} key={title}>{title}</option>)}</select></label></div><section className="practice-grid" aria-label="연습 방식"><Practice title="듣고 따라 말하기" text="예문을 듣고 마이크 또는 입력으로 따라 해요." icon={Mic} onClick={()=>open('듣고 따라 말하기',scenario)}/><Practice title="문장 떠올리기" text="한국어 뜻을 보고 문장을 스스로 떠올려요." icon={Lightbulb} onClick={()=>open('문장 떠올리기',scenario)}/><Practice title="짧은 대화" text="선택한 상황에서 상대방에게 3번 대답해요." icon={Headphones} onClick={()=>open('짧은 대화',scenario)}/></section></details></>}
 {page==='복습 노트'&&<><section className="sentence-review" aria-label="문장 복습"><div className="section-heading"><div><h2>오늘 다시 말할 문장 <span>{dueSentenceIds.length}개</span></h2><p>틀린 문장은 다음 날, 맞힌 문장은 3 → 7 → 14 → 30 → 60일 뒤에 만나요.</p></div></div>{dueScenes.map(scene=><div className="sentence-review-row" key={scene.id}><div><h3>{scene.titleKo}</h3><p>{scene.dueSentences.length}문장 · 이 상황의 복습 문장만 연습해요.</p></div><button className="primary" onClick={()=>startSentenceSession(scene.id,scene.dueSentences)} aria-label={scene.titleKo+' 문장 복습 시작'}>이 상황 복습<ArrowRight size={16}/></button></div>)}{!dueScenes.length&&<p className="sentence-empty">지금 복습할 문장이 없어요. 새로운 상황을 배워 보세요.</p>}{plannedSentences.length>0&&<details className="sentence-schedule"><summary>문장별 다음 복습 일정 ({plannedSentences.length})</summary>{plannedSentences.map(sentence=><div className="sentence-schedule-row" key={sentence.id}><div><strong lang={profile.locale}>{sentence.text}</strong><small>{sentence.meaningKo}</small></div><span>{sentence.progress.lastOutcome==='failed'?'다시 볼 문장':'기억한 문장'} · {sentence.progress.dueAt<=now?'복습할 시간':new Date(sentence.progress.dueAt).toLocaleString('ko-KR')}</span></div>)}</details>}</section><div className="review-banner legacy-review"><div><h2>기존 단어 복습</h2><p>기억한 단어는 1 · 3 · 7 · 14 · 30일 간격, 어려운 단어는 10분 뒤에 복습해요.</p></div><button className="primary" onClick={()=>due.length?open('복습'):open()}>{due.length?'복습 시작하기':'새 단어 배우기'}<ArrowRight size={16}/></button></div><div className="search-row"><h2>나의 단어장 <span>{data.learned.length}</span></h2><input aria-label="단어 검색" placeholder="단어 또는 뜻으로 검색" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="vocabulary">{allWords.filter(w=>(data.learned.includes(w.key)||data.reviews[w.key])&&`${w.word}${w.meaning}${w.reading||''}`.toLowerCase().includes(query.toLowerCase())).map(w=><div className="vocab-row" key={w.id}><span><strong lang={profile.locale}><Ruby parts={w.parts} fallback={w.word}/></strong><small>{w.meaning}</small></span><span className="vocab-due">{data.reviews[w.key]<=now?'복습할 시간':data.reviews[w.key]?'다음 복습 '+new Date(data.reviews[w.key]).toLocaleString('ko-KR'):'학습한 단어'}</span><button aria-label={w.word+' 듣기'} onClick={()=>speak(w.word)}><Volume2 size={19}/></button></div>)}</div>{!allWords.some(w=>data.learned.includes(w.key)||data.reviews[w.key])&&<div className="empty"><Sprout size={40}/><h3>첫 번째 단어를 심어볼까요?</h3><p>학습하면 이곳에 나만의 단어장이 생겨요.</p><button className="primary" onClick={()=>open()}>첫 학습 시작하기</button></div>}</>}
 {page==='학습 리포트'&&<><WeeklyGrowth data={data} timezone={timezone}/><section className="report-summary"><Stat icon={Clock3} color="green" label="누적 학습 시간" value={data.minutes} unit="분" bottom={profile.label+'의 기록'}/><Stat icon={BookOpen} color="orange" label="기억한 단어" value={data.learned.length} unit="개" bottom="매일 쌓이는 자신감"/><Stat icon={CheckCircle2} color="purple" label="완료한 학습" value={data.sessions} unit="회" bottom="작은 시작을 응원해요"/></section><div className="growth-card"><Sprout size={48}/><h2>나의 {profile.language}가 자라고 있어요.</h2><p>하루 {data.goal}분, 나의 속도로 꾸준히.<br/>완료한 학습의 실제 경과 시간을 기록해요.</p><div className="growth-progress"><span style={{width:Math.min(data.sessions/7*100,100)+'%'}}/></div><small>첫 성장 목표 · {Math.min(data.sessions,7)} / 7회</small><button className="primary" onClick={()=>startSentenceSession()}>오늘도 한 뼘 자라기</button></div></>}
 <footer><span><Sprout size={15}/>Bloom a little, every day.</span><span>{account?'나의 학습 기록은 내 계정에 저장돼요.':'로컬 데모 · 두 사람의 기록은 이 브라우저에만 저장돼요.'}</span></footer></main></div>
 {sentenceSession&&account&&<div className={'session-save-status '+syncStatus} role="status">{syncStatus==='saved'?'계정에 저장됨':syncStatus==='saving'?'서버에 저장 중…':'서버 저장 실패 · 창을 닫기 전에 다시 시도해 주세요'}{syncStatus==='failed'&&<button onClick={flush}>다시 저장</button>}</div>}
 {sentenceSession&&<SentenceSession scenario={sentenceSession.scenario} sentences={sentenceSession.sentences} lang={sentenceSession.lang} onComplete={payload=>completeSentenceSession(sentenceSession,payload)} onClose={()=>setSentenceSession(null)}/>}
 {modal&&<div className="modal-backdrop" onClick={close}><section ref={dialogRef} tabIndex={-1} className={'modal '+(modal==='lesson'?'lesson-modal':'')} role="dialog" aria-modal="true" aria-label={modal==='lesson'?lesson.mode:modal} onClick={e=>e.stopPropagation()}><button className="close-modal" aria-label="닫기" onClick={close}><X size={21}/></button>
 {modal==='lesson'&&lesson&&<><div className="lesson-top"><span>{profile.label} · {lesson.mode}</span><strong>{index+1} / {lesson.mode==='짧은 대화'?conversation.length:lesson.items.length}</strong></div><div className="lesson-progress"><span style={{width:(index+1)/(lesson.mode==='짧은 대화'?conversation.length:lesson.items.length)*100+'%'}}/></div><img className="lesson-image" src={photo(item?.image)} alt="카페와 여행의 학습 장면"/><div className="lesson-body">
 {lesson.mode==='짧은 대화'?<><p className="eyebrow">{profile.titles[lesson.group]} · 대화 {index+1}</p><div className="dialogue-prompt" lang={profile.locale}><Ruby parts={turn.parts} fallback={turn.prompt}/><button aria-label="상대방 말 듣기" onClick={()=>speak(turn.prompt)}><Volume2 size={20}/></button></div><p className="translation">{turn.ko}</p><div className="hint">내가 말할 뜻: {turn.meaning}</div></>:lesson.mode==='문장 떠올리기'?<><h2>이 문장을 {profile.language}로 말해 볼까요?</h2><p className="recall-prompt">{item.ko}</p><p className="translation">먼저 답을 입력해 보세요. 시도 후 예문을 확인할 수 있어요.</p></>:<><div className="lesson-word"><h2 lang={profile.locale}><Ruby parts={item.parts} fallback={item.word}/></h2><button aria-label="발음 듣기" onClick={()=>speak(item.word)}><Volume2 size={24}/></button></div><span className="pron">{item.pron}</span>{revealed||lesson.mode==='듣고 따라 말하기'?<><h3>{item.meaning}</h3><p className="hint"><Lightbulb size={17}/>{item.hint}</p><button className="example" lang={profile.locale} aria-label="예문 듣기" onClick={()=>speak(item.example)}><span><Ruby parts={item.sentence} fallback={item.example}/></span><Volume2 size={16}/></button>{item.kana&&<p className="kana">가나 읽기: {item.kana}</p>}<p className="translation">{item.ko}</p></>:<button className="reveal" onClick={()=>setRevealed(true)}>장면을 보고 뜻을 떠올려 보세요.<span>뜻 확인하기<ArrowRight size={15}/></span></button>}</>}
 {['듣고 따라 말하기','문장 떠올리기','짧은 대화'].includes(lesson.mode)&&<form className="speaking" onSubmit={e=>{e.preventDefault();attempt()}}><button type="button" className="primary" onClick={record} disabled={listening}><Mic size={17}/>{listening?'듣고 있어요…':'마이크로 말하기'}</button><p role="status">{speech||'음성인식 또는 직접 입력으로 연습해요. 인식된 문장의 비교이며 발음 평가는 제공하지 않아요.'}</p><label className="answer-label">{lesson.mode==='짧은 대화'?'나의 대답':'문장 입력 연습'}<input lang={profile.locale} aria-label={lesson.mode==='짧은 대화'?'나의 대답':'문장 입력 연습'} placeholder={active==='husband'?'일본어 또는 가나로 입력하세요':'영어 문장을 입력하세요'} value={answer} onChange={e=>{setAnswer(e.target.value);setFeedback(null)}}/></label><button className="check-answer" disabled={!answer.trim()||listening} type="submit">문장 확인</button>{feedback&&<div className={'answer-feedback '+(feedback.ok?'correct':'retry')} role="status"><strong>{feedback.ok?'예문과 일치해요!':'예문과 비교해 보세요.'}</strong><p>{lesson.mode==='짧은 대화'?'다른 자연스러운 표현도 가능해요. 아래는 한 가지 답변 예시예요.':'띄어쓰기와 문장부호를 제외한 문장을 비교했어요.'}</p>{lesson.mode!=='듣고 따라 말하기'&&<><p className="example" lang={profile.locale}>{lesson.mode==='짧은 대화'?<Ruby parts={turn.answerParts} fallback={turn.answer}/>:<Ruby parts={item.sentence} fallback={item.example}/>}</p>{(turn?.kana&&lesson.mode==='짧은 대화'||item.kana&&lesson.mode==='문장 떠올리기')&&<p className="kana">{lesson.mode==='짧은 대화'?turn.kana:item.kana}</p>}<button type="button" className="text-button" onClick={()=>speak(lesson.mode==='짧은 대화'?turn.answer:item.example)}><Volume2 size={17}/>예시 듣기</button></>}</div>}</form>}
 {(lesson.mode==='짧은 대화'?feedback:lesson.mode==='문장 떠올리기'||lesson.mode==='듣고 따라 말하기'?feedback:revealed)&&<div className="lesson-actions">{lesson.mode==='짧은 대화'?<button className="primary wide" onClick={()=>finish()}>{index===2?'대화 마치기':'다음 대화'}<ArrowRight size={16}/></button>:<><button onClick={()=>finish(false)}><RotateCcw size={16}/>다시 볼게요</button><button className="primary" onClick={()=>finish(true)}><Check size={17}/>기억했어요</button></>}</div>}</div></>}
 {modal==='완료'&&<div className="completion"><span className="completion-icon"><Sprout size={52}/></span><h2>오늘도 한 뼘 자랐어요!</h2><p>{profile.label}의 학습 기록을 {account?(syncStatus==='saved'?'내 계정에 저장했어요.':syncStatus==='saving'?'서버에 저장 중이에요.':'아직 서버에 저장하지 못했어요.'):(saveFailed?'이 창에 보관 중이에요.':'저장했어요.')}<br/>복습 노트에서 다음 복습 시간을 확인하세요.</p><div className="completion-stats"><span><strong>{data.learned.length}</strong>기억한 단어</span><span><strong>{data.sessions}</strong>완료한 학습</span></div><button className="primary" onClick={()=>{close();setPage('복습 노트')}}>나의 단어장 보기<ArrowRight size={17}/></button></div>}
 {modal==='설정'&&<div className="settings"><div className="eyebrow">{profile.label} · MY LITTLE ROUTINE</div><h2>나에게 맞는 학습 설정</h2><label>이름<input aria-label="이름" maxLength={account?60:12} value={account?(settingsDraft?.name??data.name):data.name} onChange={e=>{const name=e.target.value;if(account)setSettingsDraft(current=>({...current,name}));else save(current=>({...current,name}))}}/></label><label>하루 학습 목표<select aria-label="하루 학습 목표" value={account?(settingsDraft?.goal??data.goal):data.goal} onChange={e=>{const goal=Number(e.target.value);if(account)setSettingsDraft(current=>({...current,goal}));else save(current=>({...current,goal}))}}>{[...new Set([5,10,20,data.goal])].sort((a,b)=>a-b).map(n=><option value={n} key={n}>{n}분</option>)}</select></label>{account?<><label>학습 기록 시간대<input aria-label="학습 기록 시간대" value={settingsDraft?.timezone??accountProfile.timezone} onChange={e=>setSettingsDraft(current=>({...current,timezone:e.target.value}))}/></label><p>{account.account.email} · {profile.language}<br/>설정과 학습 기록은 내 계정에 저장해요. 학습 후 언어는 바꿀 수 없어요.</p></>:<p>{profile.label}의 설정과 기록은 이 브라우저에만 저장해요.</p>}<button className="primary" disabled={account&&!settingsDraft?.name?.trim()} onClick={()=>{if(account&&!saveProfile(settingsDraft))return;close()}}>설정 완료<Check size={16}/></button></div>}
 {modal==='도움말'&&<div className="help"><h2>함께 자라는 언어 습관</h2><p><strong>01. 나만의 학습 공간</strong><br/>{account?'내 계정에 선택한 언어의 설정과 학습 기록을 보관해요. 기존 로컬 기록은 직접 확인한 뒤 한 번만 가져올 수 있어요.':'로컬 데모에서는 아내 영어와 남편 일본어 기록을 이 브라우저에 따로 보관해요.'}</p><p><strong>02. 장면을 보고 말해요</strong><br/>20가지 생활 상황 중 하나를 골라 네 문장을 배워요. 장면 이해, 듣기, 따라 말하기, 기억해서 말하기, 퀴즈를 하나의 전체 화면 세션에서 진행해요. 기존 단어와 짧은 대화는 보조 코스로 계속 이용할 수 있어요.</p><p><strong>03. 잊기 전에 다시 만나요</strong><br/>문장은 한 번이라도 틀리면 다음 날, 모두 맞히면 3, 7, 14, 30, 60일 간격으로 복습해요. 기존 단어 복습 일정은 별도로 유지해요.</p><small>음성 기능은 기기와 브라우저에 따라 다릅니다. 마이크를 사용할 수 없으면 직접 입력하세요. 음성인식은 발음 평가가 아닙니다. {account?'서버 저장 상태를 확인해 주세요. 저장되지 않은 변경은 창을 닫으면 사라져요.':'데모 데이터는 이 기기에만 저장되며 브라우저 데이터를 지우면 삭제됩니다.'}</small></div>}
 </section></div>}{toast&&<div className="toast" role="status">{toast}</div>}</div>;
}
function Practice({title,text,icon:Icon,onClick}){return <button className="practice-card" onClick={onClick}><Icon size={23}/><h3>{title}</h3><p>{text}</p><span>연습 시작하기 <ArrowRight size={15}/></span></button>}
function Stat({icon:Icon,color,label,value,unit,bottom,progress}){return <div className="stat"><div className="stat-top"><span className={'stat-icon '+color}><Icon size={17}/></span><span>{label}</span></div><div className="stat-value">{value}<span>{unit}</span></div>{progress!==undefined&&<div className="stat-track"><span style={{width:progress+'%'}}/></div>}<p>{bottom}</p></div>}
function WeeklyGrowth({data,timezone}){const days=recentCalendarDays(timezone).map(day=>({...day,minutes:data.dailyMinutes[day.key]||0}));const total=Math.round(days.reduce((sum,day)=>sum+day.minutes,0)*10)/10,max=Math.max(data.goal,...days.map(day=>day.minutes));return <section className="weekly-growth"><h2>최근 7일의 작은 발걸음</h2><p>실제 완료한 학습 {total}분 · {days.filter(day=>day.minutes>0).length}일 학습 · 현재 {streak(data.dates,timezone)}일 연속</p><div className="week-bars">{days.map(day=><div className="week-day" key={day.key}><span>{day.minutes}분</span><div className="week-bar" style={{height:Math.max(3,day.minutes/max*100)+'px'}}/><span>{day.label}</span></div>)}</div></section>}
createRoot(document.getElementById('root')).render(<AccountGateway>{props=><App key={props.account?.account.id||'demo'} {...props}/>}</AccountGateway>);
