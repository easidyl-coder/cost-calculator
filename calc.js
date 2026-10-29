/* 계산은 이 파일에만 모아 둔다 (검수팀이 여기만 보면 됨).
   계산 중에는 반올림하지 않는다. 반올림은 화면에 보여 줄 때만 (fmtWon). */
(function (root) {
  'use strict';

  // 판정 기준값 (한곳). 마진이 MARGIN_MIN원 미만 "이면서" 원가율이 RATE_MAX 초과일 때만 "조정 필요"
  var MARGIN_MIN = 2000;   // 원
  var RATE_MAX = 0.4;      // 40%
  var UNITS = ['g', 'ml', '개'];

  function isNum(n) { return typeof n === 'number' && isFinite(n); }

  // 재료 단가 = 구매가 ÷ 구매 용량 (용량이 0 이하면 0)
  function unitCost(ing) {
    if (!ing || !isNum(ing.price) || !isNum(ing.qty) || ing.qty <= 0) return 0;
    return ing.price / ing.qty;
  }

  // 메뉴 원가 = Σ(사용량 × 단가). 지워진 재료는 건너뜀
  function menuCost(menu, ingredients) {
    var total = 0;
    (menu.items || []).forEach(function (it) {
      var ing = null;
      for (var i = 0; i < ingredients.length; i++) {
        if (ingredients[i].id === it.ingId) { ing = ingredients[i]; break; }
      }
      if (ing && isNum(it.amount)) total += it.amount * unitCost(ing);
    });
    return total;
  }

  // 판정: 'adjust'(조정 필요) / 'ok'(괜찮음) / 'none'(판매가 없어 판단 불가)
  function judge(margin, rate) {
    if (rate === null) return 'none';
    return (margin < MARGIN_MIN && rate > RATE_MAX) ? 'adjust' : 'ok';
  }

  // 메뉴 한 개의 결과: 원가, 마진, 원가율(판매가 0이면 null), 판정
  function evaluate(menu, ingredients) {
    var price = isNum(menu.price) ? menu.price : 0;
    var cost = menuCost(menu, ingredients);
    var margin = price - cost;
    var rate = price > 0 ? cost / price : null;
    return { cost: cost, margin: margin, rate: rate, verdict: judge(margin, rate) };
  }

  // ---- 화면 표시용 (계산 값은 건드리지 않음) ----
  function fmtWon(n) { return Math.round(n).toLocaleString('ko-KR'); }
  function fmtPct(r) { return r === null ? '-' : (Math.round(r * 1000) / 10).toLocaleString('ko-KR') + '%'; }
  function fmtUnitCost(n) { return String(parseFloat(n.toFixed(3))); }

  // 하루 판매 정리. rec = { items:[{price,cost,qty}], posTotal } (원가는 판매를 넣을 때의 값으로 저장돼 있음)
  // 매출 = 포스 합계를 넣었으면 그 값, 아니면 메뉴 판매가 × 개수의 합. 번 돈 = 매출 − 원가 (고정비는 빠짐)
  function daySummary(rec) {
    var menuSales = 0, cost = 0, cups = 0;
    ((rec && rec.items) || []).forEach(function (it) {
      if (!isNum(it.qty)) return;
      menuSales += (isNum(it.price) ? it.price : 0) * it.qty;
      cost += (isNum(it.cost) ? it.cost : 0) * it.qty;
      cups += it.qty;
    });
    var sales = rec && isNum(rec.posTotal) ? rec.posTotal : menuSales;
    return { sales: sales, menuSales: menuSales, cost: cost, profit: sales - cost, cups: cups,
             rate: sales > 0 ? cost / sales : null };
  }

  // 한 달 고정비 정리. fixed = { rent, labor, util, etc } (원)
  function fixedTotal(fixed) {
    var t = 0;
    ['rent', 'labor', 'util', 'etc'].forEach(function (k) { if (fixed && isNum(fixed[k])) t += fixed[k]; });
    return t;
  }

  // 저장·불러오기 자료 모양 검사 (판매 기록 sales·설정 settings 는 없어도 됨: 예전 백업 파일)
  function validateData(s) {
    if (!s || !Array.isArray(s.ingredients) || !Array.isArray(s.menus)) return false;
    if (s.sales !== undefined && (typeof s.sales !== 'object' || s.sales === null || Array.isArray(s.sales))) return false;
    if (s.settings !== undefined && (typeof s.settings !== 'object' || s.settings === null)) return false;
    if (s.sales && !Object.keys(s.sales).every(function (d) {
      var r = s.sales[d];
      return /^\d{4}-\d{2}-\d{2}$/.test(d) && r && Array.isArray(r.items) &&
        r.items.every(function (it) { return it && typeof it.name === 'string' && isNum(it.qty); });
    })) return false;
    var okIng = s.ingredients.every(function (i) {
      return i && typeof i.id === 'string' && typeof i.name === 'string' &&
        isNum(i.price) && isNum(i.qty) && UNITS.indexOf(i.unit) >= 0;
    });
    var okMenu = s.menus.every(function (m) {
      return m && typeof m.id === 'string' && typeof m.name === 'string' &&
        isNum(m.price) && Array.isArray(m.items) &&
        m.items.every(function (it) { return it && typeof it.ingId === 'string' && isNum(it.amount); });
    });
    return okIng && okMenu;
  }

  root.Calc = {
    MARGIN_MIN: MARGIN_MIN, RATE_MAX: RATE_MAX, UNITS: UNITS,
    isNum: isNum, unitCost: unitCost, menuCost: menuCost, judge: judge, evaluate: evaluate,
    daySummary: daySummary, fixedTotal: fixedTotal,
    fmtWon: fmtWon, fmtPct: fmtPct, fmtUnitCost: fmtUnitCost, validateData: validateData
  };
})(typeof window !== 'undefined' ? window : globalThis);
