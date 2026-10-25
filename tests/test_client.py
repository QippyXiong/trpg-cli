"""Standalone transport tests: stdlib-only HTTP fixture, no server repository."""
import contextlib
import io
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
from nighttable_cli.client import Client, main


class APIHandler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def respond(self, status, data, headers=None):
        raw = data if isinstance(data, bytes) else json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8" if isinstance(data, bytes) else "application/json")
        self.send_header("Content-Length", str(len(raw)))
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        self.server.calls.append((self.command, self.path, body))
        if self.path == "/api/login":
            return self.respond(200, {"ok": True}, {"Set-Cookie": "trpg_session=fixture-session; Path=/; HttpOnly; Max-Age=3600"})
        if self.path == "/api/conflict":
            return self.respond(409, {"error": "本轮已提交决策"})
        if self.headers.get("Cookie") != "trpg_session=fixture-session":
            return self.respond(401, {"error": "请先登录"})
        return self.respond(200, {"ok": True})

    def do_GET(self):
        self.server.calls.append((self.command, self.path, None))
        route = urlsplit(self.path).path
        if route == "/api/redirect":
            return self.respond(302, {}, {"Location": "/api/trap"})
        if route == "/api/trap":
            return self.respond(200, {"unexpected": True})
        if self.headers.get("Cookie") != "trpg_session=fixture-session":
            return self.respond(401, {"error": "请先登录"})
        if route == "/api/state":
            return self.respond(200, {"user": {"username": "fixture-user"}, "round": {"number": 7}})
        if route == "/api/export":
            return self.respond(200, "独立客户端导出\n".encode())
        return self.respond(200, {"games": []})


class StandaloneClient(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), APIHandler)
        cls.server.calls = []
        cls.url = "http://127.0.0.1:" + str(cls.server.server_port)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.sessions = Path(self.tmp.name) / "sessions"
        self.client = Client(self.url, self.sessions)
        self.server.calls.clear()

    def login(self):
        self.client.request("/api/login", {"username": "fixture-user", "password": "standalone-fixture-only"})

    def cli(self, *args):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = main(["--server", self.url, "--session-dir", str(self.sessions), *args])
        return code, out.getvalue(), err.getvalue()

    def test_session_survives_new_client_without_relogin(self):
        self.login()
        restored = Client(self.url, self.sessions)
        self.assertEqual(restored.request("/api/state")["user"]["username"], "fixture-user")
        self.assertEqual(sum(path == "/api/login" for _, path, _ in self.server.calls), 1)
        if os.name != "nt":
            self.assertEqual(restored.file.stat().st_mode & 0o777, 0o600)
            self.assertEqual(self.sessions.stat().st_mode & 0o777, 0o700)

    def test_origins_do_not_share_sessions(self):
        self.login()
        other = Client(self.url.replace("127.0.0.1", "localhost"), self.sessions)
        self.assertNotEqual(self.client.file, other.file)
        self.assertEqual(list(other.cookies), [])

    def test_http_error_preserves_status_and_message_without_write_retry(self):
        with self.assertRaisesRegex(ValueError, "HTTP 409.*本轮已提交决策"):
            self.client.request("/api/conflict", {"text": "fixture"})
        self.assertEqual(len(self.server.calls), 1)

    def test_redirect_is_not_followed(self):
        self.login()
        with self.assertRaisesRegex(ValueError, "HTTP 302"):
            self.client.request("/api/redirect")
        self.assertNotIn("/api/trap", [path for _, path, _ in self.server.calls])

    def test_action_uses_live_round_and_explicit_request_id(self):
        self.login()
        code, out, err = self.cli("action", "9", "--check", "explore", "--text", "观察门框", "--item", "rope", "--request-id", "fixture-decision")
        self.assertEqual(code, 0, err)
        body = self.server.calls[-1][2]
        self.assertEqual(self.server.calls[-1][1], "/api/message")
        self.assertEqual((body["game_id"], body["round_no"], body["check_id"]), (9, 7, "explore"))
        self.assertEqual(body["item_ids"], ["rope"])
        self.assertEqual(body["request_id"], "fixture-decision")
        self.assertIn("fixture-decision", err)

    def test_login_does_not_print_or_persist_password(self):
        with patch("getpass.getpass", return_value="standalone-fixture-only"):
            code, out, err = self.cli("login", "fixture-user")
        self.assertEqual(code, 0, err)
        self.assertNotIn("standalone-fixture-only", out + err)
        self.assertNotIn("standalone-fixture-only", self.client.file.read_text(encoding="utf-8"))

    def test_export_preserves_bytes(self):
        self.login()
        target = Path(self.tmp.name) / "record.md"
        code, out, err = self.cli("export", "9", "--output", str(target))
        self.assertEqual(code, 0, err)
        self.assertEqual(target.read_bytes(), "独立客户端导出\n".encode())

    def test_export_never_overwrites_an_existing_file(self):
        self.login()
        target = Path(self.tmp.name) / "record.md"
        target.write_bytes(b"keep-existing")
        code, out, err = self.cli("export", "9", "--output", str(target))
        self.assertEqual(code, 1)
        self.assertEqual(target.read_bytes(), b"keep-existing")

    def test_invalid_server_urls_rejected_before_network(self):
        for url in ("http://example.com", "https://user:password@example.com", "https://example.com/path"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                Client(url, self.sessions)
        self.assertEqual(self.server.calls, [])

    def test_foreign_route_rejected_before_network(self):
        with self.assertRaises(ValueError):
            self.client.request("https://example.com/")
        self.assertEqual(self.server.calls, [])

    def test_server_environment_selects_the_target_origin(self):
        self.login()
        out, err = io.StringIO(), io.StringIO()
        with patch.dict(os.environ, {"NIGHTTABLE_URL": self.url}), contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = main(["--session-dir", str(self.sessions), "rooms"])
        self.assertEqual(code, 0, err.getvalue())
        self.assertEqual(self.server.calls[-1][1], "/api/games")


if __name__ == "__main__":
    unittest.main()
