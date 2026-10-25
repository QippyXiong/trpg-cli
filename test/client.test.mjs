import {test,before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,readFile,writeFile,rm,mkdir,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';
import {Client,HttpError} from '../dist/client.js';
import {run} from '../dist/commands.js';

let server,trap,url,trapUrl,calls,trapHits,dir,sessions,client;
const password='fixture-密码';
function send(res,status,data,headers={}) {
 const raw=Buffer.isBuffer(data)?data:Buffer.from(JSON.stringify(data));
 res.writeHead(status,{'Content-Type':Buffer.isBuffer(data)?'text/plain; charset=utf-8':'application/json','Content-Length':raw.length,...headers});res.end(raw);
}
before(async()=>{
 calls=[];trapHits=0;
 trap=createServer((_req,res)=>{trapHits++;send(res,200,{unexpected:true})});trap.listen(0,'127.0.0.1');await once(trap,'listening');trapUrl='http://127.0.0.1:'+trap.address().port;
 server=createServer(async(req,res)=>{
  const buffers=[];for await(const part of req)buffers.push(part);
  const raw=Buffer.concat(buffers).toString();const body=raw?JSON.parse(raw):undefined;
  calls.push({method:req.method,url:req.url,body,cookie:req.headers.cookie});
  const route=new URL(req.url,'http://fixture').pathname;
  if(route==='/api/login'){
   if(body?.password!==password)return send(res,401,{error:'账号或密码不正确'});
   return send(res,200,{ok:true},{'Set-Cookie':'trpg_session=fixture-session; HttpOnly; Path=/; Max-Age=3600'});
  }
  if(route==='/api/redirect')return send(res,302,{}, {Location:trapUrl+'/api/trap'});
  if(route==='/api/conflict')return send(res,409,{error:'本轮已提交决策'});
  if(route==='/api/slow'){const timer=setTimeout(()=>send(res,200,{ok:true}),500);res.once('close',()=>clearTimeout(timer));return}
  if(req.headers.cookie!=='trpg_session=fixture-session')return send(res,401,{error:'请先登录'});
  if(route==='/api/state')return send(res,200,{user:{username:'tester'},round:{number:7}});
  if(route==='/api/export')return send(res,200,Buffer.from('独立导出\n'));
  if(route==='/api/logout')return send(res,200,{ok:true},{'Set-Cookie':'trpg_session=; Path=/; Max-Age=0'});
  if(route==='/api/secure')return send(res,200,{ok:true},{'Set-Cookie':'trpg_session=fixture-session; Path=/; Secure'});
  return send(res,200,req.method==='GET'?{games:[]}:{ok:true});
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');url='http://127.0.0.1:'+server.address().port;
});
after(async()=>{for(const s of [server,trap]){s.closeAllConnections();await new Promise(done=>s.close(done))}});
beforeEach(async()=>{dir=await mkdtemp(join(tmpdir(),'trpg-ts-test-'));sessions=join(dir,'sessions');client=await Client.create(url,sessions);calls.length=0;trapHits=0});
afterEach(async()=>{await rm(dir,{recursive:true,force:true})});
const login=()=>client.request('/api/login',{username:'tester',password});
async function command(args) {let out='',err='';const code=await run(['--server',url,'--session-dir',sessions,...args],{stdout:t=>{out+=t},stderr:t=>{err+=t},passwordReader:async()=>password});return {code,out,err}}

test('session persists across client instances, with POSIX modes when available',async()=>{
 await login();const restored=await Client.create(url,sessions);
 assert.equal((await restored.request('/api/state')).user.username,'tester');assert.equal(calls.filter(c=>c.url==='/api/login').length,1);
 if(process.platform!=='win32'){assert.equal((await stat(sessions)).mode&0o777,0o700);assert.equal((await stat(restored.sessionFile)).mode&0o777,0o600)}
 assert.ok(!(await readFile(restored.sessionFile,'utf8')).includes(password));
});
test('pre-created directory and existing session are reusable',async()=>{
 const path=join(dir,'powershell-style');await mkdir(path);
 const first=await Client.create(url,path);await first.save();await Client.create(url,path);
});
test('different origins do not share sessions',async()=>{
 await login();const other=await Client.create(url.replace('127.0.0.1','localhost'),sessions);
 assert.notEqual(client.sessionFile,other.sessionFile);assert.equal(other.sessions.cookie,null);
 assert.equal(client.sessions.header(new URL(trapUrl+'/api/state')),undefined);
});
test('foreign-origin or corrupted session files fail without leaking their content',async()=>{
 await writeFile(client.sessionFile,'not-json sensitive-session-marker');
 await assert.rejects(()=>Client.create(url,sessions),e=>!e.message.includes('sensitive-session-marker')&&/会话/.test(e.message));
 await writeFile(client.sessionFile,JSON.stringify({version:1,origin:trapUrl,cookie:null}));
 await assert.rejects(()=>Client.create(url,sessions),/不匹配/);
});
test('imports a matching Python LWP session without asking for the password',async()=>{
 const legacyDir=join(dir,'legacy');await mkdir(legacyDir);
 const name=createHash('sha256').update(url).digest('hex')+'.cookies';
 await writeFile(join(legacyDir,name),'#LWP-Cookies-2.0\nSet-Cookie3: trpg_session=fixture-session; path="/"; domain="127.0.0.1"; path_spec; expires="2099-01-01 00:00:00Z"; HttpOnly=None; version=0\n');
 const migrated=await Client.create(url,legacyDir);assert.equal((await migrated.request('/api/state')).user.username,'tester');
 assert.equal(calls.some(c=>c.url==='/api/login'),false);
});
test('expired cookies are not sent',async()=>{
 await login();client.sessions.cookie.expiresAt=Date.now()-1;
 await assert.rejects(()=>client.request('/api/state'),e=>e instanceof HttpError&&e.status===401);
 assert.equal(calls.at(-1).cookie,undefined);
});
test('secure cookies are never sent over plain HTTP',async()=>{
 await login();await client.request('/api/secure');
 await assert.rejects(()=>client.request('/api/state'),e=>e.status===401);
 assert.equal(calls.at(-1).cookie,undefined);
});
test('logout clears persisted session',async()=>{
 await login();await client.request('/api/logout');const restored=await Client.create(url,sessions);
 await assert.rejects(()=>restored.request('/api/state'),e=>e.status===401);
});
test('redirect is refused and cannot forward the session to a second origin',async()=>{
 await login();await assert.rejects(()=>client.request('/api/redirect'),e=>e.status===302);
 assert.equal(trapHits,0);
});
test('HTTP errors preserve status and do not retry writes',async()=>{
 await assert.rejects(()=>client.request('/api/conflict',{text:'fixture'}),e=>e.status===409&&/本轮/.test(e.message));
 assert.equal(calls.length,1);
});
test('timeouts abort one request without retry',async()=>{
 const short=await Client.create(url,sessions,150);
 await assert.rejects(()=>short.request('/api/slow'),/超时/);assert.equal(calls.length,1);
});
test('invalid server origins and API traversal are rejected',async()=>{
 for(const bad of ['http://example.com','https://user:pass@example.com','https://example.com/path','https://example.com/?x=1'])await assert.rejects(()=>Client.create(bad,sessions));
 for(const bad of ['https://example.com/api/state','//example.com/api/state','/api/../outside','/api\\state'])await assert.rejects(()=>client.request(bad));
 assert.equal(calls.length,0);
});
test('login, rooms, role, readiness and action retain their CLI interface',async()=>{
 let result=await command(['login','tester']);assert.equal(result.code,0,result.err);assert.ok(!(result.out+result.err).includes(password));
 for(const args of [['rooms'],['select','9','engineer'],['join','9'],['ready','9'],['ready','9','--cancel']]){
  result=await command(args);assert.equal(result.code,0,result.err);
 }
 result=await command(['action','9','--check','explore','--text','观察门框','--item','rope','--take','note','--request-id','fixed-request']);
 assert.equal(result.code,0,result.err);assert.match(result.err,/fixed-request/);
 assert.deepEqual(calls.at(-1).body,{game_id:9,round_no:7,kind:'action',text:'观察门框',check_id:'explore',request_id:'fixed-request',item_ids:['rope'],take_item_ids:['note']});
 assert.equal(calls.filter(c=>c.url==='/api/login').length,1);
});
test('history, audit, chat and generic JSON API routes work',async()=>{
 await login();
 for(const args of [['history','9','--before','12'],['audit','9'],['chat','9','--text','你好'],['api','games']]){
  const result=await command(args);assert.equal(result.code,0,result.err);
 }
 const file=join(dir,'request.json');await writeFile(file,JSON.stringify({game_id:9,ready:false}));
 const result=await command(['api','game/ready','--body-file',file]);assert.equal(result.code,0,result.err);assert.equal(calls.at(-1).body.ready,false);
});
test('export preserves bytes and never overwrites an existing file',async()=>{
 await login();const output=join(dir,'game.md');let result=await command(['export','9','--output',output]);assert.equal(result.code,0,result.err);assert.equal(await readFile(output,'utf8'),'独立导出\n');
 await writeFile(output,'keep');result=await command(['export','9','--output',output]);assert.equal(result.code,1);assert.equal(await readFile(output,'utf8'),'keep');
});
test('invalid CLI options fail without sending a request or echoing a password',async()=>{
 for(const args of [['action','9','--text','x'],['ready','9','--text','x'],['state','0'],['login','tester','--password=private-marker']]){
  const result=await command(args);assert.notEqual(result.code,0);assert.ok(!(result.out+result.err).includes('private-marker'));
 }
 assert.equal(calls.length,0);
});
test('NIGHTTABLE_URL selects server when no explicit --server is supplied',async()=>{
 await login();const previous=process.env.NIGHTTABLE_URL;process.env.NIGHTTABLE_URL=url;
 try {let out='';const code=await run(['--session-dir',sessions,'rooms'],{stdout:t=>{out+=t},stderr:()=>{}});assert.equal(code,0);assert.equal(JSON.parse(out).games.length,0)}
 finally {if(previous===undefined)delete process.env.NIGHTTABLE_URL;else process.env.NIGHTTABLE_URL=previous}
});
test('real executable accepts a password via stdin, not command-line plaintext',async()=>{
 const child=spawn(process.execPath,[resolve('dist/cli.js'),'--server',url,'--session-dir',sessions,'login','tester','--password-stdin'],{stdio:['pipe','pipe','pipe']});
 let out='',err='';child.stdout.setEncoding('utf8').on('data',s=>{out+=s});child.stderr.setEncoding('utf8').on('data',s=>{err+=s});
 const ended=once(child,'exit');const raw=Buffer.from(password+'\n');child.stdin.write(raw.subarray(0,9));await pause(20);child.stdin.end(raw.subarray(9));
 const [exit]=await ended;assert.equal(exit,0,err);assert.equal(JSON.parse(out).ok,true);assert.ok(!(out+err).includes(password));
});
