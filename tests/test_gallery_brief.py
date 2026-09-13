from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from gallery_brief import _load_knowledge, build_gallery_brief


def _knowledge_pack_available() -> bool:
    account_mod, briefing_mod = _load_knowledge()
    return bool(account_mod and briefing_mod)


@unittest.skipUnless(
    _knowledge_pack_available(),
    "requires demo-knowledge account pack (KNOWLEDGE_ROOT or /opt/demo-runtime/demo-knowledge)",
)
class GalleryBriefTests(unittest.TestCase):
    def test_libang_card_has_coverage_and_lanes(self):
        brief = build_gallery_brief(
            "立邦怎么讲",
            {
                "demos": [{"title": "涂料行业 DEMO", "url": "/demos/x/", "client": "某涂料"}],
                "feedback": [{"title": "会后批注", "snippet": "客户要看库存"}],
                "knowledge": [{"title": "涂料百科", "snippet": "立邦投资有限公司在涂料行业"}],
                "feishu": [{"title": "飞书纪要", "snippet": "价格与折扣"}],
            },
        )
        self.assertTrue(brief.get("account", {}).get("resolved"))
        labels = [c["label"] for c in brief.get("coverage") or []]
        self.assertIn("会后反馈", labels)
        self.assertTrue(brief.get("internal"))
        self.assertTrue(brief.get("demos"))

    def test_compare_query_keeps_peers(self):
        brief = build_gallery_brief(
            "立邦和立白怎么比",
            {"demos": [], "feedback": [], "knowledge": [], "feishu": []},
        )
        acc = brief.get("account") or {}
        self.assertIn("立白", acc.get("peers") or [])


if __name__ == "__main__":
    unittest.main()
