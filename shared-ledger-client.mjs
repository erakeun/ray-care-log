import {APP_ID,KEY,validate,freshState,uid} from './core.mjs';
const META_ID='__'+APP_ID+'_vehicle_profile_v2__';
export const ledgerAppId=APP_ID==='k3-care-log'?'k3':'ray';
export function encodeSnapshot(value){
 const s=validate(value);if(s.items.length>99||s.items.some(i=>i.id===META_ID))throw Error('공유 장부는 차량 사양 항목을 포함해 관리 항목 최대 100개를 저장합니다. 사용자 항목은 최대 99개예요.');
 const {year,engine,transmission,usage}=s.vehicle;
 const metadata={id:META_ID,name:'차량 사양 · 시스템 보관',kind:'수리',note:JSON.stringify({format:2,appId:APP_ID,year,engine,transmission,usage}),intervalKm:null,intervalMonths:null,confirmed:false,baselineId:null};
 return {schemaVersion:1,vehicle:{name:'',odometer:s.vehicle.odometer,fuel:s.vehicle.fuel,type:s.vehicle.type},items:[...s.items,metadata],records:s.records};
}
export function decodeSnapshot(wire){
 if(!wire||wire.schemaVersion!==1||Object.keys(wire).sort().join(',')!=='items,records,schemaVersion,vehicle'||!Array.isArray(wire.items))throw Error('공유 장부 형식을 확인하지 못했어요.');
 const metadata=wire.items.filter(i=>i.id===META_ID);if(metadata.length!==1)throw Error('다른 차량 또는 차량 사양 정보가 없는 공유 기록입니다.');
 let m;try{m=JSON.parse(metadata[0].note);}catch{throw Error('차량 사양 정보가 손상됐어요.');}
 if(m.format!==2||m.appId!==APP_ID||Object.keys(m).sort().join(',')!=='appId,engine,format,transmission,usage,year')throw Error('차량 사양 앱 식별자를 확인하세요.');
 return validate({schemaVersion:2,appId:APP_ID,vehicle:{name:'',odometer:wire.vehicle.odometer,fuel:wire.vehicle.fuel,type:wire.vehicle.type,year:m.year,engine:m.engine,transmission:m.transmission,usage:m.usage},items:wire.items.filter(i=>i.id!==META_ID),records:wire.records});
}
function response(result){if(!result||!Number.isSafeInteger(result.revision)||result.revision<0||result.snapshot===null&&result.revision!==0||!result.snapshot&&result.snapshot!==null)throw Error('서버 응답을 확인하지 못했어요. 저장 완료가 아닙니다.');return {revision:result.revision,payload:result.snapshot===null?freshState():decodeSnapshot(result.snapshot)};}
export class SharedLedgerStore{
 constructor(transport,{storage=globalThis.localStorage}={}){this.transport=transport;this.storage=storage;this.revision=0;this.ready=false;this.loading=false;this.pending=null;this.pendingKey=KEY+':shared-pending';const raw=storage?.getItem(this.pendingKey);if(raw){const p=JSON.parse(raw);if(p.appId!==ledgerAppId||!Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<0||!/^[-a-zA-Z0-9]{20,80}$/.test(p.mutationId))throw Error('미확인 저장 원본을 확인하세요.');const payload=validate(p.payload);this.pending={...p,payload,snapshot:encodeSnapshot(payload),serialized:JSON.stringify(payload)};}}
 async load({accept=()=>true}={}){if(this.pending)throw Error('이전 저장 결과가 미확인입니다. 같은 입력 재시도로 먼저 확인하세요.');if(this.loading)throw Error('공유 장부 확인 중입니다.');this.loading=true;try{const result=response(await this.transport.request({appId:ledgerAppId,action:'load'}));if(result.revision<this.revision||!accept())return null;this.revision=result.revision;this.ready=true;return result;}finally{this.loading=false;}}
 async write(value){if(this.loading||!this.ready&&!this.pending)throw Error('공유 장부 연결을 먼저 확인하세요.');const payload=validate(value),serialized=JSON.stringify(payload);if(this.pending&&serialized!==this.pending.serialized)throw Error('이전 저장 결과가 미확인입니다. 같은 입력으로 재시도하세요.');if(!this.pending){const snapshot=encodeSnapshot(payload);this.pending={appId:ledgerAppId,mutationId:uid(),expectedRevision:this.revision,payload,snapshot,serialized};this.storage?.setItem(this.pendingKey,JSON.stringify(this.pending));}
 const p=this.pending;let result;try{result=await this.transport.request({appId:ledgerAppId,action:'save',expectedRevision:p.expectedRevision,mutationId:p.mutationId,snapshot:p.snapshot});}catch{throw Error('서버 저장 확인 실패 · 입력과 미확인 저장은 이 브라우저에 보존됩니다. 같은 입력으로 재시도하세요.');}
 if(result?.conflict){response(result);this.pending=null;this.storage?.removeItem(this.pendingKey);this.ready=false;const error=Error('다른 기기가 먼저 저장했어요. 현재 입력은 서버에 저장되지 않았습니다. JSON으로 보관하고 최신 장부를 확인하세요.');error.code='conflict';throw error;}
 const checked=response(result);if(checked.revision!==p.expectedRevision+1||JSON.stringify(encodeSnapshot(checked.payload))!==JSON.stringify(p.snapshot))throw Error('서버 저장 내용 확인 실패 · 완료로 표시하지 않습니다. 같은 입력으로 재시도하세요.');
 this.pending=null;this.storage?.removeItem(this.pendingKey);this.revision=checked.revision;this.ready=true;return checked;
 }
}
