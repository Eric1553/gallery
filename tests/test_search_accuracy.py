from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

os.environ.setdefault("KNOWLEDGE_MOSS", "0")

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from search_federation import compact_query_text, retrieve_query, search_demos


class SearchAccuracyTests(unittest.TestCase):
    def test_question_tail_still_finds_named_client(self):
        hits = search_demos("隐冠怎么讲")
        ids = [h["id"] for h in hits]
        self.assertTrue(any(str(i).startswith("yinguang") for i in ids), ids)

    def test_libang_question_does_not_invent_demos(self):
        hits = search_demos("立邦怎么讲")
        self.assertEqual(hits, [])

    def test_retrieve_query_drops_how_to_ask(self):
        q = retrieve_query("立邦怎么讲")
        self.assertIn("立邦", q)
        self.assertNotIn("怎么讲", q)

    def test_compact_query_strips_middot_and_spaces(self):
        self.assertEqual(compact_query_text("旌芯 · 掌舵者OS"), "旌芯掌舵者os")
        self.assertIn(compact_query_text("旌芯掌舵者"), compact_query_text("旌芯 · 掌舵者OS 作战支持"))

    def test_colloquial_jingxin_hits_helmsman_family(self):
        hits = search_demos("旌芯掌舵者")
        ids = [h["id"] for h in hits]
        self.assertIn("jingxin-helmsman", ids, ids)
        self.assertIn("jingxin-helmsman-mobile", ids, ids)

    def test_colloquial_yinguang_efficiency(self):
        hits = search_demos("隐冠人效")
        ids = [h["id"] for h in hits]
        self.assertIn("yinguang-efficiency", ids, ids)

    def test_jiandaoyun_does_not_require_jiangyuan(self):
        hits = search_demos("简道云")
        ids = [h["id"] for h in hits]
        self.assertNotIn("jiangyuan-rd-pm", ids, ids)

    def test_jiangyuan_still_hits_client_and_title_terms(self):
        by_client = [h["id"] for h in search_demos("江原")]
        by_topic = [h["id"] for h in search_demos("研发项目管理")]
        self.assertIn("jiangyuan-rd-pm", by_client, by_client)
        self.assertIn("jiangyuan-rd-pm", by_topic, by_topic)


if __name__ == "__main__":
    unittest.main()
