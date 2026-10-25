"""Cross-repository tests use a temporary database and loopback servers."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from http.server import ThreadingHTTPServer
from urllib.parse import urlsplit
from nighttable_cli.client import Client,main

BASE=Path(__file__).resolve().parents[2]
BACKEND=Path(os.environ.get('TRPG_SERVER_DIR',BASE/'trpg-server'))
WEB=Path(os.environ.get('TRPG_WEB_DIR',BASE/'trpg-web'))
sys.path.insert(0,str(BACKEND))
import server as room
spec=importlib.util.spec_from_file_location('web_dev',WEB/'dev.py');web=importlib.util.module_from_spec(spec);spec.loader.exec_module(web)

class Integration(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.tmp=tempfile.TemporaryDirectory();room.DATA=Path(cls.tmp.name)/'db';room.CONFIG=BACKEND/'config.json';room.initialize()
  room.create_user('host','主持人','dm','integration-only-password');room.create_user('player','玩家','player','integration-only-password')
  cls.api=room.RoomServer(('127.0.0.1',0),room.Handler);threading.Thread(target=cls.api.serve_forever,daemon=True).start();cls.url='http://127.0.0.1:'+str(cls.api.server_port)
  cls.web=ThreadingHTTPServer(('127.0.0.1',0),web.Handler);cls.web.backend=urlsplit(cls.url);threading.Thread(target=cls.web.serve_forever,daemon=True).start();cls.web_url='http://127.0.0.1:'+str(cls.web.server_port)
 @classmethod
 def tearDownClass(cls):
  for s in (cls.web,cls.api):s.shutdown();s.server_close()
  cls.tmp.cleanup()
 def test_cli_roundtrip_via_separate_web_proxy(self):
  sessions=Path(self.tmp.name)/'cli';argv=['--server',self.web_url,'--session-dir',str(sessions)]
  def cli(*args):
   out=io.StringIO()
   with contextlib.redirect_stdout(out),contextlib.redirect_stderr(io.StringIO()):code=main(argv+list(args))
   self.assertEqual(code,0,out.getvalue());return out.getvalue()
  with patch('getpass.getpass',return_value='integration-only-password'):self.assertNotIn('integration-only-password',cli('login','player'))
  player=Client(self.web_url,sessions);self.assertEqual(player.file.stat().st_mode&0o777,0o600)
  self.assertEqual(player.request('/api/state')['user']['username'],'player')
  host=Client(self.url,Path(self.tmp.name)/'host');host.request('/api/login',{'username':'host','password':'integration-only-password'})
  gid=host.request('/api/game/create',{'title':'split integration'})['game_id']
  cli('select',str(gid),'engineer');cli('join',str(gid));cli('ready',str(gid));host.request('/api/game/launch',{'game_id':gid})
  cli('action',str(gid),'--check','explore','--text','确认门口情况','--request-id','split-action')
  self.assertTrue(json.loads(cli('state',str(gid)))['round']['decided'])
  self.assertTrue(json.loads(cli('action',str(gid),'--check','explore','--text','确认门口情况','--request-id','split-action'))['duplicate'])
  with self.assertRaisesRegex(ValueError,'409'):player.request('/api/message',{'game_id':gid,'round_no':1,'kind':'action','text':'再交','check_id':'explore','request_id':'different'})
  output=Path(self.tmp.name)/'export.md';cli('export',str(gid),'--output',str(output));self.assertIn('确认门口情况',output.read_text())
  cli('rooms');cli('audit',str(gid));cli('logout');self.assertIsNone(Client(self.web_url,sessions).request('/api/state')['user'])
 def test_proxy_preserves_origin_protection_and_assets(self):
  import urllib.request,urllib.error
  for asset in ('/','/app.js','/style.css','/health'):
   with urllib.request.urlopen(self.web_url+asset) as r:self.assertEqual(r.status,200);self.assertTrue(r.read())
  bad=urllib.request.Request(self.web_url+'/api/logout',data=b'{}',headers={'Content-Type':'application/json','Origin':'https://attacker.invalid'})
  with self.assertRaises(urllib.error.HTTPError) as e:urllib.request.urlopen(bad)
  self.assertEqual(e.exception.code,403)
 def test_rejects_remote_plaintext_and_embedded_credentials(self):
  for url in ('http://example.com','https://user:pass@example.com','https://example.com/path'):
   with self.assertRaises(ValueError):Client(url,Path(self.tmp.name)/'bad')
 def test_foreign_route_rejected(self):
  with self.assertRaises(ValueError):Client(self.url,Path(self.tmp.name)/'route').request('https://example.com/')
if __name__=='__main__':unittest.main()
