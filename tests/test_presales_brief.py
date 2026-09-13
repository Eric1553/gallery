from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import presales_brief as pb
from gallery_brief import build_gallery_brief
import server


FED_PAYLOAD = {
    "demos": [
        {
            "id": "biren-ceo",
            "title": "壁仞科技 · CEO 决策看板",
            "url": "/demos/biren-ceo/",
            "client": "壁仞科技",
            "reason": "客户 · 壁仞科技",
            "summary": "经营决策",
        }
    ],
    "feedback": [{"title": "会后批注", "snippet": "客户要看库存"}],
    "knowledge": [{"title": "涂料百科", "snippet": "行业背景", "url": "https://example.test/k"}],
    "feishu": [{"title": "飞书纪要", "snippet": "价格与折扣"}],
}


class SchemaValidateTests(unittest.TestCase):
    def test_schema_file_is_valid_json(self):
        schema = pb.load_schema()
        self.assertEqual(schema.get("title"), "Presales Brief v1")
        self.assertIn("meta", schema["properties"])
        self.assertEqual(schema["properties"]["meta"]["properties"]["status"]["enum"], ["draft", "ready", "archived"])

    def test_empty_draft_validates(self):
        brief = pb.normalize({}, query="壁仞")
        ok, errors = pb.validate(brief)
        self.assertTrue(ok, errors)
        self.assertEqual(brief["meta"]["schema_version"], "1")
        self.assertEqual(brief["meta"]["status"], "draft")
        self.assertEqual(brief["customer"]["name"], "壁仞")
        self.assertTrue(brief["meta"]["brief_id"].startswith("psb-"))

    def test_full_brief_validates(self):
        brief = pb.load(
            {
                "meta": {
                    "schema_version": "1",
                    "brief_id": "psb-biren",
                    "updated_at": "2026-09-13T10:00:00Z",
                    "owner": "gallery",
                    "status": "ready",
                },
                "customer": {
                    "name": "壁仞科技",
                    "short_name": "壁仞",
                    "industry": "半导体",
                    "audience_notes": "CEO 室",
                },
                "visit": {
                    "date": "2026-09-20",
                    "goal": "对齐经营闭环",
                    "narrative": "今天讲财经驾驶舱",
                    "red_lines": ["不要承诺未上线口径"],
                    "shareability": {
                        "external": [{"title": "公开白皮书", "snippet": "可外发"}],
                        "internal_only": [{"title": "内部价", "snippet": "勿外发"}],
                    },
                },
                "demos": [
                    {
                        "id": "biren-ceo",
                        "title": "CEO 决策看板",
                        "hall": "ceo",
                        "why": "一把手",
                        "featured": True,
                    }
                ],
                "talking_points": [{"title": "切入", "body": "先问库存", "source": "feedback"}],
                "materials": {
                    "knowledge": [{"title": "笔记", "url": "/k", "snippet": "…"}],
                    "ammo_pack_ids": ["biren-ceo"],
                    "links": ["https://example.test/deck"],
                },
                "gaps": [{"id": "feishu", "note": "缺纪要", "area": "飞书"}],
                "provenance": {"sources": [{"module": "gallery", "ref": "federated_search"}]},
            }
        )
        self.assertEqual(brief["customer"]["short_name"], "壁仞")
        self.assertTrue(brief["demos"][0]["featured"])
        self.assertEqual(brief["materials"]["links"][0]["url"], "https://example.test/deck")

    def test_invalid_status_rejected(self):
        brief = pb.normalize({"meta": {"status": "published"}, "customer": {"name": "X"}})
        ok, errors = pb.validate(brief)
        self.assertFalse(ok)
        self.assertTrue(any("status" in e for e in errors))

    def test_invalid_schema_version_rejected(self):
        brief = pb.normalize({"meta": {"schema_version": "2"}, "customer": {"name": "X"}})
        ok, errors = pb.validate(brief)
        self.assertFalse(ok)
        self.assertTrue(any("schema_version" in e for e in errors))

    def test_load_raises_on_invalid(self):
        with self.assertRaises(pb.PresalesBriefError):
            pb.load({"meta": {"schema_version": "9", "status": "nope"}, "customer": {"name": "X"}})


class AdapterTests(unittest.TestCase):
    def test_from_gallery_federation_builds_v1(self):
        brief = pb.from_gallery_federation("壁仞怎么讲", FED_PAYLOAD)
        ok, errors = pb.validate(brief)
        self.assertTrue(ok, errors)
        self.assertIn("壁仞", brief["customer"]["name"])
        self.assertEqual(brief["customer"]["industry"], "半导体")
        self.assertEqual(brief["customer"]["short_name"], "壁仞")
        ids = [d["id"] for d in brief["demos"]]
        self.assertIn("biren-ceo", ids)
        demo = next(d for d in brief["demos"] if d["id"] == "biren-ceo")
        self.assertEqual(demo.get("hall"), "ceo")
        self.assertTrue(demo.get("featured"))
        self.assertTrue(brief["materials"]["knowledge"])
        self.assertTrue(brief["visit"]["shareability"]["internal_only"])
        modules = {s["module"] for s in brief["provenance"]["sources"]}
        self.assertIn("gallery", modules)
        self.assertIn("catalog", modules)

    def test_from_knowledge_card_stub_and_typical_card(self):
        empty = pb.from_knowledge_card(None)
        self.assertEqual(empty["meta"]["schema_version"], "1")
        card = {
            "account": {"name": "立邦", "industry": "涂料", "resolved": True, "peers": ["立白"]},
            "stance": "今天对标竞品",
            "talk": [{"kind": "切入", "text": "先问库存", "account_name": "立邦"}],
            "demos": [{"title": "涂料 DEMO", "href": "/demos/x/"}],
            "share": [{"title": "百科", "snippet": "公开"}],
            "internal": [{"title": "飞书", "snippet": "内部"}],
            "redlines": ["勿报未审价格"],
            "coverage": [{"id": "kms", "label": "KMS", "status": "missing", "note": "无"}],
            "tags": ["涂料"],
        }
        brief = pb.from_knowledge_card(card)
        ok, errors = pb.validate(brief)
        self.assertTrue(ok, errors)
        self.assertEqual(brief["customer"]["name"], "立邦")
        self.assertEqual(brief["visit"]["narrative"], "今天对标竞品")
        self.assertEqual(brief["talking_points"][0]["body"], "先问库存")
        self.assertIn("勿报未审价格", brief["visit"]["red_lines"])
        self.assertTrue(brief["gaps"])

    def test_from_knowledge_card_accepts_v1_passthrough(self):
        v1 = pb.normalize({"customer": {"name": "旌芯"}}, query="旌芯")
        again = pb.from_knowledge_card({"presales_brief": v1})
        self.assertEqual(again["customer"]["name"], "旌芯")

    def test_ammo_roundtrip_keeps_extra_fields(self):
        pack = {
            "id": "biren-pack",
            "customer": "壁仞科技",
            "short_name": "壁仞",
            "industry": "半导体",
            "goal": "续约",
            "narrative": "今天讲闭环",
            "red_lines": ["勿提竞品报价"],
            "talking_points": [{"title": "开场", "body": "先复盘 Q2"}],
            "demos": [{"id": "biren-ceo", "title": "CEO 看板"}],
            "ammo_pack_ids": ["biren-pack"],
            "moss_score": 88,
            "pack_id": "biren-pack",
            "title": "壁仞弹药包",
            "custom_lane": ["MOSS 定性"],
        }
        v1 = pb.from_ammo_brief(pack)
        ok, errors = pb.validate(v1)
        self.assertTrue(ok, errors)
        self.assertEqual(v1["customer"]["name"], "壁仞科技")
        self.assertIn("biren-pack", v1["materials"]["ammo_pack_ids"])
        self.assertEqual(v1["extensions"]["ammo"]["moss_score"], 88)
        back = pb.to_ammo_brief(v1)
        self.assertEqual(back["customer"], "壁仞科技")
        self.assertEqual(back["narrative"], "今天讲闭环")
        self.assertEqual(back["moss_score"], 88)
        self.assertEqual(back["custom_lane"], ["MOSS 定性"])
        self.assertEqual(back["title"], "壁仞弹药包")
        self.assertEqual(back["red_lines"], ["勿提竞品报价"])


class GalleryBriefMappingTests(unittest.TestCase):
    def test_build_gallery_brief_dual_writes_v1_and_old_keys(self):
        card = build_gallery_brief("壁仞怎么讲", FED_PAYLOAD)
        for key in ("account", "stance", "talk", "demos", "coverage", "share", "internal", "redlines"):
            self.assertIn(key, card, key)
        labels = [c["label"] for c in card.get("coverage") or []]
        self.assertIn("会后反馈", labels)
        self.assertTrue(card.get("internal"))
        self.assertTrue(card.get("demos"))
        self.assertTrue(card["demos"][0].get("href") or card["demos"][0].get("title"))

        v1 = card.get("presales_brief")
        self.assertIsInstance(v1, dict)
        ok, errors = pb.validate(v1)
        self.assertTrue(ok, errors)
        self.assertEqual(v1["meta"]["schema_version"], "1")
        self.assertIn("壁仞", v1["customer"]["name"])
        self.assertEqual(v1["customer"]["industry"], "半导体")
        self.assertTrue(any(d.get("id") == "biren-ceo" for d in v1["demos"]))

    def test_to_meeting_card_keeps_frontend_shape(self):
        v1 = pb.from_gallery_federation("壁仞怎么讲", FED_PAYLOAD)
        card = pb.to_meeting_card(v1)
        self.assertIn("account", card)
        self.assertTrue(card["stance"])
        self.assertTrue(card["demos"][0]["href"].startswith("/demos/"))
        self.assertTrue(card["share"] or card["internal"])
        self.assertEqual(card["presales_brief"]["meta"]["schema_version"], "1")

    def test_question_tail_stripped_for_customer_name(self):
        v1 = pb.from_gallery_federation("隐冠怎么讲", {"demos": [], "feedback": [], "knowledge": [], "feishu": []})
        self.assertEqual(v1["customer"]["name"], "隐冠")
        self.assertNotIn("怎么讲", v1["customer"]["name"])


class BriefApiTests(unittest.TestCase):
    def _handler(self, path: str, *, authed: bool):
        handler = object.__new__(server.GalleryHandler)
        handler.path = path
        handler._authed = lambda: authed
        sent: dict = {}

        def _send_json(obj, code=200, set_cookie=None):
            sent["obj"] = obj
            sent["code"] = code

        handler._send_json = _send_json
        return handler, sent

    def test_requires_auth(self):
        handler, sent = self._handler("/api/brief?q=壁仞", authed=False)
        handler.do_GET()
        self.assertEqual(sent["code"], 401)
        self.assertFalse(sent["obj"].get("ok"))

    def test_short_query_returns_draft(self):
        handler, sent = self._handler("/api/brief?q=壁", authed=True)
        handler.do_GET()
        self.assertEqual(sent["code"], 200)
        self.assertEqual(sent["obj"]["meta"]["note"], "query too short")
        self.assertEqual(sent["obj"]["brief"]["meta"]["schema_version"], "1")

    def test_customer_alias_returns_v1(self):
        briefing = build_gallery_brief("壁仞", FED_PAYLOAD)
        fed = {**FED_PAYLOAD, "ok": True, "query": "壁仞", "briefing": briefing}
        handler, sent = self._handler("/api/brief?customer=壁仞", authed=True)
        with patch("server.federated_search", return_value=fed):
            handler.do_GET()
        self.assertEqual(sent.get("code"), 200)
        brief = sent["obj"]["brief"]
        self.assertEqual(brief["meta"]["schema_version"], "1")
        self.assertEqual(sent["obj"]["query"], "壁仞")
        ok, errors = pb.validate(brief)
        self.assertTrue(ok, errors)


if __name__ == "__main__":
    unittest.main()
