import {connectLedger} from './shared.mjs';
import {sharedConfig} from './shared-config.mjs';
import {SharedLedgerStore} from './shared-ledger-client.mjs';
import {APP_ID,freshState} from './core.mjs';
const status=document.querySelector('#status'),button=document.querySelector('#restore-qa');
const store=new SharedLedgerStore(connectLedger(sharedConfig));
let current;
try{
 current=await store.load();const s=current.payload,v=s.vehicle,k3=APP_ID==='k3-care-log';
 const expectedRevision=k3?3:2,expectedKm=k3?10000:20000;
 const sampleOnly=k3?s.records.length===1&&s.records[0].note==='QA-K3-20261013 임시 동기화 시험 · 실제 정비 아님'&&s.records[0].km===10000&&s.records[0].date===null:s.records.length===0;
 const knownEmptyProfile=[v.name,v.fuel,v.year,v.engine,v.transmission,v.usage].every(value=>value==='');
 if(current.revision!==expectedRevision||v.odometer!==expectedKm||!sampleOnly||!knownEmptyProfile)throw Error('다른 버전 또는 실제 입력 발견: 원복하지 않습니다.');
 status.textContent=`${sharedConfig.appId} · 최신 버전 ${current.revision} · ${expectedKm.toLocaleString()} km · 시험 정비 ${s.records.length}건. 승인된 QA 상태 일치 확인.`;button.disabled=false;
}catch(error){status.textContent=error.message;}
button.addEventListener('click',async()=>{button.disabled=true;try{const result=await store.write(freshState());status.textContent=`원복 완료 · ${sharedConfig.appId} · 새 버전 ${result.revision} · 정비 ${result.payload.records.length}건 · 누적거리 미기록 · 사양 미확정. 과거 버전과 로그 보존.`;}catch(error){status.textContent=error.message;}});
