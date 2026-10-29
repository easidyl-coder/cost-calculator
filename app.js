/* 화면과 저장. 계산은 calc.js(Calc)만 쓴다. 자료는 이 휴대폰(localStorage) 안에만 저장한다. */
(function () {
  'use strict';
  var KEY = 'wongagesan.v1';
  var view = document.getElementById('view');
  var sheet = document.getElementById('sheet');
  var fileInput = document.getElementById('file');
  var tab = 'menus';
  var state = load();

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (Calc.validateData(s)) return s;
    } catch (e) {}
    return { ingredients: [], menus: [] };
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
    else renderBackup();
  }

  function exampleButton() {
    if (state.ingredients.length || state.menus.length) return '';
    return '<div class="empty">아직 입력한 자료가 없어요.<br>먼저 재료를 넣고, 메뉴를 만들어 보세요.' +
      '<button class="btn primary block" data-act="example">예시 자료 넣어 보기</button></div>';
  }

  function renderIngs() {
    var h = '<button class="btn primary block" data-act="ing-new">+ 재료 추가</button>' + exampleButton();
    state.ingredients.forEach(function (g) {
      h += '<button class="card" data-act="ing-edit" data-id="' + g.id + '"><div class="row"><span class="name">' + esc(g.name) +
        '</span><span>1' + g.unit + '당 ' + Calc.fmtUnitCost(Calc.unitCost(g)) + '원</span></div>' +
        '<div class="sub">' + Calc.fmtWon(g.price) + '원 / ' + g.qty.toLocaleString('ko-KR') + g.unit + '</div></button>';
    });
    view.innerHTML = h;
  }

  function renderMenus() {
    var h = '<button class="btn primary block" data-act="menu-new">+ 메뉴 추가</button>' + exampleButton();
    state.menus.forEach(function (m) {
      var r = Calc.evaluate(m, state.ingredients);
      h += '<button class="card" data-act="menu-edit" data-id="' + m.id + '"><div class="row"><span class="name">' + esc(m.name) +
        '</span><span>' + Calc.fmtWon(m.price) + '원</span></div>' +
        '<div class="grid"><div>원가<b>' + Calc.fmtWon(r.cost) + '원</b></div><div>마진<b>' + Calc.fmtWon(r.margin) +
        '원</b></div><div>원가율<b>' + Calc.fmtPct(r.rate) + '</b></div></div>' +
        '<div style="margin-top:8px">' + verdictBadge(r.verdict) + '</div></button>';
    });
    if (state.menus.length) {
      h += '<p class="hint">조정 필요: 마진 ' + Calc.fmtWon(Calc.MARGIN_MIN) + '원 미만이면서 원가율 ' +
        Math.round(Calc.RATE_MAX * 100) + '% 초과일 때만 표시돼요.</p>';
    }
    view.innerHTML = h;
  }

  function renderBackup() {
    view.innerHTML = '<p class="hint">입력한 재료·메뉴는 이 휴대폰 안에만 저장돼요. 서버로 보내지 않아요. ' +
      '휴대폰을 바꾸거나 앱을 지우기 전에 내보내기로 파일을 따로 보관해 두세요.</p>' +
      '<button class="btn primary block" data-act="export">내보내기 (파일로 저장)</button>' +
      '<button class="btn block" data-act="import">불러오기 (파일 선택)</button>';
  }

  // ---------- 아래에서 올라오는 입력창 ----------
  function openSheet(html) { sheet.innerHTML = '<div class="panel">' + html + '</div>'; sheet.hidden = false; sheet.scrollTop = 0; }
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
    g.name = name; g.price = price; g.qty = qty; g.unit = val('f-unit');
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
    editItems = m.items.map(function (it) { return { ingId: it.ingId, amount: it.amount }; });
    openSheet('<h2>' + (isNew ? '메뉴 추가' : '메뉴 수정') + '</h2>' +
      '<label>이름</label><input id="f-name" class="f" value="' + esc(m.name) + '" placeholder="예: 카페라떼">' +
      '<label>판매가 (원)</label><input id="f-price" class="f" inputmode="decimal" value="' + esc(m.price) + '">' +
      '<label>들어가는 재료와 사용량</label><div id="rows"></div>' +
      '<button class="btn block" data-act="row-add">+ 재료 넣기</button>' +
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
  function updateMenuPreview() {
    var el = document.getElementById('m-prev');
    if (!el) return;
    readRows();
    var items = editItems.filter(function (it) { return Calc.isNum(it.amount); });
    var r = Calc.evaluate({ price: parseNum(val('f-price')), items: items }, state.ingredients);
    el.innerHTML = '원가 <b>' + Calc.fmtWon(r.cost) + '원</b> · 마진 <b>' + Calc.fmtWon(r.margin) + '원</b> · 원가율 <b>' +
      Calc.fmtPct(r.rate) + '</b> ' + verdictBadge(r.verdict);
  }
  function saveMenu(id) {
    readRows();
    var name = val('f-name').trim(), price = parseNum(val('f-price'));
    if (!name) return showErr('이름을 입력해 주세요.');
    if (!Calc.isNum(price) || price < 0) return showErr('판매가를 0 이상의 숫자로 입력해 주세요.');
    for (var i = 0; i < editItems.length; i++) {
      if (!Calc.isNum(editItems[i].amount) || editItems[i].amount < 0) return showErr('사용량을 0 이상의 숫자로 입력하거나, 필요 없는 재료는 ✕로 빼 주세요.');
    }
    var m = null;
    if (id) state.menus.forEach(function (x) { if (x.id === id) m = x; });
    if (!m) { m = { id: newId() }; state.menus.push(m); }
    m.name = name; m.price = price; m.items = editItems.map(function (it) { return { ingId: it.ingId, amount: it.amount }; });
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
  function exportData() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    var name = '원가계산기_백업_' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '.json';
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function importData(file) {
    var rd = new FileReader();
    rd.onload = function () {
      var s;
      try { s = JSON.parse(rd.result); } catch (e) { s = null; }
      if (!Calc.validateData(s)) { alert('이 파일은 원가계산기 백업 파일이 아니에요. 불러오지 않았어요.'); return; }
      if (!confirm('지금 들어 있는 재료 ' + state.ingredients.length + '개·메뉴 ' + state.menus.length +
        '개가 모두 지워지고, 파일의 재료 ' + s.ingredients.length + '개·메뉴 ' + s.menus.length + '개로 바뀌어요. 불러올까요?')) return;
      state = { ingredients: s.ingredients, menus: s.menus };
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
    }
  });
  document.addEventListener('input', function (e) {
    if (sheet.hidden) return;
    if (document.getElementById('f-unitcost')) updateUnitCost();
    else if (document.getElementById('m-prev')) {
      if (e.target.tagName === 'SELECT') { readRows(); drawRows(); } else updateMenuPreview();
    }
  });
  fileInput.addEventListener('change', function () { if (fileInput.files[0]) importData(fileInput.files[0]); });

  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(function () {});
  }
})();
