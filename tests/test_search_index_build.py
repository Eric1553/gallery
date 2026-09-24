from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_search_index import collect_aliases, compact_text  # noqa: E402


class CompactAliasTests(unittest.TestCase):
    def test_compact_strips_middot_space_hyphen_slash(self):
        self.assertEqual(compact_text("旌芯 · 掌舵者OS"), "旌芯掌舵者OS")
        self.assertEqual(compact_text("隐冠 · 人效看板"), "隐冠人效看板")
        self.assertEqual(compact_text("江原科技 / 研发"), "江原科技研发")
        self.assertEqual(compact_text("fine-data"), "finedata")

    def test_jingxin_collects_colloquial_and_helmsman(self):
        aliases = collect_aliases(
            {
                "id": "jingxin-helmsman",
                "title": "旌芯 · 掌舵者OS 作战支持（桌面）",
                "client": "旌芯半导体",
                "tags": ["半导体", "经营决策", "一把手看板", "掌舵者OS"],
                "industry": "半导体",
                "hall": "ceo",
                "aliases": ["旌芯掌舵者", "掌舵者"],
            }
        )
        self.assertIn("旌芯掌舵者", aliases)
        self.assertIn("掌舵者", aliases)
        self.assertIn("旌芯掌舵者OS作战支持（桌面）", aliases)

    def test_yinguang_collects_efficiency_forms(self):
        aliases = collect_aliases(
            {
                "id": "yinguang-efficiency",
                "title": "隐冠 · 人效看板",
                "client": "隐冠半导体",
                "tags": ["半导体", "组织人效", "人效分析", "编制结构"],
                "industry": "半导体",
                "hall": "ops",
            }
        )
        self.assertIn("隐冠人效", aliases)
        self.assertIn("隐冠人效看板", aliases)

    def test_jiangyuan_index_has_no_product_packaging(self):
        index = json.loads((ROOT / "search_index.json").read_text(encoding="utf-8"))
        item = index["demos"]["jiangyuan-rd-pm"]
        blob = json.dumps(item, ensure_ascii=False)
        for banned in ("简道云", "帆软", "FDE"):
            self.assertNotIn(banned, blob, banned)

    def test_client_demos_drop_fanruan_packaging(self):
        index = json.loads((ROOT / "search_index.json").read_text(encoding="utf-8"))
        for did in ("yinguang-ipd", "smic-finance"):
            item = index["demos"][did]
            for field in ("page_titles", "source_paths", "keywords", "aliases"):
                blob = json.dumps(item.get(field), ensure_ascii=False)
                self.assertNotIn("帆软", blob, f"{did}.{field}")
        smic = index["demos"]["smic-finance"]
        smic_blob = json.dumps(
            {"keywords": smic["keywords"], "page_titles": smic["page_titles"]},
            ensure_ascii=False,
        )
        self.assertNotIn("FVS", smic_blob)
        self.assertNotIn("帆软", smic_blob)


if __name__ == "__main__":
    unittest.main()
