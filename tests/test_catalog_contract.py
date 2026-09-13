from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from validate_catalog import infer_audience, validate  # noqa: E402


class CatalogContractTests(unittest.TestCase):
    def test_validate_catalog_script_passes(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "validate_catalog.py"), "--root", str(ROOT)],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(
            result.returncode,
            0,
            result.stdout + "\n" + result.stderr,
        )

    def test_validate_function_has_no_errors(self):
        errors, _warnings = validate(ROOT)
        self.assertEqual(errors, [])

    def test_audience_heuristics(self):
        self.assertEqual(infer_audience({"id": "jiangyuan-rd-pm", "client": "江原科技"}), "client")
        self.assertEqual(infer_audience({"id": "fde-carousel", "client": "帆软 / 横向"}), "internal")
        self.assertEqual(infer_audience({"id": "jiandaoyun-carousel", "client": "帆软 / 横向"}), "internal")
        self.assertEqual(infer_audience({"id": "ammo-finance", "client": "内部"}), "internal")
        self.assertEqual(infer_audience({"id": "biren-finance", "client": "壁仞科技"}), "client")

    def test_every_demo_has_explicit_audience_and_four_tags(self):
        catalog = json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))
        for demo in catalog["demos"]:
            self.assertIn(demo.get("audience"), {"client", "internal"}, demo.get("id"))
            self.assertEqual(len(demo.get("tags") or []), 4, demo.get("id"))

    def test_baseline_is_out_of_latest_pool(self):
        catalog = json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))
        baseline = next(d for d in catalog["demos"] if d["id"] == "biren-finance__baseline")
        current = next(d for d in catalog["demos"] if d["id"] == "biren-finance")
        self.assertEqual(baseline.get("family"), "biren-finance")
        self.assertTrue(baseline.get("archived") is True or baseline.get("is_latest") is False)
        self.assertEqual(current.get("family"), "biren-finance")
        self.assertNotEqual(current.get("archived"), True)
        self.assertNotEqual(current.get("is_latest"), False)

    def test_internal_carousels_are_not_customer_featured(self):
        catalog = json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))
        for did in ("fde-carousel", "jiandaoyun-carousel"):
            demo = next(d for d in catalog["demos"] if d["id"] == did)
            self.assertEqual(demo["audience"], "internal")
            self.assertFalse(demo.get("featured"))


if __name__ == "__main__":
    unittest.main()
