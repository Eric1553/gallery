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

    def test_biren_finance_revs_are_archived_family_stubs(self):
        catalog = json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))
        by_id = {d["id"]: d for d in catalog["demos"]}
        for did in ("biren-finance__rev1", "biren-finance__rev2", "biren-finance__rev3"):
            demo = by_id[did]
            self.assertEqual(demo.get("family"), "biren-finance")
            self.assertIs(demo.get("archived"), True)
            self.assertIs(demo.get("is_latest"), False)
            self.assertEqual(demo.get("audience"), "client")
            self.assertEqual(demo.get("client"), "壁仞科技")
            self.assertFalse(demo.get("featured"))
        latest = [d["id"] for d in catalog["demos"] if d.get("family") == "biren-finance" and d.get("archived") is not True and d.get("is_latest") is not False]
        self.assertEqual(latest, ["biren-finance"])

    def test_jingxin_helmsman_family_latest_flags(self):
        catalog = json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))
        by_id = {d["id"]: d for d in catalog["demos"]}
        desktop = by_id["jingxin-helmsman"]
        mobile = by_id["jingxin-helmsman-mobile"]
        self.assertEqual(desktop.get("family"), "jingxin-helmsman")
        self.assertEqual(mobile.get("family"), "jingxin-helmsman")
        self.assertIs(desktop.get("is_latest"), True)
        self.assertIs(mobile.get("is_latest"), False)
        self.assertIsNot(mobile.get("archived"), True)
        self.assertEqual(catalog["meta"]["version"], "1.6.6")
        self.assertEqual(catalog["meta"]["updated_at"], "2026-09-24")
        yinguang = by_id["yinguang-ipd"]
        self.assertNotIn("帆软", json.dumps(yinguang.get("source_files"), ensure_ascii=False))
        self.assertTrue((ROOT / "demos" / "yinguang-ipd" / "半导体IPD数字化方案-售前讲稿.html").is_file())

    def test_internal_carousels_are_not_customer_featured(self):
        catalog = json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))
        for did in ("fde-carousel", "jiandaoyun-carousel"):
            demo = next(d for d in catalog["demos"] if d["id"] == did)
            self.assertEqual(demo["audience"], "internal")
            self.assertFalse(demo.get("featured"))


if __name__ == "__main__":
    unittest.main()
