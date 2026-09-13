(function () {
  'use strict';

  const DATA = window.DASHBOARD_DATA;
  const PKG = window.DASHBOARD_PACKAGE || { demo: false, refreshSteps: [], cacheKey: 'biren-ceo-intel-cache-v3gate' };

  /** 情报刷新接口：内部可走 MOSS；演示包走本地 demo；失败时前端可回退内置数据 */
  const INTEL_REFRESH_API = '/api/intel/refresh';
  const DEMO_PACKAGE = !!PKG.demo;

  const REFRESH_STEPS = Array.isArray(PKG.refreshSteps) && PKG.refreshSteps.length
    ? PKG.refreshSteps
    : [
      { pct: 10, text: '连接情报服务…', eta: '约 15 秒' },
      { pct: 35, text: '检索政策 / 竞品 / 产业舆情…', eta: '约 12 秒' },
      { pct: 60, text: '检索客户 / 品牌舆情…', eta: '约 8 秒' },
      { pct: 82, text: '过滤噪声并组装情报包…', eta: '约 3 秒' },
      { pct: 100, text: '刷新完成', eta: '' },
    ];
  const INTEL_CACHE_KEY = PKG.cacheKey || (DEMO_PACKAGE ? 'biren-ceo-intel-cache-demo-v3gate' : 'biren-ceo-intel-cache-v3gate');
  const INTEL_REFRESH_AT_KEY = 'biren-ceo-intel-refreshed-at';
  const TODO_FILTER_KEY = 'biren-ceo-todo-day';
  const TOPIC_META = {
    'BR-POL': { name: '政策监管', module: 'external' },
    'BR-SEN': { name: '舆情品牌', module: 'external' },
    'BR-CMP': { name: '竞品雷达', module: 'external' },
    'BR-IND': { name: '产业链', module: 'external' },
    'BR-CUS': { name: '客户动态', module: 'strategy' },
  };

  const THEMES = [
    { id: 'biren-classic', name: '壁仞经典', desc: '深空蓝 #070B18 · 壁仞蓝 · 科技青', swatches: ['#070B18', '#165DFF', '#22D3EE'] },
    { id: 'biren-deep', name: '壁仞深空', desc: '更深背景 · 高对比阅读', swatches: ['#030712', '#3B82F6', '#38BDF8'] },
    { id: 'biren-light', name: '壁仞晨光', desc: '浅色演示 · 会议室投屏', swatches: ['#F0F4FA', '#165DFF', '#0891B2'] },
  ];

  /** CEO 视图默认不展示资本市场类情报 */
  const CAPITAL_MARKET_RE = /股价|跌超|涨超|06082\.HK|06082|解禁.*配|二级市场|目标价|增持|回购|配售价|折让|流通盘|分析师.*评级|IR团队|股东信|港股跌|港股涨|(股价|港股|A股|收盘).{0,10}(涨|跌|跳水|市值)\d|报\d+(\.\d+)?港元|AI快讯|每经AI|财联社AI|(涨|跌)\d+(\.\d+)?%.{0,12}港元/i;
  const THIN_FLASH_RE = /AI快讯|每经AI|财联社AI|快讯[:：]|盘中[涨跌]|港股[涨跌]|A股[涨跌]|(股价|港股|A股|收盘|开盘).{0,12}(涨|跌|跳水|拉升)\d+(\.\d+)?%|(涨|跌)\d+(\.\d+)?%.{0,8}(报|至)?.{0,6}\d+(\.\d+)?\s*港?元|报\d+(\.\d+)?\s*港?元|收报\d+|现报\d+|最新价/i;
  const SOCIAL_HARD_RE = /xueqiu\.com|weibo\.com|douyin\.com|iesdouyin\.com|baijiahao\.baidu\.com/i;
  const CLICKBAIT_RE = /痴人说梦|当场完蛋|狂飙|干崩|干翻|曝光了|秘闻|妻子的|暧昧对象|不转不是|震惊|太可怕|真相了|一夜之间|彻底完了|彻底凉了|只要.{0,12}敢.{0,20}(就|会|当场)|几百家.{0,8}完蛋|[！!]{2,}|[？?]{2,}|教育行业业绩未来可期|未来可期[！!]/i;
  const LISTICLE_RE = /避坑|大盘点|厂家盘点|生产厂家|贴牌合作|怎么选|哪家好|排行榜|加盟|代理招商|软文|报价表|多少钱|专业选型|选型与配置|配置建议|选购指南|买哪款|照着这\d+款|新刊热卖|热卖丨|限时优惠|扫码领取/i;
  const BAD_URL_RE = /yoojia\.baidu\.com|baidu\.com\/app\/tuwen|hao123\.com/i;
  const TABLOID_HOST_RE = /sohu\.com|sina\.com\.cn|qq\.com|163\.com|ifeng\.com|yoojia|toutiao\.com|jianshu\.com|qsina|jfinfo|百家号|网易号|搜狐号/i;
  const POLITICAL_MEETING_RE = /座谈|会见|调研|考察|走访|接见|一行到/i;
  const INDUSTRY_SIGNAL_RE = /算力|GPU|芯片|半导体|信创|国产化|集采|招标|出口管制|实体清单|智算|大模型|封测|HBM|英伟达|昇腾|壁仞|Biren/i;
  // 与后端 intel_gate.py 保持同义：赌博/引流广告、内容农场模板正文、产业相关性词库
  const SPAM_RE = /彩民|彩票|双色球|时时彩|竞彩|福彩|六合彩|博彩|赌球|赌场|棋牌|百家乐|信用盘|外围盘|返水|流水提成|包赢|稳赚|必中|包中|下注|投注|开户送|邀请码|注册码|优惠大厅|秒提现|秒到账|赚钱软件|挂机赚|日入过万|科普优选|加微信|加V信|加威信|私聊我|裸聊|情色|约炮/i;
  const BOILERPLATE_RE = /在智能化技术快速迭代的今天|随着(人工智能|智能化|科技|互联网)的?(快速|不断|飞速)?发展[，,]|本文将(为您|带您|详细)|更多(详情|信息|资讯)请(咨询|联系|关注)|以上就是.{0,12}的全部内容/i;
  const RELEVANCE_RE = /GPU|算力|芯片|半导体|英伟达|NVIDIA|昇腾|寒武纪|摩尔线程|海光|天数|壁仞|Biren|BR100|智算|大模型|AI服务器|封测|HBM|DPU|澜起|出口管制|国产化|信创|推理|训练|算电协同|WAIC|DeepSeek|腾讯混元|华为|阿里云|字节/i;
  const AUTHORITY_RE = /新华社|新华财经|人民日报|人民网|央视|工信部|发改委|财政部|科技部|证监会|国务院|中国政府网|证券时报|上海证券报|中国证券报|经济日报|科技日报|财新|第一财经|界面|华尔街见闻|路透|Reuters|Bloomberg|彭博|SEMI|集微网|芯智讯|电子工程专辑|半导体行业观察|机器之心|量子位|36氪|钛媒体|people\.com\.cn|xinhuanet\.com|news\.cn|cctv\.com|gov\.cn|yicai\.com|caixin\.com|jiemian\.com|wallstreetcn\.com|laoyaoba\.com|semiinsights\.com|stdaily\.com/i;
  // 全角空格 / 零宽字符等拆字分隔符
  const SEP_RE = /[\s\u3000\u200b-\u200f\ufeff·・‧∙…．.。、,，\-—_~*|/\\]+/g;

  /** 指标领域 → 默认跟进负责人 */
  const METRIC_OWNER_MAP = {
    sales: ['销售VP'],
    finance: ['CFO', '销售VP'],
    org: ['HRD'],
    production: ['CTO', '供应链负责人'],
    supply: ['供应链负责人'],
    inventory: ['供应链负责人'],
    rd: ['CTO'],
    compliance: ['法务', 'CTO'],
    external: ['战略部'],
  };

  const MAX_PINNED = 3;
  const MAX_DYNAMIC = 3;
  const PIN_KEY = 'biren-ceo-pinned-metrics';

  function isCapitalMarketIntel(item) {
    const text = `${item.title || ''} ${item.summary || ''} ${item.biren_relevance || ''} ${(item.tags || []).join(' ')}`;
    return CAPITAL_MARKET_RE.test(text);
  }

  function isThinIntel(item) {
    const title = String(item.title || '').trim();
    const summary = String(item.summary || '').trim();
    const blob = `${title} ${summary}`;
    if (THIN_FLASH_RE.test(blob)) return true;
    if (/港股|股价|报\d/.test(title) && /(涨|跌)\d+(\.\d+)?%/.test(title) && summary.length < 120) return true;
    // 仅拦截几乎无正文的空壳，避免误杀正常短摘要
    if (summary.length > 0 && summary.length < 18) return true;
    if (
      CAPITAL_MARKET_RE.test(blob)
      && summary.length < 90
      && !/原因|影响|客户|交付|产能|招标|政策|管制|封测|推理|训练|订单|替代|国产/i.test(blob)
    ) {
      return true;
    }
    return false;
  }

  function isLowTrustIntel(item) {
    const source = item.source_name || '';
    const url = item.source_url || '';
    const hardHost = SOCIAL_HARD_RE.test(url);
    const trashSource = /雪球|微博|抖音|快手|百家号|港股第一眼|AI快讯|每经AI|财联社AI/i.test(source);
    if (hardHost || trashSource) return true;
    return false;
  }

  function isClickbaitIntel(item) {
    return CLICKBAIT_RE.test(String(item?.title || ''));
  }

  function compactText(text) {
    return String(text || '').replace(SEP_RE, '');
  }

  /** 「买　大　买　单」式逐字拆分只出现在垃圾广告里 */
  function isObfuscatedTitle(title) {
    const raw = String(title || '').trim();
    if (raw.length < 8) return false;
    const seps = (raw.match(SEP_RE) || []).length;
    if (seps < 5) return false;
    return seps / raw.length > 0.28;
  }

  function isSpamIntel(item) {
    const title = String(item?.title || '');
    if (isObfuscatedTitle(title)) return true;
    const blob = compactText(`${title} ${item?.summary || ''}`);
    return SPAM_RE.test(compactText(title)) || SPAM_RE.test(blob);
  }

  function isAuthoritativeIntel(item) {
    return AUTHORITY_RE.test(`${item?.source_name || ''} ${item?.source_url || ''}`);
  }

  /**
   * 产业相关性必须由标题承担。内容农场的手法是「广告标题 + 正文塞满算力关键词」，
   * 只有权威/行业媒体才允许靠摘要命中过关。
   */
  function hasTitleRelevance(item) {
    if (RELEVANCE_RE.test(compactText(item?.title || ''))) return true;
    return isAuthoritativeIntel(item) && RELEVANCE_RE.test(String(item?.summary || ''));
  }

  function isTabloidIntel(item) {
    const blob = `${item?.source_name || ''} ${item?.source_url || ''}`;
    return TABLOID_HOST_RE.test(blob) || /搜狐|头条|简书|百家号|自媒体/i.test(blob);
  }

  /**
   * 「上桌」必须是「可展示」的子集：凡是主列表都不该出现的条目，
   * 更不能进入 CEO 今日关注。此前两处规则各写一份，导致软文被列表拦下却仍能上桌。
   */
  function isCeoDeskEligible(item) {
    if (!shouldShowIntel(item)) return false;
    if (item.impact_level === 'high' && item.confidence !== 'high') return false;
    if (isTabloidIntel(item) && item.confidence !== 'high') return false;
    return true;
  }

  function shouldShowIntel(item) {
    if (!item) return false;
    // 垃圾广告与内容农场优先拦下：这类条目一旦渲染就是演示事故
    if (isSpamIntel(item)) return false;
    if (!hasTitleRelevance(item)) return false;
    if (isCapitalMarketIntel(item)) return false;
    if (isThinIntel(item)) return false;
    if (isLowTrustIntel(item)) return false;
    if (isClickbaitIntel(item)) return false;
    const title = String(item.title || '');
    const summary = String(item.summary || '');
    const url = String(item.source_url || '');
    if (BOILERPLATE_RE.test(summary)) return false;
    // 来源名残缺（被截成单字符）说明抓取元数据不可信，出处无法向 CEO 交代
    if (compactText(item.source_name || '').length < 2 && !isAuthoritativeIntel(item)) return false;
    if (LISTICLE_RE.test(title) || BAD_URL_RE.test(url)) return false;
    if (POLITICAL_MEETING_RE.test(title) && !INDUSTRY_SIGNAL_RE.test(`${title} ${summary}`)) return false;
    if (item.impact_type === 'noise' || (item.tags || []).includes('舆情噪声')) return false;
    // CEO 主列表只展示可上桌条目；未标注时按旧包兼容
    if (item.desk_eligible === false) return false;
    return true;
  }

  const GENERIC_RELEVANCE_RE = /与壁仞经营环境相关|建议纳入外部情报简报/;

  function isGenericRelevance(text) {
    const t = String(text || '').trim();
    return !t || GENERIC_RELEVANCE_RE.test(t);
  }

  function shortTitlePhrase(title, maxLen = 20) {
    const t = String(title || '').replace(/[「」【】\[\]（）()《》"“”]/g, '').replace(/\s+/g, ' ').trim();
    return t.length <= maxLen ? t : `${t.slice(0, maxLen - 1)}…`;
  }

  function composeBirenRelevance(item) {
    const raw = String(item?.biren_relevance || '').trim();
    if (!isGenericRelevance(raw)) return raw;

    const title = String(item?.title || '');
    const summary = String(item?.summary || '');
    const blob = `${title} ${summary}`;
    const phrase = shortTitlePhrase(title);
    const topic = item?.topic_id || '';
    const impactType = item?.impact_type || '';
    const impactLabel = item?.impact_label || impactLevelLabel(item?.impact_level);

    const keywordRules = [
      [/(算力|GPU|芯片).{0,6}(招标|采购|集采|中标)|(招标|集采|中标).{0,8}(算力|GPU|智算)/i, '算力采购信号活跃，建议销售跟踪相关客户招标与 POC 进展。'],
      [/智算中心|智算基建|算力基建/i, '智算基建扩张拉动 GPU 集群需求，关注区域集采节奏。'],
      [/推理|Agent|智能体/i, '推理算力需求结构变化，关注客户整机配置与推理卡出货节奏。'],
      [/训练|大模型|LLM/i, '训练算力投入持续，关注头部客户扩容与国产集群替换窗口。'],
      [/算电协同|算力券|能效|TCO/i, '智算中心能耗约束趋严，客户采购将更看重能效与 TCO 指标。'],
      [/封测|先进封装|CoWoS/i, '封测产能分化影响国产 GPU 交付兑现，需核对封测排期。'],
      [/DPU|RDMA|网卡/i, '算力集群网络瓶颈凸显，可强化 GPU+DPU 协同方案叙事。'],
      [/英伟达|NVIDIA|昇腾|寒武纪|摩尔线程|海光|DeepSeek|自研芯片/i, '竞品与客户自研芯片动作抬升选型对比，需更新对标矩阵。'],
      [/出口管制|实体清单|BIS|EAR/i, '出口与管制博弈持续，国产替代窗口仍在，需同步合规口径。'],
      [/信创|国产化/i, '国产化采购导向强化，关注信创目录与客户合规选型变化。'],
      [/壁仞|Biren|BR100/i, '品牌相关舆情，经营侧保持交付叙事聚焦，避免二级市场噪音干扰商务。'],
    ];
    for (const [re, text] of keywordRules) {
      if (re.test(blob)) return phrase ? `「${phrase}」：${text}` : text;
    }

    const topicImpact = {
      'direct-BR-POL': '监管政策直接牵动国产算力合规与出货，需法务与销售同步研判。',
      'opportunity-BR-CUS': '头部客户算力布局出现扩容信号，建议销售跟踪 POC 与集采窗口。',
      'competitor-BR-CMP': '竞品节奏抬升客户对比维度，需刷新性能/能效/交付三维对标。',
      'chain-BR-IND': '产业链波动可能传导至封测与整机交付，需核对关键物料与产能排期。',
      'context-BR-POL': '政策风向变化，可能影响国产算力采购门槛与合规口径。',
      'context-BR-IND': '产业链供需信号变化，关注是否影响 GPU 集群成本与客户 TCO。',
      'context-BR-CUS': '客户侧算力投入节奏调整，关注是否带来替换或扩容机会。',
      'context-BR-CMP': '竞品生态变化，需评估对壁仞议价与客户留存的影响。',
      'context-BR-SEN': '行业舆情热度上升，经营侧保持交付叙事聚焦。',
    };
    const tpl = topicImpact[`${impactType}-${topic}`] || topicImpact[`context-${topic}`];
    if (tpl) return phrase ? `「${phrase}」：${tpl}` : tpl;

    const impactOnly = {
      direct: '对壁仞形成直接经营影响，建议相关部门当日评估应对节奏。',
      opportunity: '存在算力采购或合作窗口，建议销售跟踪招标/POC 并评估切入时机。',
      chain: '上下游波动可能传导至交付兑现，需核对封测排期与关键物料。',
      competitor: '竞品压力抬升客户选型对比，建议更新对标矩阵与报价策略。',
      context: '外部环境变化需持续跟踪，建议纳入本周经营情报复盘。',
    };
    const base = impactOnly[impactType] || impactOnly.context;
    const clause = summary.split(/[。；\n]/).map((s) => s.trim()).find((s) => s.length >= 14 && !/大家好|点赞|关注|热卖/.test(s));
    if (clause) return `报道指向${clause.slice(0, 48)}，建议纳入本周客户沟通与方案对标。`;
    return phrase ? `「${phrase}」：${base}` : `${impactLabel}：${base}`;
  }

  function collectIntelItemsFromPacks(packs) {
    const merged = [];
    ['evening', 'noon', 'morning'].forEach((key) => {
      (packs[key]?.items || []).forEach((item) => merged.push(item));
    });
    return sortIntelByPriority(ceoIntelItems(merged));
  }

  /** 「外部态势」条目与情报条目的对齐键；服务端会把标题截断并加省略号 */
  function focusKey(text) {
    return String(text || '').replace(/[\s…]/g, '').slice(0, 18);
  }

  function buildExternalFocusFromPacks(packs) {
    const tagMap = {
      'BR-POL': '政策',
      'BR-CMP': '竞品',
      'BR-IND': '产业',
      'BR-CUS': '客户',
      'BR-SEN': '舆情',
    };
    const externalFocus = [];
    const seen = new Set();
    collectIntelItemsFromPacks(packs)
      .filter(isCeoDeskEligible)
      .forEach((item) => {
      if (externalFocus.length >= 3) return;
      const text = String(item.title || '').trim();
      if (!text) return;
      const key = focusKey(text);
      if (seen.has(key)) return;
      const why = composeBirenRelevance(item);
      if (isGenericRelevance(why)) return;
      seen.add(key);
      externalFocus.push({
        tag: tagMap[item.topic_id] || '外部',
        text: text.length > 28 ? `${text.slice(0, 27)}…` : text,
        why: why.length > 72 ? `${why.slice(0, 71)}…` : why,
      });
    });
    return externalFocus;
  }

  function applyInsightsFromRefresh(packs, opts = {}) {
    if (!DATA.insights) return;
    const { externalFocus = null, daySummary = null } = opts;
    // 首页「外部态势」必须与情报明细同源：此前直接采用服务端 external_focus，
    // 一旦服务端与前端闸门版本不一致（例如长驻服务进程仍持有旧规则），
    // 首页就会出现明细里根本看不到的条目。改为一律按前端闸门重算。
    const localFocus = buildExternalFocusFromPacks(packs);
    const gatedKeys = new Set(
      collectIntelItemsFromPacks(packs)
        .filter(isCeoDeskEligible)
        .map((item) => focusKey(item.title)),
    );
    const serverFocus = (Array.isArray(externalFocus) ? externalFocus : [])
      .filter((entry) => gatedKeys.has(focusKey(entry?.text)));
    const focus = localFocus.length ? localFocus : serverFocus;
    const topItems = collectIntelItemsFromPacks(packs).slice(0, 3);
    const headline = daySummary?.headline
      || (topItems[0] ? `${shortTitlePhrase(topItems[0].title, 24)}等外部议题需关注` : '外部经营环境更新');
    const bridge = daySummary?.bridge
      || (focus.length
        ? `今日外部重点：${focus.map((f) => f.text).join('、')}。`
        : '已更新外部情报列表，建议浏览高影响条目。');
    const externalSignals = daySummary?.external_signals
      || focus.map((f) => `${f.text}：${f.why}`);

    ['morning', 'noon', 'evening'].forEach((key) => {
      const prev = DATA.insights[key] || {};
      const internalList = Array.isArray(prev.internal) ? prev.internal : (prev.focus || []);
      DATA.insights[key] = {
        ...prev,
        headline,
        bridge,
        external: focus.slice(0, 3),
        internal: internalList,
        external_track: {
          summary: bridge,
          signals: externalSignals.slice(0, 3),
        },
      };
    });
  }

  const SOURCE_HIGH_RE = /新华社|人民日报|人民网|央视|工信部|发改委|财政部|科技部|证监会|证券时报|上海证券报|中国证券报|经济日报|科技日报|财新|第一财经|界面|华尔街见闻|路透|Reuters|Bloomberg|彭博|SEMI|集微网|芯智讯|电子工程专辑|半导体行业观察|people\.com\.cn|people\.cn|xinhuanet\.com/i;
  const SOURCE_MED_RE = /36氪|钛媒体|虎嗅|爱范儿|澎湃|观察者|新浪科技|网易科技|腾讯科技|机器之心|量子位|雷锋网|InfoQ|微信|公众号|EETimes|Digitimes/i;
  const SOURCE_LOW_RE = /头条|简书|百家号|微博|超话|抖音|快手|贴吧|自媒体|雪球|港股第一眼|AI快讯|每经AI|财联社AI/i;
  const HOST_SOURCE_MAP = {
    'jiemian.com': '界面新闻',
    'caixin.com': '财新',
    'yicai.com': '第一财经',
    'wallstreetcn.com': '华尔街见闻',
    '36kr.com': '36氪',
    'jiqizhixin.com': '机器之心',
    'qbitai.com': '量子位',
    'eet-china.com': '电子工程专辑',
    'laoyaoba.com': '集微网',
    'semiinsights.com': '芯智讯',
    'thepaper.cn': '澎湃新闻',
    'reuters.com': '路透',
    'bloomberg.com': '彭博',
    'toutiao.com': '今日头条',
    'jianshu.com': '简书',
    'mp.weixin.qq.com': '微信公众号',
    'xueqiu.com': '雪球',
    'weibo.com': '微博',
    'nbd.com.cn': '每日经济新闻',
  };

  function hostFromUrl(url) {
    const m = String(url || '').match(/https?:\/\/(?:www\.)?([^/]+)/i);
    return (m?.[1] || '').toLowerCase();
  }

  function normalizeSourceName(raw, url) {
    const name = String(raw || '').replace(/\s+/g, ' ').trim();
    const host = hostFromUrl(url);
    if (name && !['行业媒体', '未知来源', '未知', 'null'].includes(name)) return name.slice(0, 32);
    for (const [key, label] of Object.entries(HOST_SOURCE_MAP)) {
      if (host.includes(key)) return label;
    }
    if (host) return host.split('.')[0].slice(0, 24);
    return '行业媒体';
  }

  function inferConfidence(sourceName, url) {
    const blob = `${sourceName || ''} ${url || ''}`;
    if (SOURCE_HIGH_RE.test(blob)) return { confidence: 'high', confidence_label: '高' };
    if (SOURCE_LOW_RE.test(blob) || !sourceName || sourceName === '行业媒体') {
      return { confidence: 'low', confidence_label: '低' };
    }
    if (SOURCE_MED_RE.test(blob)) return { confidence: 'medium', confidence_label: '中' };
    if (hostFromUrl(url)) return { confidence: 'medium', confidence_label: '中' };
    return { confidence: 'low', confidence_label: '低' };
  }

  function inferImpactProfile(title, summary, topic) {
    const blob = `${title || ''}${summary || ''}`;
    const direct = /壁仞|Biren|BR10[04]|出口管制|制裁|国产替代|信创目录|集采中标|丢标|客户切换|替换英伟达|替换昇腾/i.test(blob);
    const opportunity = /招标|采购|集采|扩容|POC|推理卡|推理需求|Agent|WAIC|算电协同|能效|TCO|性价比|新机会|订单|中标/i.test(blob);
    const upstream = /封测|HBM|先进封装|光刻|刻蚀|EDA|设备|晶圆|CoWoS|基板/i.test(blob);
    const downstream = /智算中心|AI服务器|整机|机柜|集群|云厂商|阿里云|字节|腾讯云|百度智能云/i.test(blob);
    const competitor = /英伟达|NVIDIA|昇腾|寒武纪|摩尔线程|海光|天数|Meta.*芯片|自研芯片|Iris/i.test(blob) || topic === 'BR-CMP';

    let impact_type = 'context';
    let impact_label = '环境观察';
    let impact_level = topic === 'BR-SEN' ? 'low' : 'medium';
    let priority_score = 48;
    const type_tags = [];

    if (direct) {
      impact_type = 'direct';
      impact_label = '直接影响';
      impact_level = 'high';
      priority_score = 92;
      type_tags.push('直接影响');
    } else if (opportunity) {
      impact_type = 'opportunity';
      impact_label = '新机会';
      impact_level = (topic === 'BR-CUS' || topic === 'BR-POL') ? 'high' : 'medium';
      priority_score = 84;
      type_tags.push('新机会');
    } else if (upstream || downstream) {
      impact_type = 'chain';
      impact_label = '上下游';
      impact_level = 'medium';
      priority_score = 72;
      if (upstream) type_tags.push('上游');
      if (downstream) type_tags.push('下游');
    } else if (competitor) {
      impact_type = 'competitor';
      impact_label = '竞品压力';
      impact_level = /昇腾|自研芯片|替代/i.test(blob) ? 'high' : 'medium';
      priority_score = 68;
      type_tags.push('竞品压力');
    } else {
      type_tags.push('环境观察');
      if (topic === 'BR-SEN') {
        impact_level = 'low';
        priority_score = 40;
      }
    }

    if (topic === 'BR-POL' && impact_level !== 'high') priority_score += 8;
    if (topic === 'BR-CUS' && opportunity) priority_score += 6;
    if (topic === 'BR-SEN' && !direct) {
      impact_level = 'low';
      priority_score = Math.min(priority_score, 40);
    }

    return { impact_level, impact_type, impact_label, priority_score, type_tags };
  }

  function enrichIntelTags(title, summary, topic, typeTags) {
    const blob = `${title || ''}${summary || ''}`;
    const tags = [...(typeTags || [])];
    const mapping = [
      [/出口|管制|制裁/i, '出口管制'],
      [/国产化|信创|国产替代/i, '国产化'],
      [/招标|采购|集采|中标/i, '算力采购'],
      [/推理/i, '推理场景'],
      [/训练|大模型/i, '大模型'],
      [/封测|先进封装|CoWoS/i, '封测上游'],
      [/HBM|内存|互连/i, '存储互连'],
      [/DPU|网络|集群/i, '集群网络'],
      [/能效|算电|功耗/i, '能效约束'],
      [/舆情|股价|配售/i, '品牌舆情'],
      [/英伟达|NVIDIA|昇腾|寒武纪|摩尔线程/i, '竞品对标'],
      [/阿里云|字节|腾讯|百度/i, '头部客户'],
    ];
    mapping.forEach(([re, tag]) => {
      if (re.test(blob) && !tags.includes(tag)) tags.push(tag);
    });
    if (tags.length <= 1) {
      const fallback = TOPIC_META[topic]?.name;
      if (fallback && !tags.includes(fallback)) tags.push(fallback);
    }
    return tags.slice(0, 5);
  }

  function enrichIntelItem(raw) {
    if (!raw) return raw;
    const title = raw.title || '';
    const summary = raw.summary || '';
    const topic = raw.topic_id || '';
    const source_name = normalizeSourceName(raw.source_name, raw.source_url);
    const conf = inferConfidence(source_name, raw.source_url);
    const profile = inferImpactProfile(title, summary, topic);
    const hasLiveScore = raw.priority_score != null && raw.impact_type && raw.confidence;
    let priority = hasLiveScore ? Number(raw.priority_score) : profile.priority_score;
    if (!hasLiveScore) {
      if (conf.confidence === 'high') priority += 22;
      else if (conf.confidence === 'medium') priority += 8;
      else priority -= 28;
      if (CAPITAL_MARKET_RE.test(`${title} ${summary}`)) priority -= 40;
    }

    const existingTags = Array.isArray(raw.tags) ? raw.tags.filter(Boolean) : [];
    const tags = existingTags.length >= 2
      ? [...new Set([...(profile.type_tags || []), ...existingTags])].slice(0, 5)
      : enrichIntelTags(title, summary, topic, profile.type_tags);

    return {
      ...raw,
      source_name,
      impact_level: hasLiveScore ? raw.impact_level : profile.impact_level,
      impact_type: hasLiveScore ? raw.impact_type : profile.impact_type,
      impact_label: hasLiveScore ? (raw.impact_label || profile.impact_label) : profile.impact_label,
      priority_score: priority,
      confidence: hasLiveScore ? raw.confidence : conf.confidence,
      confidence_label: hasLiveScore ? (raw.confidence_label || conf.confidence_label) : conf.confidence_label,
      tags,
    };
  }

  function ceoIntelItems(items) {
    return items
      .filter(shouldShowIntel)
      .map(enrichIntelItem);
  }

  function isFeaturedIntel(item) {
    if (!item) return false;
    const score = Number(item.priority_score || 0);
    const conf = String(item.confidence || item.confidence_label || '').toLowerCase();
    const highConf = conf === 'high' || conf === '高';
    const midConf = highConf || conf === 'medium' || conf === '中';
    if (highConf) return true;
    if (score >= 85) return true;
    if (item.impact_level === 'high' && midConf) return true;
    if ((item.from_baseline || item.content_stale) && score >= 70 && item.impact_level === 'high') return true;
    return false;
  }

  function freshnessOfIntel(item) {
    if (item?.from_baseline || item?.content_stale) {
      return { key: 'hist', label: '精选基线' };
    }
    const mode = String(state.intelMode || '');
    if (mode === 'moss_live' || mode === 'moss_partial') {
      return { key: 'live', label: '实时' };
    }
    if (mode === 'local_fallback' || mode === 'embedded_fallback') {
      return { key: 'hist', label: '本地精选' };
    }
    // 未刷新过：基线包按精选展示
    return { key: 'hist', label: '精选基线' };
  }

  function sortIntelByPriority(items) {
    return [...items].sort((a, b) => {
      const fa = isFeaturedIntel(a) ? 1 : 0;
      const fb = isFeaturedIntel(b) ? 1 : 0;
      if (fa !== fb) return fb - fa;
      // priority_score 已含置信度权重；同分再比置信度与时效
      const scoreDiff = (b.priority_score || 0) - (a.priority_score || 0);
      if (scoreDiff) return scoreDiff;
      const confOrder = { high: 0, medium: 1, low: 2 };
      const confDiff = (confOrder[a.confidence] ?? 3) - (confOrder[b.confidence] ?? 3);
      if (confDiff) return confDiff;
      return String(b.published_at || '').localeCompare(String(a.published_at || ''));
    });
  }

  function impactLevelLabel(level) {
    return ({ high: '高影响', medium: '中影响', low: '低影响' })[level] || '待评估';
  }

  const state = {
    period: 'evening',
    nav: 'home',
    actionTab: 'todo',
    topicFilter: 'ALL',
    theme: 'biren-light', // 强制浅色；覆盖历史深色偏好
    dispatchTodoId: null,
    selectedOwners: [],
    recognition: null,
    isRecording: false,
    poolCategory: 'all',
    intelMode: 'idle',
    intelRefresh: {
      loading: false,
      progress: 0,
      stepText: '',
      lastSuccessAt: localStorage.getItem(INTEL_REFRESH_AT_KEY) || null,
      lastError: null,
      pendingReload: false,
    },
    todoDayKey: localStorage.getItem(TODO_FILTER_KEY) || 'all',
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function getPack() {
    // 首页统一展示日终汇总包（含当日完整情报）；无则回退早间包
    return DATA.evening?.items?.length ? DATA.evening : (DATA.morning || DATA.noon || { items: [] });
  }

  function mergeNoonItems() {
    const morningIds = new Set((DATA.morning?.items || []).map((i) => i.item_id));
    const delta = (DATA.noon?.items || []).filter((i) => !morningIds.has(i.item_id));
    return {
      ...DATA.noon,
      items: [...delta, ...(DATA.morning?.items || [])].slice(0, 12),
    };
  }

  function countByTopic(items) {
    const c = {};
    items.forEach((i) => { c[i.topic_id] = (c[i.topic_id] || 0) + 1; });
    return c;
  }

  function openTodos() {
    return DATA.todos.filter((t) => t.status !== 'done');
  }

  function showToast(msg, ms = 2600) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.add('hidden'), ms);
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16).replace('T', ' ');
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function getLatestPackTimestamp() {
    const times = ['morning', 'noon', 'evening']
      .map((k) => DATA[k]?.client_refreshed_at || DATA[k]?.generated_at)
      .filter(Boolean)
      .sort();
    return times.length ? times[times.length - 1] : null;
  }

  function todayDate() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function toDateKey(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parseTodoDue(todo) {
    if (todo.due_at) {
      const d = new Date(todo.due_at);
      if (!Number.isNaN(d.getTime())) return d;
    }
    const raw = String(todo.due || '').trim();
    const now = todayDate();
    // HH:mm → 今天该时刻
    if (/^\d{1,2}:\d{2}$/.test(raw)) {
      const [h, m] = raw.split(':').map(Number);
      const d = new Date(now);
      d.setHours(h, m, 0, 0);
      return d;
    }
    // M/D or MM/DD
    const md = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (md) {
      const d = new Date(now.getFullYear(), Number(md[1]) - 1, Number(md[2]), 18, 0, 0, 0);
      return d;
    }
    // 7/15前
    const before = raw.match(/(\d{1,2})\/(\d{1,2})/);
    if (before) {
      return new Date(now.getFullYear(), Number(before[1]) - 1, Number(before[2]), 18, 0, 0, 0);
    }
    // fallback: 本周五
    const d = new Date(now);
    d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
    d.setHours(18, 0, 0, 0);
    return d;
  }

  function dueBucket(todo) {
    if (todo.status === 'done') return 'done';
    const due = parseTodoDue(todo);
    const start = todayDate();
    const endToday = new Date(start); endToday.setHours(23, 59, 59, 999);
    const endTomorrow = new Date(start); endTomorrow.setDate(endTomorrow.getDate() + 1); endTomorrow.setHours(23, 59, 59, 999);
    const endWeek = new Date(start); endWeek.setDate(endWeek.getDate() + (7 - endWeek.getDay())); endWeek.setHours(23, 59, 59, 999);
    if (due < start) return 'overdue';
    if (due <= endToday) return 'today';
    if (due <= endTomorrow) return 'tomorrow';
    if (due <= endWeek) return 'week';
    return 'later';
  }

  function dueLabel(todo) {
    const due = parseTodoDue(todo);
    const bucket = dueBucket(todo);
    const pad = (n) => String(n).padStart(2, '0');
    const hm = `${pad(due.getHours())}:${pad(due.getMinutes())}`;
    const md = `${due.getMonth() + 1}/${due.getDate()}`;
    if (bucket === 'overdue') return { text: `已逾期 · ${md}`, cls: 'overdue' };
    if (bucket === 'today') return { text: hm === '18:00' ? '今天' : `今天 ${hm}`, cls: 'today' };
    if (bucket === 'tomorrow') return { text: hm === '18:00' ? '明天' : `明天 ${hm}`, cls: 'soon' };
    if (bucket === 'week') return { text: `${md} 本周`, cls: 'soon' };
    return { text: md, cls: '' };
  }

  function weekDays() {
    const start = todayDate();
    const dow = start.getDay(); // 0 Sun
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(start);
    monday.setDate(start.getDate() + mondayOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }

  function renderTodoCalendar() {
    const el = $('#todoCalendar');
    if (!el) return;
    const open = openTodos();
    const wd = ['一', '二', '三', '四', '五', '六', '日'];
    const days = weekDays();
    el.innerHTML = days.map((d, idx) => {
      const key = toDateKey(d);
      const count = open.filter((t) => toDateKey(parseTodoDue(t)) === key).length;
      const overdueBoost = open.filter((t) => dueBucket(t) === 'overdue' && toDateKey(d) === toDateKey(todayDate())).length;
      const isToday = toDateKey(d) === toDateKey(todayDate());
      const selected = state.todoDayKey === key;
      return `
        <button type="button" class="todo-cal-day${isToday ? ' is-today' : ''}${selected ? ' is-selected' : ''}${count ? '' : ' is-empty'}" data-day="${key}">
          <div class="todo-cal-day__wd">周${wd[idx]}</div>
          <div class="todo-cal-day__num">${d.getDate()}</div>
          <div class="todo-cal-day__count${overdueBoost && isToday ? ' todo-cal-day__count--warn' : ''}">${count ? `${count}项` : '—'}</div>
        </button>
      `;
    }).join('');

    el.querySelectorAll('[data-day]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.todoDayKey = state.todoDayKey === btn.dataset.day ? 'all' : btn.dataset.day;
        localStorage.setItem(TODO_FILTER_KEY, state.todoDayKey);
        renderTasksTab();
      });
    });
  }

  function renderTodoGroups() {
    const wrap = $('#todoGroups');
    if (!wrap) return;
    const buckets = [
      { id: 'overdue', title: '已逾期', items: [] },
      { id: 'today', title: '今天必须完成', items: [] },
      { id: 'tomorrow', title: '明天', items: [] },
      { id: 'week', title: '本周其余', items: [] },
      { id: 'later', title: '更晚', items: [] },
    ];
    openTodos().forEach((t) => {
      const b = dueBucket(t);
      const target = buckets.find((x) => x.id === b);
      if (target) target.items.push(t);
    });

    if (state.todoDayKey !== 'all') {
      buckets.forEach((b) => {
        b.items = b.items.filter((t) => toDateKey(parseTodoDue(t)) === state.todoDayKey);
      });
    }

    wrap.innerHTML = buckets.filter((b) => b.items.length).map((b) => `
      <div class="todo-group">
        <div class="todo-group__title"><span>${b.title}</span><em>${b.items.length}</em></div>
        <div class="todo-list">
          ${b.items.map((t) => todoItemHtml(t)).join('')}
        </div>
      </div>
    `).join('') || '<p style="color:var(--text-dim);font-size:13px;padding:8px 0">该日暂无待办</p>';

    bindTodoItemActions(wrap);
  }

  function toggleTodoDone(id) {
    const todo = DATA.todos.find((t) => t.id === id);
    if (!todo) return;
    if (todo.status === 'done') {
      todo.status = 'open';
      delete todo.done_at;
      showToast('已重新打开待办');
    } else {
      todo.status = 'done';
      todo.done_at = new Date().toISOString();
      showToast('待办已闭环');
    }
    renderTodos();
    if (state.nav === 'tasks') renderTasksTab();
  }

  function bindTodoItemActions(root) {
    if (!root) return;
    root.querySelectorAll('.todo-item__check').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.closest('.todo-item')?.dataset?.id;
        if (id) toggleTodoDone(id);
      });
    });
    root.querySelectorAll('[data-dispatch]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDispatch(btn.dataset.dispatch);
      });
    });
  }

  function todoItemHtml(t) {
    const due = dueLabel(t);
    return `
      <div class="todo-item ${t.status === 'done' ? 'todo-item--done' : ''}" data-id="${t.id}">
        <button type="button" class="todo-item__check" aria-label="${t.status === 'done' ? '重新打开' : '标记完成'}" title="${t.status === 'done' ? '重新打开' : '点击闭环'}">${t.status === 'done' ? '✓' : ''}</button>
        <div class="todo-item__body">
          <div class="todo-item__title">${t.title}</div>
          <div class="todo-item__meta">
            <span class="todo-due-chip${due.cls ? ` todo-due-chip--${due.cls}` : ''}">${due.text}</span>
            <span class="chip chip--${t.priority}">${t.priority === 'high' ? '高优' : '中优'}</span>
            <span>${(t.owners || []).join(' · ')}</span>
          </div>
          ${t.status !== 'done' ? `
            <div class="todo-item__actions">
              <button class="btn-dispatch" data-dispatch="${t.id}">↗ 下发企微</button>
            </div>` : '<div class="todo-item__meta"><span class="chip chip--done">已闭环</span></div>'}
        </div>
      </div>
    `;
  }

  function persistIntelCache(packs, refreshedAt) {
    try {
      localStorage.setItem(INTEL_CACHE_KEY, JSON.stringify({
        packs: {
          morning: packs.morning || DATA.morning,
          noon: packs.noon || DATA.noon,
          evening: packs.evening || DATA.evening,
        },
        refreshed_at: refreshedAt,
      }));
      localStorage.setItem(INTEL_REFRESH_AT_KEY, refreshedAt);
    } catch (err) {
      console.warn('intel cache persist failed', err);
    }
  }

  /**
   * 缓存可能是旧版闸门写入的，里面可能残留垃圾条目。
   * 读回时按当前闸门重过一遍，避免旧缓存把广告重新渲染到看板上。
   */
  function sanitizeCachedPacks(packs) {
    const out = {};
    let dropped = 0;
    Object.keys(packs || {}).forEach((slot) => {
      const pack = packs[slot];
      if (!pack) return;
      const items = Array.isArray(pack.items) ? pack.items : [];
      const kept = items.filter(shouldShowIntel);
      dropped += items.length - kept.length;
      out[slot] = { ...pack, items: kept };
    });
    if (dropped > 0) {
      console.warn(`[情报闸门] 已从本地缓存剔除 ${dropped} 条不合格条目`);
    }
    return { packs: out, dropped };
  }

  function hydrateIntelCache() {
    try {
      const raw = localStorage.getItem(INTEL_CACHE_KEY);
      if (!raw) return false;
      const cached = JSON.parse(raw);
      if (!cached?.packs) return false;
      const { packs: cleanPacks, dropped } = sanitizeCachedPacks(cached.packs);
      const total = Object.values(cleanPacks).reduce((n, p) => n + (p.items?.length || 0), 0);
      // 缓存被清空说明它整体不可信，回落到随包基线而不是展示空看板
      if (total === 0 && dropped > 0) {
        localStorage.removeItem(INTEL_CACHE_KEY);
        return false;
      }
      applyIntelPacks(cleanPacks, { persist: false, stamp: false });
      if (cached.refreshed_at) {
        state.intelRefresh.lastSuccessAt = cached.refreshed_at;
      }
      return true;
    } catch (err) {
      console.warn('intel cache hydrate failed', err);
      return false;
    }
  }

  function showReloadBanner(count) {
    const banner = $('#intelReloadBanner');
    const meta = $('#intelReloadBannerMeta');
    if (!banner) return;
    state.intelRefresh.pendingReload = true;
    banner.classList.remove('hidden');
    if (meta) {
      meta.textContent = `已写入本地缓存 · ${count} 条 · ${formatDateTime(state.intelRefresh.lastSuccessAt)} · 请手动刷新页面锁定展示`;
    }
  }

  function updateIntelRefreshMeta() {
    const label = $('#intelLastUpdated');
    if (!label) return;
    const { loading, lastSuccessAt, lastError, stepText, progress } = state.intelRefresh;
    label.classList.remove('is-error', 'is-fresh');
    if (loading) {
      const step = REFRESH_STEPS.find((s) => s.pct === progress) || {};
      label.textContent = `${stepText || '正在刷新…'}${step.eta ? ` · 预计${step.eta}` : ''}`;
      return;
    }
    if (lastError) {
      label.classList.add('is-error');
      label.textContent = `刷新失败：${lastError}`;
      return;
    }
    const count = ceoIntelItems(getPack().items || []).length;
    if (lastSuccessAt) {
      label.classList.add('is-fresh');
      label.textContent = `最近刷新 ${formatDateTime(lastSuccessAt)} · 共 ${count} 条经营情报`;
    } else {
      const packTs = getLatestPackTimestamp();
      label.textContent = packTs
        ? `情报包时间 ${formatDateTime(packTs)} · 共 ${count} 条（尚未手动刷新）`
        : '暂无刷新记录 · 点击右上角刷新';
    }
  }

  function setIntelRefreshProgress(pct, text) {
    state.intelRefresh.progress = pct;
    state.intelRefresh.stepText = text;
    const bar = $('#intelRefreshProgress');
    const fill = $('#intelRefreshProgressFill');
    const txt = $('#intelRefreshProgressText');
    if (bar) bar.classList.remove('hidden');
    if (fill) fill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    const step = REFRESH_STEPS.find((s) => s.pct === pct);
    if (txt) txt.textContent = step?.eta ? `${text} · 预计${step.eta}` : text;
    updateIntelRefreshMeta();
  }

  function hideIntelRefreshProgress(delayMs = 1200) {
    clearTimeout(hideIntelRefreshProgress._t);
    hideIntelRefreshProgress._t = setTimeout(() => {
      if (!state.intelRefresh.loading) {
        $('#intelRefreshProgress')?.classList.add('hidden');
      }
    }, delayMs);
  }

  async function fetchIntelLiveFromMoss(onProgress) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120000);
    try {
      onProgress?.(REFRESH_STEPS[1] || REFRESH_STEPS[0]);
      const res = await fetch(`${INTEL_REFRESH_API}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: ctrl.signal,
      });
      onProgress?.(REFRESH_STEPS[2] || REFRESH_STEPS[1] || REFRESH_STEPS[0]);
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const errBody = await res.json();
          detail = errBody.error || detail;
        } catch (_) { /* ignore */ }
        throw new Error(detail);
      }
      const body = await res.json();
      if (!body.ok || !body.packs) throw new Error(body.error || '情报刷新返回无效');
      onProgress?.(REFRESH_STEPS[3] || REFRESH_STEPS[REFRESH_STEPS.length - 2] || REFRESH_STEPS[0]);
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  function cloneIntelPacks(rawPacks, refreshedAt, source) {
    const nowIso = refreshedAt || new Date().toISOString();
    const packs = {};
    ['morning', 'noon', 'evening'].forEach((key) => {
      if (!rawPacks[key]) return;
      packs[key] = {
        ...rawPacks[key],
        generated_at: nowIso,
        client_refreshed_at: nowIso,
        source: source || 'local_fallback',
        items: (rawPacks[key].items || []).map((it) => ({ ...it })),
      };
    });
    return packs;
  }

  function buildRefreshBodyFromPacks(packs, opts = {}) {
    const refreshedAt = opts.refreshedAt || new Date().toISOString();
    return {
      ok: true,
      mode: opts.mode || 'local_fallback',
      refreshed_at: refreshedAt,
      item_count: Object.values(packs).reduce((n, p) => n + ((p.items || []).length), 0),
      errors: opts.errors || [],
      external_focus: opts.externalFocus || buildExternalFocusFromPacks(packs),
      packs,
      note: opts.note || '',
    };
  }

  async function fetchDemoIntelPacks(reason) {
    const refreshedAt = new Date().toISOString();
    try {
      const res = await fetch(`/demo-packs.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const raw = await res.json();
        const packs = cloneIntelPacks(raw, refreshedAt, 'local_fallback');
        return buildRefreshBodyFromPacks(packs, {
          mode: 'local_fallback',
          refreshedAt,
          errors: reason ? [reason] : [],
          note: reason || 'MOSS 不可用，已加载本地情报基线。',
        });
      }
    } catch (_) { /* fall through */ }
    return buildEmbeddedIntelRefreshBody(reason);
  }

  function buildEmbeddedIntelRefreshBody(reason) {
    const refreshedAt = new Date().toISOString();
    const raw = {};
    ['morning', 'noon', 'evening'].forEach((key) => {
      if (DATA[key]) raw[key] = DATA[key];
    });
    const packs = cloneIntelPacks(raw, refreshedAt, 'embedded_fallback');
    return buildRefreshBodyFromPacks(packs, {
      mode: 'embedded_fallback',
      refreshedAt,
      errors: reason ? [reason] : [],
      note: reason || '',
    });
  }

  function enrichPackRelevance(packs) {
    ['morning', 'noon', 'evening'].forEach((key) => {
      const items = packs[key]?.items;
      if (!Array.isArray(items)) return;
      packs[key].items = items.map((item) => {
        if (!isGenericRelevance(item.biren_relevance)) return item;
        return { ...item, biren_relevance: composeBirenRelevance(item) };
      });
    });
    return packs;
  }

  function applyIntelPacks(packs, opts = {}) {
    const {
      persist = true,
      stamp = true,
      refreshedAt = null,
      externalFocus = null,
      daySummary = null,
    } = opts;
    const nowIso = refreshedAt || new Date().toISOString();
    enrichPackRelevance(packs);
    const incomingCount = ['morning', 'noon', 'evening']
      .reduce((n, key) => n + ((packs[key]?.items || []).length), 0);
    if (incomingCount === 0) {
      if (stamp) state.intelRefresh.lastError = state.intelRefresh.lastError || '本次未拉到可用经营情报，已保留原列表';
      return false;
    }

    ['morning', 'noon', 'evening'].forEach((key) => {
      if (!packs[key]?.items) return;
      const pack = { ...packs[key] };
      if (stamp) {
        pack.client_refreshed_at = nowIso;
        pack.generated_at = nowIso;
      } else if (!pack.client_refreshed_at && refreshedAt) {
        // 保留内容时间，仅补尝试刷新时间
        pack.client_refreshed_at = refreshedAt;
      }
      DATA[key] = pack;
    });

    applyInsightsFromRefresh(packs, { externalFocus, daySummary });

    window.DASHBOARD_DATA = DATA;
    if (persist) persistIntelCache(packs, nowIso);
    return true;
  }

  async function refreshLatestIntelMessages() {
    if (state.intelRefresh.loading) return;
    state.intelRefresh.loading = true;
    state.intelRefresh.lastError = null;
    state.intelRefresh.pendingReload = false;
    $('#intelReloadBanner')?.classList.add('hidden');
    const btn = $('#intelRefreshBtn');
    btn?.classList.add('is-loading');
    setIntelRefreshProgress(REFRESH_STEPS[0].pct, REFRESH_STEPS[0].text);

    try {
      let body;
      let usedFallback = false;
      try {
        body = await fetchIntelLiveFromMoss((step) => {
          setIntelRefreshProgress(step.pct, step.text);
        });
      } catch (liveErr) {
        const reason = liveErr?.name === 'AbortError'
          ? '请求超时'
          : (liveErr?.message || 'Failed to fetch');
        setIntelRefreshProgress(70, 'MOSS 不可用，加载本地情报基线…');
        body = DEMO_PACKAGE
          ? await fetchDemoIntelPacks(reason)
          : buildEmbeddedIntelRefreshBody(reason);
        usedFallback = true;
      }

      const refreshedAt = body.refreshed_at || new Date().toISOString();
      const mode = body.mode || '';
      state.intelMode = mode || (usedFallback ? 'local_fallback' : 'idle');
      // 服务端 local_fallback 也是回退，不能仅凭 fetch 成功就当 MOSS 实时
      const isLive = mode === 'moss_live' || mode === 'moss_partial';
      const isDegraded = !!body.degraded || mode === 'local_fallback' || mode === 'embedded_fallback' || mode === 'moss_empty' || usedFallback;
      const applied = applyIntelPacks(body.packs, {
        persist: isLive && Number(body.item_count || 0) > 0,
        // 仅真正 live 才允许用刷新时刻覆盖内容时间；回退保留原 generated_at
        stamp: false,
        refreshedAt,
        externalFocus: body.external_focus || null,
        daySummary: body.day_summary || null,
      });

      const count = ceoIntelItems(getPack().items || []).length;
      const modeLabel = mode === 'moss_live'
        ? 'MOSS 实时'
        : (mode === 'moss_partial'
          ? 'MOSS 部分成功'
          : (mode === 'local_fallback'
            ? '本地基线'
            : (mode === 'embedded_fallback' ? '页面内置' : (mode || '刷新'))));
      const doneStep = REFRESH_STEPS[REFRESH_STEPS.length - 1] || { pct: 100, text: '刷新完成' };

      if (isLive && applied) {
        state.intelRefresh.lastSuccessAt = refreshedAt;
        state.intelRefresh.lastError = null;
      } else if (isDegraded && count > 0) {
        // 回退有内容：记录尝试时间，但不宣称实时成功
        state.intelRefresh.lastSuccessAt = refreshedAt;
        state.intelRefresh.lastError = null;
      } else if (!applied || Number(body.item_count || 0) === 0) {
        state.intelRefresh.lastError = (body.errors && body.errors[0]) || body.error || '未拉到可用经营情报';
      }

      setIntelRefreshProgress(
        doneStep.pct,
        `${doneStep.text} · ${modeLabel} ${isLive ? (body.item_count || count) : count} 条${isDegraded && !isLive ? '（非实时）' : ''}`,
      );

      state.nav = 'intel';
      updateNav();
      renderTopicFilters();
      renderIntelFeed();
      renderHomeBrief();
      if ($('#insightHeadline')) renderInsight();
      updateIntelEntryMeta();
      updateIntelRefreshMeta();
      if (!DEMO_PACKAGE && isLive && applied) showReloadBanner(count);
      const warn = (body.errors || []).length && isLive ? `（${body.errors.length} 路检索有告警）` : '';
      if (!isLive || isDegraded) {
        const fb = typeof PKG.fallbackToast === 'function'
          ? PKG.fallbackToast(count, body.errors)
          : (PKG.fallbackToast || '服务未连接，已用本地情报完成刷新');
        showToast(fb, 4200);
        const soft = (body.errors || [])[0] || body.error;
        if (soft) {
          setIntelRefreshProgress(doneStep.pct, `${doneStep.text} · ${modeLabel} ${count} 条（${soft}）`);
        }
        updateIntelRefreshMeta();
      } else if (!applied) {
        showToast('MOSS 无有效情报，已保留原列表', 4200);
      } else {
        const toast = typeof PKG.successToast === 'function'
          ? PKG.successToast(body.item_count || count, warn)
          : `情报刷新完成 · ${body.item_count || count} 条${warn}`;
        showToast(toast, 4200);
      }
    } catch (err) {
      const msg = err.name === 'AbortError' ? '请求超时，请重试' : (err.message || '未知错误');
      state.intelRefresh.lastError = msg;
      setIntelRefreshProgress(state.intelRefresh.progress, `刷新失败：${msg}`);
      showToast(DEMO_PACKAGE
        ? '刷新失败，请先运行「启动演示.command」或 python3 server.py'
        : '刷新失败，请确认已启动 server.py');
    } finally {
      state.intelRefresh.loading = false;
      btn?.classList.remove('is-loading');
      updateIntelRefreshMeta();
      hideIntelRefreshProgress(state.intelRefresh.lastError ? 3200 : 2200);
    }
  }

  const THEME_META = {
    'biren-classic': '#070b18',
    'biren-deep': '#030712',
    'biren-light': '#f1f5f9',
  };

  function applyPackageBranding() {
    if (PKG.brandSub) {
      const sub = document.querySelector('.brand__sub');
      if (sub) sub.textContent = PKG.brandSub;
    }
    if (PKG.titleSuffix != null) {
      const base = '壁仞科技 · CEO 决策看板';
      document.title = `${base}${PKG.titleSuffix || ''}`;
    }
  }

  function applyTheme(id) {
    state.theme = id;
    document.documentElement.setAttribute('data-theme', id);
    localStorage.setItem('biren-ceo-theme', id);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = THEME_META[id] || THEME_META['biren-light'];
  }

  function openThemePicker() {
    const html = `<div class="theme-picker">${THEMES.map((t) => `
      <button class="theme-option ${state.theme === t.id ? 'is-active' : ''}" data-theme-pick="${t.id}">
        <div class="theme-option__name">${t.name}</div>
        <div class="theme-option__desc">${t.desc}</div>
        <div class="theme-option__swatch">${t.swatches.map((c) => `<span style="background:${c}"></span>`).join('')}</div>
      </button>
    `).join('')}</div>`;
    openSheet('壁仞主题配色', html);
    $$('[data-theme-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        applyTheme(btn.dataset.themePick);
        closeSheet();
        showToast(`已切换：${THEMES.find((t) => t.id === btn.dataset.themePick).name}`);
      });
    });
  }

  const PERIOD_META = {
    evening: { name: '今日', tag: '最新', intel: '经营情报', tasks: '待办清单' },
  };

  function getPeriodMeta() {
    return PERIOD_META.evening;
  }

  function renderPeriodHints() {
    // 早午晚时段叙事已移除
  }

  function updateIntelEntryMeta() {
    const items = ceoIntelItems(getPack().items || []);
    const high = items.filter((i) => i.impact_level === 'high').length;
    const meta = $('#intelEntryMeta');
    if (!meta) return;
    const ts = state.intelRefresh.lastSuccessAt;
    const base = high
      ? `今日 ${items.length} 条 · ${high} 条高影响`
      : `今日 ${items.length} 条经营情报`;
    meta.textContent = ts ? `${base} · 刷新于 ${formatDateTime(ts).slice(11)}` : base;
  }

  function goIntelPage() {
    state.nav = 'intel';
    updateNav();
    scrollActivePanelTop();
  }

  function normalizeFocusItem(item) {
    if (typeof item === 'string') return { text: item, why: '' };
    return {
      tag: item.tag || '',
      text: item.text || item.title || '',
      why: item.why || item.note || '',
    };
  }

  function renderHomeBrief() {
    const card = $('#decisionBriefCard');
    if (!card) return;
    const ins = DATA.insights?.[state.period] || DATA.insights?.evening || {};
    const external = (Array.isArray(ins.external) ? ins.external : [])
      .map(normalizeFocusItem)
      .filter((item) => item.text);
    const internal = (Array.isArray(ins.internal) ? ins.internal : (ins.focus || []))
      .map(normalizeFocusItem)
      .filter((item) => item.text);

    const renderWhy = (why) => (why ? `<div class="focus-item__why">${why}</div>` : '');

    card.innerHTML = `
      <div class="focus-brief__rail">
        <div class="focus-brief__kicker">外部态势</div>
        <div class="focus-ext-list">
          ${external.slice(0, 3).map((item) => `
            <div class="focus-ext-item">
              <span class="focus-ext-item__tag">${item.tag || '外部'}</span>
              <div class="focus-item__body">
                <div class="focus-ext-item__text">${item.text}</div>
                ${renderWhy(item.why)}
              </div>
            </div>
          `).join('') || '<div class="focus-ext-item"><span class="focus-ext-item__text">暂无</span></div>'}
        </div>
      </div>
      <div class="focus-brief__body">
        <div class="focus-brief__kicker">内部态势</div>
        <div class="focus-action-list">
          ${internal.slice(0, 4).map((item, idx) => `
            <div class="focus-action">
              <span class="focus-action__idx">${String(idx + 1).padStart(2, '0')}</span>
              <div class="focus-item__body">
                <div class="focus-action__text">${item.text}</div>
                ${renderWhy(item.why)}
              </div>
            </div>
          `).join('') || '<div class="focus-action"><span class="focus-action__text">暂无</span></div>'}
        </div>
      </div>
    `;
  }

  function renderActiveTab() {
    updateIntelRefreshMeta();
    if (state.nav === 'home') {
      renderItQuickGrid();
      renderItSnapshots();
      renderHomeBrief();
      renderTodos();
      updateIntelEntryMeta();
    }
    if (state.nav === 'intel') {
      renderTopicFilters();
      renderIntelFeed();
    }
    if (state.nav === 'tasks') renderTasksTab();
    if (state.nav === 'me') renderSettings();
  }

  function scrollActivePanelTop() {
    const panel = $('.tab-panel.is-active');
    if (panel) panel.scrollTop = 0;
    $('#mainScroll')?.scrollTo?.({ top: 0, behavior: 'smooth' });
  }

  function formatYi(value) {
    if (value == null || Number.isNaN(Number(value))) return '—';
    return `${Number(value).toFixed(2).replace(/\.?0+$/, '').replace(/(\.\d)0$/, '$1')}亿`;
  }

  function renderCeoKpi() {
    const kpiData = DATA.ceo_sales_kpi;
    const strip = $('#ceoKpiStrip');
    const forecastEl = $('#revenueForecast');
    if (!kpiData || !strip) {
      $('#ceoKpiSection')?.classList.add('hidden');
      forecastEl?.classList.add('hidden');
      return;
    }
    $('#ceoKpiSection')?.classList.remove('hidden');
    forecastEl?.classList.remove('hidden');
    $('#ceoKpiAsOf').textContent = `截至 ${kpiData.as_of || '—'}`;

    strip.innerHTML = (kpiData.kpis || []).map((k) => {
      const polarity = k.polarity || 'neutral';
      const ach = k.achievement_pct != null
        ? `<span class="ceo-kpi-card__achievement ${polarity === 'bad' ? 'ceo-kpi-card__achievement--bad' : polarity === 'warn' ? 'ceo-kpi-card__achievement--warn' : ''}">${k.achievement_pct}%</span>`
        : '';
      const displayVal = k.unit === '%' ? `${k.value}%` : `${k.value}${k.unit || ''}`;
      const targetLine = k.target != null
        ? `<span class="ceo-kpi-card__target">目标 ${k.target}${k.unit === '%' ? '%' : k.unit || ''}</span>`
        : '';
      const gapLine = k.gap != null
        ? `<span class="ceo-kpi-card__target">${k.unit === '%' ? `缺口 ${k.gap}pp` : `缺口 ${k.gap}${k.unit || ''}`}</span>`
        : '';
      return `
        <div class="ceo-kpi-card ceo-kpi-card--${polarity}">
          <div class="ceo-kpi-card__name">${k.name}</div>
          <div class="ceo-kpi-card__value-row">
            <span class="ceo-kpi-card__value">${displayVal}</span>
            ${ach}
          </div>
          ${targetLine || gapLine ? `<div class="ceo-kpi-card__value-row">${targetLine}${gapLine}</div>` : ''}
          <div class="ceo-kpi-card__meta">
            <span class="ceo-kpi-card__tag">${k.source || 'BI'}</span>
            <span class="ceo-kpi-card__tag">${k.freshness || '—'}</span>
            ${k.note ? `<span class="ceo-kpi-card__tag">${k.note}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    const fc = kpiData.annual_forecast || {};
    const segments = fc.segments || [];
    const total = fc.forecast || segments.reduce((s, x) => s + (x.value || 0), 0);
    const sum = segments.reduce((s, x) => s + (x.value || 0), 0) || 1;

    $('#revenueForecastNote').textContent = kpiData.tax_note || '';
    $('#revenueForecastTotal').innerHTML = `
      <div class="revenue-forecast__total-value">${formatYi(total)}</div>
      <div class="revenue-forecast__total-label">预测合计</div>
    `;
    $('#revenueForecastBar').innerHTML = segments.map((seg) => {
      const pct = ((seg.value || 0) / sum) * 100;
      return `<div class="revenue-forecast__seg" style="width:${pct}%;background:${seg.color || '#165DFF'}" title="${seg.name} ${formatYi(seg.value)}"></div>`;
    }).join('');
    $('#revenueForecastLegend').innerHTML = segments.map((seg) => `
      <span class="revenue-forecast__legend-item">
        <span class="revenue-forecast__dot" style="background:${seg.color || '#165DFF'}"></span>
        ${seg.name} ${formatYi(seg.value)}${seg.raw ? ` <em style="opacity:.7">(含税${seg.raw}亿)</em>` : ''}
      </span>
    `).join('');
    const gap = (fc.target || 0) - total;
    $('#revenueForecastTarget').innerHTML = `
      <span>年度目标 ${formatYi(fc.target)} · 达成 ${fc.achievement_pct || Math.round((total / (fc.target || 1)) * 100)}%</span>
      <span class="revenue-forecast__gap">缺口 ${formatYi(gap)}</span>
    `;
  }

  function renderInsight() {
    const ins = DATA.insights?.[state.period];
    if (!ins || !$('#insightHeadline')) return;
    $('#insightHeadline').textContent = ins.headline || '外部经营环境更新';
    $('#insightBridge').textContent = ins.bridge || ins.body || '';

    const externalTrack = ins.external_track || (Array.isArray(ins.external) ? {
      summary: ins.bridge || '',
      signals: ins.external.map((f) => (typeof f === 'string' ? f : `${f.text}：${f.why || ''}`)),
    } : ins.external);
    const internalTrack = (ins.internal && !Array.isArray(ins.internal))
      ? ins.internal
      : {
        summary: '',
        signals: (Array.isArray(ins.internal) ? ins.internal : (ins.focus || []))
          .map((f) => (typeof f === 'string' ? f : f.text)),
      };

    if (internalTrack || externalTrack) {
      const track = (kind, data) => `
        <div class="insight-track insight-track--${kind}">
          <div class="insight-track__head">
            <span class="insight-track__title">${kind === 'internal' ? '内部经营' : '外部环境'}</span>
          </div>
          ${data?.summary ? `<p class="insight-track__summary">${data.summary}</p>` : ''}
          <ul class="insight-track__signals">${(data?.signals || []).slice(0, kind === 'external' ? 3 : 3).map((s) => `<li>${s}</li>`).join('')}</ul>
        </div>
      `;
      $('#insightTracks').innerHTML = track('internal', internalTrack) + track('external', externalTrack);
    } else {
      $('#insightTracks').innerHTML = `
        <p class="insight-track__summary">${ins.body || ''}</p>
        <ul class="insight-track__signals">${(ins.signals || []).map((s) => `<li>${s}</li>`).join('')}</ul>
      `;
    }

    const pack = getPack();
    $('#insightMeta').textContent = pack.generated_at
      ? `更新于 ${pack.generated_at.slice(0, 16).replace('T', ' ')}`
      : '';
  }

  function metricStatusLabel(item) {
    if (item.polarity === 'good') return { text: '正常', cls: 'ok' };
    if (item.polarity === 'focus') return { text: '待决策', cls: 'focus' };
    return { text: '需盯', cls: 'warn' };
  }

  function metricDeltaClass(text) {
    if (!text) return '';
    if (text === 'NEW' || /^\+/.test(text)) return 'up';
    if (/^-/.test(text) || /升高|↑|open|黄灯/.test(text)) return 'down';
    return 'flat';
  }

  function getPinnedMetricIds() {
    try {
      const saved = JSON.parse(localStorage.getItem(PIN_KEY) || 'null');
      if (Array.isArray(saved) && saved.length) return saved.slice(0, MAX_PINNED);
    } catch (_) {}
    return (DATA.default_pinned_metrics || ['bi.org.attendance_today', 'bi.finance.overdue_total', 'bi.finance.collection_month']).slice(0, MAX_PINNED);
  }

  function savePinnedMetricIds(ids) {
    localStorage.setItem(PIN_KEY, JSON.stringify(ids.slice(0, MAX_PINNED)));
    renderItQuickGrid();
    renderSettings();
    if (!$('#subpageMetricsPool')?.classList.contains('hidden')) renderMetricsPool();
  }

  function togglePinMetric(id) {
    let pins = getPinnedMetricIds();
    if (pins.includes(id)) {
      savePinnedMetricIds(pins.filter((x) => x !== id));
      showToast('已取消置顶');
      return;
    }
    if (pins.length >= MAX_PINNED) {
      showToast(`最多置顶 ${MAX_PINNED} 项 CEO 核心指标`);
      return;
    }
    pins.push(id);
    savePinnedMetricIds(pins);
    showToast('已设为 CEO 核心指标');
  }

  function getInternalMetricPool() {
    const pool = new Map();
    Object.values(DATA.metric_catalog || {}).forEach((m) => {
      if (m.domain === 'internal') {
        const resolved = findMetricById(m.id);
        if (resolved) pool.set(m.id, resolved);
      }
    });
    const pm = DATA.metrics[state.period];
    [...(pm.good || []), ...(pm.bad || []), ...(pm.focus ? [pm.focus] : [])].forEach((m) => {
      if (m && m.domain === 'internal') {
        const resolved = findMetricById(m.id);
        if (resolved) pool.set(m.id, resolved);
      }
    });
    return [...pool.values()];
  }

  function getPeriodInternalMetricIds() {
    const ids = new Set();
    const pm = DATA.metrics[state.period];
    [...(pm.good || []), ...(pm.bad || []), ...(pm.focus ? [pm.focus] : [])].forEach((m) => {
      if (m && m.domain === 'internal') ids.add(m.id);
    });
    return ids;
  }

  function metricDynamicScore(item, inPeriod) {
    let score = 0;
    if (item.polarity === 'bad') score += 45;
    else if (item.polarity === 'focus') score += 38;
    else score += 8;
    if (item.delta?.text === 'NEW') score += 28;
    else if (item.delta?.text && /^[+-]/.test(item.delta.text)) score += 12;
    const sp = item.sparkline || [];
    if (sp.length >= 2) {
      const change = Math.abs(Number(sp[sp.length - 1]) - Number(sp[0]));
      score += Math.min(change * 3, 18);
    }
    if ((item.freshness?.lag_minutes ?? 999) <= 120) score += 14;
    if (inPeriod) score += 16;
    return score;
  }

  function computeDynamicMetrics() {
    const pinned = new Set(getPinnedMetricIds());
    const periodIds = getPeriodInternalMetricIds();
    const candidates = getInternalMetricPool().filter((m) => !pinned.has(m.id));
    return candidates
      .map((item) => ({ item, score: metricDynamicScore(item, periodIds.has(item.id)) }))
      .sort((a, b) => b.score - a.score || (a.item.name || '').localeCompare(b.item.name || '', 'zh'))
      .slice(0, MAX_DYNAMIC)
      .map((x) => x.item);
  }

  function getCoreMetrics() {
    return getPinnedMetricIds()
      .map((id) => findMetricById(id))
      .filter(Boolean);
  }

  function formatTrendNum(v) {
    const n = Number(v);
    if (Math.abs(n) >= 100) return Math.round(n).toString();
    if (Math.abs(n) >= 10) return n.toFixed(1).replace(/\.0$/, '');
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  function trendChartHtml(values, unit, metricId) {
    if (!values || !values.length) {
      return '<p class="trend-empty">暂无 7 日历史数据</p>';
    }

    const vals = values.map(Number);
    const first = vals[0];
    const last = vals[vals.length - 1];
    const delta = last - first;
    const flat = vals.every((v) => v === vals[0]);
    const pct = first !== 0 ? ((delta / Math.abs(first)) * 100) : (delta !== 0 ? 100 : 0);
    const u = unit ? ` ${unit}` : '';

    let summaryClass = 'trend-summary--flat';
    let summaryText = '近 7 日基本持平，无显著波动';
    if (!flat) {
      const sign = delta > 0 ? '+' : '';
      summaryClass = delta > 0 ? 'trend-summary--up' : 'trend-summary--down';
      summaryText = `7 日内 ${sign}${formatTrendNum(delta)}${u}`;
      if (Math.abs(pct) >= 0.5) summaryText += `（${sign}${formatTrendNum(pct)}%）`;
    }

    const w = 300;
    const h = 80;
    const padX = 10;
    const padY = 10;
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    if (max === min) {
      min -= Math.abs(min) * 0.08 + 0.5;
      max += Math.abs(max) * 0.08 + 0.5;
    }

    const coords = vals.map((v, i) => {
      const x = padX + (i / (vals.length - 1)) * (w - padX * 2);
      const y = padY + (1 - (v - min) / (max - min)) * (h - padY * 2);
      return { x, y, v };
    });

    const linePath = `M ${coords.map((c) => `${c.x},${c.y}`).join(' L ')}`;
    const areaPath = `${linePath} L ${w - padX},${h - padY} L ${padX},${h - padY} Z`;
    const gradId = `trendGrad-${(metricId || 'x').replace(/\./g, '-')}`;
    const dayLabels = ['T-6', 'T-5', 'T-4', 'T-3', 'T-2', '昨日', '今日'];

    return `
      <div class="trend-chart">
        <div class="trend-summary ${summaryClass}">${summaryText}</div>
        <div class="trend-chart__range">
          <span>起始 <strong>${formatTrendNum(first)}${u}</strong></span>
          <span class="trend-chart__arrow">→</span>
          <span>当前 <strong>${formatTrendNum(last)}${u}</strong></span>
        </div>
        <svg class="trend-chart__svg" viewBox="0 0 ${w} ${h}" aria-hidden="true">
          <defs>
            <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.35"/>
              <stop offset="100%" stop-color="#165dff" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path class="trend-chart__area" d="${areaPath}" fill="url(#${gradId})"/>
          <path class="trend-chart__line" d="${linePath}"/>
          ${coords.map((c, i) => `
            <circle class="trend-chart__dot" cx="${c.x}" cy="${c.y}" r="${i === coords.length - 1 ? 4 : 2.5}"/>
          `).join('')}
        </svg>
        <div class="trend-chart__days">${dayLabels.map((d) => `<span>${d}</span>`).join('')}</div>
        <div class="trend-chart__values">${coords.map((c) => `<span>${formatTrendNum(c.v)}</span>`).join('')}</div>
      </div>
    `;
  }

  function findMetricById(id) {
    let found = null;
    for (const period of ['morning', 'noon', 'evening']) {
      const m = DATA.metrics[period];
      const all = [...(m.good || []), ...(m.bad || []), ...(m.focus ? [m.focus] : [])];
      const hit = all.find((x) => x && x.id === id);
      if (hit) found = hit;
    }
    const catalogItem = DATA.metric_catalog && DATA.metric_catalog[id];
    if (found && catalogItem) {
      return {
        ...catalogItem,
        ...found,
        category: found.category || catalogItem.category,
        action_owners: found.action_owners || catalogItem.action_owners,
        related: found.related?.length ? found.related : catalogItem.related,
        evidence: found.evidence?.length ? found.evidence : catalogItem.evidence,
      };
    }
    if (found) return found;
    if (catalogItem) return catalogItem;
    return null;
  }

  function polarityLabel(item) {
    if (item.polarity === 'good') return { tag: '正向指标', emoji: '🟢' };
    if (item.polarity === 'focus') return { tag: '焦点指标', emoji: '⭐' };
    return { tag: '关注指标', emoji: '🔴' };
  }

  function isActionableMetric(item) {
    return item.polarity === 'bad' || item.polarity === 'focus';
  }

  function getMetricOwners(item) {
    if (item.action_owners?.length) return item.action_owners;
    const catalog = DATA.metric_catalog?.[item.id];
    if (catalog?.action_owners?.length) return catalog.action_owners;
    const category = item.category || catalog?.category;
    return METRIC_OWNER_MAP[category] || ['待指定'];
  }

  function buildMetricTodoTitle(item) {
    const unit = item.unit ? ` ${item.unit}` : '';
    const delta = item.delta?.text ? ` · ${item.delta.text}` : '';
    return `跟进：${item.name}（${item.value}${unit}${delta}）`;
  }

  function buildMetricTodoNote(item) {
    const evidence = (item.evidence || [])[0]?.text || '';
    const parts = [item.selection_rationale, evidence ? `证据：${evidence}` : ''].filter(Boolean);
    return parts.join('\n');
  }

  function createTodoFromMetric(item, { navigate = true } = {}) {
    const owners = getMetricOwners(item);
    const todo = {
      id: 't' + Date.now(),
      title: buildMetricTodoTitle(item),
      priority: item.polarity === 'focus' ? 'high' : 'medium',
      status: 'open',
      owners,
      due: item.polarity === 'focus' ? '本周' : '今日',
      source: item.id,
      metric_id: item.id,
      note: buildMetricTodoNote(item),
    };
    DATA.todos.unshift(todo);
    renderTodos();
    if (navigate) {
      closeSheet();
      state.nav = 'home';
      updateNav();
      setActionTab('todo');
    }
    return todo;
  }

  function openMetricNotify(item) {
    let todo = DATA.todos.find((t) => t.metric_id === item.id && t.status === 'open');
    if (!todo) todo = createTodoFromMetric(item, { navigate: false });
    closeSheet();
    openDispatch(todo.id);
  }

  function metricActionCardHtml(item) {
    if (!isActionableMetric(item)) return '';
    const owners = getMetricOwners(item).join('、');
    const tone = item.polarity === 'focus' ? ' metric-action-card--focus' : '';
    return `
      <div class="detail-block metric-action-card${tone}">
        <div class="detail-label">CEO 行动</div>
        <p class="metric-action-card__text">该指标存在异常或待决策项，可生成待办或直接通知相关负责人跟进。</p>
        <div class="metric-action-card__owners">建议跟进：<strong>${owners}</strong></div>
      </div>
    `;
  }

  function metricActionFooterHtml(item) {
    if (!isActionableMetric(item)) {
      return '<button type="button" class="btn btn--ghost" style="flex:1" id="sheetOk">关闭</button>';
    }
    const owners = getMetricOwners(item).join('、');
    return `
      <div class="sheet-actions-wrap">
        <p class="sheet-actions-hint">建议跟进 · ${owners}</p>
        <div class="sheet-actions">
          <button type="button" class="btn btn--outline sheet-action-btn" id="metricTodoBtn">+ 生成待办</button>
          <button type="button" class="btn btn--primary sheet-action-btn" id="metricNotifyBtn">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            通知负责人
          </button>
        </div>
      </div>
    `;
  }

  function bindMetricActionClicks(item) {
    const todoBtn = $('#metricTodoBtn');
    const notifyBtn = $('#metricNotifyBtn');
    if (todoBtn) {
      todoBtn.addEventListener('click', () => {
        createTodoFromMetric(item);
        showToast('已生成待办，可在行动区跟进');
      });
    }
    if (notifyBtn) {
      notifyBtn.addEventListener('click', () => openMetricNotify(item));
    }
  }

  function bindRelatedMetricClicks(container) {
    (container || $('#sheetBody')).querySelectorAll('[data-related-id]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.relatedId;
        const rel = findMetricById(id);
        if (!rel) {
          showToast('该关联指标暂无详情');
          return;
        }
        const pl = polarityLabel(rel);
        showMetricDetail(rel, pl.tag, pl.emoji);
      });
    });
  }

  function showMetricDetail(item, type, label) {
    const metric = findMetricById(item.id) || item;
    const f = metric.freshness || {};
    const domainLabel = metric.domain === 'internal' ? '内部 BI' : '外部 MOSS';
    const evidenceHtml = (metric.evidence || []).map((e) => `
      <div class="evidence-item">
        <div class="evidence-item__meta">
          <span>${e.type === 'bi' ? '内部' : '外部'}</span>
          <span>${e.source}</span>
          <span>${e.time || ''}</span>
        </div>
        ${e.text}
      </div>
    `).join('');

    const relatedHtml = (metric.related || []).length
      ? `<div class="related-metrics">${metric.related.map((r) => `
          <div class="related-metric" data-related-id="${r.id}" role="button" tabindex="0">
            <div>
              <div>${r.name}</div>
              <div style="font-size:10px;color:var(--text-dim);margin-top:2px">${r.reason || ''}</div>
            </div>
            <span style="color:var(--accent);font-size:16px">›</span>
          </div>
        `).join('')}</div>`
      : '<p style="font-size:12px;color:var(--text-dim)">暂无强关联指标</p>';

    openSheet(metric.name, `
      <div class="detail-block">
        <div class="detail-label">${label} · ${domainLabel}</div>
        <div style="font-size:28px;font-weight:700;margin:4px 0">${metric.value}${metric.unit ? ' ' + metric.unit : ''}
          <span style="font-size:14px;color:var(--text-muted);margin-left:8px">${metric.delta?.text || ''}</span>
        </div>
        <div style="font-size:11px;color:var(--text-dim)">数据时效：${f.lag_label || '—'} · 更新 ${f.updated_at || '—'}</div>
      </div>
      <div class="detail-block">
        <div class="detail-label">7 日趋势</div>
        ${trendChartHtml(metric.sparkline, metric.unit, metric.id)}
      </div>
      <div class="detail-block">
        <div class="detail-label">入选依据</div>
        ${metric.selection_rationale || '—'}
      </div>
      <div class="detail-block">
        <div class="detail-label">证据链</div>
        <div class="evidence-list">${evidenceHtml || '<p style="color:var(--text-dim)">无</p>'}</div>
      </div>
      ${metricActionCardHtml(metric)}
      <div class="detail-block">
        <div class="detail-label">关联指标推荐</div>
        ${relatedHtml}
      </div>
    `, metricActionFooterHtml(metric));

    bindRelatedMetricClicks();
    bindMetricActionClicks(metric);
  }

  function getFeaturedMetricIds() {
    const ids = new Set(getPinnedMetricIds());
    computeDynamicMetrics().forEach((m) => ids.add(m.id));
    return ids;
  }

  function getPoolMetrics() {
    const catalog = DATA.metric_catalog || {};
    const order = { finance: 0, org: 1, production: 2, supply: 3, inventory: 4, sales: 5, rd: 6, compliance: 7, external: 8 };
    return Object.values(catalog).sort((a, b) => {
      const ca = order[a.category] ?? 99;
      const cb = order[b.category] ?? 99;
      return ca - cb || a.name.localeCompare(b.name, 'zh');
    });
  }

  function renderItQuickGrid() {
    const grid = $('#itQuickGrid');
    if (!grid) return;
    // 首页脉搏：人力相关置前（会议纪要：人力/组织与交付联动为 CEO 关注）
    const homeIds = DATA.home_pulse_metrics || [
      'bi.org.attendance_today',
      'bi.org.late_managers',
      'bi.finance.overdue_total',
      'bi.finance.collection_month',
      'bi.supply.board_prep',
      'bi.inventory.m_stock',
    ];
    const cards = homeIds.map((id) => findMetricById(id)).filter(Boolean);
    if (!cards.length) {
      grid.innerHTML = '<p class="metrics-empty">暂无经营指标</p>';
      return;
    }
    grid.innerHTML = cards.map((m, idx) => {
      const tone = m.polarity === 'good' ? '' : ` ops-pulse-card--${m.polarity === 'focus' ? 'focus' : m.polarity === 'bad' ? 'bad' : 'warn'}`;
      const lead = idx < 2 ? ' ops-pulse-card--lead' : '';
      const delta = m.delta?.text ? `<div class="ops-pulse-card__delta">${m.delta.text}</div>` : '';
      const badge = m.category === 'org' ? '<span class="ops-pulse-card__badge">人力</span>' : '';
      return `
        <div class="ops-pulse-card${tone}${lead}" data-metric-id="${m.id}" role="button" tabindex="0">
          <div class="ops-pulse-card__top">
            <div class="ops-pulse-card__name">${m.name}</div>
            ${badge}
          </div>
          <div class="ops-pulse-card__value">${m.value}<span class="ops-pulse-card__unit">${m.unit || ''}</span></div>
          ${delta}
        </div>
      `;
    }).join('');
    grid.querySelectorAll('[data-metric-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const item = findMetricById(el.dataset.metricId);
        if (!item) return;
        const pl = polarityLabel(item);
        showMetricDetail(item, pl.tag, pl.emoji);
      });
    });
  }

  function renderItSnapshots() {
    const wrap = $('#snapshotsGrid');
    const snaps = DATA.it_metric_snapshots;
    if (!wrap || !snaps) return;

    const attendance = snaps.attendance_low;
    const overdue = snaps.overdue_risk;
    const inventory = snaps.inventory_key;
    const maxVal = Math.max(...(overdue?.segments || []).map((s) => s.value), 1);

    const attendanceHtml = attendance ? `
      <div class="snapshot-card snapshot-card--lead">
        <div class="snapshot-card__head">
          <span class="snapshot-card__eyebrow">人力</span>
          <span>${attendance.title}</span>
        </div>
        <div class="snapshot-list">
          ${attendance.items.slice(0, 4).map((it) => `
            <div class="snapshot-list__row">
              <span class="snapshot-list__name">${it.name}</span>
              <span class="snapshot-list__val">${it.rate}%</span>
              <span class="snapshot-pill snapshot-pill--${it.polarity || 'neutral'}">${
                it.polarity === 'bad' ? '偏低' : it.polarity === 'warn' ? '需盯' : '正常'
              }</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    const overdueHtml = overdue ? `
      <div class="snapshot-card">
        <div class="snapshot-card__head">${overdue.title}（${overdue.unit}）</div>
        <div class="snapshot-bars">
          ${overdue.segments.map((s) => `
            <div class="snapshot-bar-wrap">
              <div class="snapshot-bar" style="height:${Math.max(8, (s.value / maxVal) * 40)}px;background:${s.color}"></div>
              <span class="snapshot-bar__label">${s.label}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    const invHtml = inventory ? `
      <div class="snapshot-card">
        <div class="snapshot-card__head">${inventory.title}</div>
        <div class="snapshot-list">
          ${inventory.items.slice(0, 4).map((it) => `
            <div class="snapshot-list__row">
              <span class="snapshot-list__name">${it.name}</span>
              <span class="snapshot-list__val" style="flex:0 0 auto;font-weight:500;color:var(--text-dim)">${it.days}天</span>
              <span class="snapshot-pill snapshot-pill--${it.polarity || 'neutral'}">${it.level}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    wrap.innerHTML = attendanceHtml + overdueHtml + invHtml;
  }

  function poolRowHtml(item, featured) {
    const isFeatured = featured.has(item.id);
    const stale = (item.freshness?.lag_minutes || 0) > 360;
    const polarityClass = item.polarity === 'good' ? 'pool-row--good' : item.polarity === 'focus' ? 'pool-row--focus' : 'pool-row--bad';
    const pins = getPinnedMetricIds();
    const isPinned = pins.includes(item.id);
    const pinDisabled = !isPinned && pins.length >= MAX_PINNED;
    return `
      <div class="pool-row ${polarityClass}${isFeatured ? ' pool-row--featured' : ''}${isPinned ? ' pool-row--pinned' : ''}" data-metric-id="${item.id}" role="button" tabindex="0">
        <button type="button" class="pool-pin${isPinned ? ' is-pinned' : ''}" data-pin-id="${item.id}" aria-label="${isPinned ? '取消置顶' : '置顶为核心指标'}" ${pinDisabled ? 'disabled' : ''}>★</button>
        <div class="pool-row__main">
          <div class="pool-row__name">${item.name}${isPinned ? '<span class="pool-row__badge pool-row__badge--star">核心</span>' : ''}${isFeatured && !isPinned ? '<span class="pool-row__badge">今日</span>' : ''}</div>
          <div class="pool-row__meta">
            <span>${item.domain === 'internal' ? 'BI' : 'MOSS'}</span>
            <span class="pool-row__dot ${stale ? 'pool-row__dot--stale' : ''}"></span>
            <span>${item.freshness?.lag_label || '—'}</span>
          </div>
        </div>
        <div class="pool-row__value">
          <div class="pool-row__num">${item.value}${item.unit ? `<small>${item.unit}</small>` : ''}</div>
          <div class="pool-row__delta">${item.delta?.text || ''}</div>
        </div>
        <span class="pool-row__chev">›</span>
      </div>
    `;
  }

  function renderMetricsPool() {
    const metrics = getPoolMetrics();
    const featured = getFeaturedMetricIds();
    const categories = DATA.metric_pool_categories || [];
    const catName = (id) => categories.find((c) => c.id === id)?.name || id;

    $('#poolTotalCount').textContent = String(metrics.length);

    const internalCount = metrics.filter((m) => m.domain === 'internal').length;
    const externalCount = metrics.length - internalCount;
    const featuredCount = metrics.filter((m) => featured.has(m.id)).length;
    const pinCount = getPinnedMetricIds().length;
    $('#poolSummary').innerHTML = `
      <div class="pool-stat"><strong>${pinCount}/${MAX_PINNED}</strong><span>CEO 核心 ★</span></div>
      <div class="pool-stat"><strong>${featuredCount}</strong><span>今日展示</span></div>
      <div class="pool-stat"><strong>${internalCount}</strong><span>内部 BI</span></div>
    `;

    const filters = [{ id: 'all', name: '全部' }, ...categories];
    const filterEl = $('#poolDomainFilters');
    filterEl.innerHTML = filters.map((f) => `
      <button type="button" class="filter-chip${state.poolCategory === f.id ? ' is-active' : ''}" data-pool-cat="${f.id}">${f.name}</button>
    `).join('');
    filterEl.querySelectorAll('[data-pool-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.poolCategory = btn.dataset.poolCat;
        renderMetricsPool();
      });
    });

    const filtered = state.poolCategory === 'all'
      ? metrics
      : metrics.filter((m) => m.category === state.poolCategory);

    const groups = {};
    filtered.forEach((m) => {
      const cat = m.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(m);
    });

    const sections = categories
      .map((c) => c.id)
      .filter((id) => groups[id]?.length)
      .map((id) => `
        <section class="pool-section">
          <h3 class="pool-section__title">${catName(id)}<span class="pool-section__count">${groups[id].length}</span></h3>
          <div class="pool-rows">${groups[id].map((item) => poolRowHtml(item, featured)).join('')}</div>
        </section>
      `).join('');

    const listEl = $('#poolMetricList');
    listEl.innerHTML = sections || '<p class="pool-empty">暂无符合条件的指标</p>';
    listEl.querySelectorAll('[data-metric-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const item = findMetricById(el.dataset.metricId);
        if (!item) {
          showToast('该指标暂无详情');
          return;
        }
        const pl = polarityLabel(item);
        showMetricDetail(item, pl.tag, pl.emoji);
      });
    });
    listEl.querySelectorAll('[data-pin-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePinMetric(btn.dataset.pinId);
      });
    });
  }

  function openMetricsPool() {
    state.poolCategory = 'all';
    $('#subpageMetricsPool').classList.remove('hidden');
    $('#app').classList.add('subpage-open');
    renderMetricsPool();
    const body = $('#subpageMetricsPool .subpage-body');
    if (body) body.scrollTop = 0;
  }

  function closeMetricsPool() {
    $('#subpageMetricsPool').classList.add('hidden');
    $('#app').classList.remove('subpage-open');
  }

  function renderMetrics() {
    // 核心关注 / 今日异动区块已移除；保留空实现避免旧调用报错
    if (!$('#metricsGrid')) return;

    const cardType = (item) => (item.polarity === 'good' ? 'good' : item.polarity === 'focus' ? 'focus' : 'bad');

    const buildCard = (item, role) => {
      const f = item.freshness || {};
      const stale = (f.lag_minutes || 0) > 360;
      const type = cardType(item);
      const status = metricStatusLabel(item);
      const delta = item.delta?.text || '';
      const deltaCls = metricDeltaClass(delta);
      const roleLabel = role === 'core' ? '置顶' : '异动';
      return `
        <div class="metric-card metric-card--${type}${role === 'core' ? ' metric-card--core' : ' metric-card--dynamic'}" data-metric-id="${item.id}" role="button" tabindex="0">
          <div class="metric-card__top">
            <span class="metric-card__role">${roleLabel}</span>
            <span class="metric-card__status metric-card__status--${status.cls}">${status.text}</span>
          </div>
          <div class="metric-card__name">${item.name}</div>
          <div class="metric-card__value-row">
            <span class="metric-card__value">${item.value}${item.unit ? `<span class="metric-card__unit">${item.unit}</span>` : ''}</span>
            ${delta ? `<span class="metric-card__delta metric-card__delta--${deltaCls}">${delta}</span>` : ''}
          </div>
          <div class="metric-card__fresh">
            <span class="metric-card__fresh-dot ${stale ? 'metric-card__fresh-dot--stale' : ''}"></span>
            ${f.lag_label || '—'}
          </div>
        </div>
      `;
    };

    grid.innerHTML = `
      <div class="metrics-block">
        <div class="metrics-block__head">
          <span class="metrics-block__title">核心关注</span>
          <button type="button" class="text-btn metrics-block__link" id="metricsPinHint">去指标池置顶 · ${core.length}/${MAX_PINNED}</button>
        </div>
        <div class="metrics-grid">${core.map((m) => buildCard(m, 'core')).join('') || `<p class="metrics-empty">在指标池选 3 项你最关心的指标</p>`}</div>
      </div>
      <div class="metrics-block">
        <div class="metrics-block__head">
          <span class="metrics-block__title">今日异动</span>
          <span class="metrics-block__sub">按变化幅度推荐 · ${dynamic.length} 项</span>
        </div>
        <div class="metrics-grid">${dynamic.map((m) => buildCard(m, 'dynamic')).join('')}</div>
      </div>
    `;

    grid.querySelectorAll('[data-metric-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const item = findMetricById(el.dataset.metricId);
        if (!item) return;
        const pl = polarityLabel(item);
        showMetricDetail(item, pl.tag, pl.emoji);
      });
    });
    $('#metricsPinHint')?.addEventListener('click', openMetricsPool);
  }

  function renderModules() {
    const pack = getPack();
    const items = ceoIntelItems(pack.items);
    const counts = countByTopic(items);
    const external = (counts['BR-POL'] || 0) + (counts['BR-SEN'] || 0) + (counts['BR-CMP'] || 0) + (counts['BR-IND'] || 0);
    const strategy = (counts['BR-CUS'] || 0) + items.filter((i) => i.impact_level === 'high').length;
    const ops = computeDynamicMetrics().filter((m) => m.polarity === 'bad').length + openTodos().length;

    const modules = [
      { id: 'external', icon: '🌐', title: '外部环境', count: external, sub: 'MOSS' },
      { id: 'ops', icon: '📊', title: '经营健康', count: ops, sub: 'BI 动态' },
      { id: 'strategy', icon: '🧭', title: '战略决策', count: strategy, sub: '融合' },
    ];

    $('#moduleRow').innerHTML = modules.map((m) => `
      <div class="module-card" data-module="${m.id}">
        <div class="module-card__icon">${m.icon}</div>
        <div class="module-card__title">${m.title}</div>
        <div class="module-card__count">${m.count}</div>
        <div class="module-card__sub">${m.sub}</div>
      </div>
    `).join('');

    $$('.module-card').forEach((el) => {
      el.addEventListener('click', () => {
        state.nav = 'intel';
        updateNav();
        const map = { external: 'BR-POL', ops: 'BR-IND', strategy: 'BR-CUS' };
        state.topicFilter = map[el.dataset.module] || 'ALL';
        renderTopicFilters();
        renderIntelFeed();
      });
    });
  }

  function renderTodos(container, full) {
    const openOnly = !full && !container;
    let source = openOnly ? DATA.todos.filter((t) => t.status !== 'done') : DATA.todos;
    if (openOnly) {
      source = [...source].sort((a, b) => parseTodoDue(a) - parseTodoDue(b));
    }
    const list = full ? source : source.slice(0, openOnly ? 3 : 5);
    const el = container || $('#todoList');
    if (!el) return;
    el.innerHTML = list.map((t) => todoItemHtml(t)).join('')
      || '<p style="color:var(--text-dim);font-size:13px;padding:8px 0">暂无待办</p>';

    bindTodoItemActions(el);

    const open = openTodos().length;
    const badge = $('#todoBadge');
    if (badge) badge.textContent = open;
    const dot = $('#navTodoDot');
    if (open) dot?.classList.remove('hidden');
    else dot?.classList.add('hidden');
  }

  function renderTasksTab() {
    const open = openTodos();
    const done = DATA.todos.filter((t) => t.status === 'done').length;
    const overdue = open.filter((t) => dueBucket(t) === 'overdue').length;
    const todayCount = open.filter((t) => dueBucket(t) === 'today').length;
    const summary = $('#tasksSummary');
    if (summary) {
      summary.innerHTML = `
        <div class="stat-box"><div class="stat-box__num">${open.length}</div><div class="stat-box__label">待处理</div></div>
        <div class="stat-box"><div class="stat-box__num" style="color:${overdue ? '#f87171' : 'inherit'}">${overdue}</div><div class="stat-box__label">已逾期</div></div>
        <div class="stat-box"><div class="stat-box__num">${todayCount}</div><div class="stat-box__label">今日截止</div></div>
        <div class="stat-box"><div class="stat-box__num">${done}</div><div class="stat-box__label">已闭环</div></div>
      `;
    }
    renderTodoCalendar();
    renderTodoGroups();
    const full = $('#tasksFullList');
    if (full) full.innerHTML = '';
  }

  function renderSuggestions() {
    $('#suggestList').innerHTML = DATA.suggestions.map((s) => `
      <div class="suggest-item ${s.status === 'accepted' ? 'suggest-item--accepted' : ''}">
        <div style="flex:1">
          <div class="suggest-item__title">${s.title}</div>
          <div class="suggest-item__text">${s.text}</div>
          <div class="suggest-item__value">价值：${s.value || '—'}</div>
        </div>
        <div class="suggest-item__btns">
          ${s.status !== 'accepted' ? `<button class="btn-adopt" data-adopt="${s.id}">转为待办</button>` : '<span class="chip chip--done">已采纳</span>'}
        </div>
      </div>
    `).join('');

    $$('[data-adopt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const s = DATA.suggestions.find((x) => x.id === btn.dataset.adopt);
        if (!s) return;
        s.status = 'accepted';
        DATA.todos.unshift({
          id: 't' + Date.now(),
          title: s.title + '：' + s.text.slice(0, 40),
          priority: 'medium',
          status: 'open',
          owners: ['待指定'],
          due: '本周',
          source: s.id,
        });
        renderSuggestions();
        renderTodos();
        setActionTab('todo');
        showToast('已转为待办');
      });
    });
  }

  function setActionTab(tab) {
    state.actionTab = tab;
    $$('.action-tabs__btn').forEach((b) => {
      const active = b.dataset.actionTab === tab;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', active);
    });
    $$('.action-panel').forEach((p) => {
      p.classList.toggle('is-active', p.dataset.actionPanel === tab);
    });
    if (state.nav === 'home') {
      $('#actionSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function renderWatch() {
    const section = $('#tomorrowSection');
    if (!section) return;
    let list = state.period === 'evening' ? (DATA.evening.tomorrow_watch || []) : [];
    list = list.filter((w) => !CAPITAL_MARKET_RE.test(`${w.title} ${w.summary}`));
    if (!list.length) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    const catMap = { policy: '政策', competitor: '竞品', customer: '客户', industry: '行业' };
    $('#watchList').innerHTML = list.slice(0, 3).map((w) => `
      <div class="watch-item" data-watch="${w.watch_id}">
        <div class="watch-item__cat">${catMap[w.category] || w.category}</div>
        <div class="watch-item__title">${w.title}</div>
      </div>
    `).join('');

    $$('.watch-item').forEach((el) => {
      el.addEventListener('click', () => {
        const w = DATA.evening.tomorrow_watch.find((x) => x.watch_id === el.dataset.watch);
        if (w) openSheet('明日关注', `
          <div class="detail-block"><div class="detail-label">事项</div>${w.title}</div>
          <div class="detail-block"><div class="detail-label">说明</div>${w.summary}</div>
        `);
      });
    });
  }

  function renderTopicFilters() {
    const el = $('#topicFilters');
    if (!el) return;
    const pack = getPack();
    const items = ceoIntelItems(pack.items || []);
    const topics = ['ALL', ...new Set(items.map((i) => i.topic_id))];
    el.innerHTML = topics.map((t) => `
      <button class="filter-chip ${state.topicFilter === t ? 'is-active' : ''}" data-topic="${t}">
        ${t === 'ALL' ? '全部' : TOPIC_META[t]?.name || t}
      </button>
    `).join('');

    el.querySelectorAll('.filter-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.topicFilter = btn.dataset.topic;
        renderTopicFilters();
        renderIntelFeed();
      });
    });
  }

  function renderIntelFeed() {
    const feed = $('#intelFeed');
    if (!feed) return;
    let items = ceoIntelItems(getPack().items || []);
    if (state.topicFilter !== 'ALL') items = items.filter((i) => i.topic_id === state.topicFilter);
    items = sortIntelByPriority(items);

    feed.innerHTML = items.map((item) => {
      const meta = TOPIC_META[item.topic_id] || {};
      const tags = (item.tags || []).slice(0, 4);
      const relevance = composeBirenRelevance(item);
      const featured = isFeaturedIntel(item);
      const fresh = freshnessOfIntel(item);
      const relevanceHtml = relevance && !isGenericRelevance(relevance)
        ? `<p class="intel-card__relevance">${relevance}</p>`
        : '';
      return `
        <article class="intel-card intel-card--${item.impact_level || 'medium'}${featured ? ' is-featured' : ''}" data-id="${item.item_id}">
          <div class="intel-card__head">
            <span class="fresh-pill fresh-pill--${fresh.key}">${fresh.label}</span>
            ${featured ? '<span class="feat-pill">★ 加精</span>' : ''}
            <span class="impact-pill impact-pill--${item.impact_level || 'medium'}">${item.impact_label || impactLevelLabel(item.impact_level)}</span>
            ${item.is_new ? '<span class="intel-card__new">NEW</span>' : ''}
            <span class="intel-card__topic">${meta.name || item.topic_id}</span>
            <span class="confidence-pill confidence-pill--${item.confidence || 'low'}">置信${item.confidence_label || '低'}</span>
          </div>
          <h3 class="intel-card__title">${item.title}</h3>
          <p class="intel-card__summary">${item.summary || ''}</p>
          ${relevanceHtml}
          ${tags.length ? `<div class="intel-card__tags">${tags.map((t) => `<span class="intel-tag">${t}</span>`).join('')}</div>` : ''}
          <div class="intel-card__foot">
            <span class="intel-card__source">来源 · ${item.source_name || '未知'}</span>
            <span>${formatDateTime(item.collected_at || item.published_at).slice(5, 16)}</span>
          </div>
        </article>
      `;
    }).join('') || '<p style="color:var(--text-dim);text-align:center;padding:24px">暂无经营相关情报<br><span style="font-size:11px">已过滤行情快讯与低质二手短讯，可点击刷新重试</span></p>';

    feed.querySelectorAll('.intel-card').forEach((card) => {
      card.addEventListener('click', () => {
        const item = items.find((i) => i.item_id === card.dataset.id);
        if (item) showIntelDetail(item);
      });
    });
  }

  function showIntelDetail(item) {
    const tags = (item.tags || []).join('、') || '—';
    const relevance = composeBirenRelevance(item);
    const featured = isFeaturedIntel(item);
    const fresh = freshnessOfIntel(item);
    openSheet(item.title, `
      <div class="detail-block">
        <div class="detail-label">标记</div>
        <div>
          <span class="fresh-pill fresh-pill--${fresh.key}">${fresh.label}</span>
          ${featured ? '<span class="feat-pill" style="margin-left:6px">★ 加精</span>' : ''}
        </div>
      </div>
      <div class="detail-block"><div class="detail-label">摘要</div>${item.summary || '—'}</div>
      <div class="detail-block"><div class="detail-label">壁仞关联解读</div>${relevance || '—'}</div>
      <div class="detail-block"><div class="detail-label">影响判断</div>${item.impact_label || impactLevelLabel(item.impact_level)}（${impactLevelLabel(item.impact_level)}）</div>
      <div class="detail-block"><div class="detail-label">标签</div>${tags}</div>
      <div class="detail-block"><div class="detail-label">来源</div>${item.source_name || '—'}${item.source_url ? ` · <a href="${item.source_url}" target="_blank" rel="noopener">原文链接</a>` : ''}</div>
      <div class="detail-block"><div class="detail-label">置信度</div>置信${item.confidence_label || '低'}（按信源权威性评估，低置信请交叉核验）</div>
    `, item.source_url ? `<a href="${item.source_url}" target="_blank" rel="noopener" class="btn btn--primary" style="flex:1;text-align:center;text-decoration:none;justify-content:center">查看原文</a>` : '');
  }

  function renderTasksTab() {
    const open = openTodos();
    const done = DATA.todos.filter((t) => t.status === 'done').length;
    const overdue = open.filter((t) => dueBucket(t) === 'overdue').length;
    const todayCount = open.filter((t) => dueBucket(t) === 'today').length;
    const summary = $('#tasksSummary');
    if (summary) {
      summary.innerHTML = `
        <div class="stat-box"><div class="stat-box__num">${open.length}</div><div class="stat-box__label">待处理</div></div>
        <div class="stat-box"><div class="stat-box__num" style="color:${overdue ? '#f87171' : 'inherit'}">${overdue}</div><div class="stat-box__label">已逾期</div></div>
        <div class="stat-box"><div class="stat-box__num">${todayCount}</div><div class="stat-box__label">今日截止</div></div>
        <div class="stat-box"><div class="stat-box__num">${done}</div><div class="stat-box__label">已闭环</div></div>
      `;
    }
    renderTodoCalendar();
    renderTodoGroups();
    const full = $('#tasksFullList');
    if (full) full.innerHTML = '';
  }

  function renderSettings() {
    const pins = getPinnedMetricIds().map((id) => findMetricById(id)?.name || id).join('、');
    const el = $('#settingsList');
    if (!el) return;
    el.innerHTML = [
      ['首页结构', '今日关注 → 经营脉搏 → 待办'],
      ['情报', '完整列表在「情报」页；首页仅外部态势与内部态势'],
      ['指标库', `客户 IT 12 项 · 置顶 ${getPinnedMetricIds().length}/${MAX_PINNED}`],
      ['置顶指标', pins || '未设置'],
      ['主题配色', '点击顶栏 ◉ 切换'],
      ['CEO 视图', '默认隐藏资本市场情报'],
    ].map(([k, v]) => `<div class="settings-item"><span>${k}</span><span style="color:var(--text-dim);font-size:12px">${v}</span></div>`).join('');
  }

  function openSheet(title, bodyHtml, footerHtml) {
    $('#sheetTitle').textContent = title;
    $('#sheetBody').innerHTML = bodyHtml;
    $('#sheetFooter').innerHTML = footerHtml || '<button class="btn btn--ghost" style="flex:1" id="sheetOk">关闭</button>';
    $('#sheetBackdrop').classList.remove('hidden');
    $('#detailSheet').classList.remove('hidden');
    const ok = $('#sheetOk');
    if (ok) ok.addEventListener('click', closeSheet, { once: true });
  }

  function closeSheet() {
    $('#sheetBackdrop').classList.add('hidden');
    $('#detailSheet').classList.add('hidden');
  }

  function openDispatch(todoId) {
    const todo = DATA.todos.find((t) => t.id === todoId);
    if (!todo) return;
    state.dispatchTodoId = todoId;
    state.selectedOwners = [...(todo.owners || [])];
    $('#dispatchBody').innerHTML = `
      <div class="dispatch-preview"><strong>【CEO看板】</strong> ${todo.title}${todo.note ? `<br><br><span style="font-size:12px;color:var(--text-muted);line-height:1.5">${todo.note.replace(/\n/g, '<br>')}</span>` : ''}<br><br>截止：${todo.due}</div>
      <div class="detail-label">接收人</div>
      <div class="owner-chips" id="ownerChips">
        ${['CTO', '法务', '销售VP', '供应链负责人', 'IR'].map((o) => `
          <button class="owner-chip ${state.selectedOwners.includes(o) ? 'is-selected' : ''}" data-owner="${o}">${o}</button>
        `).join('')}
      </div>
    `;
    $('#dispatchBackdrop').classList.remove('hidden');
    $('#dispatchModal').classList.remove('hidden');
    $$('#ownerChips .owner-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const o = btn.dataset.owner;
        if (state.selectedOwners.includes(o)) {
          state.selectedOwners = state.selectedOwners.filter((x) => x !== o);
          btn.classList.remove('is-selected');
        } else {
          state.selectedOwners.push(o);
          btn.classList.add('is-selected');
        }
      });
    });
  }

  function closeDispatch() {
    $('#dispatchBackdrop').classList.add('hidden');
    $('#dispatchModal').classList.add('hidden');
  }

  /* Voice todo */
  function initSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.lang = 'zh-CN';
    rec.continuous = false;
    rec.interimResults = true;
    return rec;
  }

  function simulateSummary(text) {
    return `决策要点：${text.slice(0, 60)}${text.length > 60 ? '…' : ''}\n建议跟进：待指定负责人\n建议时限：本周内\n来源：CEO 语音输入`;
  }

  function openNewTodoModal() {
    $('#voiceTranscript').value = '';
    $('#voiceSummary').textContent = '摘要将在此自动生成：决策要点 / 跟进人 / 建议截止';
    $('#voiceSummary').classList.remove('is-ready');
    $('#todoTitleInput').value = '';
    $('#todoBackdrop').classList.remove('hidden');
    $('#todoModal').classList.remove('hidden');
  }

  function closeNewTodoModal() {
    stopRecording();
    $('#todoBackdrop').classList.add('hidden');
    $('#todoModal').classList.add('hidden');
  }

  function startRecording() {
    const btn = $('#voiceBtn');
    const label = $('#voiceLabel');
    if (!state.recognition) {
      const demo = '下午跟 CTO 确认工信部算力安全要求的反馈口径，法务一起过一遍自主可控条款，周五前要有初稿。';
      $('#voiceTranscript').value = demo;
      const summary = simulateSummary(demo);
      $('#voiceSummary').textContent = summary;
      $('#voiceSummary').classList.add('is-ready');
      $('#todoTitleInput').value = '确认工信部算力安全要求反馈口径';
      showToast('当前环境无麦克风权限，已载入演示转写');
      return;
    }
    state.isRecording = true;
    btn.classList.add('is-recording');
    label.textContent = '正在聆听… 松开结束';
    state.recognition.start();
  }

  function stopRecording() {
    if (!state.isRecording) return;
    state.isRecording = false;
    $('#voiceBtn').classList.remove('is-recording');
    $('#voiceLabel').textContent = '按住说话 · 转写并摘要';
    try { state.recognition.stop(); } catch (_) {}
  }

  function bindVoice() {
    state.recognition = initSpeech();
    if (state.recognition) {
      state.recognition.onresult = (e) => {
        let final = '';
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        const text = final || interim;
        $('#voiceTranscript').value = text;
        if (final) {
          const summary = simulateSummary(final);
          $('#voiceSummary').textContent = summary;
          $('#voiceSummary').classList.add('is-ready');
          $('#todoTitleInput').value = final.slice(0, 36);
        }
      };
      state.recognition.onend = () => {
        state.isRecording = false;
        $('#voiceBtn').classList.remove('is-recording');
        $('#voiceLabel').textContent = '按住说话 · 转写并摘要';
      };
    }

    const vBtn = $('#voiceBtn');
    if (!vBtn) return;
    vBtn.addEventListener('mousedown', startRecording);
    vBtn.addEventListener('mouseup', stopRecording);
    vBtn.addEventListener('mouseleave', stopRecording);
    vBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); });
    vBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopRecording(); });

    $('#newTodoBtn')?.addEventListener('click', openNewTodoModal);
    $('#todoModalClose')?.addEventListener('click', closeNewTodoModal);
    $('#todoModalCancel')?.addEventListener('click', closeNewTodoModal);
    $('#todoBackdrop')?.addEventListener('click', closeNewTodoModal);
    $('#todoModalSave')?.addEventListener('click', () => {
      const title = ($('#todoTitleInput')?.value || '').trim() || ($('#voiceTranscript')?.value || '').trim().slice(0, 40);
      if (!title) { showToast('请输入待办标题'); return; }
      DATA.todos.unshift({
        id: 't' + Date.now(),
        title,
        priority: 'medium',
        status: 'open',
        owners: ['待指定'],
        due: '本周',
        source: 'voice',
        note: $('#voiceSummary')?.textContent,
      });
      closeNewTodoModal();
      renderTodos();
      setActionTab('todo');
      showToast('待办已创建');
    });
  }

  function setPeriod(period) {
    state.period = period || 'evening';
    renderAll();
    renderActiveTab();
  }

  function updateNav() {
    $$('.bottom-nav__item').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.nav === state.nav);
    });
    $$('.tab-panel').forEach((p) => {
      p.classList.toggle('is-active', p.dataset.tab === state.nav);
    });
    renderActiveTab();
  }

  function renderAll() {
    if (state.nav === 'home') {
      renderItQuickGrid();
      renderItSnapshots();
      renderHomeBrief();
      renderTodos();
      updateIntelEntryMeta();
    } else if (state.nav === 'intel') {
      renderTopicFilters();
      renderIntelFeed();
    }
    updateIntelRefreshMeta();
    if (!$('#subpageMetricsPool')?.classList.contains('hidden')) renderMetricsPool();
  }

  function bindEvents() {
    $$('.bottom-nav__item').forEach((btn) => {
      btn.addEventListener('click', () => { state.nav = btn.dataset.nav; updateNav(); });
    });
    $('#themeBtn').addEventListener('click', openThemePicker);
    $('#sheetBackdrop').addEventListener('click', closeSheet);
    $('#sheetClose').addEventListener('click', closeSheet);
    $('#dispatchBackdrop').addEventListener('click', closeDispatch);
    $('#dispatchClose').addEventListener('click', closeDispatch);
    $('#dispatchCancel').addEventListener('click', closeDispatch);
    $('#dispatchConfirm').addEventListener('click', () => {
      if (!state.selectedOwners.length) { showToast('请选择接收人'); return; }
      closeDispatch();
      showToast(`已下发至 ${state.selectedOwners.join('、')}`);
    });
    $('#metricsMoreBtn')?.addEventListener('click', openMetricsPool);
    $('#intelEntryBtn')?.addEventListener('click', goIntelPage);
    $('#intelEntryMeta')?.addEventListener('click', goIntelPage);
    $('#todosMoreBtn')?.addEventListener('click', () => {
      state.nav = 'tasks';
      updateNav();
    });
    $('#poolBackBtn').addEventListener('click', closeMetricsPool);
    $('#fullscreenToggle').addEventListener('click', () => {
      $('#previewShell').classList.toggle('is-fullscreen');
    });
    $('#settingsBtn').addEventListener('click', () => { state.nav = 'me'; updateNav(); });
    $('#intelRefreshBtn')?.addEventListener('click', refreshLatestIntelMessages);
    $('#intelReloadPageBtn')?.addEventListener('click', () => {
      // 缓存已写入；刷新页面后 hydrate 会带出最新内容
      location.reload();
    });
  }

  try {
    hydrateIntelCache();
    applyPackageBranding();
  // 强制浅色主题（演示统一口径）
  applyTheme('biren-light');
    bindEvents();
    bindVoice();
    renderSettings();
    updateIntelRefreshMeta();
    setPeriod('evening');
    updateNav();
    if (state.intelRefresh.lastSuccessAt) {
      // 页面加载后若有缓存刷新记录，提示用户当前已是刷新后内容
      updateIntelEntryMeta();
    }
  } catch (err) {
    console.error('[CEO Dashboard] init failed', err);
    const main = document.getElementById('mainScroll');
    if (main) {
      main.insertAdjacentHTML('afterbegin', `<p style="padding:16px;color:#f87171;font-size:13px">页面初始化失败：${String(err && err.message || err)}</p>`);
    }
  }
})();
