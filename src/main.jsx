import React, {useState, useEffect, useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowUpRight, ArrowRight, BookOpen, ChartNoAxesCombined, Check, ChevronLeft, ChevronRight, CircleHelp, Flame, Headphones, Home, Leaf, Lightbulb, Mic, Play, Plus, Settings, Sparkles, Sprout, Target, Volume2, X, RotateCcw, CheckCircle2, Clock3} from 'lucide-react';
import './style.css';

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
const blank=(name)=>({learned:[],reviews:{},reviewStages:{},sessions:0,minutes:0,name,goal:10,dates:[],dailyMinutes:{}});
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const nonnegative=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
function normalizeLearner(value,name){
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
  dates:strings(source.dates),dailyMinutes:numbers(source.dailyMinutes)};
}
function readSavedStore(){try{
 const saved=JSON.parse(localStorage.getItem(STORAGE));
 if(saved?.version===2&&isRecord(saved.learners))return {...saved,active:Object.hasOwn(profiles,saved.active)?saved.active:'wife',learners:{wife:normalizeLearner(saved.learners.wife,'지은'),husband:normalizeLearner(saved.learners.husband,'남편')}};
}catch{}return null;}
function readStore(){const saved=readSavedStore();if(saved)return saved;let legacy;try{legacy=JSON.parse(localStorage.getItem('bloom-state'));}catch{}const initial={version:2,active:'wife',learners:{wife:normalizeLearner(legacy,'지은'),husband:blank('남편')}};try{localStorage.setItem(STORAGE,JSON.stringify(initial));}catch{}return initial;}
const dateKey=(date=new Date())=>`${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
function streak(dates=[]){let day=new Date();if(!dates.includes(dateKey(day)))day.setDate(day.getDate()-1);let count=0;while(dates.includes(dateKey(day))){count++;day.setDate(day.getDate()-1)}return count;}
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
 {prompt:'よろしくお願いします。',parts:['よろしくお',['願','ねが'],'いします。'],ko:'잘 부탁드립니다.',answer:'ありがとうございます。',kana:'ありがとうございます。',meaning:'감사합니다.',answerParts:['ありがとうございます。']}
]]};
cafeDialogues.husband.forEach((t,i)=>{t.answerParts=[japaneseGroups[0][0].sentence,japaneseGroups[0][1].sentence,[['大丈夫','だいじょうぶ'],'です。ありがとうございます。']][i]});

function App(){
 const [store,setStore]=useState(readStore),[page,setPage]=useState('홈'),[modal,setModal]=useState(null),[lesson,setLesson]=useState(null),[index,setIndex]=useState(0),[revealed,setRevealed]=useState(false),[answer,setAnswer]=useState(''),[feedback,setFeedback]=useState(null),[speech,setSpeech]=useState(''),[listening,setListening]=useState(false),[query,setQuery]=useState(''),[filter,setFilter]=useState('전체'),[scenario,setScenario]=useState(0),[now,setNow]=useState(Date.now()),[toast,setToast]=useState(''),[saveFailed,setSaveFailed]=useState(false);
 const started=useRef(0),recognition=useRef(null),generation=useRef(0),storeRef=useRef(store),committed=useRef(store),pending=useRef([]);storeRef.current=store;
 const active=store.active,profile=profiles[active],data=store.learners[active],allWords=profile.groups.flat(),todayMinutes=data.dailyMinutes?.[dateKey()]||0;
 const due=allWords.filter(w=>Number(data.reviews[w.key])>0&&Number(data.reviews[w.key])<=now);
 const item=lesson?.items[index];const conversation=dialogues[active][lesson?.group||0];const turn=conversation[index];
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(t)},[]);
 useEffect(()=>()=>{generation.current++;recognition.current?.abort();window.speechSynthesis?.cancel()},[]);
 useEffect(()=>{const handler=e=>{if(e.key==='Escape')close()};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)},[]);
 useEffect(()=>{const sync=e=>{if(e.key!==STORAGE)return;const latest=readSavedStore();if(!latest)return;if(pending.current.length){persist();return}const next={...latest,active:storeRef.current.active};committed.current=next;storeRef.current=next;setStore(next);setNow(Date.now())};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync)},[]);
 // Retry operations, never optimistic learner snapshots: rebase onto the latest saved data.
 // Each queued update captures its learner and immutable input before it can be replayed.
 function persist(operation,active=storeRef.current.active){
  if(operation)pending.current.push(operation);
  const latest=readSavedStore()||committed.current;
  const next=pending.current.reduce((current,{learnerId,update})=>({...current,learners:{...current.learners,[learnerId]:update(current.learners[learnerId])}}),{...latest,active});
  storeRef.current=next;setStore(next);setNow(Date.now());
  try{localStorage.setItem(STORAGE,JSON.stringify(next));committed.current=next;pending.current=[];setSaveFailed(false)}
  catch{setSaveFailed(true);notify('저장하지 못했어요. 변경 사항은 이 창에 보관하고 다음 변경이나 다른 탭 동기화 때 다시 저장해요. 창을 닫으면 저장되지 않은 기록은 사라져요.')}
 }
 function save(update){persist({learnerId:storeRef.current.active,update})}
 function notify(message){setToast(message);setTimeout(()=>setToast(''),3500)}
 function stop(){generation.current++;recognition.current?.abort();recognition.current=null;setListening(false);window.speechSynthesis?.cancel()}
 function close(){stop();setModal(null);setLesson(null)}
 function switchLearner(value){stop();persist(null,value);setModal(null);setLesson(null);setPage('홈');setQuery('');setFilter('전체');setScenario(0);reset();}
 function reset(){setAnswer('');setFeedback(null);setSpeech('');setRevealed(false)}
 function speak(text){if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){notify('이 브라우저는 음성 재생을 지원하지 않아요. 문장을 읽고 연습해 주세요.');return}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=profile.locale;u.rate=.8;u.onerror=()=>notify('음성을 재생할 수 없어요. 기기의 음성 설정을 확인해 주세요.');speechSynthesis.speak(u)}
 function open(mode='단어 학습',group=0){stop();setLesson({mode,items:mode==='복습'?due:[...profile.groups[group]],group});setIndex(0);reset();started.current=Date.now();setModal('lesson')}
 function record(){const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition){setSpeech('음성인식을 지원하지 않는 브라우저예요. 아래 입력창으로 연습해 주세요.');return}stop();const token=generation.current;const r=new Recognition();recognition.current=r;r.lang=profile.locale;r.interimResults=false;r.onstart=()=>{if(token===generation.current)setListening(true)};r.onend=()=>{if(token===generation.current)setListening(false)};r.onerror=()=>{if(token===generation.current){setListening(false);setSpeech('마이크를 사용할 수 없어요. 권한을 확인하거나 아래에 직접 입력해 주세요.')}};r.onresult=e=>{if(token!==generation.current)return;setAnswer(e.results[0][0].transcript);setSpeech('인식한 문장을 입력창에 넣었어요. 문장 확인을 눌러 비교하세요.');setFeedback(null)};try{r.start()}catch{setListening(false);setSpeech('음성인식을 시작하지 못했어요. 아래에 직접 입력해 주세요.')}}
 function attempt(){if(!answer.trim())return;const ok=lesson.mode==='짧은 대화'?(active==='wife'?turn.accept.some(a=>normalized(a)===normalized(answer)):matches(answer,{example:turn.answer,kana:turn.kana})):matches(answer,item);setFeedback({ok});setRevealed(true)}
 function finish(known=true){
  stop();const total=lesson.mode==='짧은 대화'?conversation.length:lesson.items.length;const completed=index===total-1;const answeredAt=Date.now(),day=dateKey(new Date(answeredAt)),elapsed=Math.round((answeredAt-started.current)/6000)/10,wordKey=item?.key,isDialogue=lesson.mode==='짧은 대화';
  save(current=>{
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
  });
  if(completed){setModal('완료');setLesson(null)}else{setIndex(i=>i+1);reset()}
 }
 const nav=[{label:'홈',icon:Home},{label:'나의 학습',icon:BookOpen},{label:'복습 노트',icon:RotateCcw},{label:'학습 리포트',icon:ChartNoAxesCombined}];
 return <div className="app"><aside className="sidebar"><a href="#" className="brand" onClick={e=>{e.preventDefault();setPage('홈')}}><span className="brand-icon"><Sprout/></span>bloom<span className="brand-dot">.</span></a><div className="brand-caption">함께 자라는 언어 습관</div><div className="workspace-label">OUR LEARNING SPACE</div><nav>{nav.map(({label,icon:Icon})=><button aria-label={label} className={'nav-item '+(page===label?'active':'')} key={label} onClick={()=>setPage(label)}><Icon size={19}/>{label}{label==='복습 노트'&&due.length>0&&<span className="count">{due.length}</span>}</button>)}</nav><div className="sidebar-note"><Sprout/><p>서로 다른 언어,<br/><strong>함께 자라는 매일.</strong></p><span>작은 걸음도 소중한 배움이에요.</span></div><div className="sidebar-bottom"><button aria-label="도움말" onClick={()=>setModal('도움말')}><CircleHelp size={18}/>도움말</button><button aria-label="설정" onClick={()=>setModal('설정')}><Settings size={18}/>설정</button><button className="profile" aria-label="학습 설정 열기" onClick={()=>setModal('설정')}><span className="avatar">{data.name.slice(0,1)||'🌱'}</span><span><strong>{data.name||profile.label}님</strong><small>{profile.label}</small></span></button></div></aside>
 <div className="main-shell"><header><span className="header-title">나의 학습 공간</span><div className="header-right"><label className="learner-select">학습자 선택<select aria-label="학습자 선택" value={active} onChange={e=>switchLearner(e.target.value)}><option value="wife">아내 · 영어</option><option value="husband">남편 · 일본어</option></select></label><span className="streak"><Flame size={16}/>{streak(data.dates)}일 연속 학습</span></div></header><main>
 <div className="greeting"><div><div className="eyebrow">{profile.label} · A LITTLE EVERY DAY</div><h1>{page==='홈'?`안녕하세요, ${data.name||profile.label}님 ☀`:page==='나의 학습'?`오늘은 어떤 ${profile.language}를 만나볼까요?`:page==='복습 노트'?'기억을 더 단단하게.':'차곡차곡 쌓이는 나의 성장.'}</h1><p>{profile.language}를 보고, 듣고, 말하며 나의 속도로 배워요.</p></div><span className="date-pill">{profile.label}의 성장 일기</span></div>
 {page==='홈'&&<><section className="hero"><div className="hero-content"><div className="hero-badge"><Sparkles size={13}/>오늘의 맞춤 학습</div><h2>{profile.language}와 조금 더<br/>가까워지는 <em>{data.goal}분.</em></h2><p>장면으로 익히고, 내 목소리로 기억해요.<br/>오늘도 한 문장, 자신감을 키워 볼까요?</p><button className="primary" onClick={()=>open()}><Play size={16}/>오늘의 학습 시작하기<ArrowRight size={17}/></button><div className="hero-meta"><span><BookOpen size={13}/>{profile.language} · 기초</span><span><Clock3 size={13}/>나의 속도로</span></div></div><div className="hero-art"><div className="circle circle-one"/><div className="circle circle-two"/><img className="hero-photo" src={photo('photo-1442512595331-e89e73853f31')} alt="커피와 함께하는 학습"/><div className="photo-note"><Leaf size={20}/><div><small>오늘의 한마디</small><strong>{active==='wife'?'Small steps, big changes.':<Ruby parts={['ゆっくり、',['一歩','いっぽ'],'ずつ。']}/>}</strong><span>천천히, 한 걸음씩 자라나요.</span></div></div></div></section><section className="stats"><Stat icon={Target} color="green" label="오늘의 학습" value={todayMinutes} unit={`/ ${data.goal}분`} bottom="나의 하루 학습 목표" progress={Math.min(todayMinutes/data.goal*100,100)}/><Stat icon={BookOpen} color="orange" label="기억한 단어" value={data.learned.length} unit="개" bottom="하나씩 쌓이는 나의 단어들"/><Stat icon={RotateCcw} color="purple" label="복습할 단어" value={due.length} unit="개" bottom="잊기 전에 다시 만나요"/><Stat icon={Sprout} color="sage" label="완료한 학습" value={data.sessions} unit="회" bottom="한 뼘 더 자라는 매일"/></section></>}
 {(page==='홈'||page==='나의 학습')&&<><section className="courses"><div className="section-heading"><div><h2>나를 위한 {profile.language} 코스 <span className="small-spark">✧</span></h2><p>장면 속에서 바로 쓸 수 있는 표현을 배워요.</p></div><button className="text-button" onClick={()=>setPage('나의 학습')}>전체 보기<ArrowRight size={15}/></button></div>{page==='나의 학습'&&<div className="filters">{['전체','일상','여행'].map(f=><button className={filter===f?'selected':''} key={f} onClick={()=>setFilter(f)}>{f}</button>)}</div>}<div className="course-grid">{profile.groups.map((group,i)=>(filter==='전체'||page==='홈'||(filter==='여행'?i===1:i!==1))&&<button className="course-card" key={profile.titles[i]} onClick={()=>open('단어 학습',i)}><div className="course-image"><img src={photo(group[0].image)} alt={profile.titles[i]}/><span className="course-tag">{['DAILY LIFE','TRAVEL','ABOUT ME'][i]}</span><span className="image-arrow"><ArrowUpRight size={19}/></span></div><div className="course-info"><h3>{profile.titles[i]}</h3><p>{i===0?'카페에서 만나는 작은 대화':i===1?'여행지에서 자신 있게 말하기':'나의 생각과 취향 표현하기'}</p><div><span><BookOpen size={13}/>{group.length}개의 단어</span><span className="level">기초</span></div></div></button>)}</div></section><div className="scenario-picker"><label>연습할 상황<select aria-label="연습할 상황" value={scenario} onChange={e=>setScenario(Number(e.target.value))}>{profile.titles.map((title,i)=><option value={i} key={title}>{title}</option>)}</select></label></div><section className="practice-grid" aria-label="연습 방식"><Practice title="듣고 따라 말하기" text="예문을 듣고 마이크 또는 입력으로 따라 해요." icon={Mic} onClick={()=>open('듣고 따라 말하기',scenario)}/><Practice title="문장 떠올리기" text="한국어 뜻을 보고 문장을 스스로 떠올려요." icon={Lightbulb} onClick={()=>open('문장 떠올리기',scenario)}/><Practice title="짧은 대화" text="선택한 상황에서 상대방에게 3번 대답해요." icon={Headphones} onClick={()=>open('짧은 대화',scenario)}/></section></>}
 {page==='복습 노트'&&<><div className="review-banner"><div><h2>{profile.language} 기억을 오래 간직해요.</h2><p>기억한 단어는 1 · 3 · 7 · 14 · 30일 간격, 어려운 단어는 10분 뒤에 복습해요.</p></div><button className="primary" onClick={()=>due.length?open('복습'):open()}>{due.length?'복습 시작하기':'새 단어 배우기'}<ArrowRight size={16}/></button></div><div className="search-row"><h2>나의 단어장 <span>{data.learned.length}</span></h2><input aria-label="단어 검색" placeholder="단어 또는 뜻으로 검색" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="vocabulary">{allWords.filter(w=>(data.learned.includes(w.key)||data.reviews[w.key])&&`${w.word}${w.meaning}${w.reading||''}`.toLowerCase().includes(query.toLowerCase())).map(w=><div className="vocab-row" key={w.id}><span><strong lang={profile.locale}><Ruby parts={w.parts} fallback={w.word}/></strong><small>{w.meaning}</small></span><span className="vocab-due">{data.reviews[w.key]<=now?'복습할 시간':data.reviews[w.key]?'다음 복습 '+new Date(data.reviews[w.key]).toLocaleString('ko-KR'):'학습한 단어'}</span><button aria-label={w.word+' 듣기'} onClick={()=>speak(w.word)}><Volume2 size={19}/></button></div>)}</div>{!allWords.some(w=>data.learned.includes(w.key)||data.reviews[w.key])&&<div className="empty"><Sprout size={40}/><h3>첫 번째 단어를 심어볼까요?</h3><p>학습하면 이곳에 나만의 단어장이 생겨요.</p><button className="primary" onClick={()=>open()}>첫 학습 시작하기</button></div>}</>}
 {page==='학습 리포트'&&<><section className="report-summary"><Stat icon={Clock3} color="green" label="누적 학습 시간" value={data.minutes} unit="분" bottom={profile.label+'의 기록'}/><Stat icon={BookOpen} color="orange" label="기억한 단어" value={data.learned.length} unit="개" bottom="매일 쌓이는 자신감"/><Stat icon={CheckCircle2} color="purple" label="완료한 학습" value={data.sessions} unit="회" bottom="작은 시작을 응원해요"/></section><div className="growth-card"><Sprout size={48}/><h2>나의 {profile.language}가 자라고 있어요.</h2><p>하루 {data.goal}분, 나의 속도로 꾸준히.<br/>완료한 학습의 실제 경과 시간을 기록해요.</p><div className="growth-progress"><span style={{width:Math.min(data.sessions/7*100,100)+'%'}}/></div><small>첫 성장 목표 · {Math.min(data.sessions,7)} / 7회</small><button className="primary" onClick={()=>open()}>오늘도 한 뼘 자라기</button></div></>}
 <footer><span><Sprout size={15}/>Bloom a little, every day.</span><span>두 사람의 배움은 각각 이 브라우저에 저장돼요.</span></footer></main></div>
 {modal&&<div className="modal-backdrop" onClick={close}><section className={'modal '+(modal==='lesson'?'lesson-modal':'')} role="dialog" aria-modal="true" aria-label={modal==='lesson'?lesson.mode:modal} onClick={e=>e.stopPropagation()}><button className="close-modal" aria-label="닫기" onClick={close}><X size={21}/></button>
 {modal==='lesson'&&lesson&&<><div className="lesson-top"><span>{profile.label} · {lesson.mode}</span><strong>{index+1} / {lesson.mode==='짧은 대화'?conversation.length:lesson.items.length}</strong></div><div className="lesson-progress"><span style={{width:(index+1)/(lesson.mode==='짧은 대화'?conversation.length:lesson.items.length)*100+'%'}}/></div><img className="lesson-image" src={photo(item?.image)} alt="카페와 여행의 학습 장면"/><div className="lesson-body">
 {lesson.mode==='짧은 대화'?<><p className="eyebrow">{profile.titles[lesson.group]} · 대화 {index+1}</p><div className="dialogue-prompt" lang={profile.locale}><Ruby parts={turn.parts} fallback={turn.prompt}/><button aria-label="상대방 말 듣기" onClick={()=>speak(turn.prompt)}><Volume2 size={20}/></button></div><p className="translation">{turn.ko}</p><div className="hint">내가 말할 뜻: {turn.meaning}</div></>:lesson.mode==='문장 떠올리기'?<><h2>이 문장을 {profile.language}로 말해 볼까요?</h2><p className="recall-prompt">{item.ko}</p><p className="translation">먼저 답을 입력해 보세요. 시도 후 예문을 확인할 수 있어요.</p></>:<><div className="lesson-word"><h2 lang={profile.locale}><Ruby parts={item.parts} fallback={item.word}/></h2><button aria-label="발음 듣기" onClick={()=>speak(item.word)}><Volume2 size={24}/></button></div><span className="pron">{item.pron}</span>{revealed||lesson.mode==='듣고 따라 말하기'?<><h3>{item.meaning}</h3><p className="hint"><Lightbulb size={17}/>{item.hint}</p><button className="example" lang={profile.locale} aria-label="예문 듣기" onClick={()=>speak(item.example)}><span><Ruby parts={item.sentence} fallback={item.example}/></span><Volume2 size={16}/></button>{item.kana&&<p className="kana">가나 읽기: {item.kana}</p>}<p className="translation">{item.ko}</p></>:<button className="reveal" onClick={()=>setRevealed(true)}>장면을 보고 뜻을 떠올려 보세요.<span>뜻 확인하기<ArrowRight size={15}/></span></button>}</>}
 {['듣고 따라 말하기','문장 떠올리기','짧은 대화'].includes(lesson.mode)&&<form className="speaking" onSubmit={e=>{e.preventDefault();attempt()}}><button type="button" className="primary" onClick={record} disabled={listening}><Mic size={17}/>{listening?'듣고 있어요…':'마이크로 말하기'}</button><p role="status">{speech||'음성인식 또는 직접 입력으로 연습해요. 인식된 문장의 비교이며 발음 평가는 제공하지 않아요.'}</p><label className="answer-label">{lesson.mode==='짧은 대화'?'나의 대답':'문장 입력 연습'}<input lang={profile.locale} aria-label={lesson.mode==='짧은 대화'?'나의 대답':'문장 입력 연습'} placeholder={active==='husband'?'일본어 또는 가나로 입력하세요':'영어 문장을 입력하세요'} value={answer} onChange={e=>{setAnswer(e.target.value);setFeedback(null)}}/></label><button className="check-answer" disabled={!answer.trim()||listening} type="submit">문장 확인</button>{feedback&&<div className={'answer-feedback '+(feedback.ok?'correct':'retry')} role="status"><strong>{feedback.ok?'예문과 일치해요!':'예문과 비교해 보세요.'}</strong><p>{lesson.mode==='짧은 대화'?'다른 자연스러운 표현도 가능해요. 아래는 한 가지 답변 예시예요.':'띄어쓰기와 문장부호를 제외한 문장을 비교했어요.'}</p>{lesson.mode!=='듣고 따라 말하기'&&<><p className="example" lang={profile.locale}>{lesson.mode==='짧은 대화'?<Ruby parts={turn.answerParts} fallback={turn.answer}/>:<Ruby parts={item.sentence} fallback={item.example}/>}</p>{(turn?.kana&&lesson.mode==='짧은 대화'||item.kana&&lesson.mode==='문장 떠올리기')&&<p className="kana">{lesson.mode==='짧은 대화'?turn.kana:item.kana}</p>}<button type="button" className="text-button" onClick={()=>speak(lesson.mode==='짧은 대화'?turn.answer:item.example)}><Volume2 size={17}/>예시 듣기</button></>}</div>}</form>}
 {(lesson.mode==='짧은 대화'?feedback:lesson.mode==='문장 떠올리기'||lesson.mode==='듣고 따라 말하기'?feedback:revealed)&&<div className="lesson-actions">{lesson.mode==='짧은 대화'?<button className="primary wide" onClick={()=>finish()}>{index===2?'대화 마치기':'다음 대화'}<ArrowRight size={16}/></button>:<><button onClick={()=>finish(false)}><RotateCcw size={16}/>다시 볼게요</button><button className="primary" onClick={()=>finish(true)}><Check size={17}/>기억했어요</button></>}</div>}</div></>}
 {modal==='완료'&&<div className="completion"><span className="completion-icon"><Sprout size={52}/></span><h2>오늘도 한 뼘 자랐어요!</h2><p>{profile.label}의 학습 기록을 {saveFailed?'이 창에 보관 중이에요.':'저장했어요.'}<br/>복습 노트에서 다음 복습 시간을 확인하세요.</p><div className="completion-stats"><span><strong>{data.learned.length}</strong>기억한 단어</span><span><strong>{data.sessions}</strong>완료한 학습</span></div><button className="primary" onClick={()=>{close();setPage('복습 노트')}}>나의 단어장 보기<ArrowRight size={17}/></button></div>}
 {modal==='설정'&&<div className="settings"><div className="eyebrow">{profile.label} · MY LITTLE ROUTINE</div><h2>나에게 맞는 학습 설정</h2><label>이름<input aria-label="이름" maxLength={12} value={data.name} onChange={e=>{const name=e.target.value;save(current=>({...current,name}))}}/></label><label>하루 학습 목표<select aria-label="하루 학습 목표" value={data.goal} onChange={e=>{const goal=Number(e.target.value);save(current=>({...current,goal}))}}>{[...new Set([5,10,20,data.goal])].sort((a,b)=>a-b).map(n=><option value={n} key={n}>{n}분</option>)}</select></label><p>{profile.label}의 설정과 기록은 다른 학습자와 분리해 이 브라우저에 저장해요.</p><button className="primary" onClick={close}>설정 완료<Check size={16}/></button></div>}
 {modal==='도움말'&&<div className="help"><h2>함께 자라는 언어 습관</h2><p><strong>01. 학습자를 선택해요</strong><br/>아내는 영어, 남편은 일본어. 이름, 목표와 모든 기록을 따로 보관해요. 기존 영어 기록은 아내에게 한 번만 옮겨요.</p><p><strong>02. 장면을 보고 말해요</strong><br/>단어를 배우고, 예문을 듣고 따라 말해요. 문장 떠올리기는 답을 직접 시도한 후 예시를 보여줘요. 짧은 대화에서는 세 번 대답해요.</p><p><strong>03. 잊기 전에 다시 만나요</strong><br/>기억한 단어는 1, 3, 7, 14, 30일 간격으로, 어려운 단어는 10분 뒤에 다시 복습해요.</p><small>음성 기능은 기기와 브라우저에 따라 다릅니다. 마이크를 사용할 수 없으면 직접 입력하세요. 음성인식은 발음 평가가 아닙니다. 데이터는 이 기기에만 저장되며 브라우저 데이터를 지우면 삭제됩니다.</small></div>}
 </section></div>}{toast&&<div className="toast" role="status">{toast}</div>}</div>;
}
function Practice({title,text,icon:Icon,onClick}){return <button className="practice-card" onClick={onClick}><Icon size={23}/><h3>{title}</h3><p>{text}</p><span>연습 시작하기 <ArrowRight size={15}/></span></button>}
function Stat({icon:Icon,color,label,value,unit,bottom,progress}){return <div className="stat"><div className="stat-top"><span className={'stat-icon '+color}><Icon size={17}/></span><span>{label}</span></div><div className="stat-value">{value}<span>{unit}</span></div>{progress!==undefined&&<div className="stat-track"><span style={{width:progress+'%'}}/></div>}<p>{bottom}</p></div>}
createRoot(document.getElementById('root')).render(<App/>);
