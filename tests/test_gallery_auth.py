from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import server


class CookieSecureHelperTests(unittest.TestCase):
    def test_plain_http_is_not_secure(self):
        self.assertFalse(
            server.cookie_secure_enabled(headers={"Host": "example"}, environ={}, https=False)
        )

    def test_env_forces_secure(self):
        self.assertTrue(
            server.cookie_secure_enabled(
                headers={"X-Forwarded-Proto": "http"},
                environ={"GALLERY_COOKIE_SECURE": "1"},
                https=False,
            )
        )

    def test_forwarded_proto_https(self):
        self.assertTrue(
            server.cookie_secure_enabled(
                headers={"X-Forwarded-Proto": "https, http"},
                environ={},
                https=False,
            )
        )

    def test_direct_https_flag(self):
        self.assertTrue(server.cookie_secure_enabled(headers={}, environ={}, https=True))

    def test_header_includes_secure_only_when_enabled(self):
        plain = server.session_cookie_header("tok", max_age=10, headers={}, environ={}, https=False)
        self.assertIn("HttpOnly", plain)
        self.assertNotIn("Secure", plain)
        secure = server.session_cookie_header(
            "tok", max_age=10, headers={"X-Forwarded-Proto": "https"}, environ={}, https=False
        )
        self.assertIn("Secure", secure)


class PasswordFailClosedTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        auth_dir = Path(self.tmp.name)
        store = auth_dir / "auth.json"
        self.addCleanup(setattr, server, "AUTH_DIR", server.AUTH_DIR)
        self.addCleanup(setattr, server, "AUTH_STORE", server.AUTH_STORE)
        self.addCleanup(setattr, server, "_AUTH_SECRET_CACHE", server._AUTH_SECRET_CACHE)
        server.AUTH_DIR = auth_dir
        server.AUTH_STORE = store
        server._AUTH_SECRET_CACHE = ""
        self.env = patch.dict(os.environ, {}, clear=False)
        self.env.start()
        self.addCleanup(self.env.stop)
        os.environ.pop("GALLERY_PASSWORD", None)

    def test_startup_exits_when_neither_env_nor_store(self):
        with self.assertRaises(SystemExit) as ctx:
            server.require_gallery_password()
        self.assertIn("GALLERY_PASSWORD", str(ctx.exception))
        self.assertIsNone(server.configured_gallery_password())

    def test_gallery_password_raises_when_missing(self):
        with self.assertRaises(RuntimeError):
            server.gallery_password()

    def test_env_password_wins(self):
        os.environ["GALLERY_PASSWORD"] = "unit-test-env-only"
        self.assertEqual(server.gallery_password(), "unit-test-env-only")

    def test_auth_json_password_used_when_env_absent(self):
        server.save_auth_store(
            {"password": "unit-test-store-only", "secret": "s", "device_tokens": {}}
        )
        self.assertEqual(server.gallery_password(), "unit-test-store-only")

    def test_load_auth_store_does_not_invent_password(self):
        data = server.load_auth_store()
        self.assertFalse(str(data.get("password") or "").strip())
        self.assertTrue(data.get("secret"))


class WantsJsonUnauthorizedTests(unittest.TestCase):
    def test_xhr_and_fetch_prefer_json(self):
        self.assertTrue(
            server.wants_json_unauthorized(
                {"Accept": "application/json", "X-Requested-With": "XMLHttpRequest"}
            )
        )
        self.assertTrue(
            server.wants_json_unauthorized(
                {"Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty"}
            )
        )

    def test_browser_navigation_prefers_redirect(self):
        self.assertFalse(
            server.wants_json_unauthorized(
                {
                    "Accept": "text/html,application/xhtml+xml",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-Dest": "document",
                }
            )
        )

    def test_image_dest_is_json_401(self):
        self.assertTrue(
            server.wants_json_unauthorized(
                {"Sec-Fetch-Dest": "image", "Sec-Fetch-Mode": "no-cors"}
            )
        )


def _handler(path: str, *, authed: bool, headers=None):
    handler = object.__new__(server.GalleryHandler)
    handler.path = path
    handler.headers = headers or {}
    handler._authed = Mock(return_value=authed)
    handler._send_file = Mock()
    handler.send_error = Mock()
    handler._send_json = Mock()
    handler.send_response = Mock()
    handler.send_header = Mock()
    handler.end_headers = Mock()
    handler.wfile = Mock()
    handler.connection = None
    handler._head_only = False
    return handler


class DemoCoverAuthTests(unittest.TestCase):
    def test_public_index_and_assets_skip_auth(self):
        handler = _handler("/assets/gallery.css", authed=False)
        handler.do_GET()
        handler._send_json.assert_not_called()
        handler._send_file.assert_called_once()

        home = _handler("/", authed=False)
        home.do_GET()
        home._send_file.assert_called_once_with(server.WEB / "index.html")

    def test_unauthenticated_demo_xhr_is_401_json(self):
        handler = _handler(
            "/demos/biren-finance/index.html",
            authed=False,
            headers={"Accept": "application/json", "Sec-Fetch-Mode": "cors"},
        )
        handler.do_GET()
        handler._send_file.assert_not_called()
        handler._send_json.assert_called_once_with(
            {"ok": False, "error": "unauthorized"}, code=401
        )

    def test_unauthenticated_demo_navigation_redirects_to_gate(self):
        handler = _handler(
            "/demos/biren-finance/index.html",
            authed=False,
            headers={
                "Accept": "text/html",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Dest": "document",
            },
        )
        handler.do_GET()
        handler._send_file.assert_not_called()
        handler.send_response.assert_called_once_with(302)
        handler.send_header.assert_any_call("Location", "/")

    def test_unauthenticated_cover_is_401_json(self):
        handler = _handler(
            "/covers/webp/biren-finance/thumb.webp",
            authed=False,
            headers={"Sec-Fetch-Dest": "image", "Sec-Fetch-Mode": "no-cors"},
        )
        handler.do_GET()
        handler._send_file.assert_not_called()
        handler._send_json.assert_called_once_with(
            {"ok": False, "error": "unauthorized"}, code=401
        )

    def test_authenticated_demo_serves_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            demos = Path(tmp)
            demo = demos / "sample"
            demo.mkdir()
            target = demo / "index.html"
            target.write_text("<html>ok</html>", encoding="utf-8")
            handler = _handler("/demos/sample/index.html", authed=True)
            with patch.object(server, "DEMOS_DIR", demos):
                handler.do_GET()
            handler._send_json.assert_not_called()
            handler._send_file.assert_called_once()
            sent = handler._send_file.call_args
            self.assertEqual(sent.args[0], target.resolve())

    def test_authenticated_cover_serves_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            demos = Path(tmp)
            demo = demos / "sample"
            demo.mkdir()
            thumb = demo / "thumb.webp"
            thumb.write_bytes(b"webp")
            handler = _handler("/covers/webp/sample/thumb.webp", authed=True)
            with patch.object(server, "DEMOS_DIR", demos):
                handler.do_GET()
            handler._send_file.assert_called_once_with(thumb.resolve())


class LoginMisconfigTests(unittest.TestCase):
    def test_login_without_password_is_503(self):
        handler = object.__new__(server.GalleryHandler)
        handler.path = "/api/auth/login"
        handler.headers = {}
        handler._read_json = Mock(return_value={"password": "x"})
        handler._send_json = Mock()
        with (
            patch.object(server, "configured_gallery_password", return_value=None),
            patch.object(server, "gallery_password", side_effect=RuntimeError("missing")),
        ):
            handler.do_POST()
        handler._send_json.assert_called_once_with(
            {"ok": False, "error": "server misconfigured"}, code=503
        )


if __name__ == "__main__":
    unittest.main()
