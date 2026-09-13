from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from search_federation import (  # noqa: E402
    apply_path_title_boosts,
    cap_paragraphs_per_document,
    classify_knowledge_intent,
    expand_maxkb_queries,
    federated_search,
    path_title_boost_factor,
    rrf_fuse,
    search_maxkb,
)


def _hit(
    para_id: str,
    *,
    title: str,
    document_name: str,
    score: float = 0.5,
    document_id: str = "doc",
    snippet: str = "body",
) -> dict:
    return {
        "id": para_id,
        "paragraph_id": para_id,
        "title": title,
        "document_name": document_name,
        "document_id": document_id,
        "snippet": snippet,
        "raw_score": score,
        "score": score,
        "channel": "knowledge",
    }


class QueryExpansionTests(unittest.TestCase):
    def test_jihe_expands_tail_and_synonyms(self):
        variants = expand_maxkb_queries("稽核套表怎么讲")
        self.assertGreaterEqual(len(variants), 2)
        self.assertLessEqual(len(variants), 4)
        self.assertIn("稽核套表怎么讲", variants)
        self.assertIn("稽核套表", variants)
        blob = " ".join(variants)
        self.assertTrue(
            any(tok in blob for tok in ("迎检", "驻厂", "审计包", "追溯")),
            variants,
        )

    def test_jiaodong_expands_oee(self):
        variants = expand_maxkb_queries("稼动率")
        blob = " ".join(variants)
        self.assertTrue(any(tok in blob for tok in ("OEE", "WIP", "良率")), variants)

    def test_yuanqu_expands_fill_report(self):
        variants = expand_maxkb_queries("园区月报怎么说")
        self.assertIn("园区月报", variants)
        blob = " ".join(variants)
        self.assertTrue(any(tok in blob for tok in ("填报", "月报")), variants)

    def test_expand_can_be_disabled(self):
        with patch.dict(os.environ, {"GALLERY_MAXKB_EXPAND": "0"}, clear=False):
            variants = expand_maxkb_queries("稽核套表怎么讲")
        self.assertEqual(variants, ["稽核套表怎么讲"])


class IntentAndBoostTests(unittest.TestCase):
    def test_objection_intent_from_zenmejiang(self):
        self.assertEqual(classify_knowledge_intent("稽核套表怎么讲"), "objection")
        self.assertEqual(classify_knowledge_intent("园区填报流程"), "process")
        self.assertEqual(classify_knowledge_intent("稼动率"), "neutral")

    def test_ammo_path_boosts_more_on_objection(self):
        play = _hit("p1", title="作战卡", document_name="售前武器/稽核套表.md")
        wiki = _hit("p2", title="稽核", document_name="百科/半导体稽核词条.md")
        obj = path_title_boost_factor(play, "objection")
        proc = path_title_boost_factor(play, "process")
        wiki_f = path_title_boost_factor(wiki, "objection")
        self.assertGreater(obj, proc)
        self.assertGreater(proc, 1.0)
        self.assertLess(wiki_f, 1.0)


class RrfBoostCapTests(unittest.TestCase):
    def test_rrf_prefers_paragraph_seen_in_multiple_lists(self):
        wiki = _hit(
            "wiki-1",
            title="稽核",
            document_name="百科/半导体稽核词条.md",
            score=0.95,
        )
        play = _hit(
            "play-1",
            title="稽核套表作战卡",
            document_name="售前武器/作战卡/稽核套表.md",
            score=0.55,
        )
        # Raw scores would pick wiki; RRF consensus should pick play.
        list_a = [wiki, play]
        list_b = [play]
        fused = rrf_fuse([list_a, list_b], k=60)
        self.assertEqual(fused[0]["id"], "play-1")
        self.assertGreater(fused[0]["rrf"], fused[1]["rrf"])

    def test_path_boost_breaks_rrf_ties_toward_playbook(self):
        wiki = _hit(
            "wiki-1",
            title="稽核",
            document_name="百科/半导体稽核词条.md",
            score=0.99,
        )
        play = _hit(
            "play-1",
            title="开场",
            document_name="售前武器/作战卡/稽核套表.md",
            score=0.40,
        )
        wiki["rrf"] = 0.016393
        play["rrf"] = 0.016393
        ranked = apply_path_title_boosts([wiki, play], "objection")
        self.assertEqual(ranked[0]["id"], "play-1")
        self.assertGreater(ranked[0]["boost"], ranked[1]["boost"])
        self.assertEqual(ranked[0]["reason"], "MaxKB · 售前武器")

    def test_dedupe_by_paragraph_and_cap_per_document(self):
        doc = "售前武器/作战卡/稽核套表.md"
        items = [
            _hit(f"play-{i}", title=f"段{i}", document_name=doc, score=0.9 - i * 0.05)
            for i in range(1, 5)
        ]
        for i, item in enumerate(items, start=1):
            item["rrf"] = 0.02 - i * 0.001
        # Duplicate paragraph id should collapse first.
        dup = dict(items[0])
        ranked = apply_path_title_boosts([dup, *items], "objection")
        capped = cap_paragraphs_per_document(ranked, cap=3)
        ids = [x["id"] for x in capped]
        self.assertEqual(len(ids), 3)
        self.assertEqual(len(set(ids)), 3)
        self.assertTrue(all(x["document_name"] == doc for x in capped))

    def test_cap_allows_other_documents_after_one_doc_fills(self):
        play_doc = "售前武器/Playbook/稼动.md"
        wiki_doc = "百科/OEE词条.md"
        items = [
            _hit("a1", title="作战卡", document_name=play_doc),
            _hit("a2", title="开场", document_name=play_doc),
            _hit("a3", title="检索卡", document_name=play_doc),
            _hit("a4", title="反对意见", document_name=play_doc),
            _hit("w1", title="OEE", document_name=wiki_doc),
        ]
        for i, item in enumerate(items):
            item["rrf"] = 0.03 - i * 0.001
        ranked = apply_path_title_boosts(items, "neutral")
        capped = cap_paragraphs_per_document(ranked, cap=3)
        self.assertEqual(sum(1 for x in capped if x["document_name"] == play_doc), 3)
        self.assertTrue(any(x["id"] == "w1" for x in capped))


class SearchMaxkbMockTests(unittest.TestCase):
    def test_search_maxkb_rrf_boost_and_multi_para(self):
        """Playbook paras beat a high raw-score encyclopedia hit (稽核套表 case)."""
        calls: list[tuple[str, str]] = []

        def fake_hit(knowledge_id, query_text, **_kwargs):
            calls.append((knowledge_id, query_text))
            play = [
                {
                    "id": "para-play-1",
                    "document_id": "doc-play",
                    "document_name": "售前武器/作战卡/稽核套表.md",
                    "title": "稽核套表作战卡",
                    "content": "驻厂迎检套表开场怎么讲",
                    "comprehensive_score": 0.58,
                    "knowledge_id": knowledge_id,
                },
                {
                    "id": "para-play-2",
                    "document_id": "doc-play",
                    "document_name": "售前武器/作战卡/稽核套表.md",
                    "title": "反对意见",
                    "content": "客户说已有审计包",
                    "comprehensive_score": 0.54,
                    "knowledge_id": knowledge_id,
                },
                {
                    "id": "para-play-3",
                    "document_id": "doc-play",
                    "document_name": "售前武器/作战卡/稽核套表.md",
                    "title": "检索卡",
                    "content": "追溯检查表",
                    "comprehensive_score": 0.50,
                    "knowledge_id": knowledge_id,
                },
                {
                    "id": "para-play-4",
                    "document_id": "doc-play",
                    "document_name": "售前武器/作战卡/稽核套表.md",
                    "title": "补充",
                    "content": "第四段不应超过 cap",
                    "comprehensive_score": 0.49,
                    "knowledge_id": knowledge_id,
                },
            ]
            wiki = [
                {
                    "id": "para-wiki-1",
                    "document_id": "doc-wiki",
                    "document_name": "百科/半导体稽核词条.md",
                    "title": "稽核",
                    "content": "稽核是一种质量审计方法，百科长文会抬高 comprehensive_score",
                    "comprehensive_score": 0.96,
                    "knowledge_id": knowledge_id,
                },
                play[0],
            ]
            if any(tok in query_text for tok in ("迎检", "驻厂", "审计包", "追溯")):
                return play
            return wiki

        with (
            patch("search_federation.MAXKB_BASE", "http://maxkb.test"),
            patch("search_federation.MAXKB_TOKEN", "tok"),
            patch("search_federation.MAXKB_KNOWLEDGE_IDS", ["kb-a", "kb-b"]),
            patch("search_federation.MAXKB_TOP", 8),
            patch("search_federation.MAXKB_SIMILARITY", 0.3),
            patch("search_federation.MAXKB_MODE", "blend"),
            patch("search_federation._maxkb_hit_test", side_effect=fake_hit),
        ):
            out = search_maxkb("稽核套表怎么讲", limit=10)

        self.assertEqual(out["status"], "ok")
        items = out["items"]
        self.assertTrue(items)
        self.assertEqual(items[0]["id"], "para-play-1")
        play_hits = [x for x in items if x["document_name"].startswith("售前武器/")]
        self.assertGreaterEqual(len(play_hits), 2)
        self.assertLessEqual(len(play_hits), 3)
        self.assertTrue(any(x["id"] == "para-wiki-1" for x in items))
        queried = {q for _kid, q in calls}
        self.assertIn("稽核套表怎么讲", queried)
        self.assertTrue(any("迎检" in q or "审计包" in q for q in queried), queried)
        self.assertGreaterEqual(len(calls), 4)  # 2 kb × ≥2 variants

    def test_hit_test_keeps_existing_env_knobs(self):
        seen: list[dict] = []

        def fake_http(method, url, body=None, headers=None, timeout=12):
            seen.append(body or {})
            return 200, {"data": []}

        with (
            patch("search_federation.MAXKB_BASE", "http://maxkb.test"),
            patch("search_federation.MAXKB_TOKEN", "tok"),
            patch("search_federation.MAXKB_KNOWLEDGE_IDS", ["kb-1"]),
            patch("search_federation.MAXKB_TOP", 8),
            patch("search_federation.MAXKB_SIMILARITY", 0.3),
            patch("search_federation.MAXKB_MODE", "blend"),
            patch("search_federation._http_json", side_effect=fake_http),
            patch.dict(os.environ, {"GALLERY_MAXKB_EXPAND": "0"}, clear=False),
        ):
            out = search_maxkb("稼动率", limit=10)

        self.assertEqual(out["status"], "ok")
        self.assertTrue(seen)
        for body in seen:
            self.assertEqual(body["search_mode"], "blend")
            self.assertEqual(body["similarity"], 0.3)
            self.assertEqual(body["top_number"], 8)
            self.assertEqual(body["query_text"], "稼动率")

    def test_not_configured_and_empty_query(self):
        with patch("search_federation.MAXKB_BASE", ""):
            self.assertEqual(search_maxkb("稽核")["status"], "not_configured")
        self.assertEqual(search_maxkb(" ")["status"], "empty_query")

    def test_knowledge_lane_keeps_original_query_for_intent(self):
        seen: list[str] = []

        def capture(q, limit=10):
            seen.append(q)
            return {"items": [], "status": "ok"}

        with (
            patch("search_federation.search_demos", return_value=[]),
            patch("search_federation.search_feedback", return_value=[]),
            patch("search_federation.search_knowledge", side_effect=capture),
            patch(
                "search_federation.search_feishu",
                return_value={"items": [], "status": "ok"},
            ),
        ):
            federated_search("稽核套表怎么讲")
        self.assertEqual(seen, ["稽核套表怎么讲"])


if __name__ == "__main__":
    unittest.main()
