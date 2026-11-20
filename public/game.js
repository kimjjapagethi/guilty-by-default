/* Guilty by Default — 3인 플레이 게임 (v3 구조). 내용은 game-data.js, 디자인은 ds.css + game.css.
 * 키: 1/2/3 = 선택, Enter/Space/클릭 = 다음.  ?kiosk=1 = 90초 무입력 시 처음으로,  ?test=1 = 통계 제외 */
(function () {
'use strict';
var SC = null, CH = [], EN = [];
var Q = location.search, KIOSK = /[?&]kiosk=1/.test(Q), TEST = /[?&]test=1/.test(Q);
var backEl = document.getElementById('back'), cv = document.getElementById('canvas'), root = document.documentElement;
var S = { ci: 0, mc: 0, c1: 0, c2: 0, weak: false }, run = 0;
var STEPS = ['오프닝', '도입', '마주침', '반전', '선택 1', '결과', '청문회', '선택 2', '마지막 씬', '판결', '엔딩'];
var played = {}, reached = {};
try { played = JSON.parse(localStorage.getItem('gbd_played') || '{}'); reached = JSON.parse(localStorage.getItem('gbd_end') || '{}'); } catch (e) {}
function save() { try { localStorage.setItem('gbd_played', JSON.stringify(played)); localStorage.setItem('gbd_end', JSON.stringify(reached)); } catch (e) {} }

/* ---------- 화면 맞춤 ---------- */
function fit() { var W = root.clientWidth || innerWidth, H = root.clientHeight || innerHeight, s = Math.min(W / 1600, H / 900); cv.style.transform = 'translate(' + Math.round((W - 1600 * s) / 2) + 'px,' + Math.round((H - 900 * s) / 2) + 'px) scale(' + s + ')'; }
addEventListener('resize', fit); addEventListener('load', fit); if (window.visualViewport) visualViewport.addEventListener('resize', fit); fit();

/* ---------- 도우미 ---------- */
function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function scene(name) { root.setAttribute('data-scene', name); cv.innerHTML = ''; backEl.innerHTML = ''; backEl.className = ''; }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* 입력: 선택 대기 / 다음 대기 */
var onNext = null, idleT = 0;
function poke() {
  if (!KIOSK) return; clearTimeout(idleT);
  idleT = setTimeout(function () { location.href = location.pathname + location.search; }, 90000);
}
document.addEventListener('keydown', function (e) {
  poke();
  if (/^[1-9]$/.test(e.key)) { var b = cv.querySelectorAll('[data-choice]')[+e.key - 1]; if (b) { e.preventDefault(); b.click(); } return; }
  if ((e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') && onNext) { e.preventDefault(); onNext(); }
});
document.addEventListener('pointerdown', poke);

/* ---------- 서버 기록 ---------- */
function postJson(url, o) { return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) }); }
function prog(step, ans) { try { postJson('/api/progress', { step: step, ans: ans == null ? undefined : String(ans) }).catch(function () {}); } catch (e) {} }
function qGet() { try { return JSON.parse(localStorage.getItem('gbd_q') || '[]'); } catch (e) { return []; } }
function qSet(a) { try { localStorage.setItem('gbd_q', JSON.stringify(a)); } catch (e) {} }
function flush() { var q = qGet(); if (!q.length) return; qSet([]); q.forEach(function (p) { postJson('/api/play', p).catch(function () { qSet(qGet().concat([p])); }); }); }
function report(p) { postJson('/api/play', p).then(function (r) { if (!r.ok && r.status !== 200) throw 0; }).catch(function () { qSet(qGet().concat([p])); }); }
flush();

/* ---------- 장면 요소 ---------- */
function bg(id, desc, src) { /* 배경은 화면 전체(#back, cover)에 깔고, 안내 칩만 1600x900 안에 둔다 */
  var b = el('div', 'layer bg ph');
  b.innerHTML = '<span class="id">' + esc(id || '') + '</span><div class="ds">' + esc(desc || '') + '</div>';
  cv.appendChild(b); backEl.className = 'ph';
  var old = backEl.querySelector('.bgimg'); if (old) old.remove();
  if (id) { /* public/scenes/<번호>.webp|png|jpg 가 있으면 자리표시 대신 사용 */
    var exts = ['webp', 'png', 'jpg'], i = 0, im = new Image(); im.className = 'bgimg';
    im.onload = function () { backEl.className = ''; backEl.insertBefore(im, backEl.firstChild); b.innerHTML = ''; b.className = 'layer bg'; };
    im.onerror = function () { if (!src && ++i < exts.length) im.src = 'scenes/' + id + '.' + exts[i]; };
    im.src = src || ('scenes/' + id + '.' + exts[0]);
  }
  return b;
}
function hud(step) {
  var h = el('div', 'hud'), c = CH[S.ci];
  h.innerHTML = '<span class="who">' + esc(c ? c.name : '') + '</span><span class="dots">' + STEPS.map(function (_, i) { return '<i class="' + (i <= step ? 'on' : '') + '"></i>'; }).join('') + '</span>';
  cv.appendChild(h);
}
function type(node, text) {
  return new Promise(function (res) {
    var i = 0, done = false;
    function finish() { if (done) return; done = true; node.textContent = text; onNext = null; res(); }
    if (reduce) return finish();
    onNext = finish;
    (function tick() { if (done) return; if (i >= text.length) return finish(); i++; node.textContent = text.slice(0, i); setTimeout(tick, 26); })();
  });
}
function waitNext(hit) {
  return new Promise(function (res) {
    hit.classList.add('on');
    function go() { hit.classList.remove('on'); onNext = null; res(); }
    onNext = go;
  });
}
/* 프로필/거울 카드 (이미지 없으면 PROFILE 자리표시) */
function frame(img, cls) { return '<div class="frame ' + (cls || '') + '">' + (img ? '<img src="' + esc(img) + '" alt="">' : '<span class="nop">PROFILE</span>') + '</div>'; }
function showCard(html) { var d = el('div', 'pcard', html); cv.appendChild(d); return d; }
/* 한 컷: 배경 + 자막 줄들. 클릭/Enter 로 넘김. 줄마다 ms>0 이면 그 시간 뒤 자동으로 넘어감 */
async function cut(o, my, extra) {
  if (my !== run) return;
  scene('cine'); bg(o.id, o.desc, o.src); backEl.appendChild(el('div', 'layer shade'));
  if (o.step != null) hud(o.step);
  var tap = el('div', 'tap'); cv.appendChild(tap);
  var hit = el('div', 'hit', '▼'); cv.appendChild(hit);
  tap.addEventListener('click', function () { if (onNext) onNext(); });
  function hold(ms, showHit) { return new Promise(function (res) { var t = ms ? setTimeout(go, ms) : 0; function go() { clearTimeout(t); hit.classList.remove('on'); onNext = null; res(); } if (showHit) hit.classList.add('on'); onNext = go; }); }
  if (o.lead) await hold(o.lead, false);
  if (o.profile) { var p = o.profile, d = showCard(frame(p.img, 'sm') + '<div class="pn">' + esc(p.name) + '</div><div class="pr">' + esc(p.role) + '</div>'); await hold(0, true); d.remove(); }
  var lines = (o.lines || []).slice(); if (extra) lines = extra(lines);
  for (var i = 0; i < lines.length; i++) {
    if (my !== run) return;
    var ln = lines[i], cap = el('div', 'cap ' + (ln.kind || '') + (o.right ? ' right' : '')), nm = el('span', 'nm'), tx = el('span', 'tx');
    nm.textContent = ln.kind === 'hook' ? '' : (ln.who || ''); cap.appendChild(nm); cap.appendChild(tx);
    var old = cv.querySelector('.cap'); if (old) old.remove();
    cv.appendChild(cap);
    await type(tx, ln.text); await hold(+ln.ms || 0, true);
  }
}
/* 선택: 카드 N장. data-choice 로 1/2/3 키 지원 */
function choose(o, my) {
  return new Promise(function (res) {
    if (my !== run) return;
    scene('cine'); bg(o.id, o.desc).classList.add('quiet'); backEl.appendChild(el('div', 'layer scrim')); if (o.step != null) hud(o.step);
    var box = el('div', 'choice');
    box.innerHTML = '<div class="kick">' + esc(o.kicker) + '</div><h2 class="q">' + esc(o.q) + '</h2>';
    var row = el('div', 'opts');
    o.options.forEach(function (op, i) {
      var b = el('button', 'opt', '<span class="k">' + (i + 1) + '</span><div class="lab">' + esc(op.label) + '</div><div class="say">' + esc(op.say) + '</div>'); b.setAttribute('data-choice', i);
      b.addEventListener('click', function () { onNext = null; res(i); }); row.appendChild(b);
    });
    box.appendChild(row); cv.appendChild(box);
  });
}
/* 거울: 이게 나다 */
function mirrorCard(c, my) {
  return new Promise(function (res) {
    if (my !== run) return;
    scene('cine'); bg('', '').classList.add('quiet'); backEl.appendChild(el('div', 'layer scrim')); hud(1);
    var m = c.mirror, box = el('div', 'mirror', frame(m.img || c.portrait, 'mir') + '<div class="mt">' + m.lines.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '</div>');
    cv.appendChild(box); var hit = el('div', 'hit on', '▼'); cv.appendChild(hit);
    var tap = el('div', 'tap'); cv.appendChild(tap);
    function go() { onNext = null; res(); } onNext = go; tap.addEventListener('click', go);
  });
}

/* ---------- 규칙 ---------- */
function endIdx(v, l) {
  var ai = /AI/.test(l), hu = /인간/.test(l), jo = /공동/.test(l);
  if (v === 'M' && ai) return 0; if (v === 'T' && hu) return 1; if (v === 'P' && jo) return 2;
  if (v === 'T' && (ai || jo)) return 3; return 4;
}
function e5sub(v, l) {
  var k = v + ' + ' + (/AI/.test(l) ? 'AI' : /인간/.test(l) ? '인간' : '공동'), s = EN[4].subs || [];
  for (var i = 0; i < s.length; i++) if (s[i][0] === k) return s[i]; return null;
}
function weakFor(v, i) { return v === 'M' ? i === 1 : v === 'T' ? i === 0 : i !== 2; } /* 첫 선택이 뒤의 근거를 약하게 만든다 */

/* ---------- 흐름 ---------- */
async function selectScreen() {
  S = { ci: 0, mc: 0, c1: 0, c2: 0, weak: false };
  scene('1'); prog('start');
  var box = el('div', 'sel'); box.innerHTML = '<div class="brand">Guilty by Default</div><h1>이 사건에서 당신은 누구입니까?</h1><p class="lede">같은 사고, 다른 자리. 한 번에 약 5분. 다른 인물로 다시 하면 보는 장면이 달라집니다.</p>';
  var row = el('div', 'opts'); box.appendChild(row); cv.appendChild(box);
  return new Promise(function (res) {
    CH.forEach(function (c, i) {
      var pic = c.portrait ? '<img src="' + esc(c.portrait) + '" alt="">' : '<span class="nop">PROFILE</span>';
      var b = el('button', 'opt', '<span class="k">' + (i + 1) + '</span><div class="pf">' + pic + '</div><div class="kw">' + esc(c.kw) + '</div><div class="nm">' + esc(c.name) + '</div><div class="pr">' + esc(c.prem) + '</div><div class="done">' + (played[i] ? '✓ 플레이함' : '') + '</div>');
      b.setAttribute('data-choice', i); b.addEventListener('click', function () { res(i); }); row.appendChild(b);
    });
  });
}
async function play(ci) {
  var my = ++run; S = { ci: ci, mc: 0, c1: 0, c2: 0, weak: false }; var c = CH[ci], k;
  prog('p0', ci);
  for (k = 0; k < SC.opening.length; k++) await cut(Object.assign({ step: 0 }, SC.opening[k]), my);
  prog('p1', ci);
  for (k = 0; k < c.intro.length; k++) await cut(Object.assign({ step: 1 }, c.intro[k]), my);
  await mirrorCard(c, my);
  prog('p2', ci);
  for (k = 0; k < c.meet.length; k++) await cut(Object.assign({ step: 2 }, c.meet[k]), my);
  prog('p3', ci);
  for (k = 0; k < c.twist.length; k++) await cut(Object.assign({ step: 3 }, c.twist[k]), my);
  prog('c1', ci);
  S.c1 = await choose({ step: 4, id: c.n + '-4', desc: c.c1.q, kicker: c.c1.kicker, q: c.c1.q, options: c.c1.options }, my);
  var v = c.c1.options[S.c1].v; prog('p5', ci);
  var a1 = c.after1[S.c1];
  for (k = 0; k < a1.length; k++) await cut(Object.assign({ step: k < 2 ? 5 : 6 }, a1[k]), my);
  prog('c2', ci);
  S.c2 = await choose({ step: 7, id: c.n + '-7', desc: '청문회장. 마이크 앞.', kicker: c.c2.kicker, q: c.c2.q, options: c.c2.options }, my);
  var l = c.c2.options[S.c2].label; S.weak = weakFor(v, S.c2); prog('p8', ci);
  var a2 = c.after2[S.c2];
  for (k = 0; k < a2.length; k++) await cut(Object.assign({ step: 8 }, a2[k]), my, k === 0 && S.weak ? function (ls) { var o = ls.slice(); o.splice(1, 0, { who: '', text: c.weakLine, kind: 'nar', ms: 0 }); return o; } : null);
  var ei = endIdx(v, l), e = EN[ei], v1 = c.c1.options[S.c1].label;
  await cut({ step: 9, id: 'I-JD', desc: '판결 · 뉴스 헤드라인', lines: [{ who: '판결', text: '“' + v1 + '을 먼저 지키려 했고, 책임은 ' + (/공동/.test(l) ? '여럿에게' : /AI/.test(l) ? 'AI에게' : '사람에게') + ' 물었다.”', kind: '', ms: 0 }, { who: '', text: c.verdict, kind: 'nar', ms: 0 }, { who: '헤드라인', text: '「' + e.name + '」 — ' + e.why, kind: '', ms: 0 }] }, my);
  if (my !== run) return;
  played[ci] = true; reached[e.id] = true; save();
  report({ sid: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), src: KIOSK ? 'kiosk' : 'browser', test: TEST, ch: ci, mc: 0, c1: S.c1, c2: S.c2, weak: S.weak, ending: e.id });
  await ending(c, ci, e, v, l, my);
}
async function ending(c, ci, e, v, l, my) {
  prog('end', e.id);
  var sub = e.id === 'E5' ? e5sub(v, l) : null;
  /* 1) 엔딩 컷: 이름표 + 판결자 대사 */
  scene('turn'); bg(e.img, e.desc).classList.add('low'); backEl.appendChild(el('div', 'layer shade up'));
  var mk = el('div', 'endmark', '<div class="id">' + esc(e.id) + '</div><h2>' + esc(e.name) + '</h2>'); cv.appendChild(mk);
  async function more(id, desc, lines, hook, keepMark) {
    var tap = el('div', 'tap'); cv.appendChild(tap); var hit = el('div', 'hit', '▼'); cv.appendChild(hit);
    tap.addEventListener('click', function () { if (onNext) onNext(); });
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i], cap = el('div', 'cap top ' + (ln[2] || '')), nm = el('span', 'nm'), tx = el('span', 'tx'); nm.textContent = ln[0] || ''; cap.appendChild(nm); cap.appendChild(tx);
      var old = cv.querySelector('.cap'); if (old) old.remove(); cv.appendChild(cap); await type(tx, ln[1]); await waitNext(hit);
    }
    tap.remove(); hit.remove(); var oc = cv.querySelector('.cap'); if (oc) oc.remove();
  }
  await more(null, null, [e.say]); if (my !== run) return;
  /* 2) 내 인물의 엔딩 컷 */
  var main = [[c.name, e.mine[ci]]]; if (sub) main.push(['', sub[1], 'nar']); if (e.extra) main.push(['', e.extra, 'nar']);
  var bgl = cv.querySelector('.bg'); if (bgl) bgl.remove(); bg(e.img + '-' + c.n, c.name + ' — ' + e.mine[ci]).classList.add('low'); cv.insertBefore(cv.lastChild, cv.children[0]);
  await more(null, null, main); if (my !== run) return;
  /* 3) 다른 두 인물의 시선 */
  var oth = []; CH.forEach(function (oc, i) { if (i !== ci) oth.push([oc.name + '의 시선', e.cross[i]]); });
  await more(null, null, oth); if (my !== run) return;
  /* 4) 딜레마 */
  var dl = el('div', 'dil', esc(e.dil)); cv.appendChild(dl);
  var tap = el('div', 'tap'); cv.appendChild(tap); var hit = el('div', 'hit', '▼'); cv.appendChild(hit);
  tap.addEventListener('click', function () { if (onNext) onNext(); }); await waitNext(hit); if (my !== run) return;
  /* 5) 마지막 질문 */
  scene('turn');
  var f = el('div', 'final', '<div class="big">“당신은 누구를 위해 책임을 물었습니까?”</div><div class="btns"></div><div class="dex"></div>');
  var btns = f.querySelector('.btns');
  var a = el('button', 'btn primary', '다른 인물로 <small>(1)</small>'), b = el('button', 'btn', '같은 인물로 다시 <small>(2)</small>');
  a.setAttribute('data-choice', 0); b.setAttribute('data-choice', 1);
  a.onclick = function () { start(); }; b.onclick = function () { play(ci); };
  btns.appendChild(a); btns.appendChild(b);
  var dex = f.querySelector('.dex'); EN.forEach(function (x) { dex.appendChild(el('span', reached[x.id] ? 'on' : '', esc(x.id + ' ' + x.name))); });
  cv.appendChild(f); poke();
}
async function start() { run++; var ci = await selectScreen(); await play(ci); }
function load() {
  return fetch('script.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .catch(function () { return fetch('script.default.json').then(function (r) { return r.json(); }); });
}
if (location.protocol === 'file:') { cv.innerHTML = '<div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center;font-size:34px;line-height:1.6;color:#FAF4EF;padding:0 120px">파일을 직접 열면 실행되지 않아요.<br>터미널에서 npm run dev 후<br>http://localhost:3000 으로 열어 주세요.</div>'; root.setAttribute('data-scene', 'turn'); } else load().then(function (j) {
  SC = j; CH = SC.chars; EN = SC.endings; CH.forEach(function (c, i) { c.n = i + 1; });
  poke(); start();
});
})();
