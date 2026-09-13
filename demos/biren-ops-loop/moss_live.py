#!/usr/bin/env python3
"""实时调用 MOSS MCP 舆情搜索，组装 CEO 看板情报包（不依赖本地 JSON 包）。"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

# 情报质量闸门与本文件同级，且需在任意工作目录下都能解析
sys.path.insert(0, str(Path(__file__).resolve().parent))
from intel_gate import (  # noqa: E402  全部演示包共用同一份闸门实现
    body_fingerprint,
    clean_title,
    passes_intel_gate,
)

TZ_SH = timezone(timedelta(hours=8))


def _refresh_budget() -> float:
    """一次刷新的总预算；到点就用已拿到的条目返回，其余由精选基线补齐。"""
    try:
        return max(10.0, float(os.environ.get("MOSS_REFRESH_BUDGET", "40")))
    except ValueError:
        return 40.0

TOPIC_QUERIES = [
    {
        "topic_id": "BR-POL",
        "label": "政策与监管",
        "must_kw": "半导体,算力",
        "should_kw": "出口管制,国产化,信创,采购,补贴",
        "not_kw": "招聘,校园,晾衣架,超话,抽奖",
    },
    {
        "topic_id": "BR-CMP",
        "label": "竞品雷达",
        "must_kw": "GPU,芯片",
        "should_kw": "英伟达,NVIDIA,昇腾,寒武纪,摩尔线程,DeepSeek,海光",
        "not_kw": "招聘,超话,抽奖",
    },
    {
        "topic_id": "BR-IND",
        "label": "产业链",
        "must_kw": "算力,半导体",
        "should_kw": "算电协同,智算中心,封测,DPU,HBM",
        "not_kw": "招聘,超话,抽奖",
    },
    {
        "topic_id": "BR-CUS",
        "label": "客户动态",
        "must_kw": "算力,GPU",
        "should_kw": "阿里云,字节跳动,腾讯,百度智能云,大模型",
        "not_kw": "招聘,超话",
    },
    {
        "topic_id": "BR-SEN",
        "label": "舆情与品牌",
        "keyword": "壁仞",
    },
]

RELEVANCE = re.compile(
    r"GPU|算力|芯片|半导体|英伟达|NVIDIA|昇腾|寒武纪|摩尔线程|海光|天数|壁仞|Biren|BR100|"
    r"智算|大模型|AI服务器|封测|HBM|DPU|澜起|出口管制|国产化|信创|智算中心|推理|训练|"
    r"算电协同|WAIC|DeepSeek|腾讯混元|华为|阿里云|字节",
    re.I,
)
NOISE = re.compile(
    r"晾衣架|笔记本.*排行|玉米和竹子|折叠晾衣|比人官方|回复@|体材料设|"
    r"超话|朱志鑫|南孚|粉丝|打卡|抽奖|#22x|一路向海|"
    r"净流入|主力资金|完整行情分析.*不含投资建议|"
    r"单[\s\S]{0,6}双[\s\S]{0,6}大[\s\S]{0,6}小|计[\s\S]{0,4}划[\s\S]{0,4}官[\s\S]{0,4}网|"
    r"非凡第一|代办申请|一人公司|OPC注册|专杀|大笑|"
    r"４|𝟱|𝗳|𝗰",
    re.I,
)
# 纯行情/极短快讯：信息密度低，CEO 经营简报不收录
THIN_FLASH = re.compile(
    r"AI快讯|每经AI|财联社AI|快讯[:：]|盘中[涨跌]|港股[涨跌]|A股[涨跌]|"
    r"(股价|港股|A股|收盘|开盘).{0,12}(涨|跌|跳水|拉升)\d+(\.\d+)?%|"
    r"(涨|跌)\d+(\.\d+)?%.{0,8}(报|至|至报)?.{0,6}\d+(\.\d+)?\s*港?元|"
    r"报\d+(\.\d+)?\s*港?元|"
    r"收报\d+|现报\d+|最新价",
    re.I,
)
CAPITAL = re.compile(
    r"股价|跌超|涨超|06082|配售|解禁|二级市场|目标价|增持|回购|"
    r"港股跌|港股涨|(股价|港股|A股|收盘).{0,10}(涨|跌|跳水|市值)\d|"
    r"报\d+(\.\d+)?港元|流通盘|折让|分析师.*评级|"
    r"(涨|跌)\d+(\.\d+)?%.{0,12}港元",
    re.I,
)
SOCIAL_HOST = re.compile(
    r"xueqiu\.com|weibo\.com|toutiao\.com|jianshu\.com|zhihu\.com|"
    r"douyin\.com|iesdouyin\.com|baijiahao\.baidu\.com|mp\.weixin\.qq\.com",
    re.I,
)
# 硬过滤平台：社交行情/短视频/百度落地页/博客二手，不进 CEO 简报
SOCIAL_HARD = re.compile(
    r"xueqiu\.com|weibo\.com|douyin\.com|iesdouyin\.com|baijiahao\.baidu\.com|"
    r"mbd\.baidu\.com|blog\.csdn\.net|toutiao\.com",
    re.I,
)

GENERIC_RELEVANCE = "与壁仞经营相关，需判断是否影响在手客户与交付承诺。"

BIREN_MAP = [
    (r"招标|采购|集采|中标|订单", "算力采购信号活跃；销售核对相关客户招标与在谈 POC 进展。"),
    (r"智算中心|智算|算力基建", "智算中心扩建抬高 GPU 集群需求；销售核对区域集采与在谈 POC 清单。"),
    (r"推理|Agent|智能体", "推理场景占比上升；销售与产品核对客户整机配置与推理卡出货排期。"),
    (r"训练|大模型|LLM", "训练侧投入持续；商务评估头部客户扩容与国产集群替换机会。"),
    (r"澜起", "AI 服务器内存互连需求上升；核对客户 BOM 变化是否影响 GPU 出货配置。"),
    (r"封测|先进封装|CoWoS", "封测产能分化直接影响国产 GPU 交付；供应链核对 Q3 封测排期与锁量。"),
    (r"DPU|网卡|RDMA", "集群互连仍是瓶颈；评估 GPU+DPU 联合方案是否进入客户比选。"),
    (r"算电协同|算力券|能耗|能效|TCO", "能耗约束趋严；客户采购更看重能效与 TCO，投标材料需备实测数据。"),
    (r"出口|管制|制裁", "出口与管制仍在收紧；法务与供应链同步合规口径与替代路径。"),
    (r"信创|国产化", "国产化采购导向强化；核对信创目录与客户合规选型要求。"),
    (r"DeepSeek|自研芯片|造芯", "大模型厂商自研芯片趋强；巩固外部客户份额，评估混合部署合作。"),
    (r"WAIC|世界人工智能大会", "行业展会前后推理卡商务机会增多；销售梳理可推进项目。"),
    (r"昇腾|华为|寒武纪|摩尔线程|海光|天数|燧原|沐曦", "竞品生态扩张压制同档议价；更新性能、能效、交付与报价对照。"),
    (r"英伟达|NVIDIA|H100|B200|Blackwell", "英伟达平台升级抬高集群成本；国产方案在性价比与供货上可重新比选。"),
    (r"壁仞|Biren|BR100|BR104", "品牌相关舆情；经营侧以交付与客户沟通为主，IR 聚焦经营结果。"),
    (r"腾讯|混元|百度智能云|文心", "云侧推理需求旺盛；跟踪算力扩容招标与在谈项目。"),
    (r"阿里云|字节跳动|字节", "头部云厂商继续扩容；销售跟踪 POC 与集采节点。"),
    (r"HBM|内存|美光|存储", "HBM 与存储供给影响 AI 服务器配置；核对客户 BOM 与交期。"),
    (r"IPO|上市|配售|港股", "资本市场热度上升；经营侧以交付与商务推进为主，避免噪音干扰客户沟通。"),
    (r"光刻|刻蚀|EDA|设备", "上游设备与工艺波动可能传导至产能与成本；供应链评估风险敞口。"),
]

# 来源可信度：高 / 中 / 低
SOURCE_HIGH = re.compile(
    r"新华社|人民日报|央视|中央社|工信部|发改委|财政部|科技部|证监会|"
    r"证券时报|上海证券报|中国证券报|经济日报|科技日报|财新|第一财经|界面|"
    r"华尔街见闻|路透|Reuters|Bloomberg|彭博|FT|Financial Times|"
    r"SEMI|集微网|芯智讯|电子工程专辑|半导体行业观察",
    re.I,
)
SOURCE_MED = re.compile(
    r"36氪|钛媒体|虎嗅|爱范儿|澎湃|观察者|新浪科技|网易科技|腾讯科技|"
    r"机器之心|量子位|雷锋网|InfoQ|CSDN|知乎|微信|公众号|"
    r"EETimes|AnandTech|Tom'?s Hardware|Digitimes",
    re.I,
)
SOURCE_LOW = re.compile(
    r"头条|简书|百家号|微博|超话|抖音|快手|贴吧|知乎盐选|自媒体|"
    r"雪球|港股第一眼|AI快讯|每经AI|财联社AI",
    re.I,
)

TOPIC_PREFIX = {
    "BR-POL": "POL",
    "BR-SEN": "SEN",
    "BR-CMP": "CMP",
    "BR-IND": "IND",
    "BR-CUS": "CUS",
}


def now_iso() -> str:
    return datetime.now(TZ_SH).isoformat(timespec="seconds")


def _load_dotenv_file(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


def load_moss_auth() -> tuple[str, str]:
    # 包内 .env → 环境变量 → Cursor mcp.json（客户 Linux 机通常只有前两者）
    pkg_root = Path(__file__).resolve().parent
    _load_dotenv_file(pkg_root / ".env")
    _load_dotenv_file(pkg_root / "config" / "moss.env")

    url = os.environ.get("MOSS_MCP_URL", "").strip()
    token = os.environ.get("MOSS_MCP_TOKEN", "").strip()
    if url and token:
        auth = token if token.lower().startswith("bearer ") else f"Bearer {token}"
        return url, auth

    mcp_path = Path.home() / ".cursor" / "mcp.json"
    if mcp_path.exists():
        cfg = json.loads(mcp_path.read_text(encoding="utf-8"))
        moss = (cfg.get("mcpServers") or {}).get("moss") or {}
        url = (moss.get("url") or "").strip()
        headers = moss.get("headers") or {}
        auth = (headers.get("Authorization") or "").strip()
        if url and auth:
            return url, auth

    raise RuntimeError(
        "未配置 MOSS 凭证。请在本目录创建 .env（MOSS_MCP_URL / MOSS_MCP_TOKEN），"
        "或在 ~/.cursor/mcp.json 配置 moss HTTP MCP。"
    )


def _moss_timeout() -> float:
    try:
        return max(10.0, float(os.environ.get("MOSS_TIMEOUT", "30")))
    except ValueError:
        return 30.0


def _unwrap_mcp_result(result: dict[str, Any]) -> dict[str, Any]:
    if result.get("isError"):
        content = result.get("content") or []
        msg = ""
        if content and content[0].get("type") == "text":
            msg = content[0].get("text") or ""
        raise RuntimeError(msg or "MOSS MCP isError=true")

    content = result.get("content") or []
    if content and content[0].get("type") == "text":
        text = content[0].get("text") or ""
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return {"raw_text": text, "status": "ok"}
        if isinstance(parsed, dict) and parsed.get("error_code") and not parsed.get("status"):
            raise RuntimeError(parsed.get("message") or parsed.get("error_code"))
        return parsed if isinstance(parsed, dict) else {"data": parsed, "status": "ok"}

    if "structuredContent" in result:
        sc = result["structuredContent"]
        return sc if isinstance(sc, dict) else {"data": sc, "status": "ok"}
    return result


def mcp_tools_call(
    url: str,
    auth: str,
    name: str,
    arguments: dict[str, Any],
    req_id: int = 1,
    retries: int = 1,
) -> dict[str, Any]:
    body = {
        "jsonrpc": "2.0",
        "id": req_id,
        "method": "tools/call",
        "params": {"name": name, "arguments": arguments},
    }
    timeout = _moss_timeout()
    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            method="POST",
            headers={
                "Authorization": auth,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            if "error" in payload:
                raise RuntimeError(payload["error"])
            return _unwrap_mcp_result(payload.get("result") or {})
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
            last_exc = exc
            if attempt >= retries:
                break
    assert last_exc is not None
    raise RuntimeError(f"MOSS 调用失败({name}): {last_exc}") from last_exc


def epoch_to_iso(ts: Any) -> str:
    if not ts:
        return now_iso()
    try:
        n = int(ts)
        if n > 1e12:
            n //= 1000
        return datetime.fromtimestamp(n, TZ_SH).isoformat(timespec="seconds")
    except (TypeError, ValueError, OSError):
        return now_iso()


def first_sentence(text: str, limit: int = 220) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    if not text:
        return ""
    parts = re.split(r"[。！？\n]", text)
    s = (parts[0] or "").strip()
    if len(s) < 40 and len(parts) > 1:
        s = (s + "。" + parts[1]).strip()
    return s[:limit] + ("…" if len(s) > limit else "")


def is_thin_content(title: str, summary: str, full_content: str = "") -> bool:
    """信息过简：行情快讯、转发摘录、几乎无事实展开。"""
    title = (title or "").strip()
    body = (full_content or summary or "").strip()
    body = re.sub(r"\s+", " ", body)
    blob = f"{title} {body}"
    if THIN_FLASH.search(blob):
        return True
    # 标题即行情句，且正文没有展开
    if re.search(r"(港股|股价|报\d).{0,20}(涨|跌)\d+(\.\d+)?%", title) and len(body) < 120:
        return True
    if 0 < len(body) < 18:
        return True
    # 纯报价短讯
    if CAPITAL.search(blob) and len(body) < 90 and not re.search(
        r"原因|影响|客户|交付|产能|招标|政策|管制|封测|推理|训练|订单|替代|国产",
        blob,
        re.I,
    ):
        return True
    return False


def is_quality(
    title: str,
    summary: str,
    source_name: str = "",
    url: str = "",
    full_content: str = "",
) -> bool:
    title = clean_title(title)
    blob = f"{title} {summary} {full_content}"
    # 共享闸门：拆字规避、赌博引流、内容农场塞词、来源残缺、政务会见等；
    # 产业相关性必须由标题承担，正文塞词不再算数。
    if not passes_intel_gate(title, summary, source_name, url, full_content):
        return False
    if NOISE.search(blob):
        return False

    body = (full_content or summary or "").strip()
    if is_thin_content(title, summary, body):
        return False

    host = host_from_url(url)
    hard_social = bool(SOCIAL_HARD.search(url or "") or SOCIAL_HARD.search(host))
    trash_source = bool(
        re.search(
            r"雪球|微博|抖音|快手|百家号|港股第一眼|AI快讯|每经AI|财联社AI",
            source_name or "",
            re.I,
        )
    )

    # 硬社交/低质落地页：一律不进 CEO 简报
    if hard_social or trash_source:
        return False
    return True


def is_generic_relevance(text: str) -> bool:
    t = (text or "").strip()
    if not t:
        return True
    return t == GENERIC_RELEVANCE or "需判断是否影响在手客户与交付承诺" in t or "建议纳入外部情报简报" in t


def short_title_phrase(title: str, max_len: int = 20) -> str:
    t = re.sub(r"[「」【】\[\]（）()《》\"'“”]", "", (title or "").strip())
    t = re.sub(r"\s+", " ", t)
    if len(t) <= max_len:
        return t
    return t[: max_len - 1] + "…"


def relevance_from_summary(summary: str) -> str:
    clause = first_sentence(summary or "", 72).strip("。；， ")
    if len(clause) < 12:
        return ""
    if re.search(r"大家好|点赞|关注|不做股票推荐|热卖|卷首语", clause):
        return ""
    return f"报道要点：{clause}。销售与产品评估对在谈客户选型的影响。"


def infer_relevance(
    title: str,
    summary: str,
    topic: str = "",
    profile: dict[str, Any] | None = None,
) -> str:
    blob = title + summary
    for pattern, rel in BIREN_MAP:
        if re.search(pattern, blob, re.I):
            return rel

    prof = profile or infer_impact_profile(title, summary, topic)
    impact_type = prof.get("impact_type") or "context"
    phrase = short_title_phrase(title)

    topic_impact_templates: dict[tuple[str, str], str] = {
        ("direct", "BR-POL"): "监管政策直接牵动国产算力合规与出货，法务与销售当日同步研判。",
        ("direct", "BR-CMP"): "竞品动作直指客户选型，当日更新对照方案与商务口径。",
        ("opportunity", "BR-CUS"): "头部客户出现算力扩容信号，销售跟踪 POC 与集采节点。",
        ("opportunity", "BR-POL"): "政策与补贴可能带动算力采购，核对区域集采与能效门槛。",
        ("competitor", "BR-CMP"): "竞品抬高客户比选标准，更新性能、能效、交付与报价对照。",
        ("chain", "BR-IND"): "产业链波动可能传导至封测与整机交付，核对关键物料与产能排期。",
        ("context", "BR-POL"): "政策口径变化，可能影响国产算力采购门槛与合规要求。",
        ("context", "BR-IND"): "产业链供需变化，评估是否影响 GPU 集群成本与客户 TCO。",
        ("context", "BR-CUS"): "客户算力投入计划调整，评估是否带来替换或扩容机会。",
        ("context", "BR-CMP"): "竞品生态与产品动作变化，评估对议价与客户留存的影响。",
        ("context", "BR-SEN"): "行业舆情升温；经营侧以交付与客户沟通为主，避免二级市场噪音干扰商务。",
    }
    tpl = topic_impact_templates.get((impact_type, topic))
    if tpl:
        return f"「{phrase}」：{tpl}" if phrase else tpl

    impact_only = {
        "direct": "对壁仞形成直接经营影响，相关部门当日评估应对动作。",
        "opportunity": "存在算力采购或合作机会，销售跟踪招标/POC 并评估切入时机。",
        "chain": "上下游波动可能传导至交付，核对封测排期与关键物料。",
        "competitor": "竞品抬高客户比选压力，更新对照方案与报价策略。",
        "context": "外部环境变化，纳入本周经营情报复盘。",
    }
    base = impact_only.get(impact_type, impact_only["context"])
    from_summary = relevance_from_summary(summary)
    if from_summary and len(from_summary) > 20:
        return from_summary
    return f"「{phrase}」：{base}" if phrase else base


def host_from_url(url: str) -> str:
    if not url:
        return ""
    m = re.search(r"https?://(?:www\.)?([^/]+)", url, re.I)
    return (m.group(1) if m else "").lower()


def normalize_source_name(raw: str, url: str = "") -> str:
    name = re.sub(r"\s+", " ", (raw or "").strip())
    host = host_from_url(url)
    host_map = {
        "jiemian.com": "界面新闻",
        "caixin.com": "财新",
        "yicai.com": "第一财经",
        "wallstreetcn.com": "华尔街见闻",
        "36kr.com": "36氪",
        "jiqizhixin.com": "机器之心",
        "qbitai.com": "量子位",
        "eet-china.com": "电子工程专辑",
        "laoyaoba.com": "集微网",
        "semiinsights.com": "芯智讯",
        "thepaper.cn": "澎湃新闻",
        "reuters.com": "路透",
        "bloomberg.com": "彭博",
        "toutiao.com": "今日头条",
        "jianshu.com": "简书",
        "mp.weixin.qq.com": "微信公众号",
        "xueqiu.com": "雪球",
        "weibo.com": "微博",
        "nbd.com.cn": "每日经济新闻",
    }
    if name and name not in ("行业媒体", "未知来源", "未知", "null"):
        return name[:32]
    for key, label in host_map.items():
        if key in host:
            return label
    if host:
        return host.split(".")[0][:24]
    return "行业媒体"


def infer_confidence(source_name: str, url: str = "") -> dict[str, str]:
    blob = f"{source_name} {url}"
    if SOURCE_HIGH.search(blob):
        return {"confidence": "high", "confidence_label": "高"}
    if SOURCE_LOW.search(blob) or not source_name or source_name == "行业媒体":
        return {"confidence": "low", "confidence_label": "低"}
    if SOURCE_MED.search(blob):
        return {"confidence": "medium", "confidence_label": "中"}
    # 有明确域名但未命中名单 → 中等
    if host_from_url(url):
        return {"confidence": "medium", "confidence_label": "中"}
    return {"confidence": "low", "confidence_label": "低"}


def infer_impact_profile(title: str, summary: str, topic: str) -> dict[str, Any]:
    """按对壁仞的影响类型打标并给出排序分。

    注意：仅提到「壁仞」不等于直接影响；必须伴随可核对的经营事件，
    否则概念股拼接标题会被打成 100 分顶到首页。
    """
    blob = title + summary
    tags: list[str] = []

    biren_hit = bool(re.search(r"壁仞|Biren|BR10[04]", blob, re.I))
    policy_hit = bool(re.search(
        r"出口管制|制裁|国产替代|信创目录|集采中标|丢标|客户切换|替换英伟达|替换昇腾",
        blob,
        re.I,
    ))
    biren_event = bool(re.search(
        r"成立|注册资本|中标|丢标|签约|合作|发布|量产|投产|出货|交付|流片|适配|"
        r"融资|获投|搬迁|扩产|任命|诉讼|裁员",
        title,
        re.I,
    ))
    direct = policy_hit or (biren_hit and biren_event)
    opportunity = bool(re.search(
        r"招标|采购|集采|扩容|POC|推理卡|推理需求|Agent|WAIC|算电协同|"
        r"能效|TCO|性价比|新机会|订单|中标",
        blob,
        re.I,
    ))
    upstream = bool(re.search(
        r"封测|HBM|先进封装|光刻|刻蚀|EDA|设备|晶圆|CoWoS|基板",
        blob,
        re.I,
    ))
    downstream = bool(re.search(
        r"智算中心|AI服务器|整机|机柜|集群|云厂商|阿里云|字节|腾讯云|百度智能云",
        blob,
        re.I,
    ))
    competitor = bool(re.search(
        r"英伟达|NVIDIA|昇腾|寒武纪|摩尔线程|海光|天数|Meta.*芯片|自研芯片|Iris",
        blob,
        re.I,
    )) or topic == "BR-CMP"

    if direct:
        impact_type, impact_label = "direct", "直接影响"
        tags.append("直接影响")
        level, score = "high", 92
    elif opportunity:
        impact_type, impact_label = "opportunity", "新机会"
        tags.append("新机会")
        level, score = ("high" if topic in ("BR-CUS", "BR-POL") else "medium"), 84
    elif upstream or downstream:
        impact_type, impact_label = "chain", "上下游"
        tags.append("上游" if upstream else "下游")
        if upstream and downstream:
            tags = ["上游", "下游"]
        level, score = "medium", 72
    elif competitor:
        impact_type, impact_label = "competitor", "竞品压力"
        tags.append("竞品压力")
        level, score = ("high" if re.search(r"昇腾|自研芯片|替代", blob, re.I) else "medium"), 68
    else:
        impact_type, impact_label = "context", "环境观察"
        tags.append("环境观察")
        level, score = ("low" if topic == "BR-SEN" else "medium"), 48

    # 政策/客户主题整体上调
    if topic == "BR-POL" and level != "high":
        score += 8
    if topic == "BR-CUS" and opportunity:
        score += 6
    if topic == "BR-SEN" and not direct:
        level, score = "low", min(score, 40)
    # 仅点名壁仞、无可核对事件：不进直接影响，分数压低
    if biren_hit and not direct:
        score = min(score, 36)
        level = "low"

    return {
        "impact_level": level,
        "impact_type": impact_type,
        "impact_label": impact_label,
        "priority_score": score,
        "type_tags": tags,
    }


def infer_tags(title: str, summary: str, topic: str, type_tags: list[str] | None = None) -> list[str]:
    blob = title + summary
    tags: list[str] = list(type_tags or [])
    mapping = [
        (r"出口|管制|制裁", "出口管制"),
        (r"国产化|信创|国产替代", "国产化"),
        (r"招标|采购|集采|中标", "算力采购"),
        (r"推理", "推理场景"),
        (r"训练|大模型", "大模型"),
        (r"封测|先进封装|CoWoS", "封测上游"),
        (r"HBM|内存|互连", "存储互连"),
        (r"DPU|网络|集群", "集群网络"),
        (r"能效|算电|功耗", "能效约束"),
        (r"舆情|股价|配售", "品牌舆情"),
        (r"英伟达|NVIDIA|昇腾|寒武纪|摩尔线程", "竞品对标"),
        (r"阿里云|字节|腾讯|百度", "头部客户"),
    ]
    for pat, tag in mapping:
        if re.search(pat, blob, re.I) and tag not in tags:
            tags.append(tag)
    if len(tags) <= 1:
        fallback = {
            "BR-POL": "政策监管",
            "BR-CMP": "竞品雷达",
            "BR-IND": "产业链",
            "BR-CUS": "客户动态",
            "BR-SEN": "舆情品牌",
        }.get(topic)
        if fallback and fallback not in tags:
            tags.append(fallback)
    return tags[:5]


def infer_impact(title: str, summary: str, topic: str) -> str:
    return infer_impact_profile(title, summary, topic)["impact_level"]


def extract_rows_from_moss(payload: dict[str, Any], topic_id: str) -> list[dict[str, Any]]:
    data = payload.get("data") or {}
    result = data.get("result") or payload.get("result") or []
    rows: list[dict[str, Any]] = []
    for raw in result:
        d = raw.get("data") or raw
        title = (d.get("title") or "").strip()
        content = (d.get("content") or "").strip()
        if not title and content:
            title = first_sentence(content, 80)
        title = clean_title(title)
        if len(title) > 100:
            title = title[:97] + "…"
        summary = first_sentence(content or title, 240)
        url = (d.get("url") or d.get("source_url") or "").strip()
        source = normalize_source_name(
            d.get("website")
            or d.get("source")
            or d.get("media_name")
            or d.get("user_name")
            or "",
            url,
        )
        if not title or not is_quality(title, summary, source, url, full_content=content):
            continue
        rows.append(
            {
                "topic_id": topic_id,
                "title": title,
                "summary": summary,
                "source_name": source,
                "source_url": url,
                "published_at": epoch_to_iso(d.get("ctime") or d.get("publish_time") or d.get("gather_ctime")),
            }
        )
    return rows


def _topic_gap() -> float:
    """MOSS 舆情接口限流约 1 次/秒，主题间必须串行留间隙。"""
    try:
        return max(1.05, float(os.environ.get("MOSS_TOPIC_GAP", "1.15")))
    except ValueError:
        return 1.15


def _is_rate_limited(payload: dict[str, Any] | Exception) -> bool:
    if isinstance(payload, Exception):
        text = str(payload)
    else:
        text = json.dumps(payload, ensure_ascii=False)
    return (
        "429" in text
        or "api000010" in text
        or "1次/1秒" in text
        or ("超出" in text and "限制" in text)
    )


def _short_topic_error(topic_id: str, exc: Exception) -> str:
    text = str(exc)
    if _is_rate_limited(exc):
        return f"{topic_id}: 接口限流（约 1 次/秒），已自动降速重试或跳过"
    # 避免把整段 JSON 甩到 CEO 界面
    if len(text) > 120:
        text = text[:117] + "…"
    return f"{topic_id}: {text}"


def search_topic(url: str, auth: str, query: dict[str, str], req_id: int) -> list[dict[str, Any]]:
    arguments: dict[str, Any] = {
        "days": 3,
        "size": 20,
        "source": ["news", "weixin"],
        "sort": "ctime",
    }
    if query.get("keyword"):
        arguments["keyword"] = query["keyword"]
    if query.get("must_kw"):
        arguments["must_kw"] = query["must_kw"]
    if query.get("should_kw"):
        arguments["should_kw"] = query["should_kw"]
    if query.get("not_kw"):
        arguments["not_kw"] = query["not_kw"]

    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            payload = mcp_tools_call(
                url,
                auth,
                "moss_public_opinion_search",
                arguments,
                req_id=req_id + attempt,
                retries=1,
            )
            status = payload.get("status")
            code = payload.get("code")
            if status and status not in ("success", "ok"):
                msg = payload.get("message") or payload.get("description") or status
                if _is_rate_limited(payload) and attempt < 2:
                    time.sleep(1.25 * (attempt + 1))
                    continue
                raise RuntimeError(f"{query['topic_id']} MOSS 返回 status={status}: {msg}")
            if code not in (None, 0, "0", 200, "200") and status not in ("success", "ok"):
                if (str(code) == "429" or _is_rate_limited(payload)) and attempt < 2:
                    time.sleep(1.25 * (attempt + 1))
                    continue
                raise RuntimeError(f"{query['topic_id']} MOSS code={code}: {payload.get('message')}")
            return extract_rows_from_moss(payload, query["topic_id"])
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if _is_rate_limited(exc) and attempt < 2:
                time.sleep(1.25 * (attempt + 1))
                continue
            raise
    raise last_exc or RuntimeError(f"{query['topic_id']} MOSS 调用失败")


def to_pack_item(row: dict[str, Any], idx: int, collected_at: str) -> dict[str, Any]:
    topic = row["topic_id"]
    prefix = TOPIC_PREFIX.get(topic, "ITM")
    day = datetime.now(TZ_SH).strftime("%Y%m%d")
    title = row["title"]
    summary = row["summary"]
    source_name = normalize_source_name(row.get("source_name") or "", row.get("source_url") or "")
    profile = infer_impact_profile(title, summary, topic)
    conf = infer_confidence(source_name, row.get("source_url") or "")
    # 置信度强权重：权威发布显著靠前，低置信大幅后置
    score = profile["priority_score"]
    if conf["confidence"] == "high":
        score += 22
    elif conf["confidence"] == "medium":
        score += 8
    else:
        score -= 28
    # 纯行情类即使漏网也压到末尾
    if CAPITAL.search(title + summary):
        score -= 40

    item = {
        "topic_id": topic,
        "item_id": f"{prefix}-{day}-{idx:02d}",
        "title": title,
        "summary": summary,
        "source_name": source_name,
        "source_url": row["source_url"],
        "sources": [{"name": source_name, "url": row["source_url"]}] if row["source_url"] else [],
        "published_at": row["published_at"],
        "collected_at": collected_at,
        "impact_level": profile["impact_level"],
        "impact_type": profile["impact_type"],
        "impact_label": profile["impact_label"],
        "priority_score": score,
        "confidence": conf["confidence"],
        "confidence_label": conf["confidence_label"],
        "tags": infer_tags(title, summary, topic, profile["type_tags"]),
        "related_metric_tags": [],
        "biren_relevance": infer_relevance(title, summary, topic, profile),
        "category": "external",
    }
    if CAPITAL.search(title + summary):
        item["tags"] = list(dict.fromkeys([*(item["tags"] or []), "资本市场"]))
    return item


def split_packs(items: list[dict[str, Any]], refreshed_at: str) -> dict[str, Any]:
    # 直接影响 / 新机会 / 上下游优先，其次置信度，再次发布时间
    ordered = sorted(
        items,
        key=lambda i: (
            i.get("priority_score") or 0,
            {"high": 2, "medium": 1, "low": 0}.get(i.get("confidence"), 0),
            i.get("published_at") or "",
        ),
        reverse=True,
    )

    def diversify(pool: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
        """优先保证五类 topic 各至少 1 条，再按优先级填满。"""
        if len(pool) <= limit:
            return pool
        by_topic: dict[str, list[dict[str, Any]]] = {}
        for it in pool:
            by_topic.setdefault(it.get("topic_id") or "UNK", []).append(it)
        out: list[dict[str, Any]] = []
        seen: set[str] = set()

        def add(it: dict[str, Any]) -> None:
            key = it.get("item_id") or it.get("title") or ""
            if key in seen:
                return
            seen.add(str(key))
            out.append(it)

        for topic in ("BR-POL", "BR-CMP", "BR-IND", "BR-CUS", "BR-SEN"):
            rows = by_topic.get(topic) or []
            if rows:
                add(rows[0])
            if len(out) >= limit:
                return out
        for it in pool:
            if len(out) >= limit:
                break
            add(it)
        return out

    morning_items = diversify(ordered, 8)
    # noon：尽量取 morning 未覆盖的后续高分
    morning_ids = {i.get("item_id") for i in morning_items}
    noon_pool = [i for i in ordered if i.get("item_id") not in morning_ids]
    noon_items = diversify(noon_pool or ordered[8:], 6)
    evening_items = diversify(ordered, 16)

    def pack(bundle_type: str, bundle_id: str, pack_items: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "bundle_id": bundle_id,
            "bundle_type": bundle_type,
            "org": "biren",
            "timezone": "Asia/Shanghai",
            "generated_at": refreshed_at,
            "client_refreshed_at": refreshed_at,
            "source": "moss_live",
            "items": pack_items,
        }

    day = datetime.now(TZ_SH).strftime("%Y%m%d-%H%M")
    return {
        "morning": pack("morning_pack", f"BIREN-MORNING-LIVE-{day}", morning_items),
        "noon": pack("noon_delta", f"BIREN-NOON-LIVE-{day}", noon_items or morning_items[:4]),
        "evening": pack("evening_pack", f"BIREN-EVENING-LIVE-{day}", evening_items or morning_items),
    }


def effective_relevance(item: dict[str, Any]) -> str:
    rel = (item.get("biren_relevance") or "").strip()
    if not is_generic_relevance(rel):
        return rel
    topic = item.get("topic_id") or ""
    title = item.get("title") or ""
    summary = item.get("summary") or ""
    profile = {
        "impact_type": item.get("impact_type"),
        "impact_label": item.get("impact_label"),
        "impact_level": item.get("impact_level"),
    }
    if not profile["impact_type"]:
        profile = infer_impact_profile(title, summary, topic)
    return infer_relevance(title, summary, topic, profile)


def build_day_summary(items: list[dict[str, Any]]) -> dict[str, Any]:
    ordered = sorted(items, key=lambda i: i.get("priority_score") or 0, reverse=True)
    top = ordered[:8]
    tag_counts: dict[str, int] = {}
    for item in top:
        for tag in item.get("tags") or []:
            if tag in ("环境观察", "舆情品牌", "政策监管"):
                continue
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
    themes = [k for k, _ in sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:3]]
    if themes:
        headline = f"{'与'.join(themes[:2])}成外部热点" + (f"，{themes[2]}需同步跟踪" if len(themes) > 2 else "")
    elif top:
        headline = f"{short_title_phrase(top[0].get('title') or '外部情报', 24)}等事项需经营侧跟进"
    else:
        headline = "外部环境相对平稳，优先查看高影响条目"

    high_impact = sum(1 for i in items if i.get("impact_level") == "high")
    topics_covered = sorted({i.get("topic_id") for i in items if i.get("topic_id")})
    track_part = (
        f" 重点跟踪{'、'.join(themes[:2])}。"
        if themes
        else " 优先查看竞品与客户动态。"
    )
    bridge = f"今日共收录 {len(items)} 条经营相关情报，高影响 {high_impact} 条。{track_part}"
    signals = []
    for item in top[:3]:
        rel = effective_relevance(item)
        short = short_title_phrase(item.get("title") or "", 22)
        signals.append(f"{short}：{rel[:48]}{'…' if len(rel) > 48 else ''}")

    return {
        "headline": headline[:56],
        "bridge": bridge[:120],
        "high_impact_count": high_impact,
        "topics_covered": topics_covered,
        "external_signals": signals,
    }


def build_external_focus(items: list[dict[str, Any]], limit: int = 3) -> list[dict[str, str]]:
    tag_map = {
        "BR-POL": "政策",
        "BR-CMP": "竞品",
        "BR-IND": "产业",
        "BR-CUS": "客户",
        "BR-SEN": "舆情",
    }
    ordered = sorted(
        items,
        key=lambda i: (
            i.get("priority_score") or 0,
            {"high": 2, "medium": 1, "low": 0}.get(i.get("impact_level"), 0),
        ),
        reverse=True,
    )
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in ordered:
        title = re.sub(r"\s+", " ", item.get("title") or "").strip()
        if not title:
            continue
        key = re.sub(r"\s+", "", title)[:18]
        if key in seen:
            continue
        why = effective_relevance(item)
        if is_generic_relevance(why):
            continue
        seen.add(key)
        display_title = title[:27] + "…" if len(title) > 28 else title
        if len(why) > 72:
            why = why[:71] + "…"
        out.append({
            "tag": tag_map.get(item.get("topic_id"), "外部"),
            "text": display_title,
            "why": why,
        })
        if len(out) >= limit:
            break
    if not out and ordered:
        item = ordered[0]
        title = (item.get("title") or "").strip()
        why = effective_relevance(item)
        out.append({
            "tag": tag_map.get(item.get("topic_id"), "外部"),
            "text": title[:27] + "…" if len(title) > 28 else title,
            "why": why[:72],
        })
    return out


def select_balanced_rows(rows: list[dict[str, Any]], limit: int = 40) -> list[dict[str, Any]]:
    """保证五类 topic 都有席位，避免热门主题挤掉 BR-SEN 等。"""
    if len(rows) <= limit:
        return rows
    by_topic: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        by_topic.setdefault(row.get("topic_id") or "UNK", []).append(row)
    for topic_rows in by_topic.values():
        topic_rows.sort(key=lambda r: r.get("published_at") or "", reverse=True)

    selected: list[dict[str, Any]] = []
    seen: set[str] = set()

    def take(row: dict[str, Any]) -> None:
        key = re.sub(r"\s+", "", row.get("title") or "")[:40]
        if not key or key in seen:
            return
        seen.add(key)
        selected.append(row)

    # 每 topic 先保底 2 条
    for topic in ("BR-POL", "BR-CMP", "BR-IND", "BR-CUS", "BR-SEN"):
        for row in (by_topic.get(topic) or [])[:2]:
            if len(selected) >= limit:
                break
            take(row)

    # 其余按时间填满
    rest = sorted(rows, key=lambda r: r.get("published_at") or "", reverse=True)
    for row in rest:
        if len(selected) >= limit:
            break
        take(row)
    return selected


def refresh_intel_from_moss() -> dict[str, Any]:
    url, auth = load_moss_auth()
    refreshed_at = now_iso()
    collected_at = refreshed_at
    errors: list[str] = []
    all_rows: list[dict[str, Any]] = []
    seen_titles: set[str] = set()
    seen_bodies: set[str] = set()
    topic_stats: dict[str, dict[str, Any]] = {}
    t0 = datetime.now(TZ_SH)

    # MOSS 舆情限流约 1 次/秒：主题必须串行，禁止并行打满
    gap = _topic_gap()
    budget = _refresh_budget()
    for idx, q in enumerate(TOPIC_QUERIES):
        elapsed = (datetime.now(TZ_SH) - t0).total_seconds()
        if elapsed >= budget - 2:
            left = [x["topic_id"] for x in TOPIC_QUERIES[idx:]]
            errors.append(f"超出 {int(budget)}s 刷新预算，未完成：{'、'.join(left)}")
            break
        if idx > 0:
            time.sleep(gap)
        tid = q["topic_id"]
        try:
            rows = search_topic(url, auth, q, idx + 1)
            topic_stats[tid] = {"ok": True, "raw": len(rows)}
            for row in rows:
                key = re.sub(r"\s+", "", row["title"])[:40]
                if key in seen_titles:
                    continue
                # 同一段正文被多个标题复用 = 内容农场批量灌页，只留首条
                body_key = body_fingerprint(row.get("summary") or "")
                if body_key and body_key in seen_bodies:
                    continue
                seen_titles.add(key)
                if body_key:
                    seen_bodies.add(body_key)
                all_rows.append(row)
        except Exception as exc:  # noqa: BLE001
            errors.append(_short_topic_error(tid, exc))
            topic_stats[tid] = {"ok": False, "error": str(exc)}

    all_rows.sort(key=lambda r: r.get("published_at") or "", reverse=True)
    balanced = select_balanced_rows(all_rows, limit=40)
    items = [to_pack_item(row, i + 1, collected_at) for i, row in enumerate(balanced)]
    # 推荐门槛：低置信且低分不进简报（闸门漏网的兜底）
    items = [
        it
        for it in items
        if (it.get("priority_score") or 0) >= 40
        or it.get("confidence") == "high"
        or (it.get("impact_type") == "direct" and (it.get("priority_score") or 0) >= 70)
    ]
    packs = split_packs(items, refreshed_at)
    elapsed_ms = int((datetime.now(TZ_SH) - t0).total_seconds() * 1000)
    failed_topics = [k for k, v in topic_stats.items() if not v.get("ok")]

    # 空结果或全 topic 失败：不可伪装成成功 live
    if not items:
        return {
            "ok": False,
            "mode": "moss_empty",
            "refreshed_at": refreshed_at,
            "item_count": 0,
            "errors": errors or ["MOSS 返回 0 条有效情报"],
            "topic_stats": topic_stats,
            "elapsed_ms": elapsed_ms,
            "error": "MOSS 实时检索无有效条目",
            "external_focus": [],
            "day_summary": {},
            "packs": packs,
        }

    mode = "moss_live" if not failed_topics else "moss_partial"
    return {
        "ok": True,
        "mode": mode,
        "refreshed_at": refreshed_at,
        "item_count": len(items),
        "errors": errors,
        "topic_stats": topic_stats,
        "elapsed_ms": elapsed_ms,
        "external_focus": build_external_focus(items),
        "day_summary": build_day_summary(items),
        "packs": packs,
    }


if __name__ == "__main__":
    try:
        result = refresh_intel_from_moss()
        print(json.dumps({
            "ok": result["ok"],
            "item_count": result["item_count"],
            "errors": result["errors"],
            "external_focus": result["external_focus"],
            "sample": [i["title"] for i in (result["packs"]["evening"].get("items") or [])[:5]],
        }, ensure_ascii=False, indent=2))
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False))
