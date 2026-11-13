// Run after npm ci: npm ci --prefix tests && npm test --prefix tests
// Uses system Chromium; override its path with CHROMIUM_PATH if needed.
// Browser speech APIs are mocked to verify language routing and fallback behavior.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const server = spawn('npm', ['run', 'dev', '--', '--port', '4179'], {cwd:new URL('..',import.meta.url), stdio:'pipe',detached:true});
let serverLog='';
server.stdout.on('data',d=>serverLog+=d);
server.stderr.on('data',d=>serverLog+=d);
const base='http://127.0.0.1:4179';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[];
let failures=0;
const legacy={learned:['Bloom','Reservation'],reviews:{Bloom:Date.now()-60000,Reservation:Date.now()+86400000},sessions:7,minutes:42.5,name:'기존 학습자',goal:20,dates:['2026-11-12'],dailyMinutes:{'2026-11-12':5.5}};
async function fixture(saved=legacy,viewport={width:1440,height:1000}) {
  const context=await browser.newContext({viewport});
  await context.addInitScript(({saved})=>{
    if(!localStorage.getItem('test-seeded')){
      localStorage.clear();
      if(saved!==null)localStorage.setItem('bloom-state',JSON.stringify(saved));
      localStorage.setItem('test-seeded','true');
    }
    window.__utterances=[];window.__recognitionLanguages=[];
    window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},speak(utterance){window.__utterances.push({text:utterance.text,lang:utterance.lang});},getVoices(){return[];}}});
    window.SpeechRecognition=class {start(){window.__recognitionLanguages.push(this.lang);this.onstart?.();this.onresult?.({results:[[{transcript:'テストです'}]]});this.onend?.();}stop(){this.onend?.();}abort(){this.onend?.();}};
  },{saved});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);
  await page.getByLabel('학습자 선택').waitFor();
  return {page,context};
}
const state=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bloom-profiles-v2')));
const choose=(page,profile)=>page.getByLabel('학습자 선택').selectOption(profile);
async function test(name,fn){try{await fn();console.log(`PASS ${name}`);}catch(e){failures++;console.error(`FAIL ${name}\n${e.stack}`);}}

try{
  for(let attempt=0;attempt<100;attempt++){
    try{if((await fetch(base)).ok)break;}catch{}
    if(attempt===99)throw Error(`Vite did not start: ${serverLog}`);
    await new Promise(r=>setTimeout(r,100));
  }
  // Tests below exercise visible controls and persisted state together.
  await test('legacy English migration preserves every saved field and original key',async()=>{
    const {page,context}=await fixture();
    const migrated=await state(page);
    assert.equal(migrated.active,'wife');
    for(const [key,value] of Object.entries(legacy)) assert.deepEqual(migrated.learners.wife[key],value,key);
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('bloom-state'))),legacy);
    assert.deepEqual(migrated.learners.husband.learned,[]);
    assert.equal(migrated.learners.husband.sessions,0);
    await page.reload();
    assert.deepEqual((await state(page)).learners,migrated.learners);
    await context.close();
  });
  await test('learner selection persists and malformed legacy storage starts safely',async()=>{
    const {page,context}=await fixture(null);
    await choose(page,'husband');
    assert.equal((await state(page)).active,'husband');
    await page.reload();
    assert.equal(await page.getByLabel('학습자 선택').inputValue(),'husband');
    await page.evaluate(()=>{localStorage.removeItem('bloom-profiles-v2');localStorage.setItem('bloom-state','broken json');});
    await page.reload();
    await page.getByLabel('학습자 선택').waitFor();
    assert.deepEqual((await state(page)).learners.wife.learned,[]);
    await context.close();
  });
  await test('Japanese lessons render furigana, use ja-JP audio, and isolate settings and learning',async()=>{
    const {page,context}=await fixture();
    const english=structuredClone((await state(page)).learners.wife);
    await choose(page,'husband');
    await page.getByRole('button',{name:'설정',exact:true}).click();
    await page.getByLabel('이름',{exact:true}).fill('일본어 학습자');
    await page.getByLabel('하루 학습 목표').selectOption('5');
    await page.getByRole('button',{name:'설정 완료'}).click();
    await page.getByRole('button',{name:'오늘의 학습 시작하기'}).click();
    const dialog=page.getByRole('dialog');
    assert.equal(await dialog.locator('h2 ruby rt').innerText(),'ちゅうもん');
    await dialog.getByRole('button',{name:'발음 듣기',exact:true}).click();
    await dialog.getByRole('button',{name:/뜻 확인하기/}).click();
    assert.equal(await dialog.locator('.example ruby rt').innerText(),'ひと');
    await dialog.getByRole('button',{name:'예문 듣기',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>window.__utterances),[{text:'注文',lang:'ja-JP'},{text:'コーヒーを一つください。',lang:'ja-JP'}]);
    const before=Date.now();
    await dialog.getByRole('button',{name:'다시 볼게요'}).click();
    let stored=await state(page);
    assert.deepEqual(stored.learners.husband.learned,[]);
    assert.equal(stored.learners.husband.reviewStages['ja-cafe-order'],0);
    assert.ok(Math.abs(stored.learners.husband.reviews['ja-cafe-order']-before-600000)<3000);
    await dialog.getByRole('button',{name:/뜻 확인하기/}).click();
    await dialog.getByRole('button',{name:'기억했어요'}).click();
    stored=await state(page);
    assert.deepEqual(stored.learners.husband.learned,['ja-cafe-takeout']);
    assert.ok(Math.abs(stored.learners.husband.reviews['ja-cafe-takeout']-Date.now()-86400000)<3000);
    assert.deepEqual(stored.learners.wife,english);
    await choose(page,'wife');
    assert.equal(await page.getByRole('dialog').count(),0,'profile switch closes active lesson');
    assert.deepEqual((await state(page)).learners.wife,english);
    await page.reload();
    await choose(page,'husband');
    stored=await state(page);
    assert.equal(stored.learners.husband.name,'일본어 학습자');
    assert.equal(stored.learners.husband.goal,5);
    assert.deepEqual(stored.learners.wife,english);
    await page.getByRole('button',{name:'복습 노트',exact:true}).click();
    assert.equal(await page.locator('.vocab-row').count(),2,'failed unlearned items remain available for review');
    assert.equal(await page.getByRole('button',{name:'새 단어 배우기'}).count(),1,'future reviews are excluded');
    await context.close();
  });
  await test('shadowing compares kana and uses Japanese recognition with typed fallback',async()=>{
    const {page,context}=await fixture(null);
    await choose(page,'husband');
    await page.getByRole('button',{name:/듣고 따라 말하기/}).click();
    const dialog=page.getByRole('dialog');
    await dialog.getByRole('button',{name:'마이크로 말하기'}).click();
    assert.deepEqual(await page.evaluate(()=>window.__recognitionLanguages),['ja-JP']);
    assert.equal(await dialog.getByLabel('문장 입력 연습').inputValue(),'テストです');
    await dialog.getByLabel('문장 입력 연습').fill('코피');
    await dialog.getByRole('button',{name:'문장 확인',exact:true}).click();
    assert.ok(await dialog.getByText('예문과 비교해 보세요.',{exact:true}).isVisible());
    await dialog.getByLabel('문장 입력 연습').fill('コーヒーをひとつください');
    await dialog.getByRole('button',{name:'문장 확인',exact:true}).click();
    assert.ok(await dialog.getByText('예문과 일치해요!',{exact:true}).isVisible());
    await dialog.getByRole('button',{name:'닫기',exact:true}).click();
    await page.evaluate(()=>{delete window.SpeechRecognition;delete window.webkitSpeechRecognition;});
    await page.getByRole('button',{name:/듣고 따라 말하기/}).click();
    await dialog.getByRole('button',{name:'마이크로 말하기'}).click();
    assert.ok(await dialog.getByText(/음성인식을 지원하지 않는 브라우저/).isVisible());
    await dialog.getByLabel('문장 입력 연습').fill('コーヒーを一つください。');
    await dialog.getByRole('button',{name:'문장 확인',exact:true}).click();
    assert.ok(await dialog.getByText('예문과 일치해요!',{exact:true}).isVisible());
    await context.close();
  });
  await test('recall hides the Japanese target until an attempted answer',async()=>{
    const {page,context}=await fixture(null);
    await choose(page,'husband');
    await page.getByRole('button',{name:/文|문장 떠올리기/}).click();
    const dialog=page.getByRole('dialog');
    assert.ok(!(await dialog.innerText()).includes('コーヒー'));
    assert.ok(await dialog.getByRole('button',{name:'문장 확인',exact:true}).isDisabled());
    await dialog.getByLabel('문장 입력 연습').fill('コーヒーを一つください。');
    await dialog.getByRole('button',{name:'문장 확인',exact:true}).click();
    assert.ok(await dialog.getByText('예문과 일치해요!',{exact:true}).isVisible());
    assert.ok((await dialog.innerText()).includes('コーヒー'));
    assert.ok(await dialog.locator('ruby rt').count()>0);
    await dialog.getByRole('button',{name:'기억했어요'}).click();
    assert.ok(!(await dialog.innerText()).includes('持ち帰りでお願いします'));
    await context.close();
  });
  await test('three-turn Japanese dialogue records only the current learner session and elapsed time',async()=>{
    const {page,context}=await fixture();
    const english=structuredClone((await state(page)).learners.wife);
    await choose(page,'husband');
    await page.clock.install();
    await page.getByRole('button',{name:/짧은 대화/}).click();
    const dialog=page.getByRole('dialog');
    const answers=['コーヒーをひとつください。','もちかえりでおねがいします。','だいじょうぶです。ありがとうございます。'];
    for(let i=0;i<answers.length;i++){
      assert.ok((await dialog.locator('.lesson-top').innerText()).includes(`${i+1} / 3`));
      assert.ok(await dialog.getByRole('button',{name:'상대방 말 듣기'}).isVisible());
      await dialog.getByLabel('나의 대답').fill(answers[i]);
      await dialog.getByRole('button',{name:'문장 확인',exact:true}).click();
      assert.ok(await dialog.getByText('예문과 일치해요!',{exact:true}).isVisible());
      if(i===2)await page.clock.fastForward(90000);
      await dialog.getByRole('button',{name:i===2?'대화 마치기':'다음 대화',exact:true}).click();
    }
    assert.ok(await page.getByRole('dialog',{name:'완료'}).isVisible());
    const stored=await state(page);
    assert.equal(stored.learners.husband.sessions,1);
    assert.equal(stored.learners.husband.minutes,1.5);
    assert.equal(Object.values(stored.learners.husband.dailyMinutes)[0],1.5);
    assert.equal(stored.learners.husband.dates.length,1);
    assert.deepEqual(stored.learners.husband.learned,[]);
    assert.deepEqual(stored.learners.wife,english);
    await context.close();
  });
  await test('due-only review advances each item through spaced intervals and resets failures',async()=>{
    const {page,context}=await fixture(null);
    await choose(page,'husband');
    for(const [stage,days] of [[0,1],[1,3],[2,7],[3,14],[4,30],[5,30]]){
      await page.evaluate(({stage})=>{
        const s=JSON.parse(localStorage.getItem('bloom-profiles-v2'));
        s.learners.husband.reviews={'ja-cafe-order':Date.now()-1000,'ja-cafe-takeout':Date.now()+86400000};
        s.learners.husband.reviewStages={'ja-cafe-order':stage};
        localStorage.setItem('bloom-profiles-v2',JSON.stringify(s));
      },{stage});
      await page.reload();
      await page.getByRole('button',{name:'복습 노트',exact:true}).click();
      await page.getByRole('button',{name:'복습 시작하기',exact:true}).click();
      const dialog=page.getByRole('dialog');
      assert.ok((await dialog.locator('.lesson-top').innerText()).includes('1 / 1'));
      await dialog.getByRole('button',{name:/뜻 확인하기/}).click();
      await dialog.getByRole('button',{name:'기억했어요'}).click();
      const data=(await state(page)).learners.husband;
      assert.ok(Math.abs(data.reviews['ja-cafe-order']-Date.now()-days*86400000)<3000,`stage ${stage} should schedule ${days} days`);
      assert.equal(data.reviewStages['ja-cafe-order'],Math.min(stage+1,5));
    }
    await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('bloom-profiles-v2'));s.learners.husband.reviews['ja-cafe-order']=Date.now()-1;localStorage.setItem('bloom-profiles-v2',JSON.stringify(s));});
    await page.reload();
    await page.getByRole('button',{name:'복습 노트',exact:true}).click();
    await page.getByRole('button',{name:'복습 시작하기',exact:true}).click();
    await page.getByRole('button',{name:/뜻 확인하기/}).click();
    await page.getByRole('button',{name:'다시 볼게요'}).click();
    const data=(await state(page)).learners.husband;
    assert.equal(data.reviewStages['ja-cafe-order'],0);
    assert.ok(Math.abs(data.reviews['ja-cafe-order']-Date.now()-600000)<3000);
    await context.close();
  });
  await test('English course continuity, en-US speech, and Japanese course switching',async()=>{
    const {page,context}=await fixture();
    for(const [title,word] of [['일상에 스며드는 영어','Serendipity'],['설레는 여행의 시작','Reservation'],['나를 위한 작은 대화','Favorite']]){
      await page.getByRole('button',{name:new RegExp(title)}).click();
      assert.equal(await page.getByRole('dialog').locator('h2').innerText(),word);
      await page.getByRole('button',{name:'발음 듣기',exact:true}).click();
      await page.getByRole('button',{name:'닫기',exact:true}).click();
    }
    assert.ok((await page.evaluate(()=>window.__utterances)).every(u=>u.lang==='en-US'));
    await page.getByRole('button',{name:/듣고 따라 말하기/}).click();
    await page.getByRole('button',{name:'마이크로 말하기'}).click();
    assert.deepEqual(await page.evaluate(()=>window.__recognitionLanguages),['en-US']);
    await page.getByRole('dialog').getByLabel('문장 입력 연습').fill('Finding this little café was pure serendipity.');
    await page.getByRole('button',{name:'문장 확인',exact:true}).click();
    assert.ok(await page.getByText('예문과 일치해요!',{exact:true}).isVisible());
    await choose(page,'husband');
    for(const [title,reading] of [['카페에서 주문하기','ちゅうもん'],['여행에서 길 찾기','えき'],['처음 만나 인사하기','なまえ']]){
      await page.getByRole('button',{name:new RegExp(title)}).click();
      assert.equal(await page.getByRole('dialog').locator('h2 ruby rt').innerText(),reading);
      await page.getByRole('button',{name:'닫기',exact:true}).click();
    }
    await context.close();
  });
  await test('travel and introduction scenarios drive shadowing, recall and complete dialogues',async()=>{
    const {page,context}=await fixture(null);
    const cases=[
      ['husband','1','駅はどこですか。',['えきはどこですか。','とうきょうまでのきっぷをください。','よやくしています。']],
      ['husband','2','私の名前はキムです。',['わたしのなまえはキムです。','しゅみはりょこうです。','ありがとうございます。']],
      ['wife','1','I have a reservation under Kim.',['I have a reservation under Kim.','Here is my boarding pass.','Let’s explore the old town.']],
      ['wife','2','What is your favorite book?',['My favorite book is The Little Prince.','My hobby is taking photos.','I prefer tea to coffee.']]
    ];
    for(const [learner,scenario,example,replies] of cases){
      await choose(page,learner);
      await page.getByLabel('연습할 상황').selectOption(scenario);
      for(const mode of ['듣고 따라 말하기','문장 떠올리기']){
        await page.getByRole('button',{name:new RegExp(mode)}).click();
        const dialog=page.getByRole('dialog');
        await dialog.getByLabel('문장 입력 연습').fill(example);
        await dialog.getByRole('button',{name:'문장 확인',exact:true}).click();
        assert.ok(await dialog.getByText('예문과 일치해요!',{exact:true}).isVisible(),`${learner} ${scenario} ${mode}`);
        await dialog.getByRole('button',{name:'닫기',exact:true}).click();
      }
      await page.getByRole('button',{name:/짧은 대화/}).click();
      const dialog=page.getByRole('dialog');
      for(let i=0;i<3;i++){
        await dialog.getByLabel('나의 대답').fill(replies[i]);
        await dialog.getByRole('button',{name:'문장 확인',exact:true}).click();
        assert.ok(await dialog.getByText('예문과 일치해요!',{exact:true}).isVisible(),`${learner} ${scenario} dialogue ${i+1}`);
        await dialog.getByRole('button',{name:i===2?'대화 마치기':'다음 대화',exact:true}).click();
      }
      await page.getByRole('button',{name:'닫기',exact:true}).click();
    }
    assert.equal((await state(page)).learners.husband.sessions,2);
    assert.equal((await state(page)).learners.wife.sessions,2);
    await context.close();
  });
  await test('mobile layout keeps navigation, learner switch and lesson controls usable',async()=>{
    const {page,context}=await fixture(null,{width:390,height:844});
    async function noOverflow(){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page has horizontal overflow');}
    await noOverflow();
    await choose(page,'husband');
    await page.getByRole('button',{name:'오늘의 학습 시작하기'}).click();
    await page.getByRole('button',{name:/뜻 확인하기/}).click();
    await page.getByRole('button',{name:'기억했어요'}).click();
    await noOverflow();
    await page.getByRole('button',{name:'닫기',exact:true}).click();
    await page.getByRole('button',{name:'복습 노트',exact:true}).click();
    await noOverflow();
    await page.getByRole('button',{name:'학습 리포트',exact:true}).click();
    await noOverflow();
    await page.getByRole('button',{name:'설정',exact:true}).click();
    await page.getByLabel('이름',{exact:true}).fill('모바일');
    await page.getByRole('button',{name:'설정 완료'}).click();
    assert.equal((await state(page)).learners.husband.name,'모바일');
    await context.close();
  });
  assert.deepEqual(errors,[],'no uncaught browser errors');
}finally{
  await browser.close();
  try { process.kill(-server.pid,'SIGTERM'); } catch {}
}
if(failures)process.exitCode=1;
