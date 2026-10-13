import {googleDriveConfig} from './google-drive-config.mjs';
import {DRIVE_SCOPE,DriveError,GoogleDriveApi,GoogleDriveStore} from './google-drive.mjs';
export async function createGoogleDriveStore(config=googleDriveConfig){
 if(!config.enabled)return null;
 if(!/^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(config.clientId))throw Error('승인된 사이트 전용 Google OAuth client ID가 필요합니다.');
 if(!globalThis.google?.accounts?.oauth2)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=resolve;script.onerror=()=>reject(new DriveError('Google 연결 화면을 열지 못했어요.'));document.head.append(script);});
 let accessToken=null,expiresAt=0,waiting=null;
 const tokenClient=google.accounts.oauth2.initTokenClient({client_id:config.clientId,scope:DRIVE_SCOPE,include_granted_scopes:false,callback:response=>{const w=waiting;waiting=null;if(!w)return;if(response.error||!response.access_token||!response.scope?.split(' ').includes(DRIVE_SCOPE)){w.reject(new DriveError('앱 파일 접근을 허용하지 않아 연결하지 않았어요.','auth'));return;}accessToken=response.access_token;expiresAt=Date.now()+(Number(response.expires_in)-30)*1000;w.resolve();},error_callback:()=>{const w=waiting;waiting=null;w?.reject(new DriveError('Google 연결을 취소했어요.','auth'));}});
 const auth={connect:()=>new Promise((resolve,reject)=>{if(waiting){reject(new DriveError('Google 연결을 진행 중입니다.'));return;}waiting={resolve,reject};try{tokenClient.requestAccessToken({prompt:'select_account'});}catch{waiting=null;reject(new DriveError('Google 연결 화면을 열지 못했어요.','auth'));}}),token:()=>Date.now()<expiresAt?accessToken:null,clear:()=>{accessToken=null;expiresAt=0;}};
 return new GoogleDriveStore(new GoogleDriveApi(auth),auth);
}
