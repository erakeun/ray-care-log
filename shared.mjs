// Client implementation for the documented common Apps Script bridge protocol.
export function connectLedger(config,{window=globalThis.window,document=globalThis.document}={}){
 const endpoint=new URL(config.endpoint);
 if(endpoint.protocol!=='https:'||endpoint.hostname!=='script.google.com'||!/^\/macros\/s\/[-a-zA-Z0-9]+\/exec$/.test(endpoint.pathname)||endpoint.search||endpoint.hash||endpoint.username||endpoint.password||endpoint.port||!['aveo','k3','ray'].includes(config.appId))throw Error('확인된 차량 appId와 Apps Script exec 주소가 필요합니다.');
 const channel=crypto.randomUUID(),requests=new Map(),waiting=new Set();let target=null,targetOrigin='',closed=false;
 const frame=document.createElement('iframe');frame.hidden=true;frame.title='차량 공유 장부';
 endpoint.searchParams.set('appId',config.appId);endpoint.searchParams.set('parentOrigin',window.location.origin);endpoint.searchParams.set('channel',channel);frame.src=endpoint.href;
 const onMessage=event=>{
  const packet=event.data;
  if(closed||!event.source||!/^https:\/\/(?:[a-z0-9-]+[-.])?script\.googleusercontent\.com$/.test(event.origin)||packet?.channel!==channel)return;
  if(packet.ready){if(!target){target=event.source;targetOrigin=event.origin;for(const complete of waiting)complete();waiting.clear();}return;}
  if(event.source!==target||event.origin!==targetOrigin)return;
  const pending=requests.get(packet.id);if(!pending)return;requests.delete(packet.id);clearTimeout(pending.timer);
  if(packet.error)pending.reject(Error(String(packet.error)));else pending.resolve(packet.result);
 };
 window.addEventListener('message',onMessage);document.body.append(frame);
 const waitForReady=()=>target?Promise.resolve():new Promise((resolve,reject)=>{const complete=()=>{clearTimeout(timer);resolve();};const timer=setTimeout(()=>{waiting.delete(complete);reject(Error('공유 장부 연결 지연 · 현재 기록을 보존하고 다시 확인하세요.'));},30000);waiting.add(complete);});
 return {async request(body){if(closed)throw Error('공유 장부 연결이 닫혔어요.');await waitForReady();return new Promise((resolve,reject)=>{const id=crypto.randomUUID(),timer=setTimeout(()=>{requests.delete(id);reject(Error('서버 수신 확인 지연 · 저장 완료가 아닙니다. 같은 입력으로 재확인하세요.'));},30000);requests.set(id,{timer,resolve,reject});target.postMessage({channel,id,request:{...body,appId:config.appId}},targetOrigin);});},dispose(){closed=true;window.removeEventListener('message',onMessage);frame.remove();for(const pending of requests.values()){clearTimeout(pending.timer);pending.reject(Error('공유 장부 연결이 닫혔어요.'));}requests.clear();}};
}
