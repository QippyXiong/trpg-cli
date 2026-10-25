import {createInterface} from 'node:readline';
import {Writable} from 'node:stream';
export async function readPassword(fromStdin=false):Promise<string> {
  if(fromStdin){
    if(process.stdin.isTTY)throw Error('--password-stdin 仅用于管道；交互登录请省略该选项');
    const chunks:Buffer[]=[];let size=0;for await(const chunk of process.stdin){const part=Buffer.from(chunk);size+=part.length;if(size>4096)throw Error('密码输入过长');chunks.push(part)}
    return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/,'');
  }
  if(!process.stdin.isTTY)throw Error('登录需交互式终端；自动化请使用 --password-stdin，勿把密码写入参数');
  process.stderr.write('密码：');
  const muted=new Writable({write(_chunk,_encoding,done){done()}});
  const rl=createInterface({input:process.stdin,output:muted,terminal:true,historySize:0});
  return new Promise((resolve,reject)=>{
    let finished=false;
    const finish=(value?:string)=>{
      if(finished)return;finished=true;rl.close();muted.end();process.stderr.write('\n');
      value===undefined?reject(Error('已取消密码输入')):resolve(value);
    };
    rl.once('SIGINT',()=>finish());rl.once('close',()=>{if(!finished)finish()});
    rl.question('',value=>finish(value));
  });
}
