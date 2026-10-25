// Consumer build integration, not part of the contract package.
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),check=process.argv.includes('--check');
const raw=await readFile(require.resolve('@qippyxiong/trpg-protocol/contract.json'),'utf8');
const contract=JSON.parse(raw);
if(!contract.version.startsWith('0.1.'))throw Error('Unsupported protocol version');
const target="nighttable_cli/protocol.json";
const content=false?'// Generated transport contract; no business logic.\nglobalThis.TRPGProtocol='+JSON.stringify(contract)+';\n':raw;
const lock=JSON.stringify({package:'@qippyxiong/trpg-protocol',version:contract.version,sha256:createHash('sha256').update(raw).digest('hex')},null,2)+'\n';
for(const [file,data] of [[resolve(target),content],[resolve('protocol.lock.json'),lock]]){
 if(check){let value;try{value=await readFile(file,'utf8')}catch{}if(value!==data){console.error('Out of sync: '+file);process.exitCode=1}}
 else{await mkdir(dirname(file),{recursive:true});await writeFile(file,data)}
}
if(!process.exitCode)console.log((check?'Verified':'Synced')+' @qippyxiong/trpg-protocol '+contract.version);
