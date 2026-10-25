import {parseArgs} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {ROUTES,API_PREFIX,type PreparedAction} from '@qippyxiong/trpg-protocol';
import {Client} from './client.js';
import {readPassword} from './password.js';
export const CLI_VERSION='0.2.0';
export const HELP='NightTable TypeScript CLI\n\nnighttable [--server URL] [--session-dir DIR] COMMAND\n\n命令：\n  login USER [--password-stdin]  隐藏密码输入；或从标准输入读取\n  logout | rooms\n  state GAME | join GAME | ready GAME [--cancel] | select GAME ROLE\n  action GAME --check TYPE --text TEXT [--item ID] [--take ID] [--request-id ID]\n  chat GAME --text TEXT\n  history GAME [--before EVENT] | audit GAME\n  export GAME --output FILE [--format md|jsonl]\n  api ROUTE [--body-file JSON]\n\n公网需HTTPS；--server 默认 NIGHTTABLE_URL 或 http://127.0.0.1:8765。\nCookie按origin保存在用户目录，密码不保存。action不会自动重试。\n';
interface IO {stdout:(text:string)=>void;stderr:(text:string)=>void;passwordReader:(stdin:boolean)=>Promise<string>}
const defaultIO:IO={stdout:text=>process.stdout.write(text),stderr:text=>process.stderr.write(text),passwordReader:readPassword};
const definitions={server:{type:'string'},'session-dir':{type:'string'},help:{type:'boolean',short:'h'},version:{type:'boolean',short:'V'},'password-stdin':{type:'boolean'},text:{type:'string'},check:{type:'string'},item:{type:'string',multiple:true},take:{type:'string',multiple:true},'request-id':{type:'string'},cancel:{type:'boolean'},before:{type:'string'},format:{type:'string'},output:{type:'string'},'body-file':{type:'string'}} as const;
const commands:Record<string,{count:number;options:string[]}>={
 login:{count:1,options:['password-stdin']},logout:{count:0,options:[]},rooms:{count:0,options:[]},
 state:{count:1,options:[]},join:{count:1,options:[]},ready:{count:1,options:['cancel']},select:{count:2,options:[]},
 action:{count:1,options:['check','text','item','take','request-id']},chat:{count:1,options:['text']},
 history:{count:1,options:['before']},audit:{count:1,options:[]},export:{count:1,options:['format','output']},api:{count:1,options:['body-file']}
};
const positive=(text:string|undefined,label:string)=>{const n=Number(text);if(!text||!/^\d+$/.test(text)||!Number.isSafeInteger(n)||n<1)throw Error(label+'必须为正整数');return n};
const required=(value:string|undefined,label:string)=>{if(value===undefined||value.length===0)throw Error('缺少 '+label);return value};
const asObject=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value)||Buffer.isBuffer(value))throw Error('服务端状态格式错误');return value as Record<string,unknown>};
export async function run(argv:string[]=process.argv.slice(2),customIO:Partial<IO>={}):Promise<number> {
 const io={...defaultIO,...customIO};
 try {
  const {values:v,positionals:args}=parseArgs({args:argv,options:definitions,allowPositionals:true,strict:true});
  if(v.help||args[0]==='help'){io.stdout(HELP);return 0}
  if(v.version){io.stdout(CLI_VERSION+'\n');return 0}
  const command=args.shift();const rule=command?commands[command]:undefined;
  if(!command||!rule)throw Error('未知或缺少命令；运行 nighttable --help');
  if(args.length!==rule.count)throw Error(command+' 的位置参数数量错误；运行 nighttable --help');
  for(const key of Object.keys(v))if(!['server','session-dir','help','version',...rule.options].includes(key))throw Error(command+' 不接受 --'+key);
  const client=await Client.create(v.server??process.env.NIGHTTABLE_URL??'http://127.0.0.1:8765',v['session-dir']);
  let route:string;let body:Record<string,unknown>|undefined;
  if(command==='login'){route=ROUTES.login.path;body={username:required(args[0],'username'),password:await io.passwordReader(v['password-stdin']??false)}}
  else if(command==='logout'){route=ROUTES.logout.path;body={}}
  else if(command==='rooms')route=ROUTES.games.path;
  else if(command==='api'){
   route=API_PREFIX+args[0]!.replace(/^\/+/,'');
   if(v['body-file']){
    let data:unknown;try{data=JSON.parse(await readFile(v['body-file'],'utf8'))}catch{throw Error('无法读取有效的 JSON 请求文件')}
    body=asObject(data);
   }
  }else{
   const gid=positive(args[0],'房间号');const query=new URLSearchParams({game_id:String(gid)});
   if(command==='state')route=ROUTES.state.path+'?'+query;
   else if(command==='history'){if(v.before)query.set('before',String(positive(v.before,'事件号')));route=ROUTES.history.path+'?'+query}
   else if(command==='audit')route=ROUTES['random/audit'].path+'?'+query;
   else if(command==='export'){
    const format=v.format??'md';if(!['md','jsonl'].includes(format))throw Error('导出格式仅支持 md/jsonl');
    required(v.output,'--output');query.set('format',format);route=ROUTES.export.path+'?'+query;
   }else{
    const id=v['request-id']??randomUUID();body={game_id:gid,request_id:id};
    if(command==='join')route=ROUTES['game/join'].path;
    else if(command==='ready'){route=ROUTES['game/ready'].path;body.ready=!v.cancel}
    else if(command==='select'){route=ROUTES['role/select'].path;body.role_id=required(args[1],'role_id')}
    else{
     route=ROUTES.message.path;body.kind=command;body.text=required(v.text,'--text');
     if(command==='action'){
      required(v.check,'--check');required(id,'--request-id');
      const state=asObject(await client.request(ROUTES.state.path+'?'+query));
      if(!state.user)throw Error('请先登录');
      const round=asObject(state.round);
      const action:PreparedAction={game_id:gid,round_no:positive(String(round.number),'轮号'),kind:'action',text:body.text as string,check_id:v.check!,request_id:id,item_ids:v.item??[],take_item_ids:v.take??[]};
      body={...action};io.stderr('request_id='+id+'\n');
     }
    }
   }
  }
  const result=await client.request(route,body);
  if(command==='export'){
   if(!Buffer.isBuffer(result))throw Error('导出响应格式错误');
   await writeFile(v.output!,result,{flag:'wx'});io.stdout('已保存：'+v.output+'\n');
  }else io.stdout(Buffer.isBuffer(result)?result.toString('utf8'):JSON.stringify(result,null,2)+'\n');
  return 0;
 }catch(error){io.stderr((error instanceof Error?error.message:'请求失败')+'\n');return 1}
}
