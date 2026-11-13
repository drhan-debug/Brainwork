// Original beginner practice: four useful learner turns in each everyday scene.
const scene = (id, titleKo, image, rows) => ({
  id,
  titleKo,
  image: `/images/${image}.svg`,
  sentences: rows.map(([text, meaningKo, cueKo, accepted], index) => ({
    id: `en:${id}:${index + 1}`,
    text,
    meaningKo,
    cueKo,
    audioText: text,
    ...(accepted ? { accepted } : {}),
  })),
});

export const englishScenarios = [
  scene('cafe_order', '카페에서 주문하기', 'coffee', [
    ['Can I have a small latte?', '작은 라테 한 잔 주세요.', '손님 · 음료 주문'],
    ['I would like oat milk, please.', '오트 밀크로 주세요.', '손님 · 우유 선택'],
    ['Can I get it to go?', '포장해 주실 수 있나요?', '손님 · 포장 요청'],
    ['How much is it?', '얼마인가요?', '손님 · 가격 확인'],
  ]),
  scene('restaurant_order', '식당에서 식사하기', 'tea', [
    ['A table for two, please.', '두 명 앉을 자리 부탁해요.', '손님 · 인원 말하기'],
    ['Does this dish have meat?', '이 음식에 고기가 들어가나요?', '손님 · 재료 확인'],
    ['I would like the chicken soup.', '치킨 수프를 먹고 싶어요.', '손님 · 메뉴 선택'],
    ['Can we have the bill, please?', '계산서 주시겠어요?', '손님 · 식사 후 계산'],
  ]),
  scene('grocery_store', '마트에서 장보기', 'flowers', [
    ['Where can I find the eggs?', '달걀은 어디에 있나요?', '손님 · 진열 위치'],
    ['How much are these apples?', '이 사과들은 얼마인가요?', '손님 · 과일 가격'],
    ['I only need one bag.', '봉투는 하나만 필요해요.', '손님 · 봉투 수량'],
    ['Can I pay by card?', '카드로 결제할 수 있나요?', '손님 · 결제 방법'],
  ]),
  scene('convenience_store', '편의점 이용하기', 'tea', [
    ['Do you sell phone chargers?', '휴대폰 충전기를 파나요?', '손님 · 상품 문의'],
    ['Can you heat this up, please?', '이것을 데워 주시겠어요?', '손님 · 도시락 데우기'],
    ['I do not need a bag.', '봉투는 필요 없어요.', '손님 · 봉투 사양'],
    ['Can I have a receipt, please?', '영수증 주시겠어요?', '손님 · 영수증 요청'],
  ]),
  scene('bakery', '빵집에서 고르기', 'coffee', [
    ['Are these rolls fresh?', '이 롤빵들은 갓 만든 건가요?', '손님 · 빵 상태 확인'],
    ['Does this bread have nuts?', '이 빵에 견과류가 들어가나요?', '손님 · 재료 문의'],
    ['Two of these, please.', '이것 두 개 주세요.', '손님 · 수량 주문'],
    ['Can you slice the bread?', '빵을 잘라 주실 수 있나요?', '손님 · 식빵 손질'],
  ]),
  scene('pharmacy', '약국에서 문의하기', 'flowers', [
    ['I have a sore throat.', '목이 아파요.', '손님 · 증상 설명'],
    ['Do you have something for a cough?', '기침에 먹을 약이 있나요?', '손님 · 약 문의'],
    ['How often should I take it?', '얼마나 자주 먹어야 하나요?', '손님 · 복용 간격'],
    ['Should I take it with food?', '음식과 함께 먹어야 하나요?', '손님 · 복용 방법'],
  ]),
  scene('doctor_visit', '병원에서 진료받기', 'forest', [
    ['I have an appointment at ten.', '열 시에 예약했어요.', '환자 · 접수'],
    ['My stomach hurts.', '배가 아파요.', '환자 · 아픈 곳 설명'],
    ['It started yesterday.', '어제부터 그랬어요.', '환자 · 시작 시점'],
    ['Could you explain that again?', '다시 설명해 주시겠어요?', '환자 · 설명 재요청'],
  ]),
  scene('directions', '길 물어보기', 'travel', [
    ['Excuse me, where is the library?', '실례하지만 도서관이 어디에 있나요?', '행인 · 목적지 질문'],
    ['Is it far from here?', '여기서 먼가요?', '행인 · 거리 확인'],
    ['Can I walk there?', '걸어서 갈 수 있나요?', '행인 · 이동 방법'],
    ['Should I turn left here?', '여기서 왼쪽으로 돌아야 하나요?', '행인 · 방향 확인'],
  ]),
  scene('train_station', '기차역에서 이동하기', 'travel', [
    ['One ticket to Oxford, please.', '옥스퍼드행 표 한 장 주세요.', '승객 · 표 구매'],
    ['What time is the next train?', '다음 기차는 몇 시인가요?', '승객 · 출발 시간'],
    ['Which platform do I need?', '어느 승강장으로 가야 하나요?', '승객 · 승강장 확인'],
    ['Do I need to change trains?', '기차를 갈아타야 하나요?', '승객 · 환승 확인'],
  ]),
  scene('airport_checkin', '공항에서 체크인하기', 'airport', [
    ['I would like to check in.', '체크인하고 싶어요.', '승객 · 수속 시작'],
    ['Here is my passport.', '여기 제 여권입니다.', '승객 · 여권 제시'],
    ['I have one bag to check.', '부칠 가방이 하나 있어요.', '승객 · 수하물 수량'],
    ['Can I have a window seat?', '창가 자리로 주실 수 있나요?', '승객 · 좌석 요청'],
  ]),
  scene('hotel_checkin', '호텔에 체크인하기', 'luggage', [
    ['I have a reservation under Kim.', '김이라는 이름으로 예약했어요.', '투숙객 · 예약 확인'],
    ['What time is breakfast?', '아침 식사는 몇 시인가요?', '투숙객 · 식사 시간'],
    ['What is the Wi-Fi password?', '와이파이 비밀번호가 무엇인가요?', '투숙객 · 인터넷 연결'],
    ['Can I check out at noon?', '정오에 체크아웃할 수 있나요?', '투숙객 · 퇴실 시간'],
  ]),
  scene('taxi_ride', '택시 타기', 'travel', [
    ['Please take me to this address.', '이 주소로 가 주세요.', '승객 · 목적지 전달'],
    ['How long will it take?', '얼마나 걸릴까요?', '승객 · 소요 시간'],
    ['Please stop near the entrance.', '입구 근처에 세워 주세요.', '승객 · 하차 위치'],
    ['Can I pay in cash?', '현금으로 내도 되나요?', '승객 · 요금 결제'],
  ]),
  scene('shopping_size', '옷 가게에서 사이즈 찾기', 'luggage', [
    ['Do you have this in medium?', '이 옷 미디엄 사이즈가 있나요?', '손님 · 사이즈 문의'],
    ['Can I try it on?', '입어 봐도 되나요?', '손님 · 착용 요청'],
    ['This is a little too small.', '이건 조금 작아요.', '손님 · 착용감 설명'],
    ['Do you have it in blue?', '이 옷 파란색도 있나요?', '손님 · 색상 문의'],
  ]),
  scene('return_exchange', '반품하고 교환하기', 'luggage', [
    ['I would like to return this shirt.', '이 셔츠를 반품하고 싶어요.', '손님 · 반품 요청'],
    ['I bought it yesterday.', '어제 샀어요.', '손님 · 구매 시점'],
    ['Here is the receipt.', '여기 영수증입니다.', '손님 · 구매 증빙'],
    ['Can I exchange it for a larger size?', '더 큰 사이즈로 교환할 수 있나요?', '손님 · 교환 요청'],
  ]),
  scene('meeting_intro', '처음 만나 인사하기', 'books', [
    ['Hi, my name is Mina.', '안녕하세요, 제 이름은 미나예요.', '첫 만남 · 자기소개'],
    ['Nice to meet you, too.', '저도 만나서 반가워요.', '상대의 첫인사 · 답하기'],
    ['I work at a small company.', '저는 작은 회사에서 일해요.', '첫 만남 · 직장 소개'],
    ['What kind of work do you do?', '어떤 일을 하세요?', '첫 만남 · 직업 질문'],
  ]),
  scene('hobbies', '취미 이야기하기', 'books', [
    ['What do you do for fun?', '여가 시간에 무엇을 하세요?', '대화 · 취미 질문'],
    ['I like taking photos.', '저는 사진 찍는 것을 좋아해요.', '대화 · 내 취미'],
    ['I usually read on weekends.', '주말에는 보통 책을 읽어요.', '대화 · 평소 활동'],
    ['Would you like to join me?', '저와 함께하실래요?', '대화 · 함께하기 제안'],
  ]),
  scene('family_plans', '가족과 계획 세우기', 'flowers', [
    ['Are you free on Sunday?', '일요일에 시간 있어요?', '가족 · 일정 확인'],
    ['Let us visit Grandma.', '할머니를 뵈러 가요.', '가족 · 방문 제안'],
    ['Can we leave after lunch?', '점심 먹고 출발할 수 있을까요?', '가족 · 출발 조율'],
    ['I will bring some fruit.', '제가 과일을 좀 가져갈게요.', '가족 · 준비할 것'],
  ]),
  scene('work_schedule', '직장에서 일정 맞추기', 'books', [
    ['What time is the meeting?', '회의는 몇 시인가요?', '동료 · 회의 시간'],
    ['I am free after two.', '저는 두 시 이후에 시간 있어요.', '동료 · 가능한 시간'],
    ['Can we meet tomorrow morning?', '내일 아침에 만날 수 있을까요?', '동료 · 일정 제안'],
    ['I will send you the details.', '자세한 내용은 보내 드릴게요.', '동료 · 후속 안내'],
  ]),
  scene('weather_plans', '날씨에 맞춰 계획하기', 'forest', [
    ['Will it rain this afternoon?', '오늘 오후에 비가 올까요?', '친구 · 날씨 확인'],
    ['Let us take an umbrella.', '우산을 가져가요.', '친구 · 준비 제안'],
    ['It is too cold for a picnic.', '소풍을 가기에는 너무 추워요.', '친구 · 날씨 판단'],
    ['How about going to a museum?', '박물관에 가는 건 어때요?', '친구 · 실내 활동 제안'],
  ]),
  scene('asking_help', '도움 요청하기', 'tea', [
    ['Could you help me, please?', '저를 도와주시겠어요?', '도움 · 정중한 요청'],
    ['I do not understand this word.', '이 단어를 이해하지 못하겠어요.', '도움 · 어려운 부분'],
    ['Could you speak more slowly?', '조금 더 천천히 말씀해 주시겠어요?', '도움 · 말하는 속도'],
    ['Could you write it down?', '그것을 적어 주시겠어요?', '도움 · 글로 요청'],
  ]),
];
