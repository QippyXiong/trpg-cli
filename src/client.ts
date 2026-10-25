import {API_PREFIX} from '@qippyxiong/trpg-protocol';
import {SessionStore} from './session.js';

export class HttpError extends Error {
  constructor(readonly status:number,message:string){super('HTTP '+status+'：'+message)}
}
export class Client {
  private constructor(readonly origin:string,readonly sessions:SessionStore,readonly timeoutMs:number){}
  static async create(server:string,sessionDir?:string,timeoutMs=20_000):Promise<Client> {
    let url:URL;
    try {url=new URL(server)}catch {throw Error('服务器必须是 HTTP(S) origin')}
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('服务器必须是无账号、无路径的 HTTP(S) origin');
    if(url.protocol==='http:'&&!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('公网服务器必须使用 HTTPS');
    return new Client(url.origin,await SessionStore.open(url.origin,sessionDir,server.replace(/\/+$/,'')),timeoutMs);
  }
  get sessionFile():string {return this.sessions.file}
  async save():Promise<void>{await this.sessions.save()}
  async request(route:string,body?:Record<string,unknown>):Promise<unknown> {
    const url=new URL(route,this.origin);
    if(!route.startsWith(API_PREFIX)||route.includes('\\')||url.origin!==this.origin||!url.pathname.startsWith(API_PREFIX)||url.hash)throw Error('仅允许本服务器的 API 路径');
    const headers=new Headers();
    if(body!==undefined)headers.set('Content-Type','application/json');
    const cookie=this.sessions.header(url);if(cookie)headers.set('Cookie',cookie);
    let response:Response;let raw:Buffer;
    try {
      response=await fetch(url,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(this.timeoutMs)});
      raw=Buffer.from(await response.arrayBuffer());
    } catch(error) {
      if((error as Error)?.name==='TimeoutError'||(error as Error)?.name==='AbortError')throw Error('连接超时；写操作不会自动重试，请先查状态');
      throw Error('网络连接失败，请检查服务器地址、网络与证书配置');
    }
    this.sessions.accept(response.headers);await this.sessions.save();
    let data:unknown=raw;
    if(response.headers.get('content-type')?.includes('application/json')){
      try {data=JSON.parse(raw.toString('utf8'))}catch {throw Error('服务端返回了无效 JSON')}
    }
    if(!response.ok){
      const message=data&&typeof data==='object'&&'error' in data&&typeof data.error==='string'?data.error:'请求失败';
      throw new HttpError(response.status,message);
    }
    return data;
  }
}
