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

  // 원가율로 정한 메뉴인가 (menu.costRate 가 0~1 숫자이면 예: 0.2 = 20%. 없거나 null 이면 재료로 계산)
  function usesRate(menu) {
    return !!menu && isNum(menu.costRate) && menu.costRate >= 0;
  }

  // 메뉴 한 개의 결과: 원가, 마진, 원가율(판매가 0이면 null), 판정
  // 원가 = 원가율로 정한 메뉴는 판매가 × 원가율, 아니면 재료 합계. (재료 목록은 원가율을 골라도 지워지지 않고 남아 있음)
  function evaluate(menu, ingredients) {
    var price = isNum(menu.price) ? menu.price : 0;
    var cost = usesRate(menu) ? price * menu.costRate : menuCost(menu, ingredients);
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

  // ---------- 가게 장부 (2026-11-06 기획서 4장) ----------
  // 항목 코드 ↔ 화면 이름. rent·labor·util 은 고정비 칸과 짝 (이중으로 빼지 않기 위해)
  var LEDGER_CATS = [['mat', '재료 구입'], ['pack', '포장재'], ['rent', '월세'], ['labor', '인건비'],
                     ['util', '공과금'], ['fix', '수리·비품'], ['etc', '기타']];
  var PAIRED = ['rent', 'labor', 'util'];
  var PAIRED_JOSA = { rent: '월세는', labor: '인건비는', util: '공과금은' };
  // 레시피 원가 vs 실제 재료비 판정 기준 (추측값. 써 보며 조정)
  var CMP_OK = 0.10;      // ±10% 안이면 "거의 맞아요"
  var CMP_MUCH = 0.25;    // +25% 넘으면 "훨씬 더 썼어요"
  var RECORD_MIN = 0.8;   // 판매 기록이 영업일의 80% 미만이면 안내
  var COST_RATES = [0.1, 0.15, 0.2, 0.25, 0.3];   // 원가율로 정하기 버튼

  function monthOf(d) { return String(d).slice(0, 7); }
  function prevMonth(ym) {
    var a = ym.split('-'), y = +a[0], m = +a[1] - 1;
    if (m < 1) { y--; m = 12; }
    return y + '-' + String(m).padStart(2, '0');
  }

  // 그 달 판매 합계. sales = state.sales → { sales:매출, cost:레시피 원가(판매 때 저장된 값), days:판매 기록 있는 날 수 }
  function monthSales(sales, ym) {
    var t = { sales: 0, cost: 0, days: 0 };
    Object.keys(sales || {}).forEach(function (d) {
      if (monthOf(d) !== ym) return;
      var r = sales[d];
      if (!r || !Array.isArray(r.items) || (!r.items.length && !isNum(r.posTotal))) return;
      var s = daySummary(r);
      t.sales += s.sales; t.cost += s.cost; t.days++;
    });
    return t;
  }

  // 그 달 장부 항목별 { count, sum }. 모르는 코드는 "기타"로 합친다
  function ledgerMonth(ledger, ym) {
    var by = {}, count = 0;
    LEDGER_CATS.forEach(function (c) { by[c[0]] = { count: 0, sum: 0 }; });
    (ledger || []).forEach(function (e) {
      if (!e || monthOf(e.date) !== ym || !isNum(e.amount)) return;
      var k = by[e.cat] ? e.cat : 'etc';
      by[k].count++; by[k].sum += e.amount; count++;
    });
    return { by: by, count: count };
  }

  // 한 달 장부 (기획서 4-4 식)
  //  짝 항목(월세·인건비·공과금): 그 달 장부에 1건 이상이면 장부 합계, 아니면 고정비 칸 금액
  //  실제 나간 돈 = 장부(재료·포장재·수리비품·기타) + 짝 항목 값 + 고정비 칸(그 밖). 레시피 원가는 넣지 않음
  //  실제로 남은 돈 = 매출 − 실제 나간 돈. 판매도 장부도 없는 달은 empty:true (남은 돈 계산 안 함)
  function monthBook(sales, lm, fixed, saleDays) {
    var f = fixed || {};
    var fx = function (k) { return isNum(f[k]) && f[k] > 0 ? f[k] : 0; };
    var rows = [], out = 0, warnings = [];
    LEDGER_CATS.forEach(function (c) {
      var k = c[0], b = lm.by[k], paired = PAIRED.indexOf(k) >= 0;
      var useBook = !paired || b.count > 0;
      var value = useBook ? b.sum : fx(k);
      rows.push({ key: k, label: c[1], value: value, count: b.count, source: useBook ? '장부' : '고정비 칸' });
      out += value;
      if (paired && b.count > 0 && fx(k) > 0) {
        warnings.push(PAIRED_JOSA[k] + ' 장부 ' + fmtWon(b.sum) + '원만 쓰고 있어요. 고정비 칸(' + fmtWon(fx(k)) + '원)은 빼지 않았어요.');
      }
    });
    rows.push({ key: 'fixetc', label: '고정비 그 밖(카드 수수료 등)', value: fx('etc'), count: 0, source: '고정비 칸' });
    out += fx('etc');
    var hasRecord = saleDays > 0 || lm.count > 0;
    if (saleDays > 0 && lm.by.mat.count === 0) {
      warnings.unshift('재료 구입을 한 건도 안 적었어요. 남은 돈이 실제보다 많게 나와요.');
    }
    if (hasRecord && fixedTotal(f) === 0 && lm.by.rent.count === 0 && lm.by.labor.count === 0) {
      warnings.push('월세·인건비가 비어 있어요. 이대로면 남은 돈이 실제보다 많게 나와요.');
    }
    return { empty: !hasRecord, sales: sales, rows: rows, out: out, left: hasRecord ? sales - out : null, warnings: warnings };
  }

  // 레시피 원가 vs 실제 재료비 (기획서 4-5). 실제 재료비 = 장부(재료 구입) + 장부(포장재)
  // level: nodata(재료·포장재 장부 없음) / norecipe(레시피 원가 0) / ok / more(+10~25%) / much(+25% 초과) / less(−10% 미만)
  function materialCompare(recipeCost, lm, saleDays, openDays) {
    var actual = lm.by.mat.sum + lm.by.pack.sum, n = lm.by.mat.count + lm.by.pack.count;
    var diff = actual - recipeCost, ratio = recipeCost > 0 ? diff / recipeCost : null, level;
    if (n === 0) level = 'nodata';
    else if (ratio === null) level = 'norecipe';
    else if (ratio < -CMP_OK) level = 'less';
    else if (ratio <= CMP_OK) level = 'ok';
    else if (ratio <= CMP_MUCH) level = 'more';
    else level = 'much';
    return { recipe: recipeCost, actual: actual, diff: diff, ratio: ratio, level: level,
             lowRecord: openDays > 0 && saleDays < openDays * RECORD_MIN };
  }

  // 저장·불러오기 자료 모양 검사 (판매 기록 sales·설정 settings·장부 ledger 는 없어도 됨: 예전 백업 파일)
  function validateData(s) {
    if (!s || !Array.isArray(s.ingredients) || !Array.isArray(s.menus)) return false;
    if (s.ledger !== undefined && !(Array.isArray(s.ledger) && s.ledger.every(function (e) {
      return e && typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
        typeof e.cat === 'string' && isNum(e.amount) && e.amount > 0 &&
        (e.memo === undefined || typeof e.memo === 'string');
    }))) return false;
    if (s.sales !== undefined && (typeof s.sales !== 'object' || s.sales === null || Array.isArray(s.sales))) return false;
    if (s.settings !== undefined && (typeof s.settings !== 'object' || s.settings === null)) return false;
    if (s.notes !== undefined && !(Array.isArray(s.notes) && s.notes.every(function (n) {
      return n && typeof n.title === 'string' && typeof n.body === 'string';
    }))) return false;
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
        (m.recipe === undefined || typeof m.recipe === 'string') &&
        (m.costRate === undefined || m.costRate === null || (isNum(m.costRate) && m.costRate >= 0 && m.costRate <= 1)) &&
        isNum(m.price) && Array.isArray(m.items) &&
        m.items.every(function (it) { return it && typeof it.ingId === 'string' && isNum(it.amount); });
    });
    return okIng && okMenu;
  }

  root.Calc = {
    MARGIN_MIN: MARGIN_MIN, RATE_MAX: RATE_MAX, UNITS: UNITS,
    isNum: isNum, unitCost: unitCost, menuCost: menuCost, judge: judge, evaluate: evaluate,
    daySummary: daySummary, fixedTotal: fixedTotal, usesRate: usesRate,
    LEDGER_CATS: LEDGER_CATS, COST_RATES: COST_RATES, CMP_OK: CMP_OK, CMP_MUCH: CMP_MUCH, RECORD_MIN: RECORD_MIN,
    prevMonth: prevMonth, monthSales: monthSales, ledgerMonth: ledgerMonth, monthBook: monthBook, materialCompare: materialCompare,
    fmtWon: fmtWon, fmtPct: fmtPct, fmtUnitCost: fmtUnitCost, validateData: validateData
  };
})(typeof window !== 'undefined' ? window : globalThis);
