/**
 * 下钻落地页：展示 URL 参数（模拟 FineBI 跳转传参），并同步简易「筛选器」文案
 */
(function () {
  'use strict';

  function bannerText() {
    var s = new URLSearchParams(window.location.search);
    var parts = [];
    s.forEach(function (v, k) {
      parts.push(k + '=' + decodeURIComponent(v));
    });
    return parts.length ? parts.join(' · ') : '';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var text = bannerText();
    var box = document.getElementById('param-banner');
    if (box) {
      if (text) {
        box.removeAttribute('hidden');
        box.textContent = '下钻参数（模拟 FineBI 传参）：' + text;
      } else {
        box.setAttribute('hidden', '');
      }
    }

    var lineMap = {
      stor: '光储充一体（SigenStor）',
      stack: '储能栈（SigenStack）',
      inv: '逆变器',
      charge: '充电与配件',
      svc: '服务与订阅',
    };
    var stageMap = {
      线索: '线索',
      方案: '方案/报价',
      谈判: '谈判',
      待签: '待签',
    };
    var tabMapCash = {
      cf: '现金流量',
      ar: '应收账龄',
    };
    var tabMapRisk = {
      fx: '汇率与套保',
      cert: '重大认证',
      cs: '重大客诉',
    };
    var scopeMap = {
      overseas: '海外市场',
      domestic: '国内市场',
    };
    var tabMapRegion = {
      budget: '预算执行',
    };

    var params = new URLSearchParams(window.location.search);
    document.querySelectorAll('[data-sync-param]').forEach(function (el) {
      var key = el.getAttribute('data-sync-param');
      var val = params.get(key);
      if (!val) return;
      val = decodeURIComponent(val);
      if (key === 'line' && lineMap[val]) {
        el.textContent = lineMap[val] + ' ▾';
      } else if (key === 'stage' && stageMap[val]) {
        el.textContent = stageMap[val] + ' ▾';
      } else if (key === 'tab' && el.getAttribute('data-tab-map') === 'cash' && tabMapCash[val]) {
        el.textContent = tabMapCash[val] + ' ▾';
      } else if (key === 'tab' && el.getAttribute('data-tab-map') === 'risk' && tabMapRisk[val]) {
        el.textContent = tabMapRisk[val] + ' ▾';
      } else if (key === 'scope' && scopeMap[val]) {
        el.textContent = scopeMap[val] + ' ▾';
      } else if (key === 'tab' && el.getAttribute('data-tab-map') === 'region' && tabMapRegion[val]) {
        el.textContent = tabMapRegion[val] + ' ▾';
      } else {
        el.textContent = val + ' ▾';
      }
    });
  });
})();
