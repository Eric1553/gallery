/**
 * 思格一把手看板：环形图绘制 + 下钻跳转
 * 依赖：页面内带 id 的 svg 容器、带 data-drill 的链接元素
 */
(function () {
  'use strict';

  function polar(cx, cy, r, rad) {
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  /** 环形扇区 path：内径 r0 外径 r1，角度 rad0→rad1（数学角，逆时针为正，从右侧 0 起） */
  function donutArc(cx, cy, r0, r1, rad0, rad1) {
    const sweep = rad1 - rad0;
    const large = Math.abs(sweep) > Math.PI ? 1 : 0;
    const [x0, y0] = polar(cx, cy, r1, rad0);
    const [x1, y1] = polar(cx, cy, r1, rad1);
    const [x2, y2] = polar(cx, cy, r0, rad1);
    const [x3, y3] = polar(cx, cy, r0, rad0);
    const f = sweep > 0 ? 1 : 0;
    return (
      'M ' + x0 + ' ' + y0 +
      ' A ' + r1 + ' ' + r1 + ' 0 ' + large + ' ' + f + ' ' + x1 + ' ' + y1 +
      ' L ' + x2 + ' ' + y2 +
      ' A ' + r0 + ' ' + r0 + ' 0 ' + large + ' ' + (1 - f) + ' ' + x3 + ' ' + y3 +
      ' Z'
    );
  }

  /** 从 12 点方向起顺时针累加：startRad = -π/2 */
  function degSlice(cx, cy, r0, r1, startRad, fraction, totalFraction) {
    var span = (fraction / totalFraction) * 2 * Math.PI;
    var a0 = startRad;
    var a1 = startRad + span;
    return { path: donutArc(cx, cy, r0, r1, a0, a1), endRad: a1 };
  }

  function clearSvg(svg) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }

  function showToast(msg) {
    var el = document.getElementById('drill-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('visible');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      el.classList.remove('visible');
    }, 1600);
  }

  function navigateDrill(url, title) {
    if (title) showToast('下钻：' + title);
    setTimeout(function () {
      window.location.href = url;
    }, title ? 150 : 0);
  }

  window.DashboardDrill = {
    navigate: navigateDrill,

    /** slices: { label, fraction, color, drillUrl, drillTitle }[] ，fraction 为占比小数 */
    renderDonut: function (svgId, slices, opts) {
      opts = opts || {};
      var svg = document.getElementById(svgId);
      if (!svg) return;
      clearSvg(svg);
      var cx = opts.cx != null ? opts.cx : 100;
      var cy = opts.cy != null ? opts.cy : 100;
      var r1 = opts.r1 != null ? opts.r1 : 62;
      var r0 = opts.r0 != null ? opts.r0 : 38;
      var start = -Math.PI / 2;
      var total = slices.reduce(function (s, x) {
        return s + x.fraction;
      }, 0);
      var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'donut-slices');
      var cur = start;
      for (var i = 0; i < slices.length; i++) {
        var sl = slices[i];
        var seg = degSlice(cx, cy, r0, r1, cur, sl.fraction, total);
        cur = seg.endRad;
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', seg.path);
        path.setAttribute('fill', sl.color);
        path.setAttribute('stroke', '#0f1419');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('class', 'donut-seg');
        path.style.cursor = 'pointer';
        if (sl.drillUrl) {
          path.setAttribute('data-drill-url', sl.drillUrl);
          if (sl.drillTitle) path.setAttribute('data-drill-title', sl.drillTitle);
          path.addEventListener('click', function (ev) {
            var u = ev.currentTarget.getAttribute('data-drill-url');
            var t = ev.currentTarget.getAttribute('data-drill-title') || '';
            navigateDrill(u, t);
          });
          path.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter' || ev.key === ' ') {
              ev.preventDefault();
              navigateDrill(ev.currentTarget.getAttribute('data-drill-url'), ev.currentTarget.getAttribute('data-drill-title'));
            }
          });
          path.setAttribute('tabindex', '0');
          path.setAttribute('role', 'button');
        }
        g.appendChild(path);
      }
      svg.appendChild(g);
      var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', cx);
      c.setAttribute('cy', cy);
      c.setAttribute('r', r0 - 2);
      c.setAttribute('fill', '#1a222c');
      svg.appendChild(c);
      var title = opts.centerTitle;
      if (title) {
        var te = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        te.setAttribute('x', cx);
        te.setAttribute('y', cy + 4);
        te.setAttribute('text-anchor', 'middle');
        te.setAttribute('fill', '#8b9aab');
        te.setAttribute('font-size', '10');
        te.textContent = title;
        svg.appendChild(te);
      }
    },

    bindDataDrills: function (root) {
      root = root || document;
      root.querySelectorAll('[data-drill-url]').forEach(function (el) {
        if (el.tagName === 'path' && el.classList.contains('donut-seg')) return;
        el.style.cursor = 'pointer';
        el.addEventListener('click', function (ev) {
          var u = el.getAttribute('data-drill-url');
          var t = el.getAttribute('data-drill-title') || '';
          if (u) navigateDrill(u, t);
        });
      });
    },
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('svg-donut-overseas')) {
      DashboardDrill.renderDonut(
        'svg-donut-overseas',
        [
          {
            label: '海外',
            fraction: 0.912,
            color: '#3d8bfd',
            drillUrl: 'drill-region.html?scope=overseas',
            drillTitle: '海外区域与战略',
          },
          {
            label: '国内',
            fraction: 0.088,
            color: '#5cb3ff',
            drillUrl: 'drill-region.html?scope=domestic',
            drillTitle: '国内市场与战略',
          },
        ],
        { centerTitle: '收入结构', cx: 100, cy: 100, r1: 64, r0: 40 }
      );
    }

    if (document.getElementById('svg-donut-product')) {
      DashboardDrill.renderDonut(
        'svg-donut-product',
        [
          { label: '光储充一体', fraction: 0.46, color: '#3d8bfd', drillUrl: 'drill-product.html?line=stor', drillTitle: '光储充一体' },
          { label: '储能栈', fraction: 0.22, color: '#5cb3ff', drillUrl: 'drill-product.html?line=stack', drillTitle: '储能栈' },
          { label: '逆变器', fraction: 0.14, color: '#2d6fd4', drillUrl: 'drill-product.html?line=inv', drillTitle: '逆变器' },
          { label: '充电与配件', fraction: 0.1, color: '#4a5568', drillUrl: 'drill-product.html?line=charge', drillTitle: '充电与配件' },
          { label: '服务与订阅', fraction: 0.08, color: '#6b7c93', drillUrl: 'drill-product.html?line=svc', drillTitle: '服务与订阅' },
        ],
        { centerTitle: '产品线', cx: 100, cy: 100, r1: 64, r0: 40 }
      );
    }

    if (document.getElementById('svg-risk-mini')) {
      DashboardDrill.renderDonut(
        'svg-risk-mini',
        [
          { label: '已套保', fraction: 0.72, color: '#34c759', drillUrl: 'drill-risk.html?tab=fx', drillTitle: '汇率与套保' },
          { label: '未套保', fraction: 0.28, color: '#2d3845', drillUrl: 'drill-risk.html?tab=fx', drillTitle: '汇率与套保' },
        ],
        { centerTitle: '套保', cx: 52, cy: 52, r1: 36, r0: 22 }
      );
    }

    DashboardDrill.bindDataDrills(document.body);
  });
})();
