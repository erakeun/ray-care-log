import {sharedSheetAdapter} from './shared-sheet-config.mjs';
import {createSharedSheetStore} from './shared-sheet-client.mjs';
import {cloudConfig} from './cloud-config.mjs';
import {googleDriveConfig} from './google-drive-config.mjs';
import {CloudStore} from './cloud.mjs';
export async function createCloudStore(config=cloudConfig){
 if(sharedSheetAdapter){if(config.enabled||googleDriveConfig.enabled)throw Error('저장 서비스는 하나만 활성화하세요.');return createSharedSheetStore(sharedSheetAdapter);}
  if(googleDriveConfig.enabled){if(config.enabled)throw Error('저장 서비스는 하나만 활성화하세요.');const {createGoogleDriveStore}=await import('./google-drive-client.mjs');return createGoogleDriveStore();}
  if(!config.enabled)return null;
  const url=new URL(config.url);
  if(url.protocol!=='https:'||!/^[-a-z0-9]+\.supabase\.co$/.test(url.hostname)||url.pathname!=='/'||url.search||url.hash||url.username||url.password||url.port)throw Error('승인된 서버 주소 설정을 확인하세요.');
  if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey))throw Error('공개용 publishable key만 설정할 수 있습니다.');
  const {createClient}=await import('./vendor/supabase.mjs');
  const timedFetch=async(input,init={})=>{const controller=new AbortController(),abort=()=>controller.abort();if(init.signal?.aborted)abort();else init.signal?.addEventListener('abort',abort,{once:true});const timeout=setTimeout(abort,15000);try{return await fetch(input,{...init,signal:controller.signal});}finally{clearTimeout(timeout);init.signal?.removeEventListener('abort',abort);}};
  return new CloudStore(createClient(url.origin,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:true,detectSessionInUrl:false},global:{fetch:timedFetch}}));
}
