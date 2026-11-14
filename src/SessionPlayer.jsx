import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { compareSentence } from './learning/compare';
import './session.css';
import { createSpeechController, inAppBrowserGuide, copyPageUrl } from './speech';

export function SentenceTarget({ sentence, lang }) {
  return <span lang={lang === 'ja' ? 'ja-JP' : 'en-US'}>{sentence.ruby && lang === 'ja'
    ? sentence.ruby.map((part, i) => typeof part === 'string' ? <React.Fragment key={i}>{part}</React.Fragment> : <ruby key={i}>{part[0]}<rt>{part[1]}</rt></ruby>)
    : sentence.text}</span>;
}

const labels = { context: '장면 이해', listen: '듣기', shadow: '따라 말하기', recall: '기억해서 말하기', quiz: '오늘의 퀴즈', summary: '세션 완료' };

export default function SentenceSession({ scenario, lang = 'en', sentences: subset, onComplete, onClose, saveStatus, saveError, saveTarget = 'account', onRetrySave }) {
  const [sentences] = useState(() => [...(subset ?? scenario.sentences)].filter(Boolean));
  const [step, setStep] = useState({ phase: 'context', index: 0 });
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [tries, setTries] = useState(0);
  const [attempts, setAttempts] = useState([]);
  const [audioStatus, setAudioStatus] = useState('');
  const [listening, setListening] = useState(false);
  const [speechStatus, setSpeechStatus] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const opener = useRef(document.activeElement);
  const overlay = useRef(null);
  const dialog = useRef(null);
  const heading = useRef(null);
  const speech = useRef(null);
  if (!speech.current) speech.current = createSpeechController();
  const browserGuide = inAppBrowserGuide();
  const [copyStatus, setCopyStatus] = useState('');
  const mounted = useRef(true);
  const completed = useRef(false);
  const started = useRef(Date.now());
  const lastAction = useRef(0);
  const attemptsRef = useRef([]);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const locale = lang === 'ja' ? 'ja-JP' : 'en-US';
  const { phase, index } = step;
  const sentence = sentences[index % Math.max(1, sentences.length)];
  const ready = phase === 'listen' || (!!feedback && (feedback.matched || tries >= 2));
  const results = sentences.map((item) => {
    const records = attempts.filter((attempt) => attempt.sentenceId === item.id);
    const failed = records.some((attempt) => !attempt.matched);
    return { sentenceId: item.id, passed: !failed && records.length > 0, matched: !failed && records.length > 0, failed, attempts: records.length };
  });

  const guarded = (action) => {
    const now = Date.now();
    if (now - lastAction.current < 400) return;
    lastAction.current = now;
    action();
  };
  const stopSpeech = () => speech.current.stopAll();
  const close = () => { stopSpeech(); closeRef.current?.(); };

  useEffect(() => {
    mounted.current = true;
    const previousFocus = opener.current;
    const previousOverflow = document.body.style.overflow;
    const root = dialog.current?.closest('.session-overlay');
    const siblings = [...document.body.children].filter((node) => node !== root && !node.contains(root));
    const previous = siblings.map((node) => [node, node.inert]);
    siblings.forEach((node) => { node.inert = true; });
    document.body.style.overflow = 'hidden';
    heading.current?.focus({ preventScroll: true });
    const trap = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); stopSpeech(); closeRef.current?.(); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.current.querySelectorAll('button:not(:disabled), textarea:not(:disabled), [tabindex="0"]')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !focusable.includes(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => {
      mounted.current = false;
      speech.current.dispose();
      previous.forEach(([node, inert]) => { node.inert = inert; });
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', trap);
      requestAnimationFrame(() => {
        // A route may remove the opener while the session is open. Wait for
        // that render before choosing a visible control in the current page.
        if (dialog.current?.isConnected) return;
        const available = (node) => node?.isConnected && !node.closest('[inert]') && !node.disabled && node.getClientRects().length > 0;
        const controls = [
          ...document.querySelectorAll('.nav-item.active, nav [aria-current]'),
          ...document.querySelectorAll('button:not(:disabled), a[href]'),
        ];
        const destination = available(previousFocus) && previousFocus !== document.body
          ? previousFocus
          : controls.find(available);
        destination?.focus();
      });
    };
  }, []);

  const play = (slow = false, target = sentence) => {
    speech.current.stopRecognition();
    setListening(false);
    speech.current.speak({
      text: target.audioText || target.text, locale, slow,
      onStatus: (message) => { if (mounted.current) setAudioStatus(message); },
    });
  };

  useEffect(() => {
    return () => speech.current.stopAll();
  }, [locale]);

  useLayoutEffect(() => {
    // The overlay owns scrolling. Focusing the heading alone can leave the
    // header above the viewport after advancing from a long answer/feedback.
    const container = overlay.current;
    if (container) container.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
    if (container) container.scrollTop = 0;
  }, [phase, index]);

  useEffect(() => {
    if (phase !== 'summary' || completed.current) return;
    completed.current = true;
    onComplete?.({ scenarioId: scenario.id, attempts: attemptsRef.current, results, elapsedMs: elapsed });
  }, [phase]);

  const move = (nextPhase, nextIndex = 0) => {
    stopSpeech();
    setListening(false);
    setSpeechStatus('');
    setAudioStatus('');
    setInput('');
    setFeedback(null);
    setTries(0);
    setStep({ phase: nextPhase, index: nextIndex });
    // Start the next listening sentence within the navigation tap, preserving
    // iOS activation instead of deferring playback to an effect/timer.
    if (nextPhase === 'listen' && sentences[nextIndex]) play(false, sentences[nextIndex]);
  };
  const advance = () => guarded(() => {
    if (phase === 'context') return move('listen');
    if (!ready) return;
    if (phase === 'quiz') {
      if (index < 2) move('quiz', index + 1);
      else { setElapsed(Date.now() - started.current); move('summary'); }
    } else if (index < sentences.length - 1) move(phase, index + 1);
    else move(phase === 'listen' ? 'shadow' : phase === 'shadow' ? 'recall' : 'quiz');
  });
  const check = (event) => {
    event.preventDefault();
    if (!input.trim() || feedback) return;
    guarded(() => {
      const compared = compareSentence({ input, sentence, locale });
      const entry = { sentenceId: sentence.id, phase, input, matched: compared.matched, segments: compared.segments };
      attemptsRef.current = [...attemptsRef.current, entry];
      setAttempts(attemptsRef.current);
      setTries((value) => value + 1);
      setFeedback(compared);
      speech.current.stopRecognition();
      setListening(false);
    });
  };
  const recognize = () => guarded(() => {
    if (listening) { speech.current.finishRecognition(); return; }
    speech.current.startRecognition({
      locale,
      onListening: (value) => { if (mounted.current) setListening(value); },
      onStatus: (message) => { if (mounted.current) setSpeechStatus(message); },
      onTranscript: (transcript) => { if (mounted.current) setInput(transcript); },
    });
  });
  const copyAddress = async () => {
    const copied = await copyPageUrl();
    if (mounted.current) setCopyStatus(copied ? '주소를 복사했어요. 외부 브라우저를 열고 주소창에 붙여 넣어 주세요.' : '자동 복사를 사용할 수 없어요. 주소를 길게 눌러 복사해 주세요.');
  };


  return createPortal(<div ref={overlay} className="session-overlay"><section ref={dialog} className="sentence-session" role="dialog" aria-modal="true" aria-labelledby="session-title">
    <header className="session-header"><div className="session-wordmark">bloom<span>practice</span></div><button className="session-close" onClick={close} aria-label={phase === 'summary' ? '세션 닫기' : '세션 취소하고 닫기'}>닫기 <span aria-hidden="true">×</span></button></header>
    <main className="session-main">
      <div className="session-eyebrow">{lang === 'ja' ? 'JAPANESE' : 'ENGLISH'} · {scenario.titleKo}</div>
      <h1 id="session-title" tabIndex={-1} ref={heading}>{labels[phase]}</h1>
      <nav className="session-steps" aria-label="학습 단계">{Object.entries(labels).filter(([key]) => key !== 'summary').map(([key, label], number) => <span key={key} aria-current={phase === key ? 'step' : undefined} className={phase === key ? 'active' : ''}>{number + 1}. {label}</span>)}</nav>
      {browserGuide && <aside className="session-browser-guide" aria-label="카카오톡 마이크 안내"><strong>마이크 연습은 외부 브라우저에서 열어 주세요</strong><p>{browserGuide}</p><button type="button" className="session-secondary" onClick={copyAddress}>현재 주소 복사</button><p className="session-note" role="status">{copyStatus}</p>{copyStatus.startsWith('자동') && <input className="session-copy-url" aria-label="복사할 현재 주소" readOnly value={window.location.href} onFocus={(event) => event.target.select()} />}</aside>}
      {!sentences.length ? <div className="session-card"><p>복습할 문장이 없어요.</p><button onClick={close}>세션 닫기</button></div> : phase === 'context' ? <>
        {scenario.contextKo && <p className="session-scene-context">{scenario.contextKo}</p>}
        <p className="session-intro">장면과 뜻을 먼저 살펴보세요. 다음 단계부터는 짧은 힌트만 보여 드려요.</p>
        <div className="session-context"><img src={scenario.image} alt={scenario.titleKo} /><ol>{sentences.map((item) => <li key={item.id}><div className="session-target"><SentenceTarget sentence={item} lang={lang} /></div><p>{item.meaningKo}</p></li>)}</ol></div>
        <button className="session-primary" onClick={advance}>뜻을 확인했어요 · 듣기 시작</button>
      </> : phase === 'summary' ? <div className="session-card session-summary"><div className="session-done" aria-hidden="true">✓</div><h2>오늘의 문장을 끝까지 연습했어요</h2><p>{sentences.length}문장 · 퀴즈 3개 · {elapsed < 60000 ? '1분 미만' : `약 ${Math.floor(elapsed / 60000)}분`}</p><p>한 번이라도 다른 답을 입력한 문장은 복습 대상으로 기록해요.</p><ul>{sentences.map((item) => <li key={item.id}><SentenceTarget sentence={item} lang={lang} /><span>{results.find((result) => result.sentenceId === item.id)?.failed ? '다시 연습' : '연습 완료'}</span></li>)}</ul><p className="session-note">답안의 글자와 단어만 비교했어요.</p>
        {saveStatus && <div className={'session-save-status ' + saveStatus} role="status">
          <p>{saveStatus === 'saved'
            ? saveTarget === 'account' ? '계정에 저장됨' : '이 브라우저에 저장됨'
            : saveStatus === 'saving' ? '서버에 저장 중…'
              : saveTarget === 'account' ? '서버 저장 실패 · 창을 닫기 전에 다시 시도해 주세요' : '브라우저 저장 실패 · 창을 닫기 전에 다시 시도해 주세요'}</p>
          {saveStatus === 'failed' && <>{saveError && <p>{saveError}</p>}<button type="button" className="session-secondary" onClick={onRetrySave}>다시 저장</button></>}
        </div>}
        <button className="session-primary" onClick={close}>세션 닫기</button></div> : <>
        <p className="session-counter">{phase === 'quiz' ? `퀴즈 ${index + 1} / 3` : `문장 ${index + 1} / ${sentences.length}`}</p>
        {phase === 'quiz' && <p className="session-note">오늘 연습한 문장만 출제돼요.{sentences.length < 3 && ' 문장이 3개보다 적으면 같은 문장을 다시 물어봐요.'}</p>}
        <div className="session-practice"><img src={scenario.image} alt={scenario.titleKo} /><div className="session-card">
          <p className="session-cue">{sentence.cueKo}</p>
          {(phase === 'listen' || phase === 'shadow' || feedback) && <div className="session-target"><SentenceTarget sentence={sentence} lang={lang} /></div>}
          {(phase === 'recall' || phase === 'quiz') && !feedback && <p className="session-hidden">문장을 떠올려 말하거나 입력해 보세요.<br />답안을 확인하면 원문이 보여요.</p>}
          {phase === 'listen' ? <><p>한 번 듣고 문장의 흐름을 익혀 보세요.</p><div className="session-answer-actions"><button className="session-secondary" onClick={() => guarded(() => play())}>↻ 다시 듣기</button><button className="session-secondary" onClick={() => guarded(() => play(true))}>천천히 듣기</button></div><p role="status" className="session-note">{audioStatus}</p></> : <form onSubmit={check}>
            <label htmlFor="session-answer">{phase === 'shadow' ? '보고 따라 말한 문장' : '기억한 문장'}</label>
            <textarea id="session-answer" lang={locale} value={input} onChange={(event) => setInput(event.target.value)} disabled={!!feedback} placeholder="마이크로 말하거나 직접 입력하세요" rows={3} />
            {!feedback && <div className="session-answer-actions"><button type="button" className="session-secondary" onClick={recognize}>{listening ? '인식 멈추기' : '마이크로 말하기'}</button><button type="submit" className="session-primary" disabled={!input.trim() || listening}>답안 확인</button></div>}
            <p role="status" className="session-note">{speechStatus || '말한 내용을 글자로 바꾸어 비교해요. 발음 점수는 제공하지 않아요.'}</p>
          </form>}
          {feedback && <div className={`session-feedback ${feedback.matched ? 'matched' : ''}`} role="status"><h2>{feedback.matched ? '문장이 일치해요' : '다른 부분을 확인해 보세요'}</h2>{!feedback.matched && <ul>{feedback.segments.filter((part) => part.type !== 'equal').map((part, i) => <li key={i}><strong>{part.type === 'missing' ? '빠진 부분' : part.type === 'extra' ? '추가된 부분' : '바뀐 부분'}</strong>{part.expected && <span lang={locale}>원문: {part.expected}</span>}{part.actual && <span lang={locale}>입력: {part.actual}</span>}</li>)}</ul>}<p className="session-note">입력한 글자와 단어를 비교한 결과예요. 배운 예문을 떠올리는 연습이라 다른 자연스러운 표현은 일치하지 않을 수 있어요.</p>{!feedback.matched && tries < 2 && <button className="session-secondary" onClick={() => guarded(() => { setFeedback(null); setInput(''); setSpeechStatus(''); })}>한 번 더 시도하기</button>}{!feedback.matched && tries >= 2 && <p>복습할 문장으로 기록했어요. 다음으로 넘어가세요.</p>}</div>}
        </div></div>
        <div className="session-footer"><span>{phase === 'listen' ? '브라우저 합성 음성으로 들어요' : '직접 입력해도 같은 방식으로 확인해요'}</span><button className="session-primary" disabled={!ready} onClick={advance}>{phase === 'quiz' && index === 2 ? '결과 보기' : '다음으로 →'}</button></div>
      </>}
    </main>
  </section></div>, document.body);
}
