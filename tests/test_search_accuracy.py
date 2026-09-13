from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

os.environ.setdefault("KNOWLEDGE_MOSS", "0")

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from search_federation import retrieve_query, search_demos


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


if __name__ == "__main__":
    unittest.main()
