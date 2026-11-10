/* 화면과 저장. 계산은 calc.js(Calc)만 쓴다. 자료는 이 휴대폰(localStorage) 안에만 저장한다. */
(function () {
  'use strict';
  var KEY = 'wongagesan.v1';
  var APP_VER = 19;   // sw.js 의 VERSION 과 같이 올린다 (백업 탭에 보임)
  // 새 변수는 state 를 만들기 전에 선언한다 (뒤에 두면 저장된 자료가 있을 때 빈 화면이 뜬 적이 있음)
  var LEDGER_NAMES = {};
  Calc.LEDGER_CATS.forEach(function (c) { LEDGER_NAMES[c[0]] = c[1]; });
  var COST_RATES = Calc.COST_RATES;
  var view = document.getElementById('view');
  var sheet = document.getElementById('sheet');
  var fileInput = document.getElementById('file');
  // 분류가 비어 있는 메뉴는 이름으로 분류를 짐작해 넣는다 (카페 메뉴 이름에 흔한 낱말 기준, 위에서부터 먼저 맞는 것)
  var CAT_RULES = [
    ['옵션', /^\[옵션\]|추가$|변경$/],
    ['베이커리', /빵|베이글|파운드|크로플|케이크|휘낭시에|모카번|쿠키|마카롱|스콘|머핀|와플|마들렌|샌드위치/],
    ['스무디', /스무디|프라페/],
    ['버블티', /버블티/],
    ['전통차', /쌍화|대추차|배도라지|식혜|수정과/],
    ['아이스티·기타', /아이스티|아샷추|^우유|카프리썬|아이스크림/],
    ['에이드', /에이드|콕|소다/],
    ['주스', /주스/],
    ['논커피 라떼', /밀크티|(오곡|곡물|초코|말차|녹차|고구마|밤|딸기|생강|흑임자|토피넛|쑥|단호박|홍차|미숫가루).*라떼/],
    ['차', /차(\s|$)|티(\s|$)/],
    ['커피', /아메리카노|라떼|에스프레소|카푸치노|모카|마끼아또|마키아토|콜드브루|아포가토|커피|에어리카노|플랫화이트|콘파냐/]
  ];
  var state = load();
  var tab = state.menus.length ? 'sales' : 'menus';
  var saleDate = ymd(new Date());          // 판매 탭에서 보고 있는 날
  var calMonth = saleDate.slice(0, 7);     // 달력 탭에서 보고 있는 달 (YYYY-MM)
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];
  var WEATHER = ['☀️', '⛅', '🌧️', '❄️'];

  function load() {
    var s = null;
    try {
      s = JSON.parse(localStorage.getItem(KEY));
      // 장부 한 줄이 잘못돼도 메뉴·재료·판매 기록까지 통째로 버려지지 않게, 잘못된 장부 줄만 뺀다
      if (s && Array.isArray(s.ledger)) s.ledger = s.ledger.filter(function (e) {
        return Calc.validateData({ ingredients: [], menus: [], ledger: [e] });
      });
      if (!Calc.validateData(s)) s = null;
    } catch (e) { s = null; }
    return fill(s || { ingredients: [], menus: [] });
  }
  function guessCat(name) {
    for (var i = 0; i < CAT_RULES.length; i++) if (CAT_RULES[i][1].test(name)) return CAT_RULES[i][0];
    return '';
  }
  function autoCat(s) {
    var n = 0;
    s.menus.forEach(function (m) {
      if ((m.cat || '').trim()) return;
      var c = guessCat(m.name);
      if (c) { m.cat = c; n++; }
    });
    return n;
  }
  function fill(s) {
    autoCat(s);
    s.sales = s.sales || {};
    s.ledger = s.ledger || [];   // 가게 장부: 나간 돈 기록 [{id,date,cat,amount,memo}]
    s.ledger.forEach(function (e) { if (!e.id) e.id = newId(); });   // 다른 곳에서 만든 파일에 id 가 없을 때
    s.notes = s.notes || [];   // 레시피북의 공통 기준 (제목·내용)
    s.settings = s.settings || {};
    s.settings.fixed = s.settings.fixed || {};
    s.settings.closed = s.settings.closed || [0];   // 쉬는 요일 (0=일). 처음엔 일요일
    return s;
  }
  function ymd(d) {
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function parseYmd(s) { var a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
  function addDays(s, n) { var d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
  function man(n) {   // 화면이 좁은 달력용: 12,345 → 1.2만
    if (Math.abs(n) < 10000) return Calc.fmtWon(n);
    return (Math.round(n / 1000) / 10).toLocaleString('ko-KR') + '만';
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { alert('저장하지 못했어요. 휴대폰 저장 공간을 확인해 주세요.'); }
  }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function parseNum(v) {
    v = String(v).replace(/,/g, '').trim();
    return v === '' ? NaN : Number(v);
  }
  function findIng(id) {
    for (var i = 0; i < state.ingredients.length; i++) if (state.ingredients[i].id === id) return state.ingredients[i];
    return null;
  }
  function verdictBadge(v) {
    if (v === 'adjust') return '<span class="badge adjust">조정 필요</span>';
    if (v === 'ok') return '<span class="badge ok">괜찮음</span>';
    return '<span class="badge none">판매가 입력</span>';
  }

  // ---------- 화면 ----------
  function render() {
    var btns = document.querySelectorAll('#tabs button');
    for (var i = 0; i < btns.length; i++) btns[i].className = btns[i].getAttribute('data-tab') === tab ? 'on' : '';
    if (tab === 'ings') renderIngs();
    else if (tab === 'menus') renderMenus();
    else if (tab === 'sales') renderSales();
    else if (tab === 'cal') renderCal();
    else if (tab === 'recipes') renderRecipes();
    else renderBackup();
  }

  // ---------- 판매 (하루 판 메뉴 개수 넣기) ----------
  function dayRec(d, make) {
    if (!state.sales[d] && make) state.sales[d] = { items: [], memo: '', weather: '', posTotal: null };
    return state.sales[d] || null;
  }
  function dropIfEmpty(d) {
    var r = state.sales[d];
    if (r && !r.items.length && !r.memo && !r.weather && !Calc.isNum(r.posTotal)) delete state.sales[d];
  }
  function popularity() {   // 메뉴별로 지금까지 판 개수 (자주 파는 메뉴를 위로)
    var c = {};
    Object.keys(state.sales).forEach(function (d) {
      state.sales[d].items.forEach(function (it) { c[it.menuId] = (c[it.menuId] || 0) + it.qty; });
    });
    return c;
  }
  function dateLabel(d) {
    var x = parseYmd(d);
    return (x.getMonth() + 1) + '월 ' + x.getDate() + '일 (' + DOW[x.getDay()] + ')';
  }
  function renderSales() {
    if (!state.menus.length) {
      view.innerHTML = '<div class="empty">먼저 메뉴 탭에서 메뉴를 만들어 주세요.<br>판매한 개수를 넣으면 하루에 얼마 벌었는지 계산해 드려요.</div>';
      return;
    }
    var r = dayRec(saleDate, false) || { memo: '', weather: '', posTotal: null };
    var today = ymd(new Date());
    view.innerHTML =
      '<div class="datebar"><button class="nav" data-act="day-prev" aria-label="전날">‹</button>' +
      '<b>' + dateLabel(saleDate) + '</b>' +
      '<button class="nav" data-act="day-next" aria-label="다음날">›</button></div>' +
      (saleDate !== today ? '<button class="btn block slim" data-act="day-today">오늘로 가기</button>' : '') +
      '<div id="sum"></div>' +
      '<div class="weather">' + WEATHER.map(function (w) {
        return '<button data-act="weather" data-w="' + w + '"' + (r.weather === w ? ' class="on"' : '') + '>' + w + '</button>';
      }).join('') + '</div>' +
      '<details class="more"' + (r.memo || Calc.isNum(r.posTotal) ? ' open' : '') + '><summary>포스 합계·메모</summary>' +
      '<label>포스 합계 (원, 할인 반영된 실제 매출)</label><input id="s-pos" class="f" inputmode="numeric" placeholder="비우면 메뉴 판매가로 계산" value="' +
      (Calc.isNum(r.posTotal) ? r.posTotal : '') + '">' +
      '<label>메모 (행사·단체 손님 등)</label><input id="s-memo" class="f" value="' + esc(r.memo || '') + '"></details>' +
      controls('sales', state.menus, '메뉴 찾기 (예: 라떼)') +
      '<div id="mlist"></div>';
    drawSales();
  }
  function drawSum(r) {
    var s = Calc.daySummary(r);
    document.getElementById('sum').innerHTML =
      '<div class="card sum"><div class="grid"><div>매출<b>' + Calc.fmtWon(s.sales) + '원</b></div><div>원가<b>' +
      Calc.fmtWon(s.cost) + '원</b></div><div>번 돈<b class="' + (s.profit < 0 ? 'neg' : 'pos') + '">' + Calc.fmtWon(s.profit) + '원</b></div></div>' +
      '<div class="sub">' + s.cups + '개 판매 · 원가율 ' + Calc.fmtPct(s.rate) +
      (Calc.isNum(r.posTotal) && Math.round(r.posTotal) !== Math.round(s.menuSales)
        ? ' · 메뉴로 계산한 매출(' + Calc.fmtWon(s.menuSales) + '원)과 ' + Calc.fmtWon(Math.abs(r.posTotal - s.menuSales)) + '원 차이' : '') +
      '</div>' + leftLine(saleDate, s) + '</div>';
  }
  function qtyMap(r) { var q = {}; r.items.forEach(function (it) { q[it.menuId] = it; }); return q; }
  // sec: 'top'(이날 판 메뉴) / 'list'(분류별 목록)
  function saleRow(m, sec, qty) {
    var it = qty[m.id], n = it ? it.qty : 0;
    var cost = it ? it.cost : Calc.evaluate(m, state.ingredients).cost;
    return '<div class="srow' + (n ? ' sold' : '') + '" data-row="' + sec + '" data-id="' + m.id + '"><div class="nm">' + esc(m.name) + (m.gone ? ' (지운 메뉴)' : '') +
      '<small>' + Calc.fmtWon(m.price) + '원 · 원가 ' + Calc.fmtWon(cost) + '원</small></div>' +
      '<button class="pm" data-act="minus" data-sec="' + sec + '" data-id="' + m.id + '"' + (n ? '' : ' disabled') + ' aria-label="하나 빼기">−</button>' +
      '<b class="qty">' + n + '</b>' +
      (m.gone ? '<span class="pm"></span>' : '<button class="pm plus" data-act="plus" data-sec="' + sec + '" data-id="' + m.id + '" aria-label="하나 더하기">+</button>') + '</div>';
  }
  // 오늘 판 메뉴는 맨 위에 따로 (메뉴가 지워졌어도 그날 판 기록은 보여 줌)
  function soldHtml(r, qty) {
    var sold = r.items.map(function (it) {
      return state.menus.filter(function (m) { return m.id === it.menuId; })[0] || { id: it.menuId, name: it.name, price: it.price, gone: true };
    });
    return sold.length ? '<div class="cathead row">이날 판 메뉴 <small>' + sold.length + '</small>' +
      '<button class="mini danger" data-act="day-clear" aria-label="초기화" title="초기화">↺</button></div>' +
      sold.map(function (m) { return saleRow(m, 'top', qty); }).join('') : '';
  }
  function drawSales() {
    var box = document.getElementById('mlist');
    if (!box) return;
    var r = dayRec(saleDate, false) || { items: [] }, qty = qtyMap(r);
    drawSum(r);
    var pop = popularity();
    // 분류 안에서는 자주 파는 메뉴가 위로 (분류 순서는 메뉴 탭과 같음). 순서는 화면을 새로 열 때만 바뀜
    var list = state.menus.slice().sort(function (a, b) { return (pop[b.id] || 0) - (pop[a.id] || 0); });
    // 메뉴 목록이 검색창 바로 아래, "이날 판 메뉴"는 맨 아래
    box.innerHTML = grouped('sales', list, function (m) { return saleRow(m, 'list', qty); }) + '<div id="soldbox">' + soldHtml(r, qty) + '</div>';
  }
  // +·− 를 누를 때: 목록은 다시 그리지 않고 그 메뉴 숫자와 "이날 판 메뉴"만 고침 (화면이 움직이지 않게)
  function updateSales(id) {
    var r = dayRec(saleDate, false) || { items: [] }, qty = qtyMap(r);
    drawSum(r);
    var sb = document.getElementById('soldbox');
    if (sb) sb.innerHTML = soldHtml(r, qty);
    var m = state.menus.filter(function (x) { return x.id === id; })[0];
    var rows = document.querySelectorAll('#mlist [data-row="list"]');
    for (var i = 0; i < rows.length; i++) if (m && rows[i].getAttribute('data-id') === id) rows[i].outerHTML = saleRow(m, 'list', qty);
  }
  function changeQty(id, delta, btn) {
    var r = dayRec(saleDate, true);
    var it = r.items.filter(function (x) { return x.menuId === id; })[0];
    var m = state.menus.filter(function (x) { return x.id === id; })[0];
    if (!it) {
      if (delta < 0 || !m) return;
      it = { menuId: id, name: m.name, price: m.price, cost: 0, qty: 0 };
      r.items.push(it);
    }
    if (m) {   // 판매가·원가는 넣는 순간의 값으로 저장 (나중에 메뉴를 고쳐도 지난 기록은 그대로)
      it.name = m.name; it.price = m.price; it.cost = Calc.evaluate(m, state.ingredients).cost;
    }
    it.qty = Math.max(0, it.qty + delta);
    if (!it.qty) r.items = r.items.filter(function (x) { return x !== it; });
    dropIfEmpty(saleDate);
    save();
    // "이날 판 메뉴"에 줄이 새로 생기거나 빠질 때만 아래 목록이 밀림 → 그때만 누른 버튼이 손가락 아래 그대로 있게 정수 픽셀로 맞춤
    var sec = btn && btn.getAttribute('data-sec'), act = btn && btn.getAttribute('data-act');
    var before = btn ? btn.getBoundingClientRect().top : 0;
    updateSales(id);
    if (!sec) return;
    var same = document.querySelectorAll('#mlist [data-act="' + act + '"][data-sec="' + sec + '"]'), now = null;
    for (var i = 0; i < same.length; i++) if (same[i].getAttribute('data-id') === id) now = same[i];
    if (!now) return;
    var diff = Math.round(now.getBoundingClientRect().top - before);
    if (Math.abs(diff) >= 1) window.scrollTo(0, Math.round(window.pageYOffset + diff));
  }

  // 보고 있는 날의 판 개수만 한꺼번에 0으로 (날씨·포스 합계·메모·다른 날 기록은 그대로)
  function clearDay() {
    var r = dayRec(saleDate, false);
    if (!r || !r.items.length) return;
    var n = r.items.reduce(function (a, it) { return a + it.qty; }, 0);
    if (!confirm(dateLabel(saleDate) + '에 판 메뉴 ' + r.items.length + '가지 (' + n + '개)를 모두 0으로 만들까요?\n날씨·포스 합계·메모와 다른 날 기록은 그대로예요.')) return;
    r.items = [];
    dropIfEmpty(saleDate);
    save(); drawSales();
  }

  // ---------- 달력 ----------
  function monthDays(ym) {
    var a = ym.split('-'), n = new Date(+a[0], +a[1], 0).getDate(), out = [];
    for (var i = 1; i <= n; i++) out.push(ym + '-' + String(i).padStart(2, '0'));
    return out;
  }
  function openDaysOf(ym) {
    var closed = state.settings.closed;
    return monthDays(ym).filter(function (d) { return closed.indexOf(parseYmd(d).getDay()) < 0; }).length;
  }
  // 고정비 하루 몫 = 그달 고정비 ÷ 그달 영업일 수 (고정비를 안 넣었으면 0)
  function dailyShare(d) {
    var fixed = Calc.fixedTotal(state.settings.fixed), n = openDaysOf(d.slice(0, 7));
    return fixed > 0 && n > 0 ? fixed / n : 0;
  }
  function leftLine(d, s) {
    var share = dailyShare(d);
    if (!share || !s.cups && !s.sales) return '';
    var left = s.profit - share;
    return '<div class="leftline">고정비 하루 몫 ' + Calc.fmtWon(share) + '원을 빼면 <b class="' + (left < 0 ? 'neg' : 'pos') + '">' +
      (left < 0 ? Calc.fmtWon(-left) + '원 모자라요' : Calc.fmtWon(left) + '원 남아요') + '</b></div>';
  }
  function renderCal() {
    var days = monthDays(calMonth), today = ymd(new Date());
    var closed = state.settings.closed, fixed = Calc.fixedTotal(state.settings.fixed);
    var tot = { sales: 0, cost: 0, profit: 0 }, sold = 0, best = null, sums = {}, byDow = {}, menus = {};
    days.forEach(function (d) {
      var r = state.sales[d];
      if (!r || (!r.items.length && !Calc.isNum(r.posTotal))) return;
      var s = Calc.daySummary(r);
      sums[d] = s; sold++;
      tot.sales += s.sales; tot.cost += s.cost; tot.profit += s.profit;
      if (!best || s.profit > sums[best].profit) best = d;
      var w = parseYmd(d).getDay();
      byDow[w] = byDow[w] || { n: 0, p: 0 }; byDow[w].n++; byDow[w].p += s.profit;
      r.items.forEach(function (it) {
        var k = it.name;
        menus[k] = menus[k] || { qty: 0, profit: 0 };
        menus[k].qty += it.qty; menus[k].profit += (it.price - it.cost) * it.qty;
      });
    });
    var ledDays = {};   // 나간 돈이 적힌 날 (달력 칸에 작은 점)
    state.ledger.forEach(function (e) { ledDays[e.date] = true; });
    var openDays = openDaysOf(calMonth), share = dailyShare(calMonth + '-01');
    var maxP = 0;
    Object.keys(sums).forEach(function (d) { maxP = Math.max(maxP, sums[d].profit); });
    var a = calMonth.split('-');
    var h = '<div class="datebar"><button class="nav" data-act="mon-prev" aria-label="전달">‹</button><b>' +
      a[0] + '년 ' + (+a[1]) + '월</b><button class="nav" data-act="mon-next" aria-label="다음달">›</button></div>';
    // 달력 칸
    h += '<div class="cal">' + DOW.map(function (w, i) { return '<div class="dow' + (i === 0 ? ' sun' : '') + '">' + w + '</div>'; }).join('');
    for (var i = 0; i < parseYmd(days[0]).getDay(); i++) h += '<div></div>';
    days.forEach(function (d) {
      var s = sums[d], r = state.sales[d], off = closed.indexOf(parseYmd(d).getDay()) >= 0;
      var lv = s && maxP > 0 && s.profit > 0 ? Math.min(4, Math.ceil(s.profit / maxP * 4)) : 0;
      h += '<button class="day lv' + lv + (off ? ' off' : '') + (d === today ? ' today' : '') + '" data-act="cal-day" data-d="' + d + '">' +
        '<span class="dn">' + (+d.slice(8)) + (ledDays[d] ? '<i class="ldot">●</i>' : '') + (r && r.weather ? ' ' + r.weather : '') + '</span>' +
        (s ? '<span class="dp' + (s.profit < 0 ? ' neg' : '') + '">' + man(s.profit) + '</span>' +
          (share ? '<span class="dl' + (s.profit - share < 0 ? ' neg' : '') + '">' + (s.profit - share < 0 ? '' : '+') + man(s.profit - share) + '</span>' : '')
          : (off ? '<span class="dp">쉼</span>' : '')) + '</button>';
    });
    h += '</div><p class="hint">칸 안 위 숫자는 그날 번 돈' +
      (share ? ', 아래 +/− 숫자는 고정비 하루 몫(' + Calc.fmtWon(share) + '원)을 빼고 남은 돈' : '') +
      '이에요. 날짜를 누르면 그날 판매를 넣거나 고칠 수 있어요.</p>';
    // 한 달 정리
    var left = tot.profit - fixed;
    h += '<div class="card"><div class="name">이번 달 정리 <small class="dim">(계산상)</small></div><div class="grid"><div>매출<b>' + man(tot.sales) + '</b></div><div>원가<b>' +
      man(tot.cost) + '</b></div><div>번 돈<b class="pos">' + man(tot.profit) + '</b></div></div>' +
      '<div class="sub">판매 기록 ' + sold + '일 / 영업일 ' + openDays + '일' + (sold ? ' · 하루 평균 번 돈 ' + Calc.fmtWon(tot.profit / sold) + '원' : '') +
      (best ? ' · 가장 많이 번 날 ' + (+best.slice(5, 7)) + '/' + (+best.slice(8)) + ' (' + Calc.fmtWon(sums[best].profit) + '원)' : '') + '</div>';
    if (fixed > 0) {
      var pct = Math.max(0, Math.min(100, tot.profit / fixed * 100));
      h += '<div class="fixedbox"><div class="row"><span>고정비 ' + Calc.fmtWon(fixed) + '원 채운 정도</span><b>' + Math.floor(pct) + '%</b></div>' +
        '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="sub">' + (left >= 0 ? '고정비를 빼고 <b class="pos">' + Calc.fmtWon(left) + '원</b> 남았어요.' :
          '고정비까지 <b class="neg">' + Calc.fmtWon(-left) + '원</b> 더 벌어야 해요.') +
        (openDays ? ' 고정비를 채우려면 영업일마다 평균 <b>' + Calc.fmtWon(fixed / openDays) + '원</b>을 벌어야 해요.' : '') + '</div></div>';
    } else {
      h += '<p class="hint">월세·인건비 같은 고정비를 넣으면, 고정비를 빼고 얼마 남는지도 보여 드려요.</p>';
    }
    h += '</div>';
    h += ledgerHtml(calMonth, openDays);
    // 요일별 평균
    var dowKeys = Object.keys(byDow);
    if (dowKeys.length) {
      var maxD = 0;
      dowKeys.forEach(function (k) { maxD = Math.max(maxD, byDow[k].p / byDow[k].n); });
      h += '<div class="card"><div class="name">요일별 하루 평균 번 돈</div>';
      [1, 2, 3, 4, 5, 6, 0].forEach(function (k) {
        if (!byDow[k]) return;
        var v = byDow[k].p / byDow[k].n;
        h += '<div class="hbar"><span>' + DOW[k] + '</span><div class="bar"><i style="width:' + (maxD > 0 ? Math.max(0, v / maxD * 100) : 0) + '%"></i></div><b>' + man(v) + '</b></div>';
      });
      h += '</div>';
    }
    // 많이 판 메뉴
    var names = Object.keys(menus).sort(function (x, y) { return menus[y].qty - menus[x].qty; }).slice(0, 7);
    if (names.length) {
      h += '<div class="card"><div class="name">이번 달 많이 판 메뉴</div><table class="tbl"><tr><th>메뉴</th><th>개수</th><th>번 돈</th></tr>' +
        names.map(function (n) { return '<tr><td>' + esc(n) + '</td><td>' + menus[n].qty + '</td><td>' + Calc.fmtWon(menus[n].profit) + '</td></tr>'; }).join('') +
        '</table></div>';
    }
    h += '<p class="hint">번 돈 = 매출 − 원가(재료·포장 등 메뉴에 넣은 것). 고정비는 위 "이번 달 정리"에서만 빼요.</p>';
    h += '<button class="btn block" data-act="settings">고정비·쉬는 요일 설정</button>' +
      '<p class="hint">세금 신고용 장부가 아니에요.</p>';
    view.innerHTML = h;
  }

  // ---------- 가게 장부 (달력 탭) ----------
  // 숫자는 모두 Calc 가 계산한다. 여기서는 보여 주기만 한다.
  function ledgerHtml(ym, openDays) {
    var ms = Calc.monthSales(state.sales, ym), lm = Calc.ledgerMonth(state.ledger, ym);
    var book = Calc.monthBook(ms.sales, lm, state.settings.fixed, ms.days);
    var h = '<div class="card"><div class="name">가게 장부</div>';
    if (book.empty) {
      h += '<div class="sub">이 달은 판매 기록도, 나간 돈 기록도 없어요.</div>';
    } else {
      h += '<div class="grid bgrid"><div>들어온 돈<br>(매출)<b>' + Calc.fmtWon(book.sales) + '</b></div><div>나간 돈<br>&nbsp;<b>' +
        Calc.fmtWon(book.out) + '</b></div><div>실제로 남은 돈<br>&nbsp;<b class="' + (book.left < 0 ? 'neg' : 'pos') + '">' + Calc.fmtWon(book.left) + '</b></div></div>';
      var pm = Calc.prevMonth(ym), pb = Calc.monthBook(Calc.monthSales(state.sales, pm).sales, Calc.ledgerMonth(state.ledger, pm),
        state.settings.fixed, Calc.monthSales(state.sales, pm).days);
      if (!pb.empty) {
        var diff = book.left - pb.left;
        h += '<div class="sub">지난달은 ' + (pb.left < 0 ? Calc.fmtWon(-pb.left) + '원 모자랐어요' : Calc.fmtWon(pb.left) + '원 남았어요') +
          (Math.round(diff) === 0 ? ' (같아요)' : ' (' + (diff > 0 ? '▲ ' : '▼ ') + Calc.fmtWon(Math.abs(diff)) + '원)') + '</div>';
      }
      h += '<table class="tbl"><tr><th>항목</th><th>금액</th><th>출처</th></tr>' +
        book.rows.filter(function (r) { return r.value > 0 || r.count > 0; }).map(function (r) {
          return '<tr><td>' + esc(r.label) + '</td><td>' + Calc.fmtWon(r.value) + '</td><td>' + r.source + '</td></tr>';
        }).join('') + '</table>';
      book.warnings.forEach(function (w) { h += '<div class="warn">⚠️ ' + esc(w) + '</div>'; });
      if (ym === ymd(new Date()).slice(0, 7)) h += '<div class="sub">월 중간이라면 아직 안 적은 돈이 있을 수 있어요.</div>';
    }
    h += '<button class="btn primary block" data-act="led-new">+ 나간 돈 적기</button></div>';

    // 레시피 원가 vs 실제 재료비
    var cp = Calc.materialCompare(ms.cost, lm, ms.days, openDays);
    h += '<div class="card"><div class="name">레시피 원가 vs 실제 재료비</div>';
    if (cp.level === 'nodata') {
      h += '<div class="sub">재료 구입이나 포장재를 적으면 레시피 원가와 비교해 드려요.</div>';
    } else {
      h += '<div class="grid bgrid"><div>레시피로 계산한 원가<b>' + Calc.fmtWon(cp.recipe) + '</b></div><div>실제 재료비<br>(재료+포장재)<b>' +
        Calc.fmtWon(cp.actual) + '</b></div><div>차이<br>&nbsp;<b>' + (cp.diff > 0 ? '+' : '') + Calc.fmtWon(cp.diff) + '</b></div></div>';
      var msg = {
        norecipe: '비교할 판매 기록이 없어요.',
        ok: '거의 맞아요. (' + Calc.fmtPct(cp.ratio) + ')',
        more: '실제로 더 썼어요. 조금 차이가 있어요. (+' + Calc.fmtPct(cp.ratio) + ')',
        much: '실제로 훨씬 더 썼어요. 아래를 살펴보세요. (+' + Calc.fmtPct(cp.ratio) + ')',
        less: '레시피보다 덜 샀어요. 아래를 살펴보세요. (' + Calc.fmtPct(cp.ratio) + ')'
      }[cp.level];
      h += '<div class="sub"><b>' + msg + '</b></div>';
      if (cp.lowRecord) h += '<div class="warn">판매 기록이 적은 달이라 레시피 원가가 작게 나왔을 수 있어요. 포스 합계만 넣고 메뉴 개수를 안 넣은 날은 레시피 원가가 0원으로 잡혀요. (판매 기록 ' + ms.days + '일 / 영업일 ' + openDays + '일)</div>';
      var ideas = [];
      if (cp.level === 'more' || cp.level === 'much') ideas = [
        '버려진 재료가 많지 않았나요? (유통기한 지남, 쏟음, 만들다 실패)',
        '레시피보다 더 넣고 있지 않나요? (샷·우유·시럽 양)',
        '서비스로 드린 음료·시음이 판매 기록에 안 들어갔나요?',
        '판매 입력을 빠뜨린 날이 있지 않나요?',
        '이번 달에 많이 사 둔 재료가 창고에 남아 있나요?',
        '재료값이 올랐는데 재료 탭 단가를 안 고치지 않았나요?',
        '가게 비품·청소용품을 "재료 구입"에 적지 않았나요? ("수리·비품"으로)'];
      else if (cp.level === 'less') ideas = [
        '지난달에 사 둔 재료를 이번 달에 쓴 건 아닌가요?',
        '재료 구입 영수증을 빠뜨리지 않았나요?',
        '레시피 양이 실제보다 많게 잡혀 있거나 단가를 높게 넣지 않았나요?'];
      if (ideas.length) h += '<details class="more"><summary>의심해 볼 것</summary><ul class="ideas">' +
        ideas.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul></details>';
      h += '<div class="sub">한 달만 보면 산 양과 쓴 양이 달라 흔들릴 수 있어요. 석 달쯤 모이면 더 믿을 만해요.</div>';
    }
    h += '</div>';

    // 이번 달에 적은 나간 돈 (접이식. 열고 닫을 때 다시 그리지 않음)
    var list = state.ledger.filter(function (e) { return e.date.slice(0, 7) === ym; }).sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    });
    if (list.length) {
      h += '<details class="card ledlist"><summary>적은 나간 돈 ' + list.length + '건 (눌러서 고치기)</summary>' +
        list.map(function (e) {
          return '<button class="lrow" data-act="led-edit" data-id="' + e.id + '"><span>' + (+e.date.slice(5, 7)) + '/' + (+e.date.slice(8)) + ' · ' +
            esc(LEDGER_NAMES[e.cat] || e.cat) + (e.memo ? ' · ' + esc(e.memo) : '') + '</span><b>' + Calc.fmtWon(e.amount) + '원</b></button>';
        }).join('') + '</details>';
    }
    return h;
  }
  // 나간 돈 입력창. 항목 버튼은 classList 로 표시만 바꾸고 창을 다시 그리지 않는다 (아이폰 화면 밀림 방지)
  function ledgerSheet(e) {
    var isNew = !e;
    e = e || { date: ymd(new Date()), cat: '', amount: '', memo: '' };
    openSheet('<h2>' + (isNew ? '나간 돈 적기' : '나간 돈 고치기') + '</h2>' +
      '<label>날짜</label><input id="l-date" class="f" type="date" value="' + esc(e.date) + '">' +
      '<label>항목</label><div class="catpick">' + Calc.LEDGER_CATS.map(function (c) {
        return '<button data-act="led-cat" data-c="' + c[0] + '"' + (e.cat === c[0] ? ' class="on"' : '') + '>' + c[1] + '</button>';
      }).join('') + '</div>' +
      '<p class="hint">카드 수수료·포스 사용료를 고정비 "그 밖" 칸에 넣었다면 여기 적지 마세요. 같은 돈이 두 번 빠져요.</p>' +
      '<label>금액 (원)</label><input id="l-amt" class="f" inputmode="numeric" value="' + (Calc.isNum(e.amount) ? e.amount : '') + '" placeholder="0">' +
      '<label>메모 (선택)</label><input id="l-memo" class="f" maxlength="40" value="' + esc(e.memo || '') + '" placeholder="예: 우유 20개">' +
      '<div class="okmsg" id="okmsg"></div><div class="err" id="err"></div>' +
      '<div class="actions"><button class="btn" data-act="close">닫기</button>' +
      (isNew ? '' : '<button class="btn danger" data-act="led-del" data-id="' + e.id + '">삭제</button>') +
      '<button class="btn primary" data-act="led-save" data-id="' + (isNew ? '' : e.id) + '">저장</button></div>' +
      (isNew ? '<button class="btn block" data-act="led-save-more">저장하고 하나 더</button>' : ''));
  }
  function saveLedger(id, more) {
    var date = val('l-date'), amount = parseNum(val('l-amt')), memo = val('l-memo').trim().slice(0, 40);
    var on = sheet.querySelector('[data-act="led-cat"].on'), cat = on ? on.getAttribute('data-c') : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return showErr('날짜를 골라 주세요.');
    if (!cat) return showErr('항목을 골라 주세요.');
    if (!Calc.isNum(amount) || amount <= 0) return showErr('금액은 0보다 큰 숫자로 넣어 주세요.');
    var e = null;
    if (id) e = state.ledger.filter(function (x) { return x.id === id; })[0] || null;
    if (!e) { e = { id: newId() }; state.ledger.push(e); }
    e.date = date; e.cat = cat; e.amount = amount; e.memo = memo;
    save();
    if (more) {   // 창은 그대로 두고 금액·메모 칸만 비움 (날짜·항목은 그대로)
      document.getElementById('l-amt').value = '';
      document.getElementById('l-memo').value = '';
      document.getElementById('err').textContent = '';
      document.getElementById('okmsg').textContent = '저장했어요. 이어서 적어 주세요.';
      render();
      return;
    }
    closeSheet(); render();
  }
  function delLedger(id) {
    if (!confirm('이 나간 돈 기록을 지울까요?')) return;
    state.ledger = state.ledger.filter(function (x) { return x.id !== id; });
    save(); closeSheet(); render();
  }
  function settingsSheet() {
    var f = state.settings.fixed, c = state.settings.closed;
    var inp = function (id, label, v) {
      return '<label>' + label + '</label><input id="' + id + '" class="f" inputmode="numeric" value="' + (Calc.isNum(v) ? v : '') + '" placeholder="0">';
    };
    openSheet('<h2>고정비·쉬는 요일</h2><p class="hint">한 달에 나가는 돈 (원). 모르는 칸은 비워 두세요.</p>' +
      inp('x-rent', '월세·관리비', f.rent) + inp('x-labor', '인건비', f.labor) + inp('x-util', '전기·가스·수도·인터넷', f.util) + inp('x-etc', '그 밖 (카드 수수료·포스 사용료 등)', f.etc) +
      '<label>쉬는 요일</label><div class="weather">' + DOW.map(function (w, i) {
        return '<button data-act="closed" data-i="' + i + '"' + (c.indexOf(i) >= 0 ? ' class="on"' : '') + '>' + w + '</button>';
      }).join('') + '</div>' +
      '<div class="err" id="err"></div><div class="actions"><button class="btn" data-act="close">닫기</button>' +
      '<button class="btn primary" data-act="settings-save">저장</button></div>');
  }
  function saveSettings() {
    var f = {}, bad = false;
    [['rent', 'x-rent'], ['labor', 'x-labor'], ['util', 'x-util'], ['etc', 'x-etc']].forEach(function (p) {
      var v = val(p[1]).trim();
      if (v === '') return;
      var n = parseNum(v);
      if (!Calc.isNum(n) || n < 0) bad = true; else f[p[0]] = n;
    });
    if (bad) return showErr('금액은 0 이상의 숫자로 넣어 주세요.');
    var c = [];
    var bs = sheet.querySelectorAll('[data-act="closed"].on');
    for (var i = 0; i < bs.length; i++) c.push(Number(bs[i].getAttribute('data-i')));
    state.settings.fixed = f; state.settings.closed = c;
    save(); closeSheet(); render();
  }
  function exportCsv() {
    var rows = [['날짜', '요일', '날씨', '매출', '원가', '번 돈', '원가율(%)', '판매 개수', '메모']];
    Object.keys(state.sales).sort().forEach(function (d) {
      var r = state.sales[d], s = Calc.daySummary(r);
      rows.push([d, DOW[parseYmd(d).getDay()], r.weather || '', Math.round(s.sales), Math.round(s.cost), Math.round(s.profit),
        s.rate === null ? '' : Math.round(s.rate * 1000) / 10, s.cups, r.memo || '']);
    });
    var text = '﻿' + rows.map(function (r) {
      return r.map(function (c) { c = String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',');
    }).join('\r\n');
    download('원가계산기_하루정리_' + ymd(new Date()) + '.csv', text, 'text/csv');
  }
  function download(name, text, type) {
    var blob = text instanceof Blob ? text : new Blob([text], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function exampleButton() {
    if (state.ingredients.length || state.menus.length) return '';
    return '<div class="empty">아직 입력한 자료가 없어요.<br>먼저 재료를 넣고, 메뉴를 만들어 보세요.' +
      '<button class="btn primary block" data-act="example">예시 자료 넣어 보기</button></div>';
  }

  // ---------- 검색·분류 (메뉴·재료·판매 탭 공통) ----------
  var NOCAT = '분류 없음';
  var filt = { menus: { q: '', cat: '' }, ings: { q: '', cat: '' }, sales: { q: '', cat: '' }, recipes: { q: '', cat: '' } };
  function catOf(x) { return (x.cat || '').trim() || NOCAT; }
  function cats(list) {   // 처음 나온 순서대로 (불러온 파일의 순서를 지킴), 분류 없음은 맨 뒤
    var out = [];
    list.forEach(function (x) { var c = catOf(x); if (out.indexOf(c) < 0) out.push(c); });
    out.sort(function (a, b) { return (a === NOCAT) - (b === NOCAT); });
    return out;
  }
  function controls(key, list, placeholder) {
    var f = filt[key], cs = cats(list);
    if (f.cat && cs.indexOf(f.cat) < 0) f.cat = '';
    return '<input id="q" class="f search" data-key="' + key + '" placeholder="🔍 ' + placeholder + '" autocomplete="off" value="' + esc(f.q) + '">' +
      (cs.length > 1 ? '<div class="chips">' + [''].concat(cs).map(function (c) {
        return '<button data-act="cat" data-key="' + key + '" data-cat="' + esc(c) + '"' + (f.cat === c ? ' class="on"' : '') + '>' + esc(c || '전체') + '</button>';
      }).join('') + '</div>' : '');
  }
  function match(key, x) {
    var f = filt[key], q = f.q.replace(/\s/g, '').toLowerCase();
    if (f.cat && catOf(x) !== f.cat) return false;
    return !q || (x.name + ' ' + (x.cat || '')).replace(/\s/g, '').toLowerCase().indexOf(q) >= 0;
  }
  function grouped(key, list, row) {   // 분류 제목을 붙여 줄 세우기
    var h = '', shown = 0;
    cats(list).forEach(function (c) {
      var part = list.filter(function (x) { return catOf(x) === c && match(key, x); });
      if (!part.length) return;
      h += '<div class="cathead">' + esc(c) + ' <small>' + part.length + '</small></div>';
      part.forEach(function (x) { h += row(x); shown++; });
    });
    return shown ? h : '<p class="hint">찾는 것이 없어요.</p>';
  }
  function drawList() {
    if (tab === 'menus') drawMenus();
    else if (tab === 'ings') drawIngs();
    else if (tab === 'sales') drawSales();
    else if (tab === 'recipes') drawRecipes();
  }

  function renderIngs() {
    view.innerHTML = '<button class="btn primary block" data-act="ing-new">+ 재료 추가</button>' + exampleButton() +
      (state.ingredients.length ? controls('ings', state.ingredients, '재료 찾기') : '') + '<div id="list"></div>';
    drawIngs();
  }
  function drawIngs() {
    var box = document.getElementById('list');
    if (!box || !state.ingredients.length) return;
    box.innerHTML = grouped('ings', state.ingredients, function (g) {
      return '<button class="card" data-act="ing-edit" data-id="' + g.id + '"><div class="row"><span class="name">' + esc(g.name) +
        '</span><span>1' + g.unit + '당 ' + Calc.fmtUnitCost(Calc.unitCost(g)) + '원</span></div>' +
        '<div class="sub">' + Calc.fmtWon(g.price) + '원 / ' + g.qty.toLocaleString('ko-KR') + g.unit + '</div></button>';
    });
  }

  function renderMenus() {
    view.innerHTML = '<button class="btn primary block" data-act="menu-new">+ 메뉴 추가</button>' + exampleButton() +
      (state.menus.length ? controls('menus', state.menus, '메뉴 찾기 (예: 라떼)') : '') + '<div id="list"></div>' +
      (state.menus.length ? '<p class="hint">조정 필요: 마진 ' + Calc.fmtWon(Calc.MARGIN_MIN) + '원 미만이면서 원가율 ' +
        Math.round(Calc.RATE_MAX * 100) + '% 초과일 때만 표시돼요.</p>' : '');
    drawMenus();
  }
  // 레시피 탭: 레시피북처럼 분류별 표 (메뉴 | 레시피) + 맨 아래 기본 기준
  var recipeAll = false;   // false: 메뉴마다 기본(첫) 레시피 한 줄만
  function renderRecipes() {
    view.innerHTML = '<div class="card docs"><div class="name">📄 내 레시피북 파일 (PDF·워드)</div><div id="docs" class="sub">불러오는 중…</div>' +
      '<button class="btn primary block" data-act="doc-add">+ PDF·워드 파일 넣기</button>' +
      '<p class="hint">넣은 파일은 이 휴대폰 안에만 저장돼요. 인터넷에 올라가지 않아요.</p></div>' +
      (state.menus.length ? controls('recipes', state.menus, '레시피 찾기 (예: 라떼)') +
        '<label class="check"><input type="checkbox" data-act="recipe-all"' + (recipeAll ? ' checked' : '') +
        '> HOT·사이즈업 레시피도 보기</label>' : '') + '<div id="list"></div>' +
      notesHtml() + '<p class="hint">레시피를 고치려면 메뉴 탭에서 메뉴를 누르고 "만드는 법"을 고치세요.</p>';
    drawRecipes();
    drawDocs();
  }
  // ---------- 레시피북 파일 (PDF·워드). 크기가 커서 localStorage 대신 IndexedDB 에 저장 ----------
  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open('wongagesan-files', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('files', { keyPath: 'id' }); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function idbDo(mode, fn) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('files', mode), req = fn(tx.objectStore('files'));
        tx.oncomplete = function () { res(req && req.result); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function docKind(f) {
    var n = (f.name || '').toLowerCase();
    if (/\.pdf$/.test(n) || f.type === 'application/pdf') return 'pdf';
    if (/\.docx$/.test(n)) return 'docx';
    return '';
  }
  function drawDocs() {
    var box = document.getElementById('docs');
    if (!box) return;
    idbDo('readonly', function (s) { return s.getAll(); }).then(function (list) {
      list = (list || []).sort(function (a, b) { return a.added < b.added ? 1 : -1; });
      box.innerHTML = list.length ? list.map(function (d) {
        return '<div class="docrow"><button class="docopen" data-act="doc-open" data-id="' + d.id + '">' +
          (d.kind === 'pdf' ? '📕 ' : '📘 ') + esc(niceName(d.name)) + '<small>' + (Math.round(d.size / 102.4) / 10) + 'KB · ' + d.added.slice(0, 10) + '</small></button>' +
          '<div class="docbtns">' + (d.kind === 'pdf' ? '<button class="mini" data-act="doc-fill" data-id="' + d.id + '">레시피 채우기</button>' : '') +
          '<button class="mini" data-act="doc-get" data-id="' + d.id + '">받기</button>' +
          '<button class="mini danger" data-act="doc-del" data-id="' + d.id + '">삭제</button></div></div>';
      }).join('') : '아직 넣은 파일이 없어요.';
    }, function () { box.textContent = '이 휴대폰에서는 파일을 저장할 수 없어요.'; });
  }
  function addDoc(file) {
    var kind = docKind(file);
    if (!kind) return alert(/\.doc$/i.test(file.name) ? '옛날 워드 파일(.doc)은 열 수 없어요. 워드에서 "다른 이름으로 저장 → .docx 또는 PDF"로 바꿔서 넣어 주세요.'
      : 'PDF(.pdf)나 워드(.docx) 파일만 넣을 수 있어요.');
    if (file.size > 30 * 1024 * 1024) return alert('파일이 너무 커요 (30MB까지).');
    var rec = { id: newId(), name: niceName(file.name), kind: kind, size: file.size, added: new Date().toISOString(), blob: file };
    idbDo('readwrite', function (s) { return s.put(rec); }).then(function () {
      drawDocs();
      if (kind === 'pdf') fillFromDoc(rec.id); else openDoc(rec.id);
    }, function () { alert('파일을 저장하지 못했어요. 휴대폰 저장 공간을 확인해 주세요.'); });
  }
  // 메신저로 받은 파일은 이름이 %EC%98… 처럼 올 때가 있어 풀어서 보여 줌
  function niceName(n) {
    try { n = decodeURIComponent(n); } catch (e) {}
    return n.split(/[\\/]/).pop();
  }
  function getPdf(buf) {
    return loadScript('./lib/pdf.min.js').then(function () {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = './lib/pdf.worker.min.js';
      // 한글 글꼴이 파일에 안 들어 있는 PDF도 글자가 보이게 (글꼴 지도·기본 글꼴). 주소는 전체 주소로
      var at = function (p) { return new URL(p, location.href).href; };
      return window.pdfjsLib.getDocument({ data: buf, cMapUrl: at('./lib/cmaps/'), cMapPacked: true,
        standardFontDataUrl: at('./lib/standard_fonts/') }).promise;
    });
  }
  // PDF 표 읽기: 왼쪽 첫 칸(메뉴 이름)을 줄의 기준으로 삼고, 나머지 글자는 높이가 가장 가까운 이름 줄에 붙인다.
  // 같은 칸(가로 위치)에 있는 글자는 위에서 아래로 이어 붙인다 (두 줄로 넘어간 레시피도 한 칸으로).
  function pdfRows(pdf) {
    var rows = [], chain = Promise.resolve();
    for (var p = 1; p <= pdf.numPages; p++) (function (no) {
      chain = chain.then(function () { return pdf.getPage(no); }).then(function (page) { return page.getTextContent(); }).then(function (tc) {
        var items = tc.items.filter(function (it) { return it.str && it.str.trim(); }).map(function (it) {
          return { x: it.transform[4], y: it.transform[5], s: it.str.trim() };
        });
        if (!items.length) return;
        var left = Math.min.apply(null, items.map(function (i) { return i.x; }));
        var anchors = items.filter(function (i) { return i.x < left + 20; }).map(function (i) { return { a: i, rest: [] }; });
        items.forEach(function (i) {
          if (i.x < left + 20) return;
          var best = null;
          anchors.forEach(function (an) { var dy = Math.abs(an.a.y - i.y); if (!best || dy < best.dy) best = { dy: dy, an: an }; });
          if (best && best.dy < 14) best.an.rest.push(i);
        });
        anchors.sort(function (a, b) { return b.a.y - a.a.y; }).forEach(function (an) {
          var cols = [];
          an.rest.forEach(function (i) {
            var c = cols.filter(function (c) { return Math.abs(c.x - i.x) < 6; })[0];
            if (!c) { c = { x: i.x, parts: [] }; cols.push(c); }
            c.parts.push(i);
          });
          cols.sort(function (a, b) { return a.x - b.x; });
          rows.push({ cells: [an.a.s].concat(cols.map(function (c) {
            return c.parts.sort(function (a, b) { return b.y - a.y; }).map(function (i) { return i.s; }).join(' ');
          })) });
        });
      });
    })(p);
    return chain.then(function () { return rows; });
  }
  function norm(s) { return String(s || '').replace(/[\s·()]/g, '').toLowerCase(); }
  // 레시피북 PDF에서 메뉴별 만드는 법을 찾아 "만드는 법"이 비어 있는 메뉴에 채움 (원가·재료는 그대로)
  function fillFromDoc(id) {
    idbDo('readonly', function (s) { return s.get(id); }).then(function (d) {
      if (!d || d.kind !== 'pdf') return;
      return d.blob.arrayBuffer().then(getPdf).then(pdfRows).then(function (rows) {
        var book = rows.filter(function (r) { return r.cells.length >= 2 && /\d/.test(r.cells[1]); });
        var found = [];
        state.menus.forEach(function (m) {
          if ((m.recipe || '').trim()) return;
          var sp = splitName(m.name), key = norm(sp.base), best = null;
          book.forEach(function (r) {
            var k = norm(r.cells[0]);
            if (!k) return;
            var score = k === key ? 1000 : (key.length >= 3 && k.length >= 3 && (k.indexOf(key) >= 0 || key.indexOf(k) >= 0)) ? Math.min(k.length, key.length) : 0;
            if (score && (!best || score > best.score)) best = { score: score, r: r };
          });
          if (!best) return;
          var c = best.r.cells, upOk = c.length > 2 && /\d/.test(c[2]) && !/미제공/.test(c[2]);
          var up = /사이즈업/.test(sp.tag) && upOk;
          found.push({ m: m, text: (up ? c[2] : c[1]) + (upOk && !up ? '\n사이즈업: ' + c[2] : '') });
        });
        if (!found.length) { alert('이 PDF에서 메뉴 이름과 맞는 레시피를 찾지 못했어요. 파일은 저장돼 있으니 열어서 볼 수 있어요.'); return; }
        var empty = state.menus.filter(function (m) { return !(m.recipe || '').trim(); }).length;
        if (!confirm('레시피북에서 메뉴 ' + found.length + '개의 만드는 법을 찾았어요 (만드는 법이 빈 메뉴 ' + empty + '개 중).\n' +
          '예: ' + found[0].m.name + ' → ' + found[0].text.split('\n')[0] + '\n\n빈 칸에 채울까요? (이미 적힌 레시피와 원가는 바꾸지 않아요)')) return;
        found.forEach(function (f) { f.m.recipe = f.text; });
        save(); tab = 'recipes'; render();
        alert('메뉴 ' + found.length + '개에 만드는 법을 채웠어요. 못 찾은 메뉴는 메뉴 탭에서 직접 적을 수 있어요.');
      });
    }).catch(function () { alert('PDF를 읽지 못했어요. 처음 읽을 때는 인터넷이 연결돼 있어야 해요.'); });
  }
  var libs = {};
  function loadScript(src) {
    if (!libs[src]) libs[src] = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = function () { delete libs[src]; rej(new Error(src)); };
      document.head.appendChild(s);
    });
    return libs[src];
  }
  function openDoc(id) {
    idbDo('readonly', function (s) { return s.get(id); }).then(function (d) {
      if (!d) return;
      openSheet('<h2>' + esc(niceName(d.name)) + '</h2><div id="docview" class="docview">여는 중…</div>');
      var out = document.getElementById('docview');
      var fail = function () { if (out) out.textContent = '파일을 열지 못했어요. 처음 열 때는 인터넷이 연결돼 있어야 해요.'; };
      d.blob.arrayBuffer().then(function (buf) {
        if (d.kind === 'pdf') {
          return getPdf(buf).then(function (pdf) {
            out.innerHTML = '';
            var chain = Promise.resolve();
            for (var p = 1; p <= pdf.numPages; p++) (function (no) {
              chain = chain.then(function () { return pdf.getPage(no); }).then(function (page) {
                var w = out.clientWidth || 360, base = page.getViewport({ scale: 1 });
                var vp = page.getViewport({ scale: w / base.width * Math.min(window.devicePixelRatio || 1, 3) });
                var c = document.createElement('canvas');
                c.width = vp.width; c.height = vp.height; c.className = 'pdfpage';
                out.appendChild(c);
                return page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
              });
            })(p);
            return chain;
          });
        }
        return loadScript('./lib/mammoth.browser.min.js').then(function () {
          return window.mammoth.convertToHtml({ arrayBuffer: buf });
        }).then(function (r) { out.innerHTML = '<div class="docx">' + r.value + '</div>'; });
      }).catch(fail);
    });
  }

  // "카페라떼 HOT 사이즈업" → 이름 "카페라떼", 표시 "HOT 사이즈업"
  function splitName(n) {
    var m = n.match(/^(.*?)\s+((?:ICE|HOT)(?:\s+사이즈업)?|사이즈업)$/);
    return m ? { base: m[1], tag: m[2] } : { base: n, tag: '' };
  }
  function drawRecipes() {
    var box = document.getElementById('list');
    if (!box || !state.menus.length) return;
    var list = state.menus.filter(function (m) {
      return match('recipes', m) || (m.recipe || '').replace(/\s/g, '').toLowerCase().indexOf(filt.recipes.q.replace(/\s/g, '').toLowerCase()) >= 0 &&
        (!filt.recipes.cat || catOf(m) === filt.recipes.cat);
    });
    var h = '';
    cats(state.menus).forEach(function (c) {
      var part = list.filter(function (m) { return catOf(m) === c; });
      if (!part.length) return;
      var groups = [], byBase = {};
      part.forEach(function (m) {
        var s = splitName(m.name);
        if (!byBase[s.base]) { byBase[s.base] = []; groups.push(s.base); }
        byBase[s.base].push({ tag: s.tag, recipe: (m.recipe || '').trim() });
      });
      h += '<div class="cathead">' + esc(c) + ' <small>' + groups.length + '</small></div><table class="rtbl">';
      groups.forEach(function (b) {
        var rows = [];   // 레시피가 같은 것(예: 차 ICE·HOT)은 한 줄로
        (recipeAll ? byBase[b] : byBase[b].slice(0, 1)).forEach(function (v) {
          var same = rows.filter(function (r) { return r.recipe === v.recipe; })[0];
          if (same) same.tags.push(v.tag); else rows.push({ tags: [v.tag], recipe: v.recipe });
        });
        h += '<tr><th>' + esc(b) + '</th><td>' + rows.map(function (r) {
          var tag = r.tags.filter(Boolean).join('·');
          if (!recipeAll && tag === 'ICE') tag = '';
          var lines = (r.recipe || '레시피 없음').split('\n');
          return '<div class="rline">' + (tag ? '<span class="tag">' + esc(tag) + '</span> ' : '') + esc(lines[0]) +
            lines.slice(1).map(function (l) { return '<small>' + esc(l) + '</small>'; }).join('') + '</div>';
        }).join('') + '</td></tr>';
      });
      h += '</table>';
    });
    box.innerHTML = h || '<p class="hint">찾는 레시피가 없어요.</p>';
  }
  function notesHtml() {
    return '<div class="cathead">기본 기준 <small>' + state.notes.length + '</small></div>' +
      state.notes.map(function (n, i) {
        return '<div class="note"><div class="row"><b>' + esc(n.title) + '</b>' +
          '<button class="mini" data-act="note-edit" data-i="' + i + '">고치기</button></div><div class="pre">' + esc(n.body) + '</div></div>';
      }).join('') +
      '<button class="btn block slim" data-act="note-new">+ 기준 메모 추가 (예: 포장 구성, 시럽 만드는 법)</button>';
  }
  function noteSheet(i) {
    var n = i === null ? { title: '', body: '' } : state.notes[i];
    openSheet('<h2>' + (i === null ? '기준 메모 추가' : '기준 메모 고치기') + '</h2>' +
      '<label>제목</label><input id="n-title" class="f" value="' + esc(n.title) + '">' +
      '<label>내용</label><textarea id="n-body" class="f" rows="10">' + esc(n.body) + '</textarea>' +
      '<div class="err" id="err"></div><div class="actions"><button class="btn" data-act="close">닫기</button>' +
      (i === null ? '' : '<button class="btn danger" data-act="note-del" data-i="' + i + '">삭제</button>') +
      '<button class="btn primary" data-act="note-save" data-i="' + (i === null ? '' : i) + '">저장</button></div>');
  }
  function saveNote(i) {
    var t = val('n-title').trim(), b = val('n-body').trim();
    if (!t) return showErr('제목을 넣어 주세요.');
    if (i === '') state.notes.push({ title: t, body: b }); else state.notes[+i] = { title: t, body: b };
    save(); closeSheet(); render();
  }
  function drawMenus() {
    var box = document.getElementById('list');
    if (!box || !state.menus.length) return;
    box.innerHTML = grouped('menus', state.menus, function (m) {
      var r = Calc.evaluate(m, state.ingredients);
      return '<button class="card" data-act="menu-edit" data-id="' + m.id + '"><div class="row"><span class="name">' + esc(m.name) +
        '</span><span>' + Calc.fmtWon(m.price) + '원</span></div>' +
        '<div class="grid"><div>원가<b>' + Calc.fmtWon(r.cost) + '원</b></div><div>마진<b>' + Calc.fmtWon(r.margin) +
        '원</b></div><div>원가율<b>' + Calc.fmtPct(r.rate) + '</b></div></div>' +
        '<div style="margin-top:8px">' + verdictBadge(r.verdict) +
        (Calc.usesRate(m) ? ' <span class="ratetag">원가율 ' + Calc.fmtPct(m.costRate) + '로 정함</span>' : '') + '</div></button>';
    });
  }
  function catField(list, cur) {   // 분류 입력칸 + 이미 쓰는 분류 고르기
    return '<label>분류 (예: 커피, 베이커리)</label><input id="f-cat" class="f" list="cat-list" value="' + esc(cur || '') + '" placeholder="비워도 돼요">' +
      '<datalist id="cat-list">' + cats(list).filter(function (c) { return c !== NOCAT; }).map(function (c) {
        return '<option value="' + esc(c) + '">';
      }).join('') + '</datalist>';
  }

  function renderBackup() {
    view.innerHTML = '<p class="hint">입력한 재료·메뉴·판매 기록은 이 휴대폰 안에만 저장돼요. 서버로 보내지 않아요. ' +
      '휴대폰을 바꾸거나 앱을 지우기 전에 내보내기로 파일을 따로 보관해 두세요.</p>' +
      '<button class="btn primary block" data-act="export">내보내기 (파일로 저장)</button>' +
      '<button class="btn block" data-act="import">불러오기 (파일 선택)</button>' +
      '<button class="btn block" data-act="export-csv">하루 정리 엑셀(CSV)로 받기</button>' +
      '<p class="hint">판매 기록 ' + Object.keys(state.sales).length + '일치가 저장돼 있어요.</p>' +
      '<p class="hint">나간 돈 기록 ' + state.ledger.length + '건이 저장돼 있어요.</p>' +
      '<p class="hint">앱 버전 ' + APP_VER + '</p>';
  }

  // ---------- 아래에서 올라오는 입력창 ----------
  function openSheet(html) {   // 닫기 버튼은 맨 위에도 (긴 입력창에서 아래까지 내리지 않게)
    sheet.innerHTML = '<div class="panel"><div class="sheettop"><button class="topclose" data-act="close">✕ 닫기</button></div>' + html + '</div>';
    sheet.hidden = false; sheet.scrollTop = 0;
  }
  function closeSheet() { sheet.hidden = true; sheet.innerHTML = ''; }
  function val(id) { return document.getElementById(id).value; }
  function showErr(msg) { document.getElementById('err').textContent = msg; }

  // 재료 입력창
  function ingSheet(g) {
    var isNew = !g;
    g = g || { name: '', price: '', qty: '', unit: 'ml' };
    var opts = Calc.UNITS.map(function (u) { return '<option' + (u === g.unit ? ' selected' : '') + '>' + u + '</option>'; }).join('');
    openSheet('<h2>' + (isNew ? '재료 추가' : '재료 수정') + '</h2>' +
      '<label>이름</label><input id="f-name" class="f" value="' + esc(g.name) + '" placeholder="예: 우유">' +
      catField(state.ingredients, g.cat) +
      '<div class="two"><div><label>구매가 (원)</label><input id="f-price" class="f" inputmode="decimal" value="' + esc(g.price) + '"></div>' +
      '<div><label>구매 용량</label><input id="f-qty" class="f" inputmode="decimal" value="' + esc(g.qty) + '"></div></div>' +
      '<label>단위</label><select id="f-unit" class="f">' + opts + '</select>' +
      '<div class="preview" id="f-unitcost"></div><div class="err" id="err"></div>' +
      '<div class="actions"><button class="btn" data-act="close">닫기</button>' +
      (isNew ? '' : '<button class="btn danger" data-act="ing-del" data-id="' + g.id + '">삭제</button>') +
      '<button class="btn primary" data-act="ing-save" data-id="' + (isNew ? '' : g.id) + '">저장</button></div>');
    updateUnitCost();
  }
  function updateUnitCost() {
    var el = document.getElementById('f-unitcost');
    if (!el) return;
    var g = { price: parseNum(val('f-price')), qty: parseNum(val('f-qty')) };
    var u = val('f-unit');
    el.textContent = (g.qty > 0 && Calc.isNum(g.price)) ? '1' + u + '당 ' + Calc.fmtUnitCost(Calc.unitCost(g)) + '원' : '단가: 구매가와 용량을 넣으면 자동으로 나와요';
  }
  function saveIng(id) {
    var name = val('f-name').trim(), price = parseNum(val('f-price')), qty = parseNum(val('f-qty'));
    if (!name) return showErr('이름을 입력해 주세요.');
    if (!Calc.isNum(price) || price < 0) return showErr('구매가를 0 이상의 숫자로 입력해 주세요.');
    if (!Calc.isNum(qty) || qty <= 0) return showErr('구매 용량을 0보다 큰 숫자로 입력해 주세요.');
    var g = id ? findIng(id) : null;
    if (!g) { g = { id: newId() }; state.ingredients.push(g); }
    g.name = name; g.price = price; g.qty = qty; g.unit = val('f-unit'); g.cat = val('f-cat').trim();
    save(); closeSheet(); render();
  }
  function delIng(id) {
    var g = findIng(id);
    var used = state.menus.filter(function (m) { return m.items.some(function (it) { return it.ingId === id; }); });
    var msg = '"' + g.name + '" 재료를 삭제할까요?' + (used.length ? '\n\n' + used.length + '개 메뉴에서 쓰고 있어요. 삭제하면 그 메뉴에서도 이 재료가 빠지고 원가가 다시 계산돼요.' : '');
    if (!confirm(msg)) return;
    state.ingredients = state.ingredients.filter(function (x) { return x.id !== id; });
    state.menus.forEach(function (m) { m.items = m.items.filter(function (it) { return it.ingId !== id; }); });
    save(); closeSheet(); render();
  }

  // 메뉴 입력창
  var editItems = [];
  function menuSheet(m) {
    var isNew = !m;
    m = m || { name: '', price: '', items: [] };
    var rateMode = Calc.usesRate(m), rates = COST_RATES.slice();
    if (rateMode && !rates.some(function (r) { return Math.abs(r - m.costRate) < 1e-9; })) rates.push(m.costRate);   // 불러온 파일의 다른 원가율도 보이게
    editItems = m.items.map(function (it) { return { ingId: it.ingId, amount: it.amount }; });
    openSheet('<h2>' + (isNew ? '메뉴 추가' : '메뉴 수정') + '</h2>' +
      '<label>이름</label><input id="f-name" class="f" value="' + esc(m.name) + '" placeholder="예: 카페라떼">' +
      catField(state.menus, m.cat) +
      '<label>판매가 (원)</label><input id="f-price" class="f" inputmode="decimal" value="' + esc(m.price) + '">' +
      '<label>원가 정하는 방법</label><div class="seg" id="cost-mode">' +
      '<button data-act="cost-mode" data-mode="items"' + (rateMode ? '' : ' class="on"') + '>재료로 계산</button>' +
      '<button data-act="cost-mode" data-mode="rate"' + (rateMode ? ' class="on"' : '') + '>원가율로 정하기</button></div>' +
      '<div id="mode-items"' + (rateMode ? ' hidden' : '') + '>' +
      '<label>들어가는 재료와 사용량</label><div id="rows"></div>' +
      '<button class="btn block" data-act="row-add">+ 재료 넣기</button></div>' +
      '<div id="mode-rate"' + (rateMode ? '' : ' hidden') + '>' +
      '<label>원가율 (판매가에서 원가가 차지하는 비율)</label><div class="weather rates">' + rates.map(function (r) {
        return '<button data-act="cost-rate" data-r="' + r + '"' + (rateMode && Math.abs(r - m.costRate) < 1e-9 ? ' class="on"' : '') + '>' + Calc.fmtPct(r) + '</button>';
      }).join('') + '</div>' +
      '<p class="hint">원가 = 판매가 × 원가율. 판매가를 바꾸면 원가도 따라 바뀌어요. 적어 둔 재료는 지워지지 않고, "재료로 계산"을 누르면 돌아와요.</p></div>' +
      '<label>만드는 법 (레시피북에 보여요)</label><textarea id="f-recipe" class="f" rows="4" placeholder="예: 샷 1 + 우유 180ml, 라떼아트">' +
      esc(m.recipe || '') + '</textarea>' +
      '<div class="preview" id="m-prev"></div><div class="err" id="err"></div>' +
      '<div class="actions"><button class="btn" data-act="close">닫기</button>' +
      (isNew ? '' : '<button class="btn danger" data-act="menu-del" data-id="' + m.id + '">삭제</button>') +
      '<button class="btn primary" data-act="menu-save" data-id="' + (isNew ? '' : m.id) + '">저장</button></div>');
    drawRows();
  }
  function readRows() {
    var rows = document.querySelectorAll('#rows .line');
    editItems = [];
    for (var i = 0; i < rows.length; i++) {
      editItems.push({ ingId: rows[i].querySelector('select').value, amount: parseNum(rows[i].querySelector('input').value) });
    }
  }
  function drawRows() {
    var box = document.getElementById('rows');
    if (!state.ingredients.length) { box.innerHTML = '<p class="hint">먼저 재료 탭에서 재료를 추가해 주세요.</p>'; updateMenuPreview(); return; }
    box.innerHTML = editItems.map(function (it, idx) {
      var ing = findIng(it.ingId);
      var opts = state.ingredients.map(function (g) {
        return '<option value="' + g.id + '"' + (g.id === it.ingId ? ' selected' : '') + '>' + esc(g.name) + '</option>';
      }).join('');
      return '<div class="line"><select class="f">' + opts + '</select>' +
        '<input class="f" inputmode="decimal" placeholder="사용량" value="' + (Calc.isNum(it.amount) ? it.amount : '') + '">' +
        '<span class="u">' + (ing ? ing.unit : '') + '</span>' +
        '<button class="x" data-act="row-del" data-idx="' + idx + '" aria-label="이 재료 빼기">✕</button></div>';
    }).join('');
    updateMenuPreview();
  }
  // 메뉴 입력창에서 고른 원가 방법·원가율은 화면(DOM)에서 읽는다 (고를 때 창을 다시 그리지 않음)
  function editMode() {
    var b = sheet.querySelector('[data-act="cost-mode"].on');
    return b && b.getAttribute('data-mode') === 'rate' ? 'rate' : 'items';
  }
  function editRate() {
    var b = sheet.querySelector('[data-act="cost-rate"].on');
    return b ? parseFloat(b.getAttribute('data-r')) : null;
  }
  function updateMenuPreview() {
    var el = document.getElementById('m-prev');
    if (!el) return;
    readRows();
    var items = editItems.filter(function (it) { return Calc.isNum(it.amount); });
    var mode = editMode(), rate = editRate();
    if (mode === 'rate' && rate === null) { el.textContent = '원가율을 골라 주세요.'; return; }
    var r = Calc.evaluate({ price: parseNum(val('f-price')), items: items, costRate: mode === 'rate' ? rate : null }, state.ingredients);
    el.innerHTML = (mode === 'rate' ? '원가율 ' + Calc.fmtPct(rate) + '로 정함 · ' : '') + '원가 <b>' + Calc.fmtWon(r.cost) + '원</b> · 마진 <b>' + Calc.fmtWon(r.margin) + '원</b> · 원가율 <b>' +
      Calc.fmtPct(r.rate) + '</b> ' + verdictBadge(r.verdict);
  }
  function saveMenu(id) {
    readRows();
    var name = val('f-name').trim(), price = parseNum(val('f-price'));
    if (!name) return showErr('이름을 입력해 주세요.');
    if (!Calc.isNum(price) || price < 0) return showErr('판매가를 0 이상의 숫자로 입력해 주세요.');
    var rateMode = editMode() === 'rate', rate = editRate();
    if (rateMode && rate === null) return showErr('원가율을 골라 주세요.');
    if (!rateMode) {
      for (var i = 0; i < editItems.length; i++) {
        if (!Calc.isNum(editItems[i].amount) || editItems[i].amount < 0) return showErr('사용량을 0 이상의 숫자로 입력하거나, 필요 없는 재료는 ✕로 빼 주세요.');
      }
    } else {   // 원가율로 정할 때는 비어 있거나 틀린 재료 칸은 저장하지 않고, 맞게 적힌 재료만 남겨 둠
      editItems = editItems.filter(function (it) { return Calc.isNum(it.amount) && it.amount >= 0; });
    }
    var m = null;
    if (id) state.menus.forEach(function (x) { if (x.id === id) m = x; });
    if (!m) { m = { id: newId() }; state.menus.push(m); }
    m.name = name; m.price = price; m.cat = val('f-cat').trim() || guessCat(name); m.recipe = val('f-recipe').trim(); m.items = editItems.map(function (it) { return { ingId: it.ingId, amount: it.amount }; });
    if (rateMode) m.costRate = rate; else delete m.costRate;
    save(); closeSheet(); render();
  }
  function delMenu(id) {
    var m = state.menus.filter(function (x) { return x.id === id; })[0];
    if (!confirm('"' + m.name + '" 메뉴를 삭제할까요?')) return;
    state.menus = state.menus.filter(function (x) { return x.id !== id; });
    save(); closeSheet(); render();
  }

  // ---------- 예시 · 백업 ----------
  function addExample() {
    // 지어낸 예시 숫자 (실제 가게 자료 아님)
    var milk = { id: newId(), name: '우유(예시)', price: 2500, qty: 1000, unit: 'ml' };
    var bean = { id: newId(), name: '원두(예시)', price: 30000, qty: 1000, unit: 'g' };
    var syrup = { id: newId(), name: '시럽(예시)', price: 8000, qty: 1000, unit: 'ml' };
    var cup = { id: newId(), name: '컵(예시)', price: 5000, qty: 100, unit: '개' };
    state.ingredients = [milk, bean, syrup, cup];
    state.menus = [
      { id: newId(), name: '라떼(예시)', price: 4500, items: [{ ingId: bean.id, amount: 18 }, { ingId: milk.id, amount: 200 }, { ingId: cup.id, amount: 1 }] },
      { id: newId(), name: '달콤라떼(예시)', price: 2500, items: [{ ingId: bean.id, amount: 18 }, { ingId: milk.id, amount: 200 }, { ingId: syrup.id, amount: 20 }, { ingId: cup.id, amount: 1 }] }
    ];
    save(); render();
  }
  // 새로고침: 저장해 둔 앱 파일(자료 아님)을 비우고 새 판을 받아 다시 연다. 재료·메뉴·판매 기록은 그대로
  function hardReload() {
    var done = function () { location.reload(); };
    var jobs = [];
    if (window.caches) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }));
    if (navigator.serviceWorker) jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) {
      return Promise.all(rs.map(function (r) { return r.update(); }));
    }));
    Promise.all(jobs).then(done, done);
  }
  function exportData() {
    download('원가계산기_백업_' + ymd(new Date()) + '.json', JSON.stringify(state, null, 2), 'application/json');
  }
  function importData(file) {
    var rd = new FileReader();
    rd.onload = function () {
      var s;
      try { s = JSON.parse(rd.result); } catch (e) { s = null; }
      if (!Calc.validateData(s)) { alert('이 파일은 원가계산기 백업 파일이 아니에요. 불러오지 않았어요.'); return; }
      // 판매 기록이 없는 파일(재료·메뉴만)이면 지금 판매 기록과 설정은 그대로 둔다
      var keep = s.sales === undefined;
      // 나간 돈 기록(장부)이 없는 예전 파일이면 지금 장부를 그대로 남긴다
      var keepL = s.ledger === undefined;
      var nowL = state.ledger.length;
      var ledMsg = keepL ? '\n나간 돈 기록 ' + nowL + '건은 그대로 남아요.'
        : '\n나간 돈 기록도 파일의 ' + s.ledger.length + '건으로 바뀌어요.' +
          (s.ledger.length === 0 && nowL > 0 ? '\n\n⚠️ 파일에는 나간 돈 기록이 없어서 지금 ' + nowL + '건이 사라져요.' : '');
      if (!confirm('지금 들어 있는 재료 ' + state.ingredients.length + '개·메뉴 ' + state.menus.length +
        '개가 모두 지워지고, 파일의 재료 ' + s.ingredients.length + '개·메뉴 ' + s.menus.length + '개로 바뀌어요.\n' +
        (keep ? '판매 기록 ' + Object.keys(state.sales).length + '일치는 그대로 남아요.'
              : '판매 기록도 파일의 ' + Object.keys(s.sales).length + '일치로 바뀌어요.') + ledMsg + '\n불러올까요?')) return;
      state = fill({ ingredients: s.ingredients, menus: s.menus,
        sales: keep ? state.sales : s.sales, settings: keep ? state.settings : s.settings,
        ledger: keepL ? state.ledger : s.ledger,
        notes: s.notes || state.notes });
      save(); render();
      alert('불러왔어요.');
    };
    rd.readAsText(file);
  }

  // ---------- 누르기 처리 ----------
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act],[data-tab]');
    if (!t) return;
    if (t.hasAttribute('data-tab')) { tab = t.getAttribute('data-tab'); render(); return; }
    var id = t.getAttribute('data-id');
    switch (t.getAttribute('data-act')) {
      case 'example': addExample(); break;
      case 'ing-new': ingSheet(null); break;
      case 'ing-edit': ingSheet(findIng(id)); break;
      case 'ing-save': saveIng(id); break;
      case 'ing-del': delIng(id); break;
      case 'menu-new': menuSheet(null); break;
      case 'menu-edit': menuSheet(state.menus.filter(function (m) { return m.id === id; })[0]); break;
      case 'menu-save': saveMenu(id); break;
      case 'menu-del': delMenu(id); break;
      case 'row-add':
        if (!state.ingredients.length) { alert('먼저 재료 탭에서 재료를 추가해 주세요.'); break; }
        readRows(); editItems.push({ ingId: state.ingredients[0].id, amount: '' }); drawRows(); break;
      case 'row-del': readRows(); editItems.splice(Number(t.getAttribute('data-idx')), 1); drawRows(); break;
      case 'close': closeSheet(); break;
      case 'export': exportData(); break;
      case 'import': fileInput.value = ''; fileInput.click(); break;
      case 'export-csv': exportCsv(); break;
      case 'plus': changeQty(id, 1, t); break;
      case 'minus': changeQty(id, -1, t); break;
      case 'day-prev': saleDate = addDays(saleDate, -1); render(); break;
      case 'day-next': saleDate = addDays(saleDate, 1); render(); break;
      case 'day-today': saleDate = ymd(new Date()); render(); break;
      case 'weather':
        var r = dayRec(saleDate, true), w = t.getAttribute('data-w');
        r.weather = r.weather === w ? '' : w;
        dropIfEmpty(saleDate); save(); render(); break;
      case 'mon-prev': case 'mon-next':
        var d = parseYmd(calMonth + '-01');
        d.setMonth(d.getMonth() + (t.getAttribute('data-act') === 'mon-prev' ? -1 : 1));
        calMonth = ymd(d).slice(0, 7); render(); break;
      case 'cal-day': saleDate = t.getAttribute('data-d'); tab = 'sales'; render(); window.scrollTo(0, 0); break;
      case 'settings': settingsSheet(); break;
      case 'settings-save': saveSettings(); break;
      case 'closed': t.classList.toggle('on'); break;
      case 'led-new': ledgerSheet(null); break;
      case 'led-edit': ledgerSheet(state.ledger.filter(function (x) { return x.id === id; })[0] || null); break;
      case 'led-cat':   // 표시만 바꿈 (창을 다시 그리지 않음)
        var lb = t.parentNode.querySelectorAll('button');
        for (var li = 0; li < lb.length; li++) lb[li].classList.toggle('on', lb[li] === t);
        break;
      case 'led-save': saveLedger(id, false); break;
      case 'led-save-more': saveLedger('', true); break;
      case 'led-del': delLedger(id); break;
      case 'cost-mode':   // 재료 칸/원가율 칸을 보이거나 숨기기만 함 (재료 목록은 그대로 남김)
        var cm = t.getAttribute('data-mode'), cb = t.parentNode.querySelectorAll('button');
        for (var ci2 = 0; ci2 < cb.length; ci2++) cb[ci2].classList.toggle('on', cb[ci2] === t);
        document.getElementById('mode-items').hidden = cm === 'rate';
        document.getElementById('mode-rate').hidden = cm !== 'rate';
        updateMenuPreview(); break;
      case 'cost-rate':
        var rb = t.parentNode.querySelectorAll('button');
        for (var ri = 0; ri < rb.length; ri++) rb[ri].classList.toggle('on', rb[ri] === t);
        updateMenuPreview(); break;
      case 'reload': hardReload(); break;
      case 'doc-add': docInput.value = ''; docInput.click(); break;
      case 'doc-open': openDoc(id); break;
      case 'doc-fill': fillFromDoc(id); break;
      case 'day-clear': clearDay(); break;
      case 'doc-get':   // 넣어 둔 레시피북 파일을 다시 휴대폰에 내려받기
        idbDo('readonly', function (s) { return s.get(id); }).then(function (d) {
          if (d) download(niceName(d.name), d.blob);
        }, function () { alert('파일을 꺼내지 못했어요.'); });
        break;
      case 'doc-del':
        if (confirm('이 파일을 앱에서 지울까요? (휴대폰의 원래 파일은 그대로예요)'))
          idbDo('readwrite', function (s) { return s.delete(id); }).then(drawDocs);
        break;
      case 'recipe-all': recipeAll = t.checked; drawRecipes(); break;
      case 'note-new': noteSheet(null); break;
      case 'note-edit': noteSheet(Number(t.getAttribute('data-i'))); break;
      case 'note-save': saveNote(t.getAttribute('data-i')); break;
      case 'note-del':
        if (confirm('이 기준 메모를 삭제할까요?')) { state.notes.splice(Number(t.getAttribute('data-i')), 1); save(); closeSheet(); render(); }
        break;
      case 'cat':
        var key = t.getAttribute('data-key');
        filt[key].cat = t.getAttribute('data-cat');
        var chips = t.parentNode.querySelectorAll('button');
        for (var ci = 0; ci < chips.length; ci++) chips[ci].className = chips[ci] === t ? 'on' : '';
        drawList(); break;
    }
  });
  // 판매 탭의 포스 합계·메모는 입력을 마치면 저장
  document.addEventListener('change', function (e) {
    var id = e.target.id;
    if (id !== 's-pos' && id !== 's-memo') return;
    var r = dayRec(saleDate, true);
    if (id === 's-memo') r.memo = e.target.value.trim();
    else {
      var n = parseNum(e.target.value);
      r.posTotal = Calc.isNum(n) && n >= 0 ? n : null;
      if (!Calc.isNum(r.posTotal)) e.target.value = '';
    }
    dropIfEmpty(saleDate); save(); drawSales();
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'q') { filt[e.target.getAttribute('data-key')].q = e.target.value; drawList(); return; }
    if (sheet.hidden) return;
    if (document.getElementById('f-unitcost')) updateUnitCost();
    else if (document.getElementById('m-prev')) {
      if (e.target.tagName === 'SELECT') { readRows(); drawRows(); } else updateMenuPreview();
    }
  });
  // 엔터: 입력창 안에서는 다음 칸으로 내려가고, 마지막 칸·검색창·판매 화면에서는 키보드를 내림
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (e.key !== 'Enter' || e.isComposing || t.tagName !== 'INPUT' || t.type === 'file' || t.type === 'checkbox') return;
    e.preventDefault();
    if (t.id !== 'q' && !sheet.hidden && sheet.contains(t)) {
      var fs = [].filter.call(sheet.querySelectorAll('input'), function (x) {
        return !x.disabled && x.type !== 'hidden' && x.type !== 'file' && x.offsetParent !== null;
      });
      var nx = fs[fs.indexOf(t) + 1];
      if (nx) { nx.focus(); return; }
    }
    t.blur();
  });
  fileInput.addEventListener('change', function () { if (fileInput.files[0]) importData(fileInput.files[0]); });
  var docInput = document.getElementById('docfile');
  docInput.addEventListener('change', function () { if (docInput.files[0]) addDoc(docInput.files[0]); });

  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // 새 판이 설치되면 한 번만 저절로 새로고침 (옛 화면에 머물지 않게)
    var hadController = !!navigator.serviceWorker.controller, reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || reloaded) return;
      reloaded = true; location.reload();
    });
    navigator.serviceWorker.register('./sw.js').then(function (reg) { reg.update(); }).catch(function () {});
  }
})();
