// Draft client adapter. No remote call until the agreed append protocol supplies a transport.
export const appendLogConfig=Object.freeze({enabled:false,endpoint:''});
export function eventFor(appId,previous,next,{restore=false,eventId=globalThis.crypto.randomUUID(),at=new Date().toISOString()}={}){
 const changed=next.records.filter(r=>JSON.stringify(r)!==JSON.stringify(previous.records.find(x=>x.id===r.id)));
 const removed=previous.records.filter(r=>!next.records.some(x=>x.id===r.id));
 return {format:1,appId,eventId,at,action:restore?'restore':changed.length?'record-change':removed.length?'record-remove':'settings-change',payload:{odometer:next.vehicle.odometer,changed:restore?[]:changed.map(r=>{const i=next.items.find(x=>x.id===r.itemId);return {id:r.id,item:i.name,kind:i.kind,date:r.date,km:r.km,note:r.note};}),removed:restore?[]:removed.map(r=>r.id)}};
}
export function enqueue(storage,key,event){const queue=JSON.parse(storage.getItem(key)||'[]');queue.push(event);storage.setItem(key,JSON.stringify(queue));return queue;}
export async function flush(storage,key,transport){if(typeof transport!=='function')return {state:'disconnected',label:'로그 수집 미연결 · 브라우저 원본 보존'};const queue=JSON.parse(storage.getItem(key)||'[]');for(const event of queue){let receipt;try{receipt=await transport(event);}catch{return {state:'failed',label:'로그 전송 실패 · 로컬 기록과 대기 로그 보존'};}if(receipt?.ok!==true||receipt.eventId!==event.eventId)return {state:'unverified',label:'로그 수신 확인 못함 · 서버 저장 완료 아님'};const remaining=JSON.parse(storage.getItem(key)||'[]').filter(x=>x.eventId!==event.eventId);storage.setItem(key,JSON.stringify(remaining));}return {state:'confirmed',label:'서버가 로그 수신을 확인했어요. 로컬 정비 기록은 이 브라우저에 보존됩니다.'};}
