import {spawnSync} from 'node:child_process';
import {readFile,readdir,stat,cp,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join,dirname,relative,isAbsolute} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),destination=join(root,'work','local-emulator-data');
const firebase=process.env.APPDATA?join(process.env.APPDATA,'npm','node_modules','firebase-tools','lib','bin','firebase.js'):'';
if(!firebase)throw Error('Firebase CLI is required.');
const hub=await fetch('http://127.0.0.1:4400/emulators').then(r=>r.json());
if(hub.auth?.host!=='127.0.0.1'||hub.firestore?.host!=='127.0.0.1')throw Error('Local Auth and Firestore emulators must be running.');
const started=Date.now();
const output=spawnSync(process.execPath,[firebase,'emulators:export',destination,'--project','demo-gilju-trip','--force'],{
  cwd:root,encoding:'utf8',env:{...process.env,XDG_CONFIG_HOME:join(dirname(root.replace(/[\\/]$/,'')),'work','firebase-emulator-cli')}
});
if(output.status!==0){
  // Some Windows sandboxes reject the CLI's final directory rename even though the
  // export completed. Copy that newly generated local export without deleting data.
  const candidates=[];
  for(const entry of await readdir(root,{withFileTypes:true}))if(entry.isDirectory()&&/^firebase-export-[A-Za-z0-9-]+$/.test(entry.name)){
    const path=resolve(root,entry.name),rel=relative(root,path);
    if(rel.startsWith('..')||isAbsolute(rel))throw Error('Export path must stay inside the app workspace.');
    const info=await stat(path);if(info.mtimeMs<started-2000)continue;
    try{const metadata=JSON.parse(await readFile(join(path,'firebase-export-metadata.json'),'utf8'));if(metadata.auth&&metadata.firestore)candidates.push({path,modified:info.mtimeMs});}catch{}
  }
  candidates.sort((a,b)=>b.modified-a.modified);
  if(!candidates[0])throw Error('Local backup did not complete. Keep the emulators running and retry.');
  await mkdir(destination,{recursive:true});await cp(candidates[0].path,destination,{recursive:true,force:true});
}
const metadata=JSON.parse(await readFile(join(destination,'firebase-export-metadata.json'),'utf8'));
if(!metadata.auth||!metadata.firestore)throw Error('Incomplete local backup.');
console.log('Local Auth and Firestore backup saved to ignored work/local-emulator-data. No production services were accessed.');
