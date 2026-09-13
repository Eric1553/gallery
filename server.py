#!/usr/bin/env python3
"""DEMO案例库：主馆 + /demos/<id>/ 静态展品。

自动为子路径部署注入 base / 路径修复脚本，并改写 HTML 中的根绝对路径，
使后续上传的 DEMO 在 /demos/<id>/ 下仍可正常跳转与加载资源。
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import threading
import time
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from search_federation import federated_search

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
CATALOG = ROOT / "catalog.json"
SEARCH_INDEX = ROOT / "search_index.json"
DEMOS_DIR = Path(os.environ.get("DEMOS_DIR", "/opt/demos"))
_CATALOG_ENTRY: dict[str, str] | None = None


def catalog_entry_for(demo_id: str) -> str:
    """Relative entry file inside /opt/demos/<id>/, default index.html."""
    global _CATALOG_ENTRY
    did = str(demo_id or "").strip()
    if _CATALOG_ENTRY is None:
        mapping: dict[str, str] = {}
        try:
            data = json.loads(CATALOG.read_text(encoding="utf-8"))
            rows = data.get("demos") or []
            if isinstance(rows, dict):
                rows = list(rows.values())
            for row in rows:
                if not isinstance(row, dict) or not row.get("id"):
                    continue
                mapping[str(row["id"])] = str(row.get("entry") or "index.html").lstrip("/")
        except Exception:
            mapping = {}
        _CATALOG_ENTRY = mapping
    return _CATALOG_ENTRY.get(did) or "index.html"
AUTH_DIR = Path(os.environ.get("GALLERY_AUTH_DIR", str(ROOT / "data")))
AUTH_STORE = AUTH_DIR / "auth.json"
COOKIE_NAME = "gallery_session"
# 默认密码可用环境变量覆盖：GALLERY_PASSWORD
DEFAULT_PASSWORD = os.environ.get("GALLERY_PASSWORD", "FanRuan@Demo")
SESSION_DAYS = int(os.environ.get("GALLERY_SESSION_DAYS", "7"))
_AUTH_SECRET_CACHE = os.environ.get("GALLERY_AUTH_SECRET", "").strip()

# 不改写的站点级前缀
KEEP_ROOT_PREFIXES = ("/demos/", "/api/", "/assets/")
# 部分 DEMO 原站点挂载前缀（如知识库 /kb/）→ 映射到当前 demo 根
MOUNT_ALIASES = ("/kb",)

ATTR_ABS_RE = re.compile(
    r"""(?P<attr>\b(?:href|src|action)\s*=\s*)(?P<q>['"])(?P<path>/(?!/).*?)(?P=q)""",
    re.IGNORECASE,
)
CSS_URL_ABS_RE = re.compile(
    r"""url\(\s*(?P<q>['"]?)(?P<path>/(?!/|demos/|api/|assets/)[^)'"]+)(?P=q)\s*\)""",
    re.IGNORECASE,
)
META_REFRESH_RE = re.compile(
    r"""(?P<prefix>content\s*=\s*)(?P<q>['"])(?P<meta>\d+\s*;\s*url=)(?P<path>/[^'"]+)(?P=q)""",
    re.IGNORECASE,
)


def demo_base_from_rel(rel: str) -> str | None:
    """rel like 'uih-poc/index.html' -> '/demos/uih-poc'."""
    parts = [p for p in rel.split("/") if p]
    if not parts:
        return None
    return f"/demos/{parts[0]}"


def resolve_static_path(root: Path, relative_path: str) -> Path | None:
    """Resolve a request path below root, failing closed on traversal or symlink escape."""
    try:
        allowed_root = root.resolve(strict=True)
        target = (allowed_root / relative_path.lstrip("/")).resolve(strict=False)
        target.relative_to(allowed_root)
    except (OSError, RuntimeError, ValueError):
        return None
    return target


def should_rewrite_path(path: str) -> bool:
    if not path.startswith("/") or path.startswith("//"):
        return False
    return not any(path == p.rstrip("/") or path.startswith(p) for p in KEEP_ROOT_PREFIXES)


def map_to_demo_path(path: str, base: str) -> str:
    """把站点根绝对路径映射到 /demos/<id>/...，并消化 /kb 等原挂载前缀。"""
    if path == "/":
        return base + "/"
    for alias in MOUNT_ALIASES:
        if path == alias:
            return base + "/"
        if path.startswith(alias + "/"):
            return base + path[len(alias) :]
    return base + path


def rewrite_attr_paths(text: str, base: str) -> str:
    def repl(m: re.Match[str]) -> str:
        path = m.group("path")
        # /kb/... 即使命中 /assets 子串也要先剥挂载前缀
        if path.startswith("/kb/") or path == "/kb":
            new_path = map_to_demo_path(path, base)
            return f"{m.group('attr')}{m.group('q')}{new_path}{m.group('q')}"
        if not should_rewrite_path(path):
            return m.group(0)
        new_path = map_to_demo_path(path, base)
        return f"{m.group('attr')}{m.group('q')}{new_path}{m.group('q')}"

    return ATTR_ABS_RE.sub(repl, text)


def rewrite_css_urls(text: str, base: str) -> str:
    def repl(m: re.Match[str]) -> str:
        path = m.group("path")
        q = m.group("q") or ""
        if path.startswith("/kb/") or path == "/kb" or should_rewrite_path(path):
            new_path = map_to_demo_path(path, base)
            return f"url({q}{new_path}{q})"
        return m.group(0)

    return CSS_URL_ABS_RE.sub(repl, text)


def rewrite_meta_refresh(text: str, base: str) -> str:
    def repl(m: re.Match[str]) -> str:
        path = m.group("path")
        new_path = map_to_demo_path(path, base)
        return f"{m.group('prefix')}{m.group('q')}{m.group('meta')}{new_path}{m.group('q')}"

    return META_REFRESH_RE.sub(repl, text)


def path_fix_script(base: str) -> str:
    # base like /demos/uih-poc (no trailing slash)
    return f"""<script data-demo-path-fix>
(function(){{
  var BASE = {json.dumps(base)};
  function keep(u){{
    if (!u || typeof u !== 'string') return true;
    if (u.charAt(0) !== '/') return true;
    if (u.indexOf('//') === 0) return true;
    if (u.indexOf(BASE) === 0) return true;
    if (u.indexOf('/demos/') === 0 || u.indexOf('/api/') === 0) return true;
    // /assets/ 可能是案例库资源，也可能是 DEMO 内资源；仅保留案例库顶栏 assets
    if (u.indexOf('/assets/') === 0 && location.pathname.indexOf('/demos/') !== 0) return true;
    return false;
  }}
  function stripMount(u){{
    if (u === '/kb') return '/';
    if (u.indexOf('/kb/') === 0) return u.slice(3);
    return u;
  }}
  function fixPath(u){{
    u = stripMount(u);
    if (keep(u) && u.indexOf(BASE) === 0) return u;
    if (u.charAt(0) !== '/') return u;
    if (u.indexOf('/demos/') === 0 || u.indexOf('/api/') === 0) return u;
    return u === '/' ? (BASE + '/') : (BASE + u);
  }}
  function remap(u){{
    if (!u || typeof u !== 'string') return u;
    if (u.indexOf('data:') === 0 || u.indexOf('mailto:') === 0 || u.indexOf('javascript:') === 0 || u.indexOf('#') === 0) return u;
    if (u.charAt(0) === '/') return fixPath(u);
    try {{
      var abs = new URL(u, location.href);
      // 第三方 CDN / 外链保持原样，避免把 jsdelivr 等改写成 /demos/<id>/npm/... 导致图表脚本 404
      if (abs.origin !== location.origin) {{
        var host = abs.hostname || '';
        // 联影旧 PoC Worker / 本机 8890 → 映射到当前 DEMO 挂载路径
        if (host === '47.99.198.211' || ((host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') && (abs.port === '8890' || abs.port === ''))) {{
          return location.origin + fixPath(abs.pathname || '/') + abs.search + abs.hash;
        }}
        if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {{
          return location.origin + fixPath(abs.pathname) + abs.search + abs.hash;
        }}
        return u;
      }}
      return location.origin + fixPath(abs.pathname) + abs.search + abs.hash;
    }} catch (e) {{}}
    return u;
  }}
  function fixEl(el){{
    if (!el || !el.getAttribute) return;
    ['href','src','action'].forEach(function(attr){{
      var v = el.getAttribute(attr);
      if (!v) return;
      var n = remap(v);
      if (n !== v) el.setAttribute(attr, n);
    }});
  }}
  function scan(root){{
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('a[href],img[src],script[src],link[href],form[action],source[src],video[src],audio[src]').forEach(fixEl);
  }}
  document.addEventListener('click', function(e){{
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var raw = a.getAttribute('href');
    if (!raw) return;
    var next = remap(raw);
    if (next === raw) return;
    e.preventDefault();
    if (a.target === '_blank') window.open(next, '_blank');
    else location.href = next;
  }}, true);
  var _fetch = window.fetch;
  if (_fetch) {{
    window.fetch = function(input, init){{
      if (typeof input === 'string') input = remap(input);
      else if (input && typeof Request !== 'undefined' && input instanceof Request) {{
        var nu = remap(input.url);
        if (nu !== input.url) input = new Request(nu, input);
      }}
      return _fetch.call(this, input, init);
    }};
  }}
  var _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url){{
    if (typeof url === 'string') arguments[1] = remap(url);
    return _open.apply(this, arguments);
  }};
  try {{
    var _assign = Location.prototype.assign;
    Location.prototype.assign = function(u){{ return _assign.call(this, remap(String(u))); }};
    var _replace = Location.prototype.replace;
    Location.prototype.replace = function(u){{ return _replace.call(this, remap(String(u))); }};
  }} catch (e) {{}}
  function patchPocPaths(){{
    if (!window.POC_PATHS || !POC_PATHS.pageUrl) return;
    var orig = POC_PATHS.pageUrl.bind(POC_PATHS);
    POC_PATHS.pageUrl = function(key){{
      var u = orig(key);
      try {{
        if (/^https?:\\/\\//i.test(u)) {{
          var abs = new URL(u);
          if (abs.hostname === '47.99.198.211' || abs.port === '8890') {{
            u = (abs.pathname || '/') + abs.search + abs.hash;
          }}
        }}
      }} catch (e) {{}}
      return remap(u);
    }};
    if (typeof POC_PATHS.bindPageLinks === 'function') POC_PATHS.bindPageLinks(document);
  }}
  if (document.readyState === 'loading') {{
    document.addEventListener('DOMContentLoaded', function(){{ scan(document); patchPocPaths(); }});
  }} else {{
    scan(document); patchPocPaths();
  }}
  setTimeout(patchPocPaths, 0);
  setTimeout(patchPocPaths, 300);
  try {{
    new MutationObserver(function(muts){{
      muts.forEach(function(m){{
        if (m.type === 'attributes') fixEl(m.target);
        m.addedNodes && m.addedNodes.forEach(function(n){{
          if (n.nodeType === 1) {{ fixEl(n); scan(n); }}
        }});
      }});
    }}).observe(document.documentElement, {{subtree:true, childList:true, attributes:true, attributeFilter:['href','src','action']}});
  }} catch (e) {{}}
}})();
</script>"""


def prepare_html(data: bytes, base: str) -> bytes:
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        text = data.decode("utf-8", errors="ignore")

    text = rewrite_attr_paths(text, base)
    text = rewrite_css_urls(text, base)
    text = rewrite_meta_refresh(text, base)

    base_tag = f'<base href="{base}/">'
    shim = path_fix_script(base)

    if re.search(r"<head[^>]*>", text, re.IGNORECASE):
        text = re.sub(
            r"(<head[^>]*>)",
            r"\1\n" + base_tag + "\n" + shim,
            text,
            count=1,
            flags=re.IGNORECASE,
        )
    else:
        text = base_tag + shim + text

    return text.encode("utf-8")


def prepare_css(data: bytes, base: str) -> bytes:
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return data
    return rewrite_css_urls(text, base).encode("utf-8")


def load_auth_store() -> dict:
    AUTH_DIR.mkdir(parents=True, exist_ok=True)
    if AUTH_STORE.is_file():
        try:
            data = json.loads(AUTH_STORE.read_text(encoding="utf-8"))
            if not data.get("secret"):
                data["secret"] = secrets.token_hex(32)
                save_auth_store(data)
            return data
        except json.JSONDecodeError:
            pass
    data = {
        "password": DEFAULT_PASSWORD,
        "secret": secrets.token_hex(32),
        "device_tokens": {},  # token -> exp
    }
    AUTH_STORE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return data


def save_auth_store(data: dict) -> None:
    AUTH_DIR.mkdir(parents=True, exist_ok=True)
    AUTH_STORE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def auth_secret() -> str:
    global _AUTH_SECRET_CACHE
    if _AUTH_SECRET_CACHE:
        return _AUTH_SECRET_CACHE
    store = load_auth_store()
    _AUTH_SECRET_CACHE = str(store.get("secret") or secrets.token_hex(32))
    return _AUTH_SECRET_CACHE


def gallery_password() -> str:
    env = os.environ.get("GALLERY_PASSWORD")
    if env:
        return env
    return str(load_auth_store().get("password") or DEFAULT_PASSWORD)


def sign_session(exp: int) -> str:
    payload = f"v1.{exp}.{secrets.token_hex(8)}"
    sig = hmac.new(auth_secret().encode(), payload.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{payload}.{sig}"


def verify_session(token: str | None) -> bool:
    if not token:
        return False
    parts = token.split(".")
    if len(parts) != 4 or parts[0] != "v1":
        return False
    try:
        exp = int(parts[1])
    except ValueError:
        return False
    if exp < int(time.time()):
        return False
    payload = ".".join(parts[:3])
    sig = parts[3]
    expect = hmac.new(auth_secret().encode(), payload.encode(), hashlib.sha256).hexdigest()[:32]
    return hmac.compare_digest(sig, expect)


def issue_device_token() -> str:
    store = load_auth_store()
    token = secrets.token_urlsafe(32)
    exp = int(time.time()) + SESSION_DAYS * 86400 * 4  # 设备令牌更长，供指纹解锁换发 session
    tokens = store.setdefault("device_tokens", {})
    # 清理过期
    now = int(time.time())
    store["device_tokens"] = {k: v for k, v in tokens.items() if int(v) > now}
    store["device_tokens"][token] = exp
    save_auth_store(store)
    return token


def verify_device_token(token: str | None) -> bool:
    if not token:
        return False
    store = load_auth_store()
    exp = store.get("device_tokens", {}).get(token)
    if not exp:
        return False
    return int(exp) > int(time.time())


class GalleryHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        return str(WEB)

    def log_message(self, fmt: str, *args) -> None:
        sys_stderr = __import__("sys").stderr
        print("%s - %s" % (self.address_string(), fmt % args), file=sys_stderr)

    def _cache_control(self, path: Path, is_catalog: bool = False) -> str:
        if is_catalog:
            return "no-cache"
        suffix = path.suffix.lower()
        # 封面/静态资源长缓存：重复访问不重复计流量（浏览器本地命中）
        if suffix in {".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff2", ".woff"}:
            return "public, max-age=2592000, immutable"
        if suffix in {".css", ".js"}:
            return "public, max-age=86400"
        if suffix in {".html", ".htm"}:
            return "no-store"
        return "public, max-age=600"

    def _send_bytes(
        self,
        data: bytes,
        content_type: str,
        code: int = 200,
        cache: str = "no-cache",
    ) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", cache)
        self.end_headers()
        if getattr(self, "_head_only", False):
            return
        self.wfile.write(data)

    def _send_file(
        self,
        path: Path,
        demo_base: str | None = None,
        *,
        is_catalog: bool = False,
    ) -> None:
        if not path.is_file():
            self.send_error(404, "File not found")
            return
        ctype = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        if path.suffix.lower() == ".webp":
            ctype = "image/webp"
        data = path.read_bytes()
        suffix = path.suffix.lower()
        if demo_base and suffix in {".html", ".htm"}:
            data = prepare_html(data, demo_base)
            ctype = "text/html; charset=utf-8"
        elif demo_base and suffix == ".css":
            data = prepare_css(data, demo_base)
            ctype = "text/css; charset=utf-8"
        self._send_bytes(data, ctype, cache=self._cache_control(path, is_catalog=is_catalog))

    def _cookies(self) -> SimpleCookie:
        c = SimpleCookie()
        raw = self.headers.get("Cookie")
        if raw:
            c.load(raw)
        return c

    def _authed(self) -> bool:
        tok = None
        morsel = self._cookies().get(COOKIE_NAME)
        if morsel:
            tok = morsel.value
        return verify_session(tok)

    def _set_session_cookie(self, token: str) -> None:
        max_age = SESSION_DAYS * 86400
        self.send_header(
            "Set-Cookie",
            f"{COOKIE_NAME}={token}; Path=/; Max-Age={max_age}; HttpOnly; SameSite=Lax",
        )

    def _send_search_sse(self, q: str) -> None:
        self.close_connection = True
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        lock = threading.Lock()

        def emit(event: str, payload: dict) -> bool:
            try:
                blob = json.dumps(payload, ensure_ascii=False, default=str)
            except Exception as exc:
                event = "error"
                blob = json.dumps(
                    {"ok": False, "error": type(exc).__name__},
                    ensure_ascii=False,
                )
            chunk = f"event: {event}\ndata: {blob}\n\n".encode("utf-8")
            with lock:
                try:
                    self.connection.sendall(chunk)
                    try:
                        self.wfile.flush()
                    except Exception:
                        pass
                    return True
                except (BrokenPipeError, ConnectionResetError, OSError):
                    return False

        def on_progress(evt: dict) -> None:
            emit("step", evt if isinstance(evt, dict) else {"step": "unknown", "status": "run"})

        try:
            result = federated_search(q, on_progress=on_progress)
            emit("done", result if isinstance(result, dict) else {"ok": False})
        except Exception as exc:
            emit("error", {"ok": False, "error": str(exc)})
        self.close_connection = True

    def _send_json(self, obj: dict, code: int = 200, set_cookie: str | None = None) -> None:
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        if set_cookie:
            self._set_session_cookie(set_cookie)
        self.end_headers()
        if getattr(self, "_head_only", False):
            return
        self.wfile.write(data)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            return {}

    def do_HEAD(self) -> None:  # noqa: N802
        self._head_only = True
        try:
            self.do_GET()
        finally:
            self._head_only = False

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        body = self._read_json()

        if path == "/api/auth/login":
            pw = str(body.get("password") or "")
            if not hmac.compare_digest(pw, gallery_password()):
                self._send_json({"ok": False, "error": "密码错误"}, code=401)
                return
            session = sign_session(int(time.time()) + SESSION_DAYS * 86400)
            device = issue_device_token()
            self._send_json({"ok": True, "device_token": device}, set_cookie=session)
            return

        if path == "/api/auth/token":
            token = str(body.get("token") or "")
            if not verify_device_token(token):
                self._send_json({"ok": False, "error": "本机令牌无效或已过期，请改用密码"}, code=401)
                return
            session = sign_session(int(time.time()) + SESSION_DAYS * 86400)
            self._send_json({"ok": True, "device_token": token}, set_cookie=session)
            return

        if path == "/api/auth/logout":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Set-Cookie", f"{COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax")
            self.send_header("Cache-Control", "no-store")
            data = b'{"ok":true}'
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        self.send_error(404, "Not found")

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        if path == "/api/auth/status":
            self._send_json({"ok": self._authed()})
            return

        if path in ("/", "/index.html"):
            self._send_file(WEB / "index.html")
            return

        if path == "/api/catalog.json":
            if not self._authed():
                self._send_json({"ok": False, "error": "unauthorized"}, code=401)
                return
            self._send_file(CATALOG, is_catalog=True)
            return

        if path == "/api/search_index.json":
            if not self._authed():
                self._send_json({"ok": False, "error": "unauthorized"}, code=401)
                return
            if not SEARCH_INDEX.is_file():
                self._send_json(
                    {
                        "ok": True,
                        "meta": {"version": "0", "demo_count": 0, "note": "empty"},
                        "demos": {},
                    }
                )
                return
            self._send_file(SEARCH_INDEX, is_catalog=True)
            return

        if path == "/api/search":
            if not self._authed():
                self._send_json({"ok": False, "error": "unauthorized"}, code=401)
                return
            qs = parse_qs(parsed.query)
            q = (qs.get("q") or [""])[0].strip()
            if len(q) < 2:
                self._send_json(
                    {
                        "ok": True,
                        "query": q,
                        "demos": [],
                        "feedback": [],
                        "knowledge": [],
                        "meta": {"note": "query too short"},
                    }
                )
                return
            stream = (qs.get("stream") or [""])[0].strip().lower() in {"1", "true", "yes"}
            if stream:
                self._send_search_sse(q)
                return
            self._send_json(federated_search(q))
            return

        if path.startswith("/assets/"):
            rel = path[len("/assets/") :]
            target = resolve_static_path(WEB / "assets", rel)
            if target is None:
                self.send_error(404, "Not found")
                return
            self._send_file(target)
            return

        if path.startswith("/covers/webp/"):
            # Canonical card URLs: /covers/webp/<demo_id>/thumb.webp|cover.webp
            # Files live beside the demo: /opt/demos/<id>/thumb.webp
            rel = path[len("/covers/webp/") :].lstrip("/")
            parts = [p for p in rel.split("/") if p]
            if len(parts) != 2 or parts[1] not in {"thumb.webp", "cover.webp", "cover.png"}:
                self.send_error(404, "Not found")
                return
            target = resolve_static_path(DEMOS_DIR, "/".join(parts))
            if target is None:
                self.send_error(404, "Not found")
                return
            self._send_file(target)
            return

        if path.startswith("/demos/"):
            rel = path[len("/demos/") :]
            base = demo_base_from_rel(rel)
            target = resolve_static_path(DEMOS_DIR, rel)
            if target is None:
                self.send_error(404, "Not found")
                return
            if target.is_dir():
                index = target / "index.html"
                if index.is_file():
                    self._send_file(index, demo_base=base)
                    return
                entry = catalog_entry_for(target.name)
                if entry and entry not in {".", "index.html"}:
                    rel_entry = "/".join(p for p in (target.name, entry) if p)
                    dest = resolve_static_path(DEMOS_DIR, rel_entry)
                    if dest is not None and dest.is_file():
                        self._send_file(dest, demo_base=base)
                        return
                self.send_error(404, "No index.html")
                return
            self._send_file(target, demo_base=base)
            return

        self.send_error(404, "Not found")


def main() -> None:
    parser = argparse.ArgumentParser(description="DEMO Case Library server")
    parser.add_argument("--host", default=os.environ.get("HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8788")))
    args = parser.parse_args()

    if not CATALOG.is_file():
        raise SystemExit(f"missing catalog: {CATALOG}")
    load_auth_store()
    print(f"gallery web: {WEB}")
    print(f"demos dir : {DEMOS_DIR}")
    print(f"auth store: {AUTH_STORE}")
    print(f"listen    : http://{args.host}:{args.port}/")
    json.loads(CATALOG.read_text(encoding="utf-8"))
    httpd = ThreadingHTTPServer((args.host, args.port), GalleryHandler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
