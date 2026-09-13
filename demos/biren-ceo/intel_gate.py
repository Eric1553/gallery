#!/usr/bin/env python3
"""情报质量闸门：所有演示包共用的唯一实现。

单一事实来源在 scripts/intel_gate.py，由 scripts/sync_intel_gate.py 分发到
每个演示包目录（与 moss_live.py 同级）。请勿在演示包内单独修改本文件。

拦截目标（按线上事故归纳）：
1. 赌博/引流广告用全角空格拆字规避词库（「彩　票　必　中」）；
2. 内容农场：标题是广告、正文塞满「算力/智算」等产业词骗过相关性判定；
3. 同一段模板正文被多个标题复用，导致多条情报摘要完全一样；
4. 抓取元数据残缺（来源名被截成单字符），无法向 CEO 交代出处；
5. 导购软文、刊物广告、股吧发言、纯政务会见等与经营决策无关的条目；
6. 概念股拼接标题、博客科普、百度落地页、无关公司信披问询函（2026-07-31 刷新事故）。
"""

from __future__ import annotations

import re

GATE_VERSION = "v4-20260731"

# 产业相关性词库：必须由标题承担（权威源可放宽到摘要）
RELEVANCE = re.compile(
    r"GPU|算力|芯片|半导体|英伟达|NVIDIA|昇腾|寒武纪|摩尔线程|海光|天数|壁仞|Biren|BR100|"
    r"智算|大模型|AI服务器|封测|HBM|DPU|澜起|出口管制|国产化|信创|智算中心|推理|训练|"
    r"算电协同|WAIC|DeepSeek|腾讯混元|华为|阿里云|字节",
    re.I,
)

# 赌博 / 色情 / 引流广告
SPAM = re.compile(
    r"彩民|彩票|双色球|时时彩|竞彩|福彩|六合彩|博彩|赌球|赌场|棋牌|百家乐|"
    r"信用盘|外围盘|返水|流水提成|包赢|稳赚|必中|包中|下注|投注|开户送|"
    r"邀请码|注册码|优惠大厅|秒提现|秒到账|赚钱软件|挂机赚|日入过万|"
    r"科普优选|优选榜单>|加微信|加V信|加威信|私聊我|裸聊|情色|约炮",
    re.I,
)

# 内容农场模板开场：正文与标题无关，无法据此写出诚实解读
BOILERPLATE = re.compile(
    r"在智能化技术快速迭代的今天|"
    r"随着(人工智能|智能化|科技|互联网)的?(快速|不断|飞速)?发展[，,]|"
    r"本文将(为您|带您|详细)|"
    r"更多(详情|信息|资讯)请(咨询|联系|关注)|"
    r"以上就是.{0,12}的全部内容|"
    r"写在前面|来玩叠叠乐|知识以奇怪的姿势",
    re.I,
)

# 标题党 / 盘面情绪文
CLICKBAIT = re.compile(
    r"痴人说梦|当场完蛋|狂飙|干崩|干翻|曝光了|秘闻|妻子的|暧昧对象|"
    r"不转不是|震惊|太可怕|真相了|一夜之间|彻底完了|彻底凉了|"
    r"只要.{0,12}敢.{0,20}(就|会|当场)|几百家.{0,8}完蛋|"
    r"[！!]{2,}|[？?]{2,}|！！|？？|"
    r"教育行业业绩未来可期|未来可期[！!]|"
    r"股民看到盘面|直接懵了|被按在地上摩擦|一脚踩下去|"
    r"还能稳多久[？?]",
    re.I,
)

# 导购/软文/广告
LISTICLE = re.compile(
    r"避坑|大盘点|厂家盘点|生产厂家|贴牌合作|怎么选|哪家好|排行榜|"
    r"加盟|代理招商|软文|广告|报价表|多少钱|"
    r"专业选型|选型与配置|配置建议|选购指南|买哪款|照着这\d+款|"
    r"新刊热卖|热卖丨|限时优惠|扫码领取",
    re.I,
)

# 股吧/雪球式发言与二级市场话题：来源名可能被标成「行业媒体」，只能靠标题识别。
# 仅对标题匹配，避免误杀正文里顺带提到资本动作的产业报道。
STOCK_TALK = re.compile(
    r"\$[^$\n]{2,24}\([A-Z]{2}[|｜:：]?\d{4,6}\)\$|"
    r"配售价格|你该砸|砸到\d|没出息|一点不跟|"
    r"目标价|增持|回购|解禁|流通盘|折让|二级市场|涨停|跌停",
    re.I,
)

# 公众号/自媒体/博客转述：本身不是一手信源，只有携带具体经营事件时才值得上 CEO 桌面
SELF_MEDIA = re.compile(
    r"微信公众号|公众号|自媒体|今日头条|头条号|百家号|简书|知乎|大鱼号|网易号|搜狐号|"
    r"CSDN|博客园|掘金|segmentfault|小红书|bilibili|B站",
    re.I,
)
# 具体经营事件：能落到某个动作或时间点上，而不是泛泛讨论
BUSINESS_EVENT = re.compile(
    r"招标|中标|集采|采购|签约|合作|发布|量产|投产|扩产|出货|交付|流片|适配|认证|"
    r"出口管制|实体清单|许可|禁令|管制|清单|"
    r"涨价|降价|扩容|上线|下架|召回|中止|试点|印发|发文|通知|规划|"
    r"财报|营收|订单|产能|排产|供货|"
    r"成立|注册资本|获投|融资|搬迁|任命",
    re.I,
)
# 科普/解释/评论体：有产业词但没有可执行信息
EXPLAINER = re.compile(
    r"到底有多|到底是什么|是什么意思|为什么会|为什么依赖|怎么回事|一模一样|"
    r"有多强|强在哪|凭什么|靠什么|的焦虑|的野心|的隐忧|意味着什么|"
    r"科普|入门|扫盲|详解|全解析|一文(读懂|看懂|说清)|完整解析",
    re.I,
)

# 易死链的聚合页 / 无效落地页 / 低质内容站
BAD_URL = re.compile(
    r"yoojia\.baidu\.com|baidu\.com/app/tuwen|hao123\.com|"
    r"toutiao\.com/article|mp\.weixin\.qq\.com/s\?__biz=0|"
    r"mbd\.baidu\.com|blog\.csdn\.net|toutiao\.com/w/|"
    r"jianshu\.com|zhihu\.com/p/|baijiahao\.baidu\.com",
    re.I,
)

# 纯政务会见/座谈：无产业关键词则不进 CEO 简报
POLITICAL_MEETING = re.compile(r"座谈|会见|调研|考察|走访|接见|一行到", re.I)
INDUSTRY_SIGNAL = re.compile(
    r"算力|GPU|芯片|半导体|信创|国产化|集采|招标|出口管制|实体清单|"
    r"智算|大模型|封测|HBM|英伟达|昇腾|壁仞|Biren",
    re.I,
)

# 无关公司信披/问询函：标题有「半导体」但与壁仞经营无关
FILING_JUNK = re.compile(
    r"信息披露监管问询函|问询函的?回复|关于.*年度报告.*回复公告|"
    r"证券代码[:：]|公告编号[:：]",
    re.I,
)
PEER_OR_SELF = re.compile(
    r"壁仞|Biren|寒武纪|海光|摩尔线程|天数|沐曦|燧原|昇腾|英伟达|NVIDIA|"
    r"澜起|长电|通富|华天|台积电|SK海力士|海力士|三星",
    re.I,
)

# 权威 / 行业媒体：唯一允许「标题无产业词、靠摘要过关」的来源
SOURCE_AUTHORITY = re.compile(
    r"新华社|新华财经|人民日报|人民网|央视|中央社|工信部|发改委|财政部|科技部|证监会|"
    r"国务院|中国政府网|证券时报|上海证券报|中国证券报|经济日报|科技日报|财新|第一财经|"
    r"界面|华尔街见闻|路透|Reuters|Bloomberg|彭博|FT|Financial Times|"
    r"SEMI|集微网|芯智讯|电子工程专辑|半导体行业观察|机器之心|量子位|36氪|钛媒体|"
    r"people\.com\.cn|people\.cn|xinhuanet\.com|news\.cn|cctv\.com|gov\.cn|"
    r"yicai\.com|caixin\.com|jiemian\.com|wallstreetcn\.com|laoyaoba\.com|"
    r"semiinsights\.com|eet-china\.com|stdaily\.com|jiqizhixin\.com|qbitai\.com|"
    r"36kr\.com|reuters\.com|bloomberg\.com",
    re.I,
)

# 社交/短视频/股吧二手信息
SOCIAL_JUNK = re.compile(
    r"雪球|xueqiu\.com|微博|weibo\.com|抖音|douyin\.com|快手|百家号|"
    r"baijiahao\.baidu\.com|贴吧|港股第一眼|AI快讯|每经AI|财联社AI|"
    r"今日头条|toutiao\.com|CSDN|csdn\.net",
    re.I,
)

_SEPARATORS = "\\s\u3000\u200b\u200c\u200d\u200e\u200f\ufeff·・‧∙…．.。、,，\\-—_~*|/\\\\"
_SEP_RE = re.compile(f"[{_SEPARATORS}]+")


def compact_text(text: str) -> str:
    """压掉空白与分隔符，用于对抗「买　大　买　单」式拆字规避。"""
    return _SEP_RE.sub("", text or "")


def is_obfuscated_title(title: str) -> bool:
    """全角空格逐字拆开的标题只出现在垃圾广告里。"""
    raw = (title or "").strip()
    if len(raw) < 8:
        return False
    seps = len(_SEP_RE.findall(raw))
    if seps < 5:
        return False
    return seps / max(len(raw), 1) > 0.28


def clean_title(title: str) -> str:
    """去掉拆字用的全角空格与零宽字符，保留正常词间空格。"""
    t = re.sub(r"[\u200b\u200c\u200d\u200e\u200f\ufeff]", "", title or "")
    if is_obfuscated_title(t):
        t = _SEP_RE.sub("", t)
    return re.sub(r"\s+", " ", t).strip()


def host_from_url(url: str) -> str:
    if not url:
        return ""
    m = re.search(r"https?://(?:www\.)?([^/]+)", url, re.I)
    return (m.group(1) if m else "").lower()


def is_authoritative(source_name: str = "", url: str = "") -> bool:
    blob = f"{source_name} {url} {host_from_url(url)}"
    if SOCIAL_JUNK.search(blob):
        return False
    return bool(SOURCE_AUTHORITY.search(blob))


def body_fingerprint(text: str, length: int = 60) -> str:
    """用于跨条目识别「同一段模板正文配不同标题」的内容农场。"""
    return compact_text(text)[:length]


def is_ticker_list_title(title: str) -> bool:
    """「广合科技，杰创智能，壁仞科技，寒武纪」式概念股拼接，无经营事件。"""
    t = (title or "").strip().rstrip("。．.;；")
    parts = [p.strip() for p in re.split(r"[，,、；;]\s*", t) if p.strip()]
    if len(parts) < 3:
        return False
    if any(len(p) > 14 for p in parts):
        return False
    if BUSINESS_EVENT.search(t) or re.search(r"发布|解读|调研|公告|中标|管制", t):
        return False
    # 多数分段像公司/产品名短词
    shortish = sum(1 for p in parts if 2 <= len(p) <= 10)
    return shortish >= 3 and shortish / len(parts) >= 0.75


def is_outline_dump_title(title: str) -> bool:
    """标题直接粘贴文章大纲/小节标题。"""
    t = title or ""
    if re.search(r"一[、.].{2,40}二[、.]", t):
        return True
    if re.search(r"完整解析[（(]|事件基础架构|目录\s*写在", t):
        return True
    if len(t) > 72 and t.count("、") + t.count("：") + t.count(":") >= 4:
        return True
    return False


def is_title_summary_clone(title: str, summary: str) -> bool:
    """标题与摘要几乎同一句话，没有事实展开。"""
    tc = compact_text(title)
    sc = compact_text(summary)
    if not tc or not sc:
        return False
    if tc == sc:
        return True
    if len(tc) >= 10 and sc.startswith(tc) and len(sc) <= len(tc) + 6:
        return True
    return False


def gate_reject_reason(
    title: str,
    summary: str = "",
    source_name: str = "",
    url: str = "",
    full_content: str = "",
) -> str:
    """返回拒绝原因；通过则返回空串。便于排查与回归测试。"""
    title = clean_title(title)
    head = f"{title} {summary}"
    blob = f"{head} {full_content}"
    title_compact = compact_text(title)
    blob_compact = compact_text(blob)

    if is_obfuscated_title(title):
        return "标题被逐字拆开（垃圾广告规避手法）"
    if SPAM.search(title_compact) or SPAM.search(blob_compact):
        return "命中赌博/引流广告词库"
    if is_ticker_list_title(title):
        return "概念股/公司名拼接标题，无经营事件"
    if is_outline_dump_title(title):
        return "标题粘贴全文大纲"
    if is_title_summary_clone(title, summary) and not BUSINESS_EVENT.search(title):
        return "标题与摘要雷同且无经营事件"
    if CLICKBAIT.search(title) or CLICKBAIT.search((summary or "")[:80]):
        return "标题党/盘面情绪文"
    if LISTICLE.search(title):
        return "导购/软文/广告"
    if STOCK_TALK.search(title):
        return "股吧发言/二级市场话题"
    if BAD_URL.search(url or ""):
        return "聚合页或低质落地页"
    if len(title) < 8:
        return "标题过短"
    if BOILERPLATE.search(summary or "") or BOILERPLATE.search((full_content or "")[:200]):
        return "内容农场模板正文，摘要与标题无关"
    if FILING_JUNK.search(title) and not PEER_OR_SELF.search(title):
        return "无关公司信披/问询函"

    authoritative = is_authoritative(source_name, url)
    if SOCIAL_JUNK.search(f"{source_name} {url} {host_from_url(url)}"):
        return "社交/股吧二手信息"
    if len(compact_text(source_name)) < 2 and not authoritative:
        return "来源名残缺，出处不可交代"

    # 关键一条：产业相关性必须由标题承担。正文塞词是内容农场的标准手法。
    if not RELEVANCE.search(title_compact):
        if not (authoritative and RELEVANCE.search(summary or "")):
            return "标题无产业相关性（正文塞词不算）"

    if POLITICAL_MEETING.search(title) and not INDUSTRY_SIGNAL.search(head):
        return "纯政务会见/座谈，无产业信号"

    # 公众号/自媒体转述：必须带具体经营事件，否则只是二手讨论
    if SELF_MEDIA.search(f"{source_name} {host_from_url(url)}") and not BUSINESS_EVENT.search(title):
        return "自媒体转述且标题无具体经营事件"
    # 科普/评论体：权威源可放行（多为深度报道），其余不上 CEO 桌面
    if EXPLAINER.search(title) and not authoritative:
        return "科普/评论体，无可执行经营信息"
    return ""


def passes_intel_gate(
    title: str,
    summary: str = "",
    source_name: str = "",
    url: str = "",
    full_content: str = "",
) -> bool:
    return not gate_reject_reason(title, summary, source_name, url, full_content)
