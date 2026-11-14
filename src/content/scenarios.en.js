import { legacyEnglishScenarios } from './scenarios.en.legacy.js';

// Original everyday English for a parent of a five-year-old.
// Versioned IDs keep earlier learning records attached to their original text.
// meaningKo translates the line; cueKo describes when to say it during recall.
const scene = (theme, titleKo, image, contextKo, rows) => {
  const id = `mom_v1_${theme}`;
  return {
    id,
    titleKo,
    image: `/images/${image}.svg`,
    contextKo,
    sentences: rows.map(([text, meaningKo, cueKo, accepted], index) => ({
      id: `en:${id}:${index + 1}`,
      text,
      meaningKo,
      cueKo,
      audioText: text,
      ...((accepted || text.includes("Let's")) ? {
        accepted: [...new Set([...(accepted || []), ...(text.includes("Let's") ? [text.replaceAll("Let's", 'Let us')] : [])])],
      } : {}),
    })),
  };
};

export const englishScenarios = [
  scene('morning_start', '아침에 아이 깨우기', 'flowers', '유치원에 갈 아침이에요. 잠에서 깬 아이가 천천히 하루를 시작하도록 도와줘요.', [
    ["It's time to get up.", '이제 일어날 시간이야.', '아직 누워 있는 아이에게 일어날 시간이라고 알려 주세요.', ['It is time to get up.']],
    ['Do you need a minute?', '조금 더 있다가 일어날래?', '막 잠에서 깬 아이에게 잠깐 시간이 더 필요한지 물어보세요.'],
    ["Let's open the curtains.", '커튼을 열자.', '아침 햇살이 들어오도록 커튼을 열자고 해 보세요.', ['Let us open the curtains.']],
    ['Your clothes are on the chair.', '네 옷은 의자 위에 있어.', '아이에게 입을 옷이 의자 위에 있다고 알려 주세요.'],
    ["I'll help you get started.", '엄마가 처음에 좀 도와줄게.', '준비를 시작하기 어려워하는 아이에게 도와주겠다고 말해 보세요.', ['I will help you get started.']],
  ]),
  scene('get_dressed', '옷 입고 신발 신기', 'luggage', '외출하기 전에 아이가 스스로 옷을 고르고 입도록 도와줘요.', [
    ['Which shirt do you want to wear?', '어떤 티셔츠 입을래?', '두 티셔츠 중 어떤 것을 입고 싶은지 아이에게 물어보세요.'],
    ['Your shirt is on backwards.', '티셔츠 앞뒤가 바뀌었네.', '옷의 앞뒤를 거꾸로 입은 아이에게 알려 주세요.', ['Your shirt is on backward.']],
    ['Can you put your arms through?', '여기 팔을 쏙 넣어 볼래?', '옷소매에 팔을 넣도록 아이에게 말해 보세요.'],
    ["Let's put your shoes on.", '신발 신자.', '옷을 다 입은 아이에게 이제 신발을 신자고 해 보세요.'],
    ["I'll help you zip it up.", '지퍼 올리는 건 엄마가 도와줄게.', '겉옷 지퍼를 어려워하는 아이에게 도와주겠다고 해 보세요.', ['I will help you zip it up.']],
  ]),
  scene('breakfast', '아침밥 함께 먹기', 'tea', '아침 식탁에서 아이의 선택을 들어 주고 필요한 것을 챙겨 줘요.', [
    ['Would you like eggs or toast?', '달걀 먹을래, 토스트 먹을래?', '달걀과 토스트 중 무엇을 먹고 싶은지 아이에게 물어보세요.'],
    ['Do you want some more?', '좀 더 먹을래?', '접시를 비운 아이에게 더 먹고 싶은지 물어보세요.'],
    ["It's still hot. Let it cool down.", '아직 뜨거워. 조금 식혀서 먹자.', '뜨거운 음식을 바로 먹으려는 아이에게 잠깐 기다리라고 해 보세요.', ['It is still hot. Let it cool down.']],
    ['Take your time chewing.', '천천히 꼭꼭 씹어 먹어.', '급하게 먹는 아이에게 천천히 씹어 먹으라고 해 보세요.'],
    ['Are you all done?', '다 먹었어?', '아이가 식사를 마쳤는지 확인해 보세요.'],
  ]),
  scene('brushing_teeth', '양치 도와주기', 'flowers', '세면대 앞에서 아이가 양치하는 것을 도와줘요.', [
    ['Put a little toothpaste on your brush.', '칫솔에 치약을 조금만 짜 봐.', '양치를 시작하는 아이에게 치약을 조금 짜라고 해 보세요.'],
    ["Let's brush your back teeth, too.", '안쪽 어금니도 닦자.', '앞니만 닦는 아이에게 안쪽 이도 닦자고 해 보세요.'],
    ['Open wide.', '입을 크게 벌려 봐.', '이를 닦아 주려고 아이에게 입을 크게 벌리라고 해 보세요.'],
    ['Spit it out in the sink.', '세면대에 뱉어.', '입에 있는 치약을 세면대에 뱉으라고 알려 주세요.'],
    ['Great, your teeth are all clean.', '잘했어, 이가 깨끗해졌네.', '양치를 마친 아이에게 잘했다고 말해 주세요.'],
  ]),
  scene('preschool_dropoff', '유치원에서 헤어지기', 'books', '유치원 교실 앞에서 아이와 인사하고 선생님께 아이의 상태를 전해요.', [
    ["Let's hang up your backpack.", '가방을 걸어 두자.', '교실에 들어가기 전에 아이와 가방을 정리해 보세요.'],
    ['Would you like one more hug?', '한 번 더 안아 줄까?', '헤어지기 아쉬워하는 아이에게 한 번 더 안아 줄지 물어보세요.'],
    ["I'll pick you up after snack time.", '간식 먹고 나면 엄마가 데리러 올게.', '아이에게 간식 시간이 끝나면 데리러 온다고 알려 주세요.', ['I will pick you up after snack time.']],
    ['He had a rough night.', '아이가 어젯밤에 잠을 잘 못 잤어요.', '선생님께 아이가 어젯밤 편히 못 잤다고 전해 보세요.'],
    ['Have fun with your friends!', '친구들이랑 재미있게 놀아!', '교실로 들어가는 아이에게 즐겁게 지내라고 인사해 주세요.'],
  ]),
  scene('preschool_pickup', '유치원에서 데려오기', 'books', '하원 시간에 아이를 만나고 집으로 갈 준비를 해요.', [
    ["I'm so happy to see you!", '다시 만나서 정말 반가워!', '하원하는 아이를 반갑게 맞아 주세요.', ['I am so happy to see you!']],
    ['What did you play today?', '오늘은 뭐 하고 놀았어?', '오늘 유치원에서 어떤 놀이를 했는지 물어보세요.'],
    ['Did anything make you laugh?', '오늘 재미있어서 웃었던 일 있어?', '아이의 하루 중 웃음이 났던 순간을 물어보세요.'],
    ["Let's check your cubby.", '네 사물함을 확인해 보자.', '집에 가져갈 물건이 있는지 사물함을 보자고 해 보세요.'],
    ['Do you need the bathroom before we go?', '가기 전에 화장실 갈래?', '유치원을 나서기 전에 화장실에 갈지 물어보세요.', ['Do you need to use the bathroom before we go?']],
  ]),
  scene('talking_teacher', '선생님께 아이 이야기 듣기', 'books', '선생님과 아이의 유치원 생활을 짧게 이야기해요.', [
    ['How was his day?', '오늘 아이는 잘 지냈나요?', '선생님께 아이가 오늘 어떻게 지냈는지 물어보세요.'],
    ['Did he eat much at lunch?', '점심은 잘 먹었나요?', '아이의 점심 식사량을 선생님께 물어보세요.'],
    ['Has he been playing with the other kids?', '다른 아이들과 어울려 놀고 있나요?', '아이가 친구들과 어울리는지 선생님께 물어보세요.'],
    ["We've been practicing taking turns at home.", '집에서도 차례를 지키는 연습을 하고 있어요.', '집에서 차례 지키기를 연습 중이라고 선생님께 전해 보세요.', ['We have been practicing taking turns at home.']],
    ['Is there anything we should work on at home?', '집에서 같이 연습하면 좋을 게 있을까요?', '집에서 도울 수 있는 부분이 있는지 선생님께 물어보세요.'],
  ]),
  scene('playground_turns', '놀이터에서 차례 기다리기', 'forest', '다른 아이들과 함께 미끄럼틀을 이용하며 차례와 거리를 지켜요.', [
    ["Let's wait for our turn.", '우리 차례를 기다리자.', '먼저 타려는 아이에게 차례를 기다리자고 말해 보세요.'],
    ["He's still using the slide.", '아직 저 친구가 미끄럼틀을 타고 있어.', '앞에 있는 친구가 아직 이용 중이라는 걸 알려 주세요.', ['He is still using the slide.', "She's still using the slide.", 'She is still using the slide.']],
    ['You can go next.', '그다음에 네가 타면 돼.', '기다리는 아이에게 다음이 자기 차례라고 알려 주세요.'],
    ['Please give her some space.', '저 친구랑 조금 떨어져 있어 줘.', '앞의 친구에게 너무 가까이 선 아이에게 간격을 두라고 해 보세요.', ['Please give him some space.']],
    ['Thanks for waiting.', '기다려 줘서 고마워.', '차례를 기다려 준 아이에게 고맙다고 해 주세요.'],
  ]),
  scene('playground_safety', '놀이터에서 안전하게 놀기', 'forest', '아이의 놀이를 지켜보며 구체적으로 안전한 행동을 알려 줘요.', [
    ['Hold on with both hands.', '두 손으로 꼭 잡아.', '놀이 기구를 한 손으로 잡은 아이에게 두 손으로 잡으라고 해 보세요.'],
    ['Watch out for the swings.', '그네 조심해.', '움직이는 그네 쪽으로 가는 아이에게 주의를 주세요.'],
    ['Wait until the slide is clear.', '미끄럼틀 아래에 아무도 없을 때 내려가.', '미끄럼틀 아래에 친구가 있을 때 기다리라고 해 보세요.'],
    ["That's a bit too high. Let's come down.", '거긴 좀 높네. 내려오자.', '아이가 너무 높은 곳에 올라갔을 때 내려오자고 말해 보세요.', ['That is a bit too high. Let us come down.', "That is a bit too high. Let's come down.", "That's a bit too high. Let us come down."]],
    ['Come get a drink of water.', '와서 물 좀 마셔.', '한참 뛰어논 아이에게 물을 마시러 오라고 해 보세요.'],
  ]),
  scene('playdate_arranging', '친구 엄마와 놀이 약속 잡기', 'flowers', '유치원 친구의 부모와 아이들이 함께 놀 시간을 정해요.', [
    ['Would you like to meet at the park?', '공원에서 만날까요?', '다른 부모에게 공원에서 아이들과 만나자고 제안해 보세요.'],
    ['Are you free on Saturday morning?', '토요일 오전에 시간 괜찮으세요?', '토요일 오전에 시간이 괜찮은지 다른 부모에게 물어보세요.'],
    ['Ten works for us.', '저희는 열 시 괜찮아요.', '상대가 제안한 열 시에 만날 수 있다고 답해 보세요.'],
    ['Should we bring some snacks?', '간식을 좀 가져갈까요?', '놀이 약속에 간식을 챙겨 갈지 물어보세요.'],
    ["I'll text you when we're on our way.", '출발할 때 문자드릴게요.', '출발하면 연락하겠다고 상대 부모에게 말해 보세요.', ['I will text you when we are on our way.', "I'll text you when we are on our way.", "I will text you when we're on our way."]],
  ]),
  scene('playdate_welcome', '집에 놀러 온 친구 맞이하기', 'tea', '아이 친구와 보호자가 집에 놀러 왔어요. 편하게 지낼 수 있게 맞아 줘요.', [
    ['Come on in!', '들어오세요!', '집에 도착한 친구와 보호자를 반갑게 맞아 주세요.'],
    ['You can leave your shoes here.', '신발은 여기에 벗어 두시면 돼요.', '방문한 사람에게 신발을 둘 곳을 알려 주세요.'],
    ['Would you like some water?', '물 좀 드릴까요?', '방문한 보호자에게 물을 권해 보세요.'],
    ['The bathroom is down the hall.', '화장실은 복도 안쪽에 있어요.', '집에 처음 온 손님에게 화장실 위치를 알려 주세요.'],
    ['Let me know if you need anything.', '필요한 거 있으면 말해 주세요.', '편하게 필요한 것을 말해 달라고 손님에게 전해 보세요.'],
  ]),
  scene('toy_conflict', '장난감 때문에 다툴 때', 'books', '아이들이 같은 장난감을 원해요. 마음을 알아주면서 말로 해결하도록 도와줘요.', [
    ['You both want the same toy.', '둘 다 같은 장난감을 갖고 싶구나.', '다투는 아이들에게 둘의 마음을 알아준다고 표현해 보세요.'],
    ["Let's use our words.", '말로 이야기해 보자.', '장난감을 잡아당기는 아이들에게 말로 이야기하자고 해 보세요.'],
    ['Ask him if you can have a turn.', '너도 한 번 써도 되는지 친구한테 물어봐.', '장난감을 쓰고 싶은 아이가 친구에게 직접 부탁하도록 도와주세요.', ['Ask her if you can have a turn.']],
    ['You can use it when she is done.', '친구가 다 쓰면 네가 쓰면 돼.', '아직 친구가 쓰는 중인 장난감을 언제 쓸 수 있는지 알려 주세요.', ['You can use it when he is done.', "You can use it when she's done.", "You can use it when he's done."]],
    ["I won't let you hit.", '때리게 둘 수는 없어.', '친구를 때리려는 아이에게 단호하고 차분하게 멈추라고 해 보세요.', ['I will not let you hit.']],
  ]),
  scene('big_feelings', '속상한 마음 달래 주기', 'flowers', '놀이가 마음대로 되지 않아 아이가 속상해해요. 감정을 받아 주고 함께 진정해요.', [
    ['You look really upset.', '많이 속상해 보이네.', '아이의 표정과 울음을 보고 마음을 알아주는 말을 해 주세요.'],
    ["It's okay to feel angry.", '화가 날 수도 있어.', '화가 난 마음 자체는 괜찮다고 알려 주세요.', ['It is okay to feel angry.']],
    ['Do you want a hug or some space?', '안아 줄까, 혼자 잠깐 있을래?', '아이에게 안아 주는 것과 잠깐 혼자 있는 것 중 무엇이 좋을지 물어보세요.'],
    ["Let's take a slow breath together.", '우리 같이 천천히 숨 쉬어 보자.', '진정할 수 있도록 함께 천천히 숨을 쉬자고 해 보세요.'],
    ["I'm here when you're ready to talk.", '말하고 싶어지면 엄마가 들어줄게.', '아이가 준비되면 이야기를 들어주겠다고 말해 주세요.', ['I am here when you are ready to talk.', "I'm here when you are ready to talk.", "I am here when you're ready to talk."]],
  ]),
  scene('tidying_up', '놀이 마치고 정리하기', 'books', '다음 활동으로 넘어가기 전에 아이와 함께 놀잇감을 정리해요.', [
    ['Five more minutes, then we clean up.', '5분만 더 놀고 정리하자.', '놀이를 마칠 시간을 미리 알려 주세요.'],
    ["Let's put the blocks in this bin.", '블록은 이 통에 넣자.', '블록을 이 통에 넣자고 아이에게 말해 보세요.'],
    ["I'll do the books. You do the cars.", '엄마는 책 정리할게. 너는 자동차 정리해 줘.', '엄마는 책을, 아이는 자동차를 정리하자고 말해 보세요.', ['I will do the books. You do the cars.']],
    ['Where does this piece go?', '이 조각은 어디에 넣으면 될까?', '남은 장난감 조각을 어디에 둘지 아이에게 물어보세요.'],
    ['We make a great team.', '우리 손발이 척척 맞네.', '함께 정리한 아이에게 좋은 팀이었다고 말해 주세요.'],
  ]),
  scene('meal_out', '아이와 식당에서 주문하기', 'tea', '아이와 식당에 왔어요. 직원에게 아이 식사에 필요한 것을 부탁해요.', [
    ["Do you have a kids' menu?", '어린이 메뉴가 있나요?', '식당 직원에게 아이용 메뉴가 있는지 물어보세요.'],
    ['Could we have a small plate, please?', '작은 접시 하나 주시겠어요?', '아이에게 음식을 덜어 줄 접시를 부탁해 보세요.'],
    ['Could you leave the sauce on the side?', '소스는 따로 주실 수 있나요?', '직원에게 소스를 음식에 붓지 말고 따로 달라고 부탁해 보세요.', ['Could you put the sauce on the side?', 'Could we have the sauce on the side?', 'Could we have the sauce on the side, please?']],
    ['Does this have any nuts in it?', '여기에 견과류가 들어가나요?', '메뉴의 견과류 포함 여부를 직원에게 확인해 보세요.'],
    ['Could we get a box for the leftovers?', '남은 음식을 담을 포장 용기를 주시겠어요?', '남은 음식을 가져갈 수 있도록 용기를 부탁해 보세요.'],
  ]),
  scene('shopping_together', '아이와 마트에서 장보기', 'flowers', '아이와 필요한 식료품을 고르며 함께 장을 봐요.', [
    ['Can you help me find the apples?', '사과 찾는 것 좀 도와줄래?', '마트에서 사과를 찾는 일을 도와달라고 아이에게 부탁해 보세요.'],
    ["Let's pick three bananas.", '바나나 세 개 고르자.', '아이와 함께 바나나를 세 개 고르자고 해 보세요.'],
    ['Please keep the eggs in the carton.', '달걀은 상자 안에 그대로 두자.', '달걀을 꺼내려는 아이에게 상자에 두라고 알려 주세요.'],
    ["We're only getting what's on our list.", '오늘은 목록에 있는 것만 살 거야.', '다른 간식을 고르는 아이에게 오늘의 장보기 약속을 알려 주세요.', ['We are only getting what is on our list.', "We're only getting what is on our list.", "We are only getting what's on our list."]],
    ['Would you like to carry the bread?', '빵은 네가 들고 갈래?', '아이에게 빵을 들고 가고 싶은지 물어보세요.'],
  ]),
  scene('road_safety', '길에서 안전하게 걷기', 'travel', '아이와 길을 걷거나 주차장을 지날 때 안전하게 이동하도록 알려 줘요.', [
    ['Hold my hand in the parking lot.', '주차장에서는 엄마 손을 잡아.', '차가 다니는 주차장에서 아이에게 손을 잡으라고 해 보세요.'],
    ['Stop at the curb.', '길 가장자리에서 멈춰.', '차도로 내려가기 전에 보도 끝에서 멈추라고 알려 주세요.'],
    ["Let's look both ways.", '양쪽을 살펴보자.', '길을 건너기 전에 양쪽에서 차가 오는지 함께 보자고 해 보세요.'],
    ['Wait for the walk signal.', '보행 신호가 켜질 때까지 기다려.', '횡단보도에서 건너도 되는 신호를 기다리라고 알려 주세요.'],
    ['Stay close to me.', '엄마 옆에 가까이 있어.', '사람이나 차가 많은 곳에서 곁에 있으라고 말해 보세요.'],
  ]),
  scene('bath_time', '목욕하고 씻기', 'tea', '목욕 시간에 아이에게 순서를 알려 주고 편안하게 씻도록 도와줘요.', [
    ["Let's check the water first.", '먼저 물 온도부터 확인하자.', '욕조에 들어가기 전에 물이 적당한지 확인하자고 해 보세요.'],
    ['Does the water feel okay?', '물 온도 괜찮아?', '물에 들어간 아이에게 온도가 괜찮은지 물어보세요.'],
    ['Tilt your head back.', '고개를 뒤로 젖혀 봐.', '머리를 헹구기 전에 고개를 뒤로 젖히라고 해 보세요.'],
    ["I'll keep the water out of your eyes.", '눈에 물 안 들어가게 해 줄게.', '머리 감기를 걱정하는 아이를 안심시켜 주세요.', ['I will keep the water out of your eyes.']],
    ["Let's wrap you up in your towel.", '수건으로 몸을 감싸자.', '목욕을 마친 아이를 수건으로 감싸 주며 말해 보세요.'],
  ]),
  scene('bedtime', '책 읽고 잠자리 들기', 'books', '자기 전 책을 고르고 하루를 돌아본 뒤 아이에게 잘 자라고 인사해요.', [
    ['Pick one book for tonight.', '오늘 밤에 읽을 책 한 권 골라 봐.', '잠들기 전 함께 읽을 책을 아이가 고르게 해 주세요.'],
    ['Do you want to turn the page?', '네가 책장 넘겨 볼래?', '책을 읽다가 아이에게 다음 장을 넘길지 물어보세요.'],
    ['What was your favorite part of today?', '오늘 뭐가 제일 좋았어?', '잠자리에서 오늘 가장 좋았던 일을 물어보세요.'],
    ["It's time to turn out the light.", '이제 불 끌 시간이야.', '책 읽기를 마친 뒤 불을 끌 시간이라고 알려 주세요.', ['It is time to turn out the light.', "It's time to turn off the light.", 'It is time to turn off the light.']],
    ["I love you. Sleep tight.", '사랑해. 푹 잘 자.', '잠들기 전 아이에게 사랑한다고 말하고 인사해 주세요.'],
  ]),
  scene('doctor_allergy', '병원에서 증상과 알레르기 설명하기', 'flowers', '땅콩 알레르기가 있는 아이가 열이 나서 병원에 왔다는 상황을 연습해요. 예문 속 증상과 알레르기는 연습용 정보예요.', [
    ["He's had a fever since last night.", '어젯밤부터 아이가 열이 나요.', '의사에게 아이의 열이 언제부터 시작됐는지 말해 보세요.', ['He has had a fever since last night.']],
    ["He hasn't been eating much.", '아이가 잘 먹지 못하고 있어요.', '아이가 평소보다 적게 먹고 있다고 의사에게 전해 보세요.', ['He has not been eating much.']],
    ["He's allergic to peanuts.", '아이는 땅콩 알레르기가 있어요.', '진료 전에 아이의 땅콩 알레르기를 알려 주세요.', ['He is allergic to peanuts.']],
    ['How much should I give him?', '아이에게 얼마나 먹이면 될까요?', '처방받은 약을 한 번에 얼마나 먹일지 확인해 보세요.'],
    ['When should I bring him back?', '어떤 때 다시 데려와야 하나요?', '어떤 경우에 재진이 필요한지 의사에게 물어보세요.', ['When should I bring him in again?']],
  ]),
];

// Retained catalog for existing records and reviews; not a replacement study list.
export const englishReviewScenarios = [...englishScenarios, ...legacyEnglishScenarios];
