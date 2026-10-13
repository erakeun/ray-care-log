import {validate,uid} from './core.mjs';
export const DRIVE_APP='ray-care-log-v1';
export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
export class DriveError extends Error{constructor(message,code='unavailable'){super(message);this.code=code;}}
const failure=()=>new DriveError('Drive에 저장하지 못했어요. 입력과 이전 기록은 유지됩니다. 같은 입력으로 다시 시도하세요.');
const idOk=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(id);
const sameIds=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
export function envelope(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='createdAt,format,mutationId,parents,payload,reason'||value.format!==1||!idOk(value.mutationId)||!Array.isArray(value.parents)||value.parents.length>50||value.parents.some(x=>!idOk(x))||new Set(value.parents).size!==value.parents.length||!['edit','migration','blank','restore','resolve'].includes(value.reason)||typeof value.createdAt!=='string'||!Number.isFinite(Date.parse(value.createdAt)))throw new DriveError('Drive 버전 형식을 확인하지 못했어요. 원본을 바꾸지 않았습니다.','integrity');
 return {...value,payload:validate(value.payload)};
}
export function versionHeads(versions){
 const ids=new Set(versions.map(v=>v.id)),parents=new Set();
 if(ids.size!==versions.length)throw new DriveError('중복된 버전 ID를 확인하세요.','integrity');
 for(const v of versions)for(const parent of v.parents){if(!ids.has(parent)||parent===v.id)throw new DriveError('이전 버전이 누락되거나 손상됐어요. Drive 원본은 그대로 유지됩니다.','integrity');parents.add(parent);}
 const visiting=new Set(),visited=new Set(),byId=new Map(versions.map(v=>[v.id,v]));
 const walk=id=>{if(visiting.has(id))throw new DriveError('버전 연결이 손상됐어요.','integrity');if(visited.has(id))return;visiting.add(id);for(const p of byId.get(id).parents)walk(p);visiting.delete(id);visited.add(id);};
 versions.forEach(v=>walk(v.id));return versions.filter(v=>!parents.has(v.id));
}
export class GoogleDriveStore{
 constructor(api,auth){this.api=api;this.auth=auth;this.authKind='google';this.label='Google Drive';this.user=null;this.snapshot=null;this.conflicts=[];this.versions=[];this.pending=null;this.loading=false;this.epoch=0;}
 get active(){return !!this.user;}
 async login(){
  const epoch=++this.epoch;await this.auth.connect();const user=await this.api.identity();
  if(epoch!==this.epoch)throw new DriveError('연결이 취소됐어요.','cancelled');
  if(!user?.permissionId||!/@(gmail|googlemail)\.com$/i.test(user.emailAddress??'')){this.auth.clear();throw new DriveError('학교·조직 계정 대신 개인 Google 계정을 선택하세요.','auth');}
  if(this.user&&this.user.id!==user.permissionId){this.auth.clear();throw new DriveError('다른 계정으로 바꾸려면 먼저 로그아웃하세요. 이전 입력은 유지됩니다.','auth');}
  this.user={id:user.permissionId,email:user.emailAddress};return this.pending?this.snapshot?structuredClone(this.snapshot):null:this.load();
 }
 async graph(){const versions=(await this.api.listVersions()).map(v=>({id:v.id,...envelope(v.envelope)}));const heads=versionHeads(versions);return {versions,heads};}
 adopt(g){this.versions=g.versions;this.conflicts=g.heads.length>1?g.heads:[];const head=g.heads.length===1?g.heads[0]:null;this.snapshot=head?{revision:head.id,revisionLabel:head.createdAt,payload:head.payload,updatedAt:head.createdAt}:null;return this.snapshot?structuredClone(this.snapshot):null;}
 async load(){
  if(!this.active)throw new DriveError('Google 연결이 필요합니다.','auth');
  if(this.pending)throw new DriveError('이전 저장 결과가 확인되지 않았어요. 같은 입력으로 다시 저장하세요.','pending');
  const epoch=this.epoch;this.loading=true;try{const g=await this.graph();if(epoch!==this.epoch)throw new DriveError('계정 연결이 변경됐어요.','cancelled');return this.adopt(g);}finally{if(epoch===this.epoch)this.loading=false;}
 }
 async write(next,{reason='edit',resolveParents=null}={}){
  if(!this.active||this.loading)throw new DriveError('Google 연결과 불러오기가 끝난 뒤 저장하세요.','auth');
  const payload=validate(next),serialized=JSON.stringify(payload),epoch=this.epoch;
  if(this.conflicts.length&&!resolveParents&&!this.pending)throw new DriveError('동시에 저장된 기록이 있어요. 먼저 기준 기록을 확인하세요.','conflict');
  if(this.pending&&this.pending.serialized!==serialized)throw new DriveError('이전 저장 결과를 확인할 때까지 입력을 바꾸지 말고 같은 내용으로 재시도하세요.','pending');
  if(!this.pending){
   const parents=resolveParents??(this.snapshot?[this.snapshot.revision]:[]),before=await this.graph();
   if(!sameIds(before.heads.map(v=>v.id),parents)){this.conflicts=before.heads;throw new DriveError('다른 기기의 기록이 바뀌었어요. 최신 기록을 먼저 확인하세요.','conflict');}
   const id=await this.api.allocateId();
   if(epoch!==this.epoch)throw new DriveError('계정 연결이 변경됐어요.','cancelled');
   this.pending={id,serialized,envelope:{format:1,mutationId:uid(),parents,payload,reason,createdAt:new Date().toISOString()},uploaded:false};
  }
  const p=this.pending;
  try{await this.api.createVersion(p.id,p.envelope);p.uploaded=true;}catch(err){if(err instanceof DriveError)throw err;throw failure();}
  if(epoch!==this.epoch)throw new DriveError('연결이 변경됐어요. 다시 연결해 저장 결과를 확인하세요.','cancelled');
  const after=await this.graph();
  if(epoch!==this.epoch)throw new DriveError('연결이 변경됐어요. 다시 연결해 저장 결과를 확인하세요.','cancelled');
  if(!after.versions.some(v=>v.id===p.id))throw new DriveError('저장 결과를 아직 읽지 못했어요. 같은 입력으로 다시 확인하세요.','pending');
  this.pending=null;
  if(after.heads.length!==1||after.heads[0].id!==p.id){this.versions=after.versions;this.conflicts=after.heads;throw new DriveError('동시에 저장된 두 기록을 모두 보관했어요. 기준 기록을 확인하세요.','conflict');}
  return this.adopt(after);
 }
 async history(){if(!this.active)throw new DriveError('Google 연결이 필요합니다.','auth');return [...this.versions].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,50).map(v=>({revision:v.id,created_at:v.createdAt,reason:v.reason}));}
 async version(id){if(!this.active)throw new DriveError('Google 연결이 필요합니다.','auth');const v=this.versions.find(v=>v.id===id);if(!v)throw new DriveError('현재 계정의 이 버전을 찾지 못했어요.','integrity');return {revision:v.id,payload:structuredClone(v.payload),created_at:v.createdAt};}
 async resolve(id){const parents=this.conflicts.map(v=>v.id);if(parents.length<2)throw new DriveError('최신 기록을 먼저 확인하세요.','conflict');const v=await this.version(id);if(!parents.includes(id))throw new DriveError('충돌한 기록 중 하나를 선택하세요.','conflict');return this.write(v.payload,{reason:'resolve',resolveParents:parents});}
 async logout(){++this.epoch;this.auth.clear();this.api.root=null;this.user=null;this.snapshot=null;this.conflicts=[];this.versions=[];this.pending=null;this.loading=false;return true;}
}

const FILE_FIELDS='id,name,mimeType,ownedByMe,shared,parents,appProperties,createdTime,permissions(type,role)';
function privateFile(f){if(!idOk(f?.id)||f.ownedByMe!==true||f.shared!==false||!Array.isArray(f.permissions)||f.permissions.some(p=>p.role!=='owner'||p.type!=='user'))throw new DriveError('본인 소유의 비공개 앱 파일만 사용할 수 있어요. 공유 설정을 변경하지 않았습니다.','privacy');return f;}
export class GoogleDriveApi{
 constructor(auth,fetcher=globalThis.fetch){this.auth=auth;this.fetcher=fetcher;this.root=null;}
 async request(url,init={}){
  const u=new URL(url);if(u.origin!=='https://www.googleapis.com'||!/^\/(drive\/v3|upload\/drive\/v3)\//.test(u.pathname))throw new DriveError('허용되지 않은 Drive 요청입니다.','privacy');
  const token=this.auth.token();if(!token)throw new DriveError('Google 연결이 만료됐어요. 다시 연결한 뒤 같은 입력으로 저장하세요.','auth');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{const response=await this.fetcher(u.href,{...init,credentials:'omit',redirect:'error',signal:controller.signal,headers:{...init.headers,Authorization:'Bearer '+token}});if(!response.ok){if(response.status===401)throw new DriveError('Google 연결이 만료됐어요. 다시 연결하세요.','auth');if(response.status===409)return {conflict:true};throw failure();}return response;}catch(err){if(err instanceof DriveError)throw err;throw failure();}finally{clearTimeout(timeout);}
 }
 async json(path,params={},init={}){const u=new URL('https://www.googleapis.com/drive/v3/'+path);for(const [k,v]of Object.entries(params))u.searchParams.set(k,v);const response=await this.request(u.href,init);if(response.conflict)return response;return response.json();}
 async identity(){return (await this.json('about',{fields:'user(permissionId,emailAddress)'})).user;}
 async allocateId(){const r=await this.json('files/generateIds',{count:'1',space:'drive',type:'files'});if(!idOk(r.ids?.[0]))throw failure();return r.ids[0];}
 async list(q){const all=[];let pageToken;do{const r=await this.json('files',{q,fields:'nextPageToken,incompleteSearch,files('+FILE_FIELDS+')',spaces:'drive',pageSize:'100',...(pageToken?{pageToken}:{})});if(r.incompleteSearch)throw new DriveError('Drive 목록을 완전히 확인하지 못해 저장을 중단했어요.','integrity');all.push(...(r.files??[]));if(all.length>500)throw new DriveError('버전이 500개를 넘었어요. 원본을 보존한 상태로 보관 정책을 확인하세요.','limit');pageToken=r.nextPageToken;}while(pageToken);return all;}
 async folder(create=false){
  const roots=await this.list(`trashed = false and 'me' in owners and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='app' and value='${DRIVE_APP}' } and appProperties has { key='role' and value='root' }`);
  if(roots.length>1)throw new DriveError('앱 폴더가 두 개 있어요. 두 원본을 보존한 상태로 폴더를 확인해야 합니다.','conflict');
  if(roots[0])return this.root=privateFile(roots[0]);
  if(!create)return null;
  const id=await this.allocateId();await this.json('files',{fields:FILE_FIELDS},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,name:'기아 레이 케어 기록',mimeType:'application/vnd.google-apps.folder',appProperties:{app:DRIVE_APP,role:'root'}})});
  return this.folder(false);
 }
 async body(id){const r=await this.request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media');const text=await r.text();if(text.length>3000000)throw new DriveError('Drive 기록 파일이 너무 큽니다.','integrity');try{return envelope(JSON.parse(text));}catch(err){if(err instanceof DriveError)throw err;throw new DriveError('Drive 기록 파일을 읽지 못했어요. 원본은 유지됩니다.','integrity');}}
 async listVersions(){const root=await this.folder(false);if(!root)return [];const files=await this.list(`trashed = false and 'me' in owners and '${root.id}' in parents and mimeType = 'application/json' and appProperties has { key='app' and value='${DRIVE_APP}' } and appProperties has { key='role' and value='snapshot' }`);const result=[];for(const f of files){privateFile(f);result.push({id:f.id,envelope:await this.body(f.id)});}return result;}
 async createVersion(id,value){
  const root=await this.folder(true);if(!root)throw failure();
  const boundary='carcare_'+uid(),metadata={id,name:'정비 기록 '+value.createdAt.slice(0,10)+' '+value.mutationId+'.json',mimeType:'application/json',parents:[root.id],appProperties:{app:DRIVE_APP,role:'snapshot',mutation:value.mutationId}};
  const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(value)}\r\n--${boundary}--`;
  await this.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields='+encodeURIComponent(FILE_FIELDS),{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});
  const file=privateFile(await this.json('files/'+encodeURIComponent(id),{fields:FILE_FIELDS}));
  if(!file.parents?.includes(root.id)||file.appProperties?.app!==DRIVE_APP||file.appProperties?.role!=='snapshot')throw new DriveError('앱 버전의 위치를 확인하지 못했어요.','integrity');
  const saved=await this.body(id);if(saved.mutationId!==value.mutationId||JSON.stringify(saved)!==JSON.stringify(envelope(value)))throw new DriveError('저장된 버전 내용이 다릅니다. 원본을 덮어쓰지 않았어요.','integrity');
 }
}
