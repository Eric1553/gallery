from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from search_federation import federated_search


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


if __name__ == "__main__":
    unittest.main()
