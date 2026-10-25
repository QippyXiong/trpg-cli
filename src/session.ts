import {mkdir, chmod, readFile, writeFile, rename, unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {createHash, randomUUID} from 'node:crypto';

export interface SessionCookie {value:string; expiresAt:number|null; secure:boolean; path:string}
interface SavedSession {version:1; origin:string; cookie:SessionCookie|null}
function code(error:unknown):string|undefined {return (error as NodeJS.ErrnoException)?.code}
export function defaultSessionDir():string {return join(homedir(),'.local','share','trpg-cli')}

export class SessionStore {
  cookie:SessionCookie|null=null;
  readonly file:string;
  private constructor(readonly origin:string, readonly directory:string) {
    this.file=join(directory,createHash('sha256').update(origin).digest('hex')+'.session.json');
  }
  static async open(origin:string,directory=defaultSessionDir(),legacyOrigin=origin):Promise<SessionStore> {
    await mkdir(directory,{recursive:true,mode:0o700});
    if(process.platform!=='win32')await chmod(directory,0o700);
    const store=new SessionStore(origin,directory);
    try {
      if(process.platform!=='win32')await chmod(store.file,0o600);
      const raw=await readFile(store.file,'utf8');
      let data:SavedSession;
      try {data=JSON.parse(raw)}catch {throw Error('会话文件格式错误，请移走损坏文件后重新登录')}
      if(data.version!==1||data.origin!==origin)throw Error('会话文件与服务器不匹配');
      const c=data.cookie;
      if(c!==null && (!c || typeof c.value!=='string' || /[\r\n;]/.test(c.value) || typeof c.secure!=='boolean' || typeof c.path!=='string' || !c.path.startsWith('/') || (c.expiresAt!==null && (typeof c.expiresAt!=='number'||!Number.isFinite(c.expiresAt)))))throw Error('会话文件格式错误');
      store.cookie=c;
    } catch(error) {
      if(code(error)!=='ENOENT')throw error;
      await store.importLegacy(legacyOrigin);
    }
    return store;
  }
  private async importLegacy(legacyOrigin:string):Promise<void> {
    for(const origin of new Set([this.origin,legacyOrigin])) {
      const file=join(this.directory,createHash('sha256').update(origin).digest('hex')+'.cookies');
      let raw:string;
      try {raw=await readFile(file,'utf8')}catch(error){if(code(error)==='ENOENT')continue;throw error}
      const host=new URL(this.origin).hostname.replace(/^\[|\]$/g,'');
      for(const line of raw.split(/\r?\n/)) {
        const match=/^Set-Cookie3:\s*trpg_session=("[^"]*"|[^;]*)(.*)$/.exec(line);
        if(!match)continue;
        const attrs=match[2]!;
        const attr=(name:string)=>new RegExp('(?:^|;)\\s*'+name+'=(?:"([^"]*)"|([^;]*))','i').exec(attrs);
        const domain=attr('domain');const value=domain?.[1]??domain?.[2];
        if(!value||![host,host+'.local'].includes(value.replace(/^\./,'')))continue;
        const expiration=attr('expires');const date=expiration?.[1]??expiration?.[2];
        const expiresAt=date?Date.parse(date.replace(' ','T')):null;
        if(expiresAt!==null&&!Number.isFinite(expiresAt))continue;
        const p=attr('path');const path=p?.[1]??p?.[2]??'/';
        const cookieValue=match[1]!.replace(/^"|"$/g,'');
        if(/[\r\n;]/.test(cookieValue))continue;
        this.cookie={value:cookieValue,expiresAt,secure:/(?:^|;)\s*secure(?:;|$)/i.test(attrs),path};
        await this.save();return;
      }
    }
  }
  header(url:URL):string|undefined {
    if(url.origin!==this.origin)return;
    const c=this.cookie;
    if(!c)return;
    if(c.expiresAt!==null&&c.expiresAt<=Date.now()){this.cookie=null;return}
    if(c.secure&&url.protocol!=='https:')return;
    if(!url.pathname.startsWith(c.path)||(c.path!=='/'&&!c.path.endsWith('/')&&url.pathname.length>c.path.length&&url.pathname[c.path.length]!=='/'))return;
    return 'trpg_session='+c.value;
  }
  accept(headers:Headers):void {
    for(const line of headers.getSetCookie()) {
      const parts=line.split(';').map(x=>x.trim());const first=parts.shift()!;
      if(!first.startsWith('trpg_session='))continue;
      const value=first.slice('trpg_session='.length);
      if(/[\r\n;]/.test(value))continue;
      const attrs=new Map(parts.map(p=>{const i=p.indexOf('=');return i<0?[p.toLowerCase(),'']:[p.slice(0,i).toLowerCase(),p.slice(i+1)]}));
      const domain=attrs.get('domain')?.replace(/^\./,'').toLowerCase();
      if(domain&&domain!==new URL(this.origin).hostname.toLowerCase())continue;
      let expiresAt:number|null=null;
      const maxAge=attrs.get('max-age');
      if(maxAge!==undefined&&/^-?\d+$/.test(maxAge))expiresAt=Date.now()+Number(maxAge)*1000;
      else if(attrs.has('expires')){const parsed=Date.parse(attrs.get('expires')!);if(Number.isFinite(parsed))expiresAt=parsed}
      const path=attrs.get('path')??'/';
      this.cookie=!value||(expiresAt!==null&&expiresAt<=Date.now())?null:{value,expiresAt,secure:attrs.has('secure'),path:path.startsWith('/')?path:'/'};
    }
  }
  async save():Promise<void> {
    const temp=this.file+'.tmp-'+randomUUID();
    try {
      await writeFile(temp,JSON.stringify({version:1,origin:this.origin,cookie:this.cookie} satisfies SavedSession)+'\n',{flag:'wx',mode:0o600});
      await rename(temp,this.file);
    } finally {
      try {await unlink(temp)}catch(error){if(code(error)!=='ENOENT')throw error}
    }
  }
}
