"""Standard-library HTTP client with private, per-origin cookie persistence."""
import argparse
import getpass
import hashlib
import http.cookiejar
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None

class Client:
 def __init__(self,url,session_dir=None):
  u=urllib.parse.urlsplit(url)
  if u.scheme not in ('http','https') or not u.hostname or u.username or u.password or u.query or u.fragment or u.path not in ('','/'):
   raise ValueError('服务器必须是无账号、无路径的 HTTP(S) origin')
  if u.scheme=='http' and u.hostname not in ('127.0.0.1','localhost','::1'):raise ValueError('公网服务器必须使用 HTTPS')
  self.url=url.rstrip('/');directory=Path(session_dir or Path.home()/'.local/share/trpg-cli')
  directory.mkdir(parents=True,exist_ok=True,mode=0o700);directory.chmod(0o700)
  self.file=directory/(hashlib.sha256(self.url.encode()).hexdigest()+'.cookies')
  self.cookies=http.cookiejar.LWPCookieJar(str(self.file))
  if self.file.exists():
   self.file.chmod(0o600);self.cookies.load(ignore_discard=True)
  self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies),NoRedirect())
 def save(self):
  temp=self.file.with_suffix('.tmp-'+uuid.uuid4().hex)
  try:
   fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600);os.close(fd)
   self.cookies.save(str(temp),ignore_discard=True);temp.replace(self.file)
  finally:
   if temp.exists():temp.unlink()
 def request(self,route,body=None):
  if not route.startswith('/api/') or urllib.parse.urlsplit(route).netloc or '\\' in route:raise ValueError('仅允许 /api/ 路径')
  q=urllib.request.Request(self.url+route,data=json.dumps(body,ensure_ascii=False).encode() if body is not None else None,headers={'Content-Type':'application/json'} if body is not None else {})
  try:
   with self.opener.open(q,timeout=20) as r:raw=r.read();mime=r.headers.get('Content-Type','')
  except urllib.error.HTTPError as e:
   try:message=json.loads(e.read()).get('error','请求失败')
   except (ValueError,AttributeError):message='请求失败'
   raise ValueError('HTTP '+str(e.code)+'：'+message) from None
  self.save()
  return json.loads(raw) if 'application/json' in mime else raw

def parser():
 p=argparse.ArgumentParser(description='NightTable 跑团终端客户端');p.add_argument('--server',default=os.environ.get('NIGHTTABLE_URL','http://127.0.0.1:8765'));p.add_argument('--session-dir');s=p.add_subparsers(dest='command',required=True)
 s.add_parser('login').add_argument('username');s.add_parser('logout');s.add_parser('rooms')
 for cmd in ('state','join','ready','select','action','chat','history','export','audit'):
  q=s.add_parser(cmd);q.add_argument('game_id',type=int)
  if cmd=='ready':q.add_argument('--cancel',action='store_true')
  if cmd=='select':q.add_argument('role_id')
  if cmd in ('action','chat'):q.add_argument('--text',required=True)
  if cmd=='action':
   q.add_argument('--check',required=True);q.add_argument('--item',action='append',default=[]);q.add_argument('--take',action='append',default=[]);q.add_argument('--request-id',default=None)
  if cmd=='history':q.add_argument('--before',type=int)
  if cmd=='export':q.add_argument('--format',choices=['md','jsonl'],default='md');q.add_argument('--output',type=Path,required=True)
 q=s.add_parser('api',help='主持人及高级操作，提交完整 JSON；权限仍由服务端校验');q.add_argument('route');q.add_argument('--body-file',type=Path)
 return p

def main(argv=None):
 p=parser();a=p.parse_args(argv)
 try:
  c=Client(a.server,a.session_dir);cmd=a.command;body=None
  if cmd=='login':route='/api/login';body={'username':a.username,'password':getpass.getpass('密码：')}
  elif cmd=='logout':route='/api/logout';body={}
  elif cmd=='rooms':route='/api/games'
  elif cmd=='api':route='/api/'+a.route.lstrip('/');body=json.loads(a.body_file.read_text()) if a.body_file else None
  else:
   gid=a.game_id
   if gid<1:raise ValueError('房间号必须为正整数')
   route={'state':'state','history':'history','export':'export','audit':'random/audit'}.get(cmd)
   if route:
    route='/api/'+route+'?game_id='+str(gid)
    if cmd=='history' and a.before is not None:route+='&before='+str(a.before)
    if cmd=='export':route+='&format='+a.format
   else:
    body={'game_id':gid,'request_id':uuid.uuid4().hex}
    route='/api/'+{'join':'game/join','ready':'game/ready','select':'role/select','action':'message','chat':'message'}[cmd]
    if cmd=='ready':body['ready']=not a.cancel
    if cmd=='select':body['role_id']=a.role_id
    if cmd in ('action','chat'):body.update(kind=cmd,text=a.text)
    if cmd=='action':
     state=c.request('/api/state?game_id='+str(gid))
     if not state.get('user'):raise ValueError('请先登录')
     body.update(round_no=state['round']['number'],check_id=a.check,item_ids=a.item,take_item_ids=a.take,request_id=a.request_id or body['request_id'])
     print('request_id='+body['request_id'],file=sys.stderr)
  result=c.request(route,body)
  if cmd=='export':
   if not isinstance(result,bytes):raise ValueError('导出响应格式错误')
   with a.output.open('xb') as f:f.write(result)
   print('已保存：'+str(a.output));return 0
  print(json.dumps(result,ensure_ascii=False,indent=2) if not isinstance(result,bytes) else result.decode());return 0
 except (ValueError,OSError,urllib.error.URLError,http.cookiejar.LoadError) as e:
  print(str(e),file=sys.stderr);return 1
if __name__=='__main__':sys.exit(main())
