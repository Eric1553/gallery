(function () {
  var PAGES = [
    { num: "01", file: "01_合见原型总览墙.html", title: "原型总览墙", layer: "总览", group: "overview", drill: ["02", "14"] },
    { num: "02", file: "02_合见L1_公司经营总览_原型.html", title: "L1 公司经营总览", layer: "L1", group: "proto", drill: ["03", "04", "05", "06", "07"] },
    { num: "03", file: "03_合见运营驾驶舱_原型.html", title: "运营驾驶舱", layer: "L2", group: "proto", drill: ["08", "09", "12"] },
    { num: "04", file: "04_合见L2_库存驾驶舱_原型.html", title: "库存驾驶舱", layer: "L2", group: "proto", drill: ["09", "06", "12"] },
    { num: "05", file: "05_合见L2_销售驾驶舱_原型.html", title: "销售驾驶舱", layer: "L2", group: "proto", drill: ["08", "11", "13"] },
    { num: "06", file: "06_合见L2_计划生产驾驶舱_原型.html", title: "计划生产驾驶舱", layer: "L2", group: "proto", drill: ["09", "04", "12"] },
    { num: "07", file: "07_合见L2_财务驾驶舱_原型.html", title: "财务驾驶舱", layer: "L2", group: "proto", drill: ["11", "13", "02"] },
    { num: "08", file: "08_合见L3_借测生命周期专题_原型.html", title: "借测生命周期专题", layer: "L3", group: "proto", drill: ["11", "12", "13"] },
    { num: "09", file: "09_合见L4_缺货归因专题_原型.html", title: "缺货归因专题", layer: "L3", group: "proto", drill: ["12", "13", "06", "04"] },
    { num: "10", file: "10_合见L4_多维分析下钻_原型.html", title: "多维分析下钻", layer: "L4", group: "proto", drill: ["12", "13", "03"] },
    { num: "11", file: "11_合见L4_借转销回款归因_原型.html", title: "借转销回款归因", layer: "L4", group: "proto", drill: ["13", "08", "07"] },
    { num: "12", file: "12_合见运营_穿透清单_原型.html", title: "穿透明细清单", layer: "L5", group: "proto", drill: ["13", "03"] },
    { num: "13", file: "13_合见运营_订单卡片_原型.html", title: "订单 360° 卡片", layer: "L5", group: "proto", drill: ["03", "08"] },
    { num: "14", file: "14_合见分析思路框架.html", title: "L1–L5 穿透总览", layer: "框架", group: "framework", drill: ["03", "12", "13"] },
    { num: "15", file: "15_合见分析思路框架_L1L2分层驾驶舱.html", title: "L1→L2 分层驾驶舱", layer: "框架", group: "framework", drill: ["02", "03", "04", "05"] },
    { num: "16", file: "16_合见分析思路框架_L3L4专题归因.html", title: "L3→L4 专题归因", layer: "框架", group: "framework", drill: ["08", "09", "10", "11"] },
    { num: "17", file: "17_合见分析思路框架_OTD供给缺货闭环.html", title: "OTD 供给缺货闭环", layer: "框架", group: "framework", drill: ["06", "04", "09", "12"] },
    { num: "18", file: "18_合见分析思路框架_LTC借测转销闭环.html", title: "LTC 借测转销闭环", layer: "框架", group: "framework", drill: ["05", "08", "11", "07"] }
  ];

  var byNum = {};
  PAGES.forEach(function (p, i) {
    p.index = i;
    byNum[p.num] = p;
  });

  var current = document.body.getAttribute("data-page") || "01";
  var cur = byNum[current] || PAGES[0];
  var navEl = document.getElementById("proto-nav");
  if (!navEl) return;

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }

  function pageLink(p, active) {
    var layerCls = p.group === "framework" ? " fw" : p.group === "overview" ? " ov" : "";
    return (
      '<li><a class="' + (active ? "active" : "") + layerCls + '" href="' + esc(p.file) + '">' +
      '<span class="nav-num">' + esc(p.num) + '</span>' +
      '<span class="nav-body"><span class="lbl">' + esc(p.title) + '</span>' +
      '<span class="tag">' + esc(p.layer) + '</span></span></a></li>'
    );
  }

  var prev = cur.index > 0 ? PAGES[cur.index - 1] : null;
  var next = cur.index < PAGES.length - 1 ? PAGES[cur.index + 1] : null;

  var groups = [
    { key: "overview", label: "总览" },
    { key: "proto", label: "L1–L5 原型" },
    { key: "framework", label: "分析思路框架" }
  ];

  var listHtml = "";
  groups.forEach(function (g) {
    listHtml += '<div class="nav-group"><div class="nav-group-hd">' + esc(g.label) + '</div><ul class="nav-list">';
    PAGES.filter(function (p) { return p.group === g.key; }).forEach(function (p) {
      listHtml += pageLink(p, p.num === current);
    });
    listHtml += "</ul></div>";
  });

  var drillHtml = "";
  (cur.drill || []).forEach(function (num) {
    var p = byNum[num];
    if (p) drillHtml += '<a href="' + esc(p.file) + '">' + esc(p.num + " " + p.title) + "</a>";
  });

  var inner =
    '<button type="button" class="nav-close" aria-label="关闭索引">×</button>' +
    '<div class="nav-scroll">' +
    '<div class="nav-brand"><div class="t1">合见运营数字化</div><div class="t2">原型系列 · 共 ' + PAGES.length + ' 页<br>①工作台 → ②清单 → ③卡片</div></div>' +
    '<div class="nav-pager">' +
    '<a class="' + (prev ? "" : "disabled") + '" href="' + (prev ? esc(prev.file) : "#") + '">◀ 上一页</a>' +
    '<a class="' + (next ? "" : "disabled") + '" href="' + (next ? esc(next.file) : "#") + '">下一页 ▶</a>' +
    "</div>" +
    listHtml +
    (drillHtml ? '<div class="nav-drill"><div class="nav-drill-hd">推荐穿透</div>' + drillHtml + "</div>" : "") +
    "</div>";

  navEl.innerHTML = inner;

  /* 浮动控件 */
  var backdrop = document.createElement("div");
  backdrop.className = "nav-backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  document.body.appendChild(backdrop);

  var toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "nav-toggle";
  toggle.setAttribute("aria-label", "打开页面索引");
  toggle.innerHTML = '<span class="ico">☰</span><span class="tx">索引</span>';
  document.body.appendChild(toggle);

  function setNavOpen(open) {
    navEl.classList.toggle("open", open);
    backdrop.classList.toggle("open", open);
    document.body.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  toggle.addEventListener("click", function () { setNavOpen(true); });
  backdrop.addEventListener("click", function () { setNavOpen(false); });
  navEl.querySelector(".nav-close").addEventListener("click", function () { setNavOpen(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setNavOpen(false);
  });

  /* 底部穿透条 — fixed 到视口，append 到 body */
  var main = document.querySelector(".proto-main");
  if (!main) return;

  if (current !== "01") {
    var chain = ["03", "12", "13"];
    var bar = document.createElement("div");
    bar.className = "proto-drill-bar";
    var parts = ['<span class="lbl">页面穿透</span>'];
    parts.push('<a href="01_合见原型总览墙.html">01 总览墙</a>');
    if (chain.indexOf(current) !== -1) {
      parts.push('<span class="sep">|</span><span class="lbl">主链路</span>');
      chain.forEach(function (num) {
        var p = byNum[num];
        if (!p) return;
        var cls = "chain" + (num === current ? " active-chain" : "");
        parts.push('<a class="' + cls + '" href="' + esc(p.file) + '">' + esc(p.num + " " + p.title) + "</a>");
      });
    }
    if (cur.drill && cur.drill.length) {
      parts.push('<span class="sep">|</span><span class="lbl">推荐</span>');
      cur.drill.slice(0, 4).forEach(function (num) {
        var p = byNum[num];
        if (p) parts.push('<a href="' + esc(p.file) + '">' + esc(p.num + " " + p.title) + "</a>");
      });
    }
    bar.innerHTML = parts.join("");
    document.body.appendChild(bar);
    document.body.classList.add("has-drill-bar");
  }
})();
