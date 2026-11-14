// Browser speech is optional: recognition transcribes words, never scores pronunciation.
export function inAppBrowserGuide(host = window) {
  if (!/KAKAOTALK/i.test(host.navigator?.userAgent || '')) return '';
  const apple = /iPhone|iPad|iPod|Macintosh/i.test(host.navigator?.userAgent || '');
  return apple
    ? '카카오톡 안에서는 아이폰 음성 인식이 제한될 수 있어요. 카카오톡의 메뉴에서 “다른 브라우저로 열기” 또는 “Safari에서 열기”를 선택해 주세요. 메뉴가 없다면 아래에서 주소를 복사한 뒤 Safari 주소창에 붙여 넣어 여세요.'
    : '카카오톡 안에서는 음성 인식이 제한될 수 있어요. 카카오톡의 메뉴에서 “다른 브라우저로 열기”를 선택하거나 주소를 복사해 Chrome 등 지원 브라우저에서 열어 주세요.';
}

export async function copyPageUrl(host = window) {
  try {
    if (!host.navigator?.clipboard?.writeText) return false;
    await host.navigator.clipboard.writeText(host.location.href);
    return true;
  } catch { return false; }
}

export function speechAvailability(host = window) {
  const inApp = inAppBrowserGuide(host);
  if (inApp) return inApp;
  if (host.isSecureContext === false) return '마이크는 HTTPS 주소 또는 localhost에서 사용할 수 있어요. 안전한 주소로 다시 열거나 직접 입력해 주세요.';
  const policy = host.document?.permissionsPolicy || host.document?.featurePolicy;
  try {
    if (policy?.allowsFeature && !policy.allowsFeature('microphone')) return '이 화면에서는 마이크가 차단되어 있어요. 앱을 새 탭에서 직접 열어 주세요. 계속 차단되면 사이트 관리자에게 마이크 허용을 요청하거나 직접 입력해 주세요.';
  } catch { /* Older browsers may not expose the microphone policy. */ }
  if (!(host.SpeechRecognition || host.webkitSpeechRecognition)) return '이 브라우저는 음성 인식을 지원하지 않아요. Chrome 또는 Safari의 최신 버전에서 앱을 직접 열거나 아래에 입력해 주세요.';
  return '';
}

export function recognitionError(error) {
  return ({
    'not-allowed': '마이크 또는 음성 인식 권한이 차단되었어요. 주소창의 사이트 권한과 기기의 마이크 설정을 확인한 뒤 다시 눌러 주세요. 앱 안의 미리보기라면 새 탭에서 직접 열어 주세요.',
    'service-not-allowed': '브라우저에서 음성 인식 서비스를 허용하지 않아요. 지원되는 브라우저에서 앱을 직접 열거나 직접 입력해 주세요.',
    'audio-capture': '사용할 수 있는 마이크가 없어요. 마이크 연결과 기기 권한을 확인하고, 다른 앱이 마이크를 사용 중이면 종료해 주세요.',
    'no-speech': '말소리를 듣지 못했어요. 마이크가 켜져 있는지 확인하고 버튼을 눌러 다시 말해 주세요.',
    network: '음성 인식 서비스에 연결하지 못했어요. 인터넷 연결을 확인해 주세요. 이 브라우저의 음성 인식은 네트워크가 필요할 수 있어요.',
    'language-not-supported': '이 브라우저의 음성 인식은 선택한 언어를 지원하지 않아요. 다른 지원 브라우저를 사용하거나 직접 입력해 주세요.',
    aborted: '음성 인식을 멈췄어요. 다시 말하거나 직접 입력할 수 있어요.',
  })[error] || '음성 인식을 시작할 수 없어요. 마이크와 브라우저 설정을 확인하거나 직접 입력해 주세요.';
}

export function selectVoice(voices, locale) {
  const target = locale.toLowerCase();
  const language = target.split('-')[0];
  return voices.filter((voice) => voice.lang?.toLowerCase().split('-')[0] === language)
    .map((voice, index) => ({ voice, index, score:
      (voice.lang.toLowerCase() === target ? 100 : 0) +
      (/neural|natural|premium|enhanced|online/i.test(voice.name) ? 35 : 0) +
      (/google|microsoft|samantha|ava|allison|aaron|kyoko|otoya|siri/i.test(voice.name) ? 15 : 0) +
      (voice.default ? 2 : 0) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.voice;
}

export function createSpeechController(host = window) {
  let capture = null;
  let recognitionTimer;
  let playbackVersion = 0;
  let cachedVoices = [];
  let voiceListener = null;
  let activeUtterance = null;
  let pendingPlayback = null;
  function stopRecognition() {
    const active = capture;
    capture = null;
    clearTimeout(recognitionTimer);
    if (!active) return;
    active.onstart = active.onresult = active.onerror = active.onend = null;
    try { active.abort(); } catch { /* Already stopped. */ }
  }
  function stopPlayback() {
    playbackVersion += 1;
    pendingPlayback?.();
    pendingPlayback = null;
    if (activeUtterance) activeUtterance.onend = activeUtterance.onerror = null;
    activeUtterance = null;
    host.speechSynthesis?.cancel();
  }
  function stopAll() { stopRecognition(); stopPlayback(); }
  function startRecognition({ locale, onStatus = () => {}, onListening = () => {}, onTranscript = () => {} }) {
    if (capture) { onStatus('마이크를 준비하고 있어요. 권한 창이 열렸다면 허용해 주세요.'); return; }
    const unavailable = speechAvailability(host);
    if (unavailable) { onListening(false); onStatus(unavailable); return; }
    stopPlayback();
    const Recognition = host.SpeechRecognition || host.webkitSpeechRecognition;
    let recognition;
    try { recognition = new Recognition(); }
    catch { onListening(false); onStatus(recognitionError('service-not-allowed')); return; }
    capture = recognition;
    let heard = false;
    let failed = false;
    recognition.lang = locale;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    const current = () => capture === recognition;
    recognition.onstart = () => { if (current()) { onListening(true); onStatus('듣고 있어요. 문장을 말한 뒤 잠시 기다려 주세요.'); } };
    recognition.onresult = (event) => {
      if (!current()) return;
      const result = Array.from(event.results || []).find((entry) => entry.isFinal !== false);
      const transcript = result?.[0]?.transcript?.trim();
      if (!transcript) return;
      heard = true;
      onTranscript(transcript);
      onStatus('인식한 문장을 확인하고 답안을 비교해 주세요. 발음 점수는 제공하지 않아요.');
    };
    recognition.onerror = (event) => {
      if (!current()) return;
      failed = true;
      stopRecognition();
      onListening(false);
      const safariHelp = /iPhone|iPad|iPod/i.test(host.navigator?.userAgent || '') && ['not-allowed', 'service-not-allowed'].includes(event.error)
        ? ' Safari에서 계속 안 되면 iPhone의 Siri 및 받아쓰기 설정도 확인해 주세요. 기기·브라우저에 따라 음성 인식 지원이 달라요.' : '';
      onStatus(recognitionError(event.error) + safariHelp);
    };
    recognition.onend = () => {
      if (!current()) return;
      stopRecognition();
      onListening(false);
      if (!heard && !failed) onStatus('인식된 문장이 없어요. 버튼을 눌러 다시 말하거나 직접 입력해 주세요.');
    };
    onStatus('마이크를 준비하고 있어요. 브라우저의 마이크 사용 요청을 허용해 주세요.');
    try {
      // Keep start() in the click call stack; do not await a permission query first.
      recognition.start();
      if (current()) recognitionTimer = setTimeout(() => {
        if (!current()) return;
        stopRecognition();
        onListening(false);
        onStatus('마이크 응답이 없어 인식을 멈췄어요. 사이트·기기의 마이크 권한을 확인하거나 앱을 새 탭에서 직접 열어 주세요. 직접 입력으로도 계속할 수 있어요.');
      }, 30000);
    } catch (error) {
      stopRecognition();
      onListening(false);
      onStatus(recognitionError(error.name === 'NotAllowedError' ? 'not-allowed' : error.name === 'NotFoundError' ? 'audio-capture' : 'unknown'));
    }
  }
  function finishRecognition() { try { capture?.stop(); } catch { stopRecognition(); } }
  function speak({ text, locale, slow = false, onStatus = () => {} }) {
    stopPlayback();
    if (!host.speechSynthesis || !host.SpeechSynthesisUtterance) { onStatus('이 브라우저에서는 음성 재생을 지원하지 않아요. 문장을 읽고 계속 연습할 수 있어요.'); return; }
    const version = playbackVersion;
    const synth = host.speechSynthesis;
    if (!voiceListener && synth.addEventListener) {
      voiceListener = () => { cachedVoices = synth.getVoices(); };
      synth.addEventListener('voiceschanged', voiceListener);
    }
    const available = synth.getVoices();
    if (available.length) cachedVoices = available;
    const voices = cachedVoices;
    // Speak synchronously in the tap call stack on iOS. A voiceschanged event
    // refreshes the available choices for the next tap without losing activation.
    const utterance = new host.SpeechSynthesisUtterance(text);
    activeUtterance = utterance;
    utterance.lang = locale;
    const voice = selectVoice(voices, locale);
    if (voice) utterance.voice = voice;
    utterance.rate = slow ? 0.78 : 1;
    utterance.pitch = 1;
    const finish = () => { clearTimeout(timer); pendingPlayback = null; activeUtterance = null; };
    const timer = setTimeout(() => { if (version !== playbackVersion) return; finish(); synth.cancel(); onStatus('음성 재생이 응답하지 않아요. 다시 듣기를 누르거나 기기의 음성 설정을 확인해 주세요.'); }, 30000);
    pendingPlayback = () => clearTimeout(timer);
    utterance.onend = () => { if (version === playbackVersion) { finish(); onStatus('재생이 끝났어요. 다시 듣거나 계속 연습하세요.'); } };
    utterance.onerror = (event) => { if (version === playbackVersion) { finish(); onStatus(event.error === 'not-allowed' ? '음성 재생 버튼을 직접 눌러 주세요. 브라우저가 자동 재생을 막았어요.' : '음성을 재생할 수 없어요. 기기의 영어·일본어 음성 설정을 확인하고 다시 눌러 주세요.'); } };
    onStatus(voice ? `${slow ? '천천히' : '보통 속도로'} 재생해요 · ${voice.name}` : '기기의 기본 음성으로 재생해요. 영어·일본어 음성을 설치하면 더 자연스럽게 들을 수 있어요.');
    try { synth.resume?.(); synth.speak(utterance); } catch { finish(); onStatus('음성을 재생할 수 없어요. 문장을 읽고 계속 연습할 수 있어요.'); }
  }
  function dispose() {
    stopAll();
    if (voiceListener) host.speechSynthesis?.removeEventListener?.('voiceschanged', voiceListener);
    voiceListener = null;
    cachedVoices = [];
  }
  return { startRecognition, finishRecognition, stopRecognition, stopPlayback, stopAll, speak, dispose };
}
