import {englishScenarios} from './scenarios.en.js';
import {advancedScenarios} from './advanced.js';
// Each row follows the stable first twenty scenario IDs; four learner turns.
const spanish=[
 ['¿Me pone un café con leche pequeño?','Quisiera leche de avena, por favor.','¿Puede ser para llevar?','¿Cuánto cuesta?'],
 ['Una mesa para dos, por favor.','¿Este plato lleva carne?','Quisiera la sopa de pollo.','¿Nos trae la cuenta, por favor?'],
 ['¿Dónde están los huevos?','¿Cuánto cuestan estas manzanas?','Solo necesito una bolsa.','¿Puedo pagar con tarjeta?'],
 ['¿Venden cargadores de móvil?','¿Puede calentar esto, por favor?','No necesito una bolsa.','¿Me da un recibo, por favor?'],
 ['¿Estos panecillos están recién hechos?','¿Este pan lleva frutos secos?','Dos de estos, por favor.','¿Puede cortar el pan en rebanadas?'],
 ['Me duele la garganta.','¿Tiene algo para la tos?','¿Con qué frecuencia debo tomarlo?','¿Debo tomarlo con comida?'],
 ['Tengo una cita a las diez.','Me duele el estómago.','Empezó ayer.','¿Podría explicarlo otra vez?'],
 ['Disculpe, ¿dónde está la biblioteca?','¿Está lejos de aquí?','¿Puedo ir andando?','¿Debo girar a la izquierda aquí?'],
 ['Un billete a Oxford, por favor.','¿A qué hora sale el próximo tren?','¿A qué andén tengo que ir?','¿Tengo que cambiar de tren?'],
 ['Quisiera facturar.','Aquí tiene mi pasaporte.','Tengo una maleta para facturar.','¿Me puede dar un asiento de ventanilla?'],
 ['Tengo una reserva a nombre de Kim.','¿A qué hora es el desayuno?','¿Cuál es la contraseña del wifi?','¿Puedo dejar la habitación al mediodía?'],
 ['Lléveme a esta dirección, por favor.','¿Cuánto tiempo tardaremos?','Pare cerca de la entrada, por favor.','¿Puedo pagar en efectivo?'],
 ['¿Tiene esto en talla mediana?','¿Me lo puedo probar?','Esto me queda un poco pequeño.','¿Lo tiene en azul?'],
 ['Quisiera devolver esta camisa.','La compré ayer.','Aquí está el recibo.','¿Puedo cambiarla por una talla más grande?'],
 ['Hola, me llamo Mina.','Igualmente, mucho gusto.','Trabajo en una empresa pequeña.','¿A qué te dedicas?'],
 ['¿Qué haces en tu tiempo libre?','Me gusta hacer fotos.','Suelo leer los fines de semana.','¿Te gustaría acompañarme?'],
 ['¿Tienes tiempo el domingo?','Vamos a visitar a la abuela.','¿Podemos salir después de comer?','Llevaré algo de fruta.'],
 ['¿A qué hora es la reunión?','Tengo tiempo después de las dos.','¿Podemos vernos mañana por la mañana?','Te enviaré los detalles.'],
 ['¿Lloverá esta tarde?','Llevemos un paraguas.','Hace demasiado frío para un pícnic.','¿Qué tal si vamos a un museo?'],
 ['¿Podría ayudarme, por favor?','No entiendo esta palabra.','¿Podría hablar más despacio?','¿Podría escribirlo?'],
];
const italian=[
 ['Posso avere un caffellatte piccolo?','Vorrei latte d’avena, per favore.','Posso averlo da portare via?','Quanto costa?'],
 ['Un tavolo per due, per favore.','Questo piatto contiene carne?','Vorrei la zuppa di pollo.','Possiamo avere il conto, per favore?'],
 ['Dove posso trovare le uova?','Quanto costano queste mele?','Mi serve solo un sacchetto.','Posso pagare con la carta?'],
 ['Vendete caricabatterie per cellulari?','Può scaldare questo, per favore?','Non mi serve un sacchetto.','Posso avere una ricevuta, per favore?'],
 ['Questi panini sono freschi?','Questo pane contiene frutta a guscio?','Due di questi, per favore.','Può tagliare il pane a fette?'],
 ['Ho mal di gola.','Ha qualcosa per la tosse?','Ogni quanto devo prenderlo?','Devo prenderlo con del cibo?'],
 ['Ho un appuntamento alle dieci.','Mi fa male lo stomaco.','È iniziato ieri.','Potrebbe spiegarlo di nuovo?'],
 ['Mi scusi, dov’è la biblioteca?','È lontana da qui?','Posso andarci a piedi?','Devo girare a sinistra qui?'],
 ['Un biglietto per Oxford, per favore.','A che ora parte il prossimo treno?','A quale binario devo andare?','Devo cambiare treno?'],
 ['Vorrei fare il check-in.','Ecco il mio passaporto.','Ho una valigia da imbarcare.','Posso avere un posto vicino al finestrino?'],
 ['Ho una prenotazione a nome Kim.','A che ora è la colazione?','Qual è la password del Wi-Fi?','Posso lasciare la camera a mezzogiorno?'],
 ['Mi porti a questo indirizzo, per favore.','Quanto tempo ci vorrà?','Si fermi vicino all’ingresso, per favore.','Posso pagare in contanti?'],
 ['Avete questo in taglia media?','Posso provarlo?','Questo è un po’ troppo piccolo.','Lo avete in blu?'],
 ['Vorrei restituire questa camicia.','L’ho comprata ieri.','Ecco la ricevuta.','Posso cambiarla con una taglia più grande?'],
 ['Ciao, mi chiamo Mina.','Anche per me è un piacere conoscerti.','Lavoro in una piccola azienda.','Che lavoro fai?'],
 ['Che cosa fai nel tempo libero?','Mi piace fare fotografie.','Di solito leggo nei fine settimana.','Ti piacerebbe venire con me?'],
 ['Hai tempo domenica?','Andiamo a trovare la nonna.','Possiamo partire dopo pranzo?','Porterò della frutta.'],
 ['A che ora è la riunione?','Sono disponibile dopo le due.','Possiamo vederci domani mattina?','Ti invierò i dettagli.'],
 ['Pioverà questo pomeriggio?','Portiamo un ombrello.','Fa troppo freddo per un picnic.','Che ne dici di andare in un museo?'],
 ['Potrebbe aiutarmi, per favore?','Non capisco questa parola.','Potrebbe parlare più lentamente?','Potrebbe scriverlo?'],
];
function curriculum(lang,rows){return [...rows.map((phrases,index)=>{const original=englishScenarios[index];return {id:original.id,titleKo:original.titleKo,image:original.image,sentences:phrases.map((text,i)=>({id:`${lang}:${original.id}:${i+1}`,text,audioText:text,meaningKo:original.sentences[i].meaningKo,cueKo:original.sentences[i].cueKo}))};}),...advancedScenarios(lang)];}
export const spanishScenarios=curriculum('es',spanish);
export const italianScenarios=curriculum('it',italian);
