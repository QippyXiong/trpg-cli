import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import {mkdtemp,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {Client,run} from '../dist/index.js';
import {ROUTES} from '@qippyxiong/trpg-protocol';

test('optional real Python API: login, rooms, role, action, duplicate, export, logout',{
 skip:process.env.TRPG_SERVER_DIR?false:'可选跨仓库测试：设置 TRPG_SERVER_DIR 后启用；独立测试仅需 Node'
},async()=>{
 const backend=resolve(process.env.TRPG_SERVER_DIR);await access(join(backend,'server.py'));
 const dir=await mkdtemp(join(tmpdir(),'trpg-node-real-api-'));
 const fixturePassword='node-integration-fixture-only';
 const script=[
  'import server,json',
  'server.initialize()',
  "server.create_user('host','主持人','dm','node-integration-fixture-only')",
  "server.create_user('player','玩家','player','node-integration-fixture-only')",
  "s=server.RoomServer(('127.0.0.1',0),server.Handler)",
  "print(json.dumps({'url':'http://127.0.0.1:'+str(s.server_port)}),flush=True)",
  's.serve_forever()'
 ].join('\n');
 const child=spawn(process.env.TRPG_PYTHON||'python3',['-u','-c',script],{cwd:backend,env:{...process.env,TRPG_DATA_DIR:join(dir,'db'),TRPG_CONFIG:join(backend,'config.json')},stdio:['ignore','pipe','pipe']});
 let stderr='';child.stderr.setEncoding('utf8').on('data',s=>{stderr+=s});
 const lines=createInterface({input:child.stdout});
 try {
  const ready=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('API startup timed out')),10000);
   lines.once('line',line=>{clearTimeout(timer);resolve(line)});
   child.once('error',error=>{clearTimeout(timer);reject(error)});
   child.once('exit',()=>{clearTimeout(timer);reject(Error('API exited: '+stderr.slice(-300)))});
  });
  const {url}=JSON.parse(ready);const sessions=join(dir,'player-session');
  const host=await Client.create(url,join(dir,'host-session'));await host.request(ROUTES.login.path,{username:'host',password:fixturePassword});
  const {game_id:gid}=await host.request(ROUTES['game/create'].path,{title:'TypeScript CLI 独立联调'});
  async function command(args){let out='',err='';const code=await run(['--server',url,'--session-dir',sessions,...args],{stdout:t=>{out+=t},stderr:t=>{err+=t},passwordReader:async()=>fixturePassword});return {code,out,err}}
  for(const args of [['login','player'],['rooms'],['select',String(gid),'engineer'],['join',String(gid)],['ready',String(gid)]]){const r=await command(args);assert.equal(r.code,0,r.err)}
  await host.request(ROUTES['game/launch'].path,{game_id:gid});
  const args=['action',String(gid),'--check','explore','--text','【Node联调】检查门框','--request-id','node-action'];
  let result=await command(args);assert.equal(result.code,0,result.err);
  result=await command(args);assert.equal(result.code,0,result.err);assert.equal(JSON.parse(result.out).duplicate,true);
  result=await command([...args.slice(0,-1),'new-action']);assert.equal(result.code,1);assert.match(result.err,/409/);
  const output=join(dir,'game.md');result=await command(['export',String(gid),'--output',output]);assert.equal(result.code,0,result.err);assert.match(await readFile(output,'utf8'),/Node联调/);
  result=await command(['logout']);assert.equal(result.code,0,result.err);
  result=await command(['rooms']);assert.equal(result.code,1);assert.match(result.err,/401/);
 }finally{
  lines.close();
  if(child.exitCode===null&&child.signalCode===null){child.kill();await once(child,'exit')}
  await rm(dir,{recursive:true,force:true});
 }
});
