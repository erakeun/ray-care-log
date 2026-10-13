import {sharedConfig} from '../shared-config.mjs';
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {cloudConfig} from '../cloud-config.mjs';
import {googleDriveConfig} from '../google-drive-config.mjs';
const assets=['shared.mjs','shared-ledger-client.mjs','shared-config.mjs','append-log.mjs','shared-sheet-client.mjs','shared-sheet-config.mjs','index.html','style.css','app.mjs','core.mjs','references.mjs','icon.svg','.nojekyll','cloud.mjs','cloud-client.mjs','cloud-config.mjs','vehicle-profile.mjs','google-drive.mjs','google-drive-client.mjs','google-drive-config.mjs','privacy.html'];
await mkdir('public/vendor',{recursive:true});
for(const asset of assets)await copyFile(asset,'public/'+asset);
await copyFile('vendor/supabase.mjs','public/vendor/supabase.mjs');
if(cloudConfig.enabled&&googleDriveConfig.enabled)throw Error('Only one approved storage provider may be active');
if(googleDriveConfig.enabled){
 if(!/^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(googleDriveConfig.clientId))throw Error('Approved Google OAuth web client ID required');
 const html=await readFile('public/index.html','utf8');
 const csp=html.replace("script-src 'self'","script-src 'self' https://accounts.google.com/gsi/client").replace("style-src 'self'","style-src 'self' https://accounts.google.com/gsi/style").replace("connect-src 'none'","connect-src https://www.googleapis.com https://accounts.google.com/gsi/; frame-src https://accounts.google.com/gsi/");
 if(csp===html||!html.includes("connect-src 'none'"))throw Error('Expected restrictive default CSP');
 await writeFile('public/index.html',csp);
}
if(cloudConfig.enabled){
 const u=new URL(cloudConfig.url);
 if(u.protocol!=='https:'||!/^[-a-z0-9]+\.supabase\.co$/.test(u.hostname)||u.pathname!=='/'||u.search||u.hash||u.port||u.username||u.password||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(cloudConfig.publishableKey))throw Error('Approved Supabase origin and publishable key required');
 const html=await readFile('public/index.html','utf8');
 if(!html.includes("connect-src 'none'"))throw Error('Expected restrictive default CSP');
 await writeFile('public/index.html',html.replace("connect-src 'none'",'connect-src '+u.origin));
}

if(sharedConfig.enabled){if(cloudConfig.enabled||googleDriveConfig.enabled)throw Error('Shared ledger cannot mix with account storage');const u=new URL(sharedConfig.endpoint);if(u.protocol!=='https:'||u.hostname!=='script.google.com'||!/^\/macros\/s\/[_a-zA-Z0-9-]+\/exec$/.test(u.pathname)||u.search||u.hash||u.port||u.username||u.password)throw Error('Verified Apps Script exec URL required');const html=await readFile('public/index.html','utf8');await writeFile('public/index.html',html.replace("connect-src 'none'", "connect-src 'none'; frame-src https://script.google.com https://*.googleusercontent.com"));}
