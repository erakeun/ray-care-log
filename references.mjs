export const aveoReferences=[];
const base='https://ownersmanual.kia.com/full_webhelp/';
const row=(name,kind,km,months,first=null,detail='')=>({name,kind,intervalKm:km,intervalMonths:months,first,detail});
const shared=()=>[row('브레이크액','교체',50000,null,null,'액량 부족은 무조건 보충하지 말고 누유·패드 마모 원인을 점검하세요.'),row('냉각수','교체',40000,24,[200000,120],'최초 200,000 km / 120개월, 이후 40,000 km / 24개월. 부족은 원인 점검, EV 보충·교체는 기아 서비스센터.'),row('실내 에어컨필터','교체',15000,null),row('구동벨트','점검',30000,24,[90000,72],'최초 90,000 km / 72개월, 이후 30,000 km / 24개월. 점검이며 교체를 뜻하지 않아요.')];
export const profiles=[
 {id:'ray-2023-normal',label:'레이 2023 · 가솔린 1.0 MPI · 4AT · 통상',year:'2023',engine:/^1\.0 MPI$/i,fuel:/^(휘발유|가솔린)$/,transmission:'자동',usage:'일반',url:base+'TAM/2023/ko_KR/topics/t00612.html',rows:[row('엔진오일 · 오일필터','교체',15000,12),...shared()]},
 {id:'ray-2023-severe',label:'레이 2023 · 가솔린 1.0 MPI · 4AT · 가혹',year:'2023',engine:/^1\.0 MPI$/i,fuel:/^(휘발유|가솔린)$/,transmission:'자동',usage:'가혹조건 가능',url:base+'TAM/2023/ko_KR/topics/t00613.html',rows:[row('엔진오일 · 오일필터','교체',7500,6),row('변속기 오일','교체',100000,null,null,'4속 자동변속기. 가혹조건 1·4·5·6·7·8·9·11에 해당할 때만 적용.')]},
 {id:'ray-ev-2024-normal',label:'레이 EV 2024 · 전기 · 감속기 · 통상',year:'2024',engine:/^(EV|전기)$/i,fuel:/^(전기|EV)$/i,transmission:'기타',usage:'일반',url:base+'TAMEV/2024/ko_KR/topics/t00707.html',rows:[...shared().filter(r=>r.name!=='구동벨트'),row('타이어 위치 교환','점검',10000,12,null,'타이어 위치를 바꾸는 작업입니다. 새 타이어 교체와 다릅니다.'),row('에어컨 냉매 · 작동 상태','점검',null,12)]},
 {id:'ray-ev-2024-severe',label:'레이 EV 2024 · 전기 · 감속기 · 가혹',year:'2024',engine:/^(EV|전기)$/i,fuel:/^(전기|EV)$/i,transmission:'기타',usage:'가혹조건 가능',url:base+'TAMEV/2024/ko_KR/topics/t00708.html',rows:[row('감속기 오일','교체',120000,null,null,'공식 가혹조건 1·3·4·5·6·8에 해당할 때만 적용.'),row('브레이크 패드 · 디스크','점검',null,null,null,'상태에 따라 수시 점검. 고정 교체 주기 아님.')]}];
export function matches(v,p){return v.year===p.year&&p.engine.test(v.engine)&&p.fuel.test(v.fuel)&&v.transmission===p.transmission&&v.usage===p.usage;}
export function ruleFor(i){const m=i.note.match(/^기아 공식 \[([^:]+):(\d+)\]/);if(!m)return null;const p=profiles.find(x=>x.id===m[1]),r=p?.rows[+m[2]];return r?{p,r}:null;}
export function presetNote(p,r,n){return `기아 공식 [${p.id}:${n}] ${p.label}. ${r.detail} ${r.first?'최초 계산은 확인한 출고일·초기 거리 기준을 기록하세요. 실제 첫 작업 기록 후 반복 주기로 전환합니다.':''} 근거: ${p.url}`;}
