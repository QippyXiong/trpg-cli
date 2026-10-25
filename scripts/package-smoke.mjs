// Offline installation proves the published tarball includes its runtime contract.
import {mkdtemp,readdir,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const npm=process.env.npm_execpath;
if(!npm)throw Error('Run this via npm run test:package');
const dir=await mkdtemp(join(tmpdir(),'trpg-ts-package-'));
function command(executable,args,cwd=dir){
 const r=spawnSync(executable,args,{cwd,encoding:'utf8'});
 if(r.error||r.status!==0)throw Error(r.error?.message||r.stderr||r.stdout);
 return r.stdout;
}
try {
 command(process.execPath,[npm,'pack','--pack-destination',dir],process.cwd());
 const file=(await readdir(dir)).find(f=>f.endsWith('.tgz'));if(!file)throw Error('No npm artifact');
 const prefix=join(dir,'installed');
 command(process.execPath,[npm,'install','--global','--prefix',prefix,'--offline','--ignore-scripts','--no-audit','--no-fund','--cache',join(dir,'cache'),join(dir,file)]);
 const installed=join(prefix,process.platform==='win32'?'node_modules':'lib/node_modules','trpg-cli');
 const contract=JSON.parse(await readFile(join(installed,'node_modules/@qippyxiong/trpg-protocol/package.json'),'utf8'));
 if(contract.version!=='0.1.1'||contract.license!=='MIT')throw Error('Missing bundled contract');
 const entry=join(installed,'dist/cli.js');const help=command(process.execPath,[entry,'--help']);
 if(!help.includes('action')||!help.includes('login'))throw Error('Installed help incomplete');
 const bin=join(prefix,process.platform==='win32'?'nighttable.cmd':'bin/nighttable');await access(bin);
 const output=process.platform==='win32'
  ?command(process.env.ComSpec||'cmd.exe',['/d','/s','/c','nighttable.cmd --version'],prefix)
  :command(bin,['--version']);
 if(output.trim()!=='0.2.0')throw Error('Installed launcher failed: '+output);
 console.log('PASS: packed CLI installs offline with bundled protocol and runs outside the source tree');
}finally{await rm(dir,{recursive:true,force:true})}
