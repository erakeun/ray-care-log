import {validate,uid} from './core.mjs';

export class CloudError extends Error {
  constructor(message,code='unavailable'){super(message);this.code=code;}
}
const errorFor=error=>new CloudError(error?.message?.includes('revision_conflict')?'다른 기기에서 기록이 바뀌었어요. 서버 최신 기록을 확인한 뒤 다시 입력하세요.':error?.message?.includes('membership_required')?'이 계정에는 차량 기록 접근 권한이 없습니다.':'서버에 저장하지 못했어요. 입력 내용은 이 화면에 남아 있습니다. 연결과 로그인을 확인하고 다시 시도하세요.',error?.message?.includes('revision_conflict')?'conflict':'unavailable');
export class CloudStore {
  constructor(client){this.client=client;this.user=null;this.snapshot=null;this.pending=null;this.loading=false;this.epoch=0;}
  get active(){return !!this.user;}
  get writable(){return this.active&&!!this.snapshot&&!this.loading;}
  async rpc(name,params){try{return await this.client.rpc(name,params);}catch{throw errorFor(null);}}
  async login(email,password){
    if(this.active)throw new CloudError('먼저 로그아웃하세요.');
    const epoch=++this.epoch;
    const {data,error}=await this.client.auth.signInWithPassword({email,password});
    if(error||!data?.user?.id)throw new CloudError('로그인하지 못했어요. 이메일과 비밀번호 또는 계정 승인을 확인하세요.','auth');
    if(epoch!==this.epoch)throw new CloudError('로그인이 취소됐어요.','cancelled');
    this.user={id:data.user.id,email:data.user.email};
    try{return await this.load();}catch(err){await this.logout();throw err;}
  }
  async load(){
    if(!this.active)throw new CloudError('로그인이 필요합니다.','auth');
    if(this.pending)throw new CloudError('저장 결과가 아직 확인되지 않았어요. 먼저 같은 입력을 다시 저장해 결과를 확인하세요.','pending');
    const epoch=this.epoch;this.loading=true;
    try{
      const {data,error}=await this.rpc('car_care_read');
      if(error)throw errorFor(error);
      if(epoch!==this.epoch)throw new CloudError('계정이 변경됐어요.','cancelled');
      this.snapshot=data?.revision?{revision:data.revision,payload:validate(data.payload),updatedAt:data.updated_at}:null;
      return this.snapshot?structuredClone(this.snapshot):null;
    }finally{if(epoch===this.epoch)this.loading=false;}
  }
  async write(next,{reason='edit',expectedRevision=this.snapshot?.revision??0}={}){
    if(!this.active||this.loading)throw new CloudError('로그인 또는 불러오기가 끝난 뒤 저장하세요.','auth');
    const checked=validate(next),serialized=JSON.stringify(checked),epoch=this.epoch;
    if(this.pending&&this.pending.serialized!==serialized)throw new CloudError('이전 저장 결과가 확인되지 않았어요. 입력을 바꾸지 말고 다시 저장하거나 로그아웃 후 서버 기록을 확인하세요.','pending');
    this.pending??={mutationId:uid(),serialized,payload:checked,expectedRevision,reason};
    const p=this.pending;
    const {data,error}=await this.rpc('car_care_save',{p_payload:p.payload,p_expected_revision:p.expectedRevision,p_mutation_id:p.mutationId,p_reason:p.reason});
    if(epoch!==this.epoch)throw new CloudError('계정이 변경됐어요. 저장 결과는 다시 로그인해 확인하세요.','cancelled');
    if(error){const err=errorFor(error);if(err.code==='conflict')this.pending=null;throw err;}
    const snapshot={revision:data.revision,payload:validate(data.payload),updatedAt:data.updated_at};
    this.pending=null;this.snapshot=snapshot;return structuredClone(snapshot);
  }
  async history(){
    if(!this.active)throw new CloudError('로그인이 필요합니다.','auth');
    const epoch=this.epoch,{data,error}=await this.rpc('car_care_history');
    if(error)throw errorFor(error);
    if(epoch!==this.epoch)throw new CloudError('계정이 변경됐어요.','cancelled');
    return data??[];
  }
  async version(revision){
    if(!this.active)throw new CloudError('로그인이 필요합니다.','auth');
    const epoch=this.epoch,{data,error}=await this.rpc('car_care_version',{p_revision:revision});
    if(error)throw errorFor(error);
    if(epoch!==this.epoch)throw new CloudError('계정이 변경됐어요.','cancelled');
    return {...data,payload:validate(data.payload)};
  }
  async logout(){
    ++this.epoch;this.user=null;this.snapshot=null;this.pending=null;this.loading=false;
    // Memory-only sessions; clear local state even if remote session revocation fails.
    try{const {error}=await this.client.auth.signOut({scope:'local'});return !error;}catch{return false;}
  }
}
