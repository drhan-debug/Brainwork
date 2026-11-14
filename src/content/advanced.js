// Original practical dialogues. Japanese includes an explicit complete reading.
const definitions=[
 ['phone_booking','전화로 예약하기','tea',[
  ['I would like to book a table for tomorrow evening.','Quisiera reservar una mesa para mañana por la noche.','Vorrei prenotare un tavolo per domani sera.','明日の夜に席を予約したいです。','あしたのよるにせきをよやくしたいです。','내일 저녁에 자리를 예약하고 싶어요.'],
  ['Would seven thirty be possible?','¿Sería posible a las siete y media?','Sarebbe possibile alle sette e mezza?','七時半でも大丈夫ですか。','しちじはんでもだいじょうぶですか。','일곱 시 반도 가능할까요?'],
  ['There will be four of us, including one child.','Seremos cuatro, incluido un niño.','Saremo in quattro, compreso un bambino.','子ども一人を含めて四人です。','こどもひとりをふくめてよにんです。','아이 한 명을 포함해 네 명이에요.'],
  ['Could you confirm the reservation by email?','¿Podría confirmar la reserva por correo electrónico?','Potrebbe confermare la prenotazione via email?','予約の確認をメールで送ってもらえますか。','よやくのかくにんをメールでおくってもらえますか。','예약 확인을 이메일로 보내 주실 수 있나요?']]],
 ['lost_property','잃어버린 물건 찾기','luggage',[
  ['I think I left my bag on the train.','Creo que dejé mi bolso en el tren.','Credo di aver lasciato la borsa sul treno.','電車にかばんを忘れたと思います。','でんしゃにかばんをわすれたとおもいます。','기차에 가방을 두고 내린 것 같아요.'],
  ['It is a small black bag with a red handle.','Es un bolso negro pequeño con un asa roja.','È una piccola borsa nera con un manico rosso.','赤い持ち手のついた小さな黒いかばんです。','あかいもちてのついたちいさなくろいかばんです。','빨간 손잡이가 달린 작은 검은 가방이에요.'],
  ['I last saw it about an hour ago.','Lo vi por última vez hace una hora.','L’ho vista l’ultima volta circa un’ora fa.','最後に見たのは一時間くらい前です。','さいごにみたのはいちじかんくらいまえです。','마지막으로 본 건 한 시간쯤 전이에요.'],
  ['Please contact me if someone finds it.','Por favor, avíseme si alguien lo encuentra.','Mi contatti se qualcuno la trova, per favore.','見つかったら連絡してください。','みつかったられんらくしてください。','찾으면 연락해 주세요.']]],
 ['food_allergy','음식 알레르기 설명하기','tea',[
  ['I am allergic to peanuts.','Soy alérgico a los cacahuetes.','Sono allergico alle arachidi.','ピーナッツのアレルギーがあります。','ピーナッツのアレルギーがあります。','땅콩 알레르기가 있어요.'],
  ['Does the sauce contain any nuts?','¿La salsa lleva frutos secos?','La salsa contiene frutta a guscio?','このソースにナッツは入っていますか。','このソースにナッツははいっていますか。','이 소스에 견과류가 들어 있나요?'],
  ['Could you prepare it without butter?','¿Podría prepararlo sin mantequilla?','Potrebbe prepararlo senza burro?','バターを使わずに作ってもらえますか。','バターをつかわずにつくってもらえますか。','버터 없이 만들어 주실 수 있나요?'],
  ['Please check with the kitchen before I order.','Por favor, consulte con la cocina antes de que pida.','Per favore, chieda in cucina prima che ordini.','注文する前に厨房に確認してください。','ちゅうもんするまえにちゅうぼうにかくにんしてください。','주문하기 전에 주방에 확인해 주세요.']]],
 ['home_repair','집 수리 요청하기','books',[
  ['The hot water has not worked since yesterday.','El agua caliente no funciona desde ayer.','L’acqua calda non funziona da ieri.','昨日からお湯が出ません。','きのうからおゆがでません。','어제부터 온수가 안 나와요.'],
  ['Could someone come and take a look?','¿Podría venir alguien a revisarlo?','Potrebbe venire qualcuno a controllare?','誰か見に来てもらえますか。','だれかみにきてもらえますか。','누가 와서 봐 주실 수 있나요?'],
  ['I will be home after six tomorrow.','Mañana estaré en casa después de las seis.','Domani sarò a casa dopo le sei.','明日は六時以降なら家にいます。','あしたはろくじいこうならいえにいます。','내일은 여섯 시 이후에 집에 있어요.'],
  ['Please let me know the cost before starting.','Dígame cuánto cuesta antes de empezar, por favor.','Mi dica il costo prima di iniziare, per favore.','修理を始める前に料金を教えてください。','しゅうりをはじめるまえにりょうきんをおしえてください。','수리 시작 전에 비용을 알려 주세요.']]],
 ['bank_visit','은행에서 문의하기','books',[
  ['I would like to open a bank account.','Quisiera abrir una cuenta bancaria.','Vorrei aprire un conto bancario.','銀行口座を開きたいです。','ぎんこうこうざをひらきたいです。','은행 계좌를 개설하고 싶어요.'],
  ['Which documents do I need to bring?','¿Qué documentos tengo que traer?','Quali documenti devo portare?','どの書類を持ってくればいいですか。','どのしょるいをもってくればいいですか。','어떤 서류를 가져와야 하나요?'],
  ['Is there a monthly fee for this account?','¿Esta cuenta tiene una comisión mensual?','Questo conto ha un canone mensile?','この口座には毎月手数料がかかりますか。','このこうざにはまいつきてすうりょうがかかりますか。','이 계좌에 월 수수료가 있나요?'],
  ['Could you explain how to make a transfer?','¿Podría explicarme cómo hacer una transferencia?','Potrebbe spiegarmi come fare un bonifico?','振り込みの方法を説明してもらえますか。','ふりこみのほうほうをせつめいしてもらえますか。','송금하는 방법을 설명해 주실 수 있나요?']]],
 ['post_office','우체국에서 소포 보내기','luggage',[
  ['I would like to send this package to Korea.','Quisiera enviar este paquete a Corea.','Vorrei spedire questo pacco in Corea.','この荷物を韓国に送りたいです。','このにもつをかんこくにおくりたいです。','이 소포를 한국에 보내고 싶어요.'],
  ['How long does standard delivery usually take?','¿Cuánto suele tardar el envío estándar?','Quanto tempo richiede di solito la spedizione standard?','普通の配送だとどのくらいかかりますか。','ふつうのはいそうだとどのくらいかかりますか。','일반 배송은 보통 얼마나 걸리나요?'],
  ['Is tracking included in the price?','¿El seguimiento está incluido en el precio?','Il tracciamento è incluso nel prezzo?','この料金に追跡サービスは含まれていますか。','このりょうきんについせきサービスはふくまれていますか。','가격에 배송 추적이 포함되어 있나요?'],
  ['Please tell me where to fill in the address.','Dígame dónde escribir la dirección, por favor.','Mi dica dove scrivere l’indirizzo, per favore.','住所をどこに書けばいいか教えてください。','じゅうしょをどこにかけばいいかおしえてください。','주소를 어디에 쓰면 되는지 알려 주세요.']]],
 ['travel_disruption','여행 일정 문제 해결하기','airport',[
  ['My flight was canceled this morning.','Mi vuelo fue cancelado esta mañana.','Il mio volo è stato cancellato questa mattina.','今朝の便が欠航になりました。','けさのびんがけっこうになりました。','오늘 아침 제 항공편이 취소됐어요.'],
  ['Is there another flight available today?','¿Hay otro vuelo disponible hoy?','C’è un altro volo disponibile oggi?','今日乗れる別の便はありますか。','きょうのれるべつのびんはありますか。','오늘 탈 수 있는 다른 항공편이 있나요?'],
  ['I need to arrive before tomorrow afternoon.','Necesito llegar antes de mañana por la tarde.','Devo arrivare prima di domani pomeriggio.','明日の午後までに到着する必要があります。','あしたのごごまでにとうちゃくするひつようがあります。','내일 오후까지 도착해야 해요.'],
  ['Could I get a refund instead of changing the ticket?','¿Podría obtener un reembolso en vez de cambiar el billete?','Potrei avere un rimborso invece di cambiare il biglietto?','変更する代わりに払い戻しはできますか。','へんこうするかわりにはらいもどしはできますか。','표 변경 대신 환불받을 수 있나요?']]],
 ['work_problem','업무 문제와 해결책 말하기','books',[
  ['I may need more time to finish the report.','Puede que necesite más tiempo para terminar el informe.','Potrei aver bisogno di più tempo per finire la relazione.','報告書を仕上げるのにもう少し時間が必要です。','ほうこくしょをしあげるのにもうすこしじかんがひつようです。','보고서 완성에 시간이 더 필요할 것 같아요.'],
  ['The data we received is incomplete.','Los datos que recibimos están incompletos.','I dati che abbiamo ricevuto sono incompleti.','受け取ったデータが不足しています。','うけとったデータがふそくしています。','받은 데이터가 불완전해요.'],
  ['Could we move the deadline to Friday?','¿Podríamos aplazar la fecha límite al viernes?','Potremmo spostare la scadenza a venerdì?','締め切りを金曜日に延ばせますか。','しめきりをきんようびにのばせますか。','마감일을 금요일로 미룰 수 있을까요?'],
  ['I will send an update as soon as I hear back.','Enviaré una actualización en cuanto reciba una respuesta.','Invierò un aggiornamento appena riceverò una risposta.','返事が来たらすぐに状況をお知らせします。','へんじがきたらすぐにじょうきょうをおしらせします。','답을 받는 대로 상황을 알려 드릴게요.']]],
 ['invitation_change','약속 변경하고 대안 제안하기','flowers',[
  ['I am sorry, but I cannot make it on Saturday.','Lo siento, pero no puedo ir el sábado.','Mi dispiace, ma sabato non posso venire.','すみませんが、土曜日は都合が悪くなりました。','すみませんが、どようびはつごうがわるくなりました。','미안하지만 토요일에는 갈 수 없어요.'],
  ['Something unexpected came up at work.','Me ha surgido un imprevisto en el trabajo.','È sorto un imprevisto al lavoro.','仕事で急な予定が入りました。','しごとできゅうなよていがはいりました。','직장에 예상치 못한 일이 생겼어요.'],
  ['Would Sunday afternoon work for you instead?','¿Te vendría bien el domingo por la tarde?','Ti andrebbe bene domenica pomeriggio invece?','代わりに日曜日の午後はいかがですか。','かわりににちようびのごごはいかがですか。','대신 일요일 오후는 어떠세요?'],
  ['Thank you for being flexible about the time.','Gracias por tu flexibilidad con el horario.','Grazie per la tua flessibilità sull’orario.','時間を調整してくれてありがとうございます。','じかんをちょうせいしてくれてありがとうございます。','시간을 조정해 줘서 고마워요.']]],
 ['sharing_opinions','의견과 이유 나누기','forest',[
  ['I think public transport is the better option.','Creo que el transporte público es la mejor opción.','Penso che i mezzi pubblici siano l’opzione migliore.','公共交通機関を使うほうがいいと思います。','こうきょうこうつうきかんをつかうほうがいいとおもいます。','대중교통이 더 나은 선택이라고 생각해요.'],
  ['It is cheaper, and we would not need to park.','Es más barato y no tendríamos que aparcar.','Costa meno e non dovremmo parcheggiare.','安いですし、駐車する必要もありません。','やすいですし、ちゅうしゃするひつようもありません。','더 저렴하고 주차할 필요도 없어요.'],
  ['I see your point, but it might take longer.','Entiendo tu punto de vista, pero podría tardar más.','Capisco il tuo punto di vista, ma potrebbe volerci più tempo.','言いたいことはわかりますが、時間がかかるかもしれません。','いいたいことはわかりますが、じかんがかかるかもしれません。','무슨 말인지 알지만 시간이 더 걸릴 수도 있어요.'],
  ['Let us compare both options before deciding.','Comparemos las dos opciones antes de decidir.','Confrontiamo entrambe le opzioni prima di decidere.','決める前に両方を比べてみましょう。','きめるまえにりょうほうをくらべてみましょう。','결정하기 전에 두 선택지를 비교해 봐요.']]],
];
const cueLabels={
 phone_booking:['전화 예약 요청','희망 시간 확인','동행 인원 설명','예약 확인 방식'],
 lost_property:['분실 장소 설명','물건 외형 설명','마지막 확인 시점','연락 요청'],
 food_allergy:['알레르기 설명','소스 재료 확인','재료 제외 요청','주방 확인 요청'],
 home_repair:['고장 증상과 시점','방문 점검 요청','방문 가능한 시간','견적 먼저 요청'],
 bank_visit:['계좌 개설 요청','필요 서류 확인','월 수수료 확인','송금 방법 질문'],
 post_office:['국제 소포 발송','일반 배송 기간','배송 추적 확인','주소 작성 위치'],
 travel_disruption:['항공편 취소 설명','대체 항공편 문의','도착 시한 설명','환불 대안 요청'],
 work_problem:['추가 시간 요청','데이터 문제 설명','마감일 조정','후속 상황 공유'],
 invitation_change:['약속 참석 불가','예상 밖 업무','대체 일정 제안','조정에 감사'],
 sharing_opinions:['이동 방법 의견','비용과 편의의 이유','다른 관점 제시','비교 후 결정 제안'],
};
export function advancedScenarios(lang){const column={en:0,es:1,it:2,ja:3}[lang];return definitions.map(([id,titleKo,image,rows])=>({id,titleKo,image:`/images/${image}.svg`,sentences:rows.map((row,index)=>({id:`${lang}:${id}:${index+1}`,text:row[column],audioText:row[column],meaningKo:row[5],cueKo:cueLabels[id][index],...(lang==='ja'?{kana:row[4],ruby:row[3]===row[4]?[row[3]]:[[row[3],row[4]]],fullReading:true}:{})}))}));}
