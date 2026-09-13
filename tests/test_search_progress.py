from __future__ import annotations

import os
import sqlite3
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from search_federation import (  # noqa: E402
    feedback_public_base,
    federated_search,
    search_feedback,
)


class FederatedProgressTests(unittest.TestCase):
    def test_emits_each_channel(self):
        events = []
        with (
            patch("search_federation.search_demos", return_value=[{"title": "d"}]),
            patch("search_federation.search_feedback", return_value=[]),
            patch(
                "search_federation.search_knowledge",
                return_value={"items": [{"title": "k"}], "status": "ok"},
            ),
            patch(
                "search_federation.search_feishu",
                return_value={"items": [], "status": "ok"},
            ),
        ):
            out = federated_search("立邦", on_progress=events.append)
        self.assertTrue(out["ok"])
        pairs = [(e["step"], e["status"]) for e in events]
        self.assertIn(("demos", "run"), pairs)
        self.assertIn(("demos", "done"), pairs)
        self.assertIn(("feedback", "empty"), pairs)
        self.assertIn(("knowledge", "done"), pairs)
        self.assertIn(("feishu", "empty"), pairs)
        self.assertEqual(out["knowledge"][0]["title"], "k")
        self.assertEqual(set(out) >= {"ok", "query", "demos", "feedback", "knowledge", "feishu", "meta"}, True)
        for evt in events:
            self.assertIn(evt.get("channel"), {"demos", "feedback", "knowledge", "feishu"})

    def test_channels_run_concurrently(self):
        events = []

        def slow_ok(delay, payload):
            def _fn(*_a, **_k):
                time.sleep(delay)
                return payload

            return _fn

        t0 = time.monotonic()
        with (
            patch("search_federation.search_demos", side_effect=slow_ok(0.35, [{"title": "d"}])),
            patch("search_federation.search_feedback", side_effect=slow_ok(0.35, [])),
            patch(
                "search_federation.search_knowledge",
                side_effect=slow_ok(0.35, {"items": [{"title": "k"}], "status": "ok"}),
            ),
            patch(
                "search_federation.search_feishu",
                side_effect=slow_ok(0.35, {"items": [], "status": "ok"}),
            ),
        ):
            out = federated_search("立邦", on_progress=events.append)
        elapsed = time.monotonic() - t0
        self.assertTrue(out["ok"])
        self.assertLess(elapsed, 1.1, f"expected parallel channels, took {elapsed:.2f}s")
        self.assertEqual(out["demos"][0]["title"], "d")
        self.assertEqual(out["knowledge"][0]["title"], "k")

    def test_error_isolation_keeps_other_channels(self):
        def boom(*_a, **_k):
            raise RuntimeError("knowledge down")

        with (
            patch("search_federation.search_demos", return_value=[{"title": "d"}]),
            patch("search_federation.search_feedback", return_value=[]),
            patch("search_federation.search_knowledge", side_effect=boom),
            patch(
                "search_federation.search_feishu",
                return_value={"items": [{"title": "f"}], "status": "ok"},
            ),
        ):
            out = federated_search("立邦")
        self.assertTrue(out["ok"])
        self.assertEqual(out["demos"][0]["title"], "d")
        self.assertEqual(out["feishu"][0]["title"], "f")
        self.assertEqual(out["knowledge"], [])
        self.assertEqual(out["meta"]["knowledge_status"], "error")
        self.assertIn("knowledge down", str(out["meta"].get("knowledge_hint") or ""))

    def test_per_channel_timeout(self):
        def hang(*_a, **_k):
            time.sleep(2)
            return {"items": [{"title": "late"}], "status": "ok"}

        env = {
            "GALLERY_FED_TIMEOUT": "0.2",
            "GALLERY_FED_TIMEOUT_DEMOS": "2",
            "GALLERY_FED_TIMEOUT_FEEDBACK": "2",
            "GALLERY_FED_TIMEOUT_FEISHU": "2",
        }
        with (
            patch.dict(os.environ, env, clear=False),
            patch("search_federation.search_demos", return_value=[{"title": "d"}]),
            patch("search_federation.search_feedback", return_value=[]),
            patch("search_federation.search_knowledge", side_effect=hang),
            patch(
                "search_federation.search_feishu",
                return_value={"items": [], "status": "ok"},
            ),
        ):
            t0 = time.monotonic()
            out = federated_search("立邦")
            elapsed = time.monotonic() - t0
        self.assertTrue(out["ok"])
        self.assertLess(elapsed, 1.2, f"timeout did not isolate hang, took {elapsed:.2f}s")
        self.assertEqual(out["demos"][0]["title"], "d")
        self.assertEqual(out["knowledge"], [])
        self.assertEqual(out["meta"]["knowledge_status"], "timeout")


class FeedbackBaseTests(unittest.TestCase):
    def test_feedback_public_base_env(self):
        with patch.dict(os.environ, {"FEEDBACK_PUBLIC_BASE": "http://fb.example:9/"}, clear=False):
            os.environ.pop("GALLERY_FEEDBACK_BASE", None)
            self.assertEqual(feedback_public_base(), "http://fb.example:9")
        with patch.dict(os.environ, {"GALLERY_FEEDBACK_BASE": "http://alt.example"}, clear=False):
            os.environ.pop("FEEDBACK_PUBLIC_BASE", None)
            self.assertEqual(feedback_public_base(), "http://alt.example")

    def test_search_feedback_urls_use_env_base(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / "feedback.sqlite"
            conn = sqlite3.connect(str(db))
            conn.executescript(
                """
                CREATE TABLE comments (
                    id TEXT, demo_id TEXT, nickname TEXT, body TEXT,
                    status TEXT, created_at TEXT, updated_at TEXT,
                    annotation_json TEXT, shot_path TEXT
                );
                CREATE TABLE replies (comment_id TEXT, body TEXT, nickname TEXT);
                INSERT INTO comments VALUES (
                    'c1','acme-rd','n','hello body','open','t','t',NULL,'shots/a.png'
                );
                """
            )
            conn.commit()
            conn.close()
            with (
                patch("search_federation.FEEDBACK_DB", db),
                patch.dict(os.environ, {"GALLERY_FEEDBACK_BASE": "http://fb.example:1234"}, clear=False),
            ):
                os.environ.pop("FEEDBACK_PUBLIC_BASE", None)
                hits = search_feedback("hello")
        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0]["url"], "http://fb.example:1234/admin/")
        self.assertEqual(hits[0]["shot_url"], "http://fb.example:1234/shots/a.png")


if __name__ == "__main__":
    unittest.main()
