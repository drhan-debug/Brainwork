export const LANGUAGES = Object.freeze({en:{name:'영어',locale:'en-US'},ja:{name:'일본어',locale:'ja-JP'},es:{name:'스페인어',locale:'es-ES'},it:{name:'이탈리아어',locale:'it-IT'}});
export const LEVELS = Object.freeze([
 {id:1,title:'입문',description:'인사와 짧은 요청부터 시작해요.',ids:['meeting_intro','cafe_order','convenience_store','bakery','grocery_store','directions','shopping_size','taxi_ride','hobbies','weather_plans']},
 {id:2,title:'기초',description:'시간과 이유를 말하며 생활 속 대화를 이어가요.',ids:['restaurant_order','train_station','airport_checkin','hotel_checkin','family_plans','pharmacy','doctor_visit','work_schedule','return_exchange','asking_help']},
 {id:3,title:'응용',description:'조건을 설명하고 문제를 해결하며 의견을 나눠요.',ids:['phone_booking','lost_property','food_allergy','home_repair','bank_visit','post_office','travel_disruption','work_problem','invitation_change','sharing_opinions']},
]);
export const scenarioLevel=id=>LEVELS.find(level=>level.ids.includes(id));
export function isScenarioComplete(scenario,progress={}){return scenario.sentences.every(sentence=>progress[sentence.id]?.stage>0&&progress[sentence.id]?.lastOutcome==='passed');}
export function learningPath(scenarios,progress={}){
 const ordered=LEVELS.flatMap(level=>level.ids.map(id=>scenarios.find(scene=>scene.id===id)).filter(Boolean));
 const next=ordered.find(scene=>!isScenarioComplete(scene,progress));
 return {ordered,next,completed:ordered.filter(scene=>isScenarioComplete(scene,progress)).length,total:ordered.length};
}
