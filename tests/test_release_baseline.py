import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

import server


ROOT = Path(__file__).resolve().parents[1]


class StaticPathTests(unittest.TestCase):
    def test_legal_static_asset_keeps_resolved_path(self):
        handler = object.__new__(server.GalleryHandler)
        handler.path = "/assets/gallery.css"
        handler._send_file = Mock()
        handler.send_error = Mock()

        handler.do_GET()

        handler.send_error.assert_not_called()
        handler._send_file.assert_called_once_with(
            (server.WEB / "assets" / "gallery.css").resolve()
        )

    def test_asset_traversal_returns_404(self):
        handler = object.__new__(server.GalleryHandler)
        handler.path = "/assets/%2e%2e/index.html"
        handler._send_file = Mock()
        handler.send_error = Mock()

        handler.do_GET()

        handler._send_file.assert_not_called()
        handler.send_error.assert_called_once_with(404, "Not found")

    def test_resolver_rejects_symlink_escape(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            allowed = base / "allowed"
            outside = base / "outside"
            allowed.mkdir()
            outside.mkdir()
            (outside / "secret.txt").write_text("secret")
            (allowed / "jump").symlink_to(outside, target_is_directory=True)
            self.assertIsNone(server.resolve_static_path(allowed, "jump/secret.txt"))


class ReleaseIntegrityTests(unittest.TestCase):
    def test_catalog_is_valid_json(self):
        payload = json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))
        self.assertIsInstance(payload.get("demos"), list)

    def test_frozen_id_cannot_enter_sync_delete_scope(self):
        with tempfile.TemporaryDirectory() as source:
            result = subprocess.run(
                [
                    "bash",
                    str(ROOT / "scripts" / "sync_to_ecs.sh"),
                    "--demo-id",
                    "biren-ceo",
                    "--source",
                    source,
                    "--apply",
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
                check=False,
            )
        self.assertEqual(result.returncode, 64)
        self.assertIn("refusing frozen demo id", result.stderr)


if __name__ == "__main__":
    unittest.main()
