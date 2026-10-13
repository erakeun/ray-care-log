import {ruleFor,matches} from './references.mjs';
export const APP_ID = 'ray-care-log';
export const KEY = 'ray-care-log:v1';
export const isEV = v => /EV|전기/i.test(v.fuel+' '+v.engine+' '+v.type);
export const applicable = (v,i) => !isEV(v) || !/엔진|점화|연료|불스원|변속기 오일/.test(i.name);
export const MAX_KM = 9999999;
export const uid = () => globalThis.crypto.randomUUID();
export const todayKST = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function validDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s) || s < '1900-01-01') return false;
  const d = new Date(s+'T00:00:00Z');
  return Number.isFinite(+d) && d.toISOString().slice(0,10) === s;
}
export function addMonths(s, months) {
  if (!validDate(s)) throw Error('올바른 날짜를 입력하세요.');
  const [y,m,d]=s.split('-').map(Number), target=new Date(Date.UTC(y,m-1+months,1));
  const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
  target.setUTCDate(Math.min(d,last)); return target.toISOString().slice(0,10);
}
const defaults = [
 ['와이퍼 · 워셔액 · 등화','점검','시야를 가리는 와이퍼 줄무늬, 워셔액 잔량, 전조등·브레이크등을 확인하세요. 워셔액은 지정 제품을 사용하세요.'],
 ['이상징후 · 경고등','점검','제동 이상·과열·누유·이상 소음·경고등이 있으면 예정일까지 기다리지 말고 점검받으세요.'],
 ['엔진오일 · 오일필터','교체','일반 관리 참고 · AAA 일반 점검 참고입니다. 연식별 공식 기준 확인 후 주기를 직접 입력하세요. 엔진을 보호하는 오일과 필터를 함께 교환해요. 내 차 설명서·오일수명 알림과 가혹조건 기준이 우선입니다.'],
 ['엔진 에어필터','교체','일반 관리 참고 · AAA 연 1회 안내. 엔진으로 들어가는 공기의 먼지를 걸러요. 오염과 운행환경·설명서 기준에 따라 교체해요.'],
 ['실내 에어컨필터','교체','일반 관리 참고 · AAA 연 1회 안내. 실내 공기의 먼지를 걸러요. 냄새·풍량·오염을 함께 확인하세요.'],
 ['타이어 상태 · 공기압','점검','냉간 공기압은 차량 라벨을 확인하세요. 마모·균열·손상도 함께 확인하세요.'],
 ['타이어 교체','교체','주행거리만으로 결정하지 않습니다. 마모·손상·노후 상태를 전문가와 확인하세요.'],
 ['브레이크 패드 · 디스크','점검','마모·소음·제동 이상을 확인하세요. 상태에 따라 교체하며 이상이 있으면 점검을 미루지 마세요.'],
 ['브레이크액','교체','액량 저하는 누유나 패드 마모 때문일 수 있어요. 무조건 보충하지 말고 원인과 액 규격을 점검받으세요. 교환 기간은 설명서에서 확인하세요.'],
 ['변속기 오일','교체','변속기 종류·연식·사용조건에 따라 기준이 다릅니다. 정확한 설명서 확인 후 주기를 설정하세요.'],
 ['냉각수','교체','냉각수 규격과 최초/이후 교환주기를 확인하세요. 뜨거울 때 캡을 열지 마세요. 부족하거나 반복해서 줄면 누수 원인 점검이 먼저예요.'],
 ['배터리','점검','시동 성능·충전상태를 점검하세요. 고정 주행거리로 교체를 단정하지 않습니다.'],
 ['점화플러그 · 구동벨트','점검','적용 여부·부품 규격·정비주기를 차량 설명서에서 확인하세요.'],
 ['엔진오일량','점검','일반 점검 참고 · 월 1회. 평지에서 설명서의 측정 방법을 따르세요. 오일량 확인은 오일 교체가 아닙니다.'],
 ['냉각수량','점검','일반 점검 참고 · 월 1회. 차량이 완전히 식었을 때 보조탱크 눈금을 확인하세요. 뜨거울 때 캡을 열지 마세요. 부족하거나 반복해서 줄면 누수 원인 점검이 먼저예요.']
];
export function freshState() { return {schemaVersion:2,appId:APP_ID,vehicle:{name:'',odometer:null,fuel:'',type:'기아 레이',year:'',engine:'',transmission:'',usage:''},items:defaults.map(([name,kind,note])=>({id:uid(),name,kind,note,intervalKm:null,intervalMonths:['타이어 상태 · 공기압','엔진오일량','냉각수량'].includes(name)?1:['브레이크 패드 · 디스크','엔진 에어필터','실내 에어컨필터'].includes(name)?12:null,confirmed:false,baselineId:null})),records:[]}; }
function fail(s) { throw Error(s); }
function object(v, keys) { if (!v || typeof v!=='object' || Array.isArray(v) || Object.keys(v).some(k=>!keys.includes(k)) || keys.some(k=>!Object.hasOwn(v,k))) fail('백업 형식 또는 필드가 올바르지 않습니다.'); }
function str(s,n) { return typeof s==='string' && s.length<=n; }
function integer(n,max,min=0) { return Number.isSafeInteger(n) && n>=min && n<=max; }
export function validate(s,today=todayKST()) {
 object(s,['schemaVersion','appId','vehicle','items','records']);
 if(s.appId!==APP_ID) fail('다른 차량 앱의 백업입니다. 이 앱에서 복원할 수 없습니다.');
 if(s.schemaVersion===1){object(s.vehicle,['name','odometer','fuel','type']);s=structuredClone(s);s.schemaVersion=2;s.vehicle={...s.vehicle,year:'',engine:'',transmission:'',usage:''};}
 if(s.schemaVersion!==2) fail('지원하지 않는 백업 버전입니다.');
 object(s.vehicle,['name','odometer','fuel','type','year','engine','transmission','usage']);
 const v=s.vehicle;
 if(!v.type.includes('레이')) fail('이 앱의 차종과 다른 차량입니다.');
 if(!str(v.name,60)||!str(v.fuel,30)||!str(v.type,60)||(v.odometer!==null&&!integer(v.odometer,MAX_KM))) fail('차량 정보가 올바르지 않습니다.');
 if(!str(v.year,4)||(v.year!==''&&(!/^\d{4}$/.test(v.year)||Number(v.year)<1900||Number(v.year)>Number(today.slice(0,4))+1))||!str(v.engine,100)||!['','자동','수동','CVT','DCT','기타'].includes(v.transmission)||!['','일반','가혹조건 가능','미확인'].includes(v.usage))fail('연식·엔진·변속기·주행 환경을 확인하세요.');
 if(!Array.isArray(s.items)||s.items.length>100||!Array.isArray(s.records)||s.records.length>10000) fail('항목 또는 이력 수가 허용 범위를 벗어납니다.');
 const ids=new Set(), rids=new Set();
 for(const i of s.items){ object(i,['id','name','kind','note','intervalKm','intervalMonths','confirmed','baselineId']);
   if(!str(i.id,80)||!i.id||ids.has(i.id)||!str(i.name,80)||!i.name.trim()||!['점검','교체','수리','선택 관리'].includes(i.kind)||!str(i.note,500)||typeof i.confirmed!=='boolean'||(i.baselineId!==null&&!str(i.baselineId,80))||(i.intervalKm!==null&&!integer(i.intervalKm,1000000,1))||(i.intervalMonths!==null&&!integer(i.intervalMonths,600,1))) fail('정비 항목의 값이 올바르지 않습니다.');
   if(i.confirmed&&i.intervalKm===null&&i.intervalMonths===null) fail('확정할 주기를 먼저 입력하세요.'); ids.add(i.id);
 }
 for(const r of s.records){ object(r,['id','itemId','date','km','note']);
   if(!str(r.id,80)||!r.id||rids.has(r.id)||!ids.has(r.itemId)||!str(r.note,1000)||(r.date!==null&&(!validDate(r.date)||r.date>today))||(r.km!==null&&(!integer(r.km,MAX_KM)||v.odometer===null||r.km>v.odometer))||(r.date===null&&r.km===null)) fail('정비 이력의 날짜·거리·항목을 확인하세요. 미래 기록은 저장할 수 없습니다.'); rids.add(r.id);
 }
 for(const i of s.items){ const rs=s.records.filter(r=>r.itemId===i.id), base=rs.find(r=>r.id===i.baselineId);
   if(i.baselineId!==null&&!base) fail('계산 기준 이력을 찾을 수 없습니다.');
   const dated=rs.filter(r=>r.date!==null&&r.km!==null).sort((a,b)=>a.date.localeCompare(b.date)||a.km-b.km);
   for(let n=1;n<dated.length;n++) if(dated[n].km<dated[n-1].km) fail('날짜가 뒤인 기록의 누적 거리가 더 작습니다. 이력을 확인하세요.');
   const seen=new Set(); for(const r of rs){ const key=JSON.stringify([r.date,r.km,r.note]); if(seen.has(key)) fail('같은 정비 기록이 이미 있습니다.'); seen.add(key); }
   if(base&&rs.some(r=>(r.date&&base.date&&r.date>base.date)||(r.km!==null&&base.km!==null&&r.km>base.km))) fail('더 최근 이력이 있습니다. 최신 기록을 계산 기준으로 선택하세요.');
 }
 return structuredClone(s);
}
export function save(storage,state) { const checked=validate(state); try { storage.setItem(KEY,JSON.stringify(checked)); } catch { fail('저장하지 못했습니다. 저장 공간 또는 브라우저 설정을 확인하고 JSON 백업을 보관하세요.'); } return checked; }
export function parseBackup(text) { if(typeof text!=='string'||text.length>3000000) fail('백업 파일이 너무 큽니다 (최대 3 MB).'); let s; try{s=JSON.parse(text);}catch{fail('올바른 JSON 백업 파일이 아닙니다.');} return validate(s); }
export function updateOdometer(s,km) { if(!integer(km,MAX_KM)||s.vehicle.odometer!==null&&km<s.vehicle.odometer) fail('현재 누적 km보다 작게 입력할 수 없습니다. 잘못 입력한 차량 거리는 차량 설정에서 정정하세요.'); const next=structuredClone(s);next.vehicle.odometer=km;return validate(next); }
export function due(s,item,today=todayKST()) {
 const r=s.records.find(r=>r.id===item.baselineId), official=ruleFor(item), result={state:'unknown',label:'이번에 상태와 이력 확인',nextKm:null,nextDate:null,leftKm:null,leftDays:null,missing:[]};
 if(official&&!matches(s.vehicle,official.p)) return {...result,label:'사양·조건 변경: 공식 기준 재확인'};
 if(!r) return result;
 if(official){const [km,months]=official.r.first&&r.note.startsWith('[출고 기준]')?official.r.first:[official.r.intervalKm,official.r.intervalMonths];item={...item,intervalKm:km,intervalMonths:months};}
 if(item.name==='타이어 교체') return {...result,state:'unset',label:'마모·균열·손상 확인 후 교체 판단'};
 if(item.intervalKm===null&&item.intervalMonths===null) return {...result,state:item.kind==='선택 관리'?'optional':'unset',label:item.kind==='수리'?'수리 기록 보관':item.kind==='선택 관리'?'선택 관리 · 거리 알림 없음':'주기 확인 필요'};
 if(item.intervalKm!==null){ if(r.km===null||s.vehicle.odometer===null)result.missing.push('거리');else {result.nextKm=r.km+item.intervalKm;result.leftKm=result.nextKm-s.vehicle.odometer;} }
 if(item.intervalMonths!==null){if(!r.date) result.missing.push('날짜');else {result.nextDate=addMonths(r.date,item.intervalMonths);result.leftDays=Math.round((Date.parse(result.nextDate+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);} }
 const dueNow=(result.leftKm!==null&&result.leftKm<=0)||(result.leftDays!==null&&result.leftDays<=0);
 const soon=(result.leftKm!==null&&result.leftKm<=500)||(result.leftDays!==null&&result.leftDays<=30);
 result.state=dueNow?'due':result.missing.length?'unknown':soon?'soon':'ok';
 result.label=dueNow?'설정한 점검 시점 도래':result.missing.length?'기준 정보 확인 필요':soon?'점검 시점 가까움':'아직 여유 있어요';if(item.kind==='선택 관리'){result.state='optional';result.label=dueNow?'선택 관리 참고 시점':'선택 관리 · 제품 라벨 우선';}return result;
}
export function csv(s) {
 const cell=v=>'"'+String(v??'').replace(/^[=+\-@\t\r]/,"'$&").replaceAll('"','""')+'"';
 return '\uFEFF'+[['항목','유형','정비일','누적거리 (km)','메모'],...s.records.map(r=>[s.items.find(i=>i.id===r.itemId).name,s.items.find(i=>i.id===r.itemId).kind,r.date,r.km,r.note])].map(row=>row.map(cell).join(',')).join('\r\n');
}
