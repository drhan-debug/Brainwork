import { fail } from './domain.js';

const encoder = new TextEncoder();
const singleWord = /^[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*$/u;
const text = (value, max) => {
  if (typeof value !== 'string') return '';
  if (/[<>\p{Cc}]/u.test(value)) return '';
  const clean=value.trim().replace(/\s+/gu,' ');
  if (!clean) return '';
  return Array.from(clean).slice(0,max).join('');
};
export function lookupWordInput(value) {
  if(typeof value!=='string'||Array.from(value).length>80||encoder.encode(value).length>200||!singleWord.test(value))fail('INVALID_LOOKUP_WORD','Enter one word of up to 80 characters.');
  return value;
}
async function boundedJson(url,fetcher) {
  let response;
  try { response=await fetcher(url,{signal:AbortSignal.timeout(5000),headers:{Accept:'application/json'},redirect:'manual'}); }
  catch { fail('LOOKUP_UNAVAILABLE','Word lookup is temporarily unavailable.',503); }
  if(response.status===404)fail('LOOKUP_NOT_FOUND','No reliable word meaning or hint was found.',404);
  if(!response.ok)fail('LOOKUP_UNAVAILABLE','Word lookup is temporarily unavailable.',503);
  if(Number(response.headers.get('content-length'))>131072)fail('LOOKUP_UNAVAILABLE','Word lookup response is too large.',503);
  const reader=response.body?.getReader();
  if(!reader)fail('LOOKUP_UNAVAILABLE','Word lookup is temporarily unavailable.',503);
  const chunks=[];let length=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>131072){await reader.cancel();fail('LOOKUP_UNAVAILABLE','Word lookup response is too large.',503);}chunks.push(value);}
  } catch(error) { if(error.code)throw error;fail('LOOKUP_UNAVAILABLE','Word lookup is temporarily unavailable.',503); }
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
  catch{fail('LOOKUP_UNAVAILABLE','Word lookup is temporarily unavailable.',503);}
}
export async function lookupCard(front, language, fetcher=fetch) {
  const word=lookupWordInput(front);
  if(!['en','ja'].includes(language))fail('INVALID_LANGUAGE','Choose English or Japanese.');
  const encoded=encodeURIComponent(word);
  const meaningUrl=`https://api.mymemory.translated.net/get?q=${encoded}&langpair=${language}%7Cko`;
  const hintUrl=language==='en'?`https://api.dictionaryapi.dev/api/v2/entries/en/${encoded}`:`https://jisho.org/api/v1/search/words?keyword=${encoded}`;
  const [meaning,hintData]=await Promise.all([boundedJson(meaningUrl,fetcher),boundedJson(hintUrl,fetcher)]);
  const rawBack=meaning?.responseData?.translatedText;
  const back=text(rawBack,360);
  if(meaning?.responseStatus!==200||meaning?.quotaFinished===true||typeof rawBack!=='string'||Array.from(rawBack).length>360||!/[\uac00-\ud7a3]/u.test(back)||back.toLocaleLowerCase()===word.toLocaleLowerCase())fail('LOOKUP_NOT_FOUND','No reliable Korean meaning was found.',404);
  let hint='';
  if(language==='en'){
    const entry=Array.isArray(hintData)?hintData.find(item=>typeof item?.word==='string'&&item.word.toLocaleLowerCase()===word.toLocaleLowerCase()):null;
    const meanings=Array.isArray(entry?.meanings)?entry.meanings:[];
    for(const meaning of meanings){
      const definitions=Array.isArray(meaning?.definitions)?meaning.definitions:[];
      const definition=definitions.find(item=>typeof item?.definition==='string');
      if(definition){hint=text(definition.definition,240);if(hint)break;}
    }
  }else{
    const entries=Array.isArray(hintData?.data)?hintData.data:[];
    const entry=entries.find(item=>Array.isArray(item?.japanese)&&item.japanese.some(form=>form?.word===word||form?.reading===word));
    const senses=Array.isArray(entry?.senses)?entry.senses:[];
    const gloss=senses.find(s=>Array.isArray(s?.english_definitions)&&s.english_definitions.length)?.english_definitions;
    hint=text(gloss?.join(', '),220);
    if(hint)hint=`${hint} (JMdict)`;
  }
  if(!hint)fail('LOOKUP_NOT_FOUND','No reliable review hint was found.',404);
  return {back,hint,source:language==='en'?'mymemory+dictionaryapi':'mymemory+jisho'};
}
