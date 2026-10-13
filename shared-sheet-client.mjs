import {APP_ID,validate} from './core.mjs';
import {CloudStore} from './cloud.mjs';
// Transport is supplied by the shared authenticated backend team. This file makes no network requests.
export function createSharedSheetStore(adapter){
 if(!adapter)return null;
 for(const method of ['login','logout','read','save','history','version'])if(typeof adapter[method]!=='function')throw Error('공통 인증서버 어댑터 규격을 확인하세요.');
 const checkedSnapshot=s=>{if(!s)return null;if(s.appId!==APP_ID||!Number.isSafeInteger(s.revision)||s.revision<1)throw Error('차량 앱 또는 서버 저장 확인 값이 맞지 않습니다.');return {...s,payload:validate(s.payload)};};
 const client={auth:{async signInWithPassword(credentials){try{const user=await adapter.login(credentials);if(!user?.id)throw Error();return {data:{user},error:null};}catch{return {data:null,error:{message:'auth_failed'}};}},async signOut(){await adapter.logout();return {error:null};}},async rpc(name,p={}){try{let data;switch(name){case 'car_care_read':data=checkedSnapshot(await adapter.read({appId:APP_ID}));break;case 'car_care_save':{const s=await adapter.save({appId:APP_ID,payload:validate(p.p_payload),expectedRevision:p.p_expected_revision,mutationId:p.p_mutation_id,reason:p.p_reason});if(!s||s.mutationId!==p.p_mutation_id)throw Error('unconfirmed_receipt');data=checkedSnapshot(s);break;}case 'car_care_history':data=await adapter.history({appId:APP_ID});break;case 'car_care_version':data=checkedSnapshot(await adapter.version({appId:APP_ID,revision:p.p_revision}));break;default:throw Error('unsupported_operation');}return {data,error:null};}catch(error){return {data:null,error:{message:error.code==='conflict'?'revision_conflict':error.message||'unavailable'}};}}};
 const store=new CloudStore(client);store.authKind='shared-sheet';store.label='로그인 차주별 비공개 Sheet';return store;
}
