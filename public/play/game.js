/* Guilty by Default — 3인 플레이 게임 (v4: 시나리오 대본집 기반). 내용은 script.json, 디자인은 ds.css + game.css.
 * 마우스가 기본: 클릭 = 선택·다음 (Enter/Space 도 다음), Esc = 설정.  ?zone=1(전시장) = 90초 무입력 시 처음으로,  ?test=1 = 통계 제외 */
(function () {
'use strict';
var SC = null, CH = [];
var Q = location.search, KIOSK = /[?&](kiosk|zone)=1/.test(Q), TEST = /[?&]test=1/.test(Q);
var backEl = document.getElementById('back'), cv = document.getElementById('canvas'), uiEl = document.getElementById('ui'), root = document.documentElement;
var S = { ci: 0, c1: 0, c2: 0 }, run = 0;
var STEPS = ['오프닝', '도입', '선택 1', '결과', '마주침', '선택 2', '엔딩'];
var played = {}, reached = {};
try { localStorage.removeItem('gbd_end'); localStorage.removeItem('gbd_played'); } catch (e) {} /* 예전 버전이 남긴 기록 정리 */
function save() { /* 관람객 간에 기록이 이어지지 않도록 저장하지 않는다 */ }

/* ---------- 화면 맞춤 ---------- */
function fit() {
  var W = root.clientWidth || innerWidth, H = root.clientHeight || innerHeight, s = Math.min(W / 1600, H / 900);
  var t = 'translate(' + Math.round((W - 1600 * s) / 2) + 'px,' + Math.round((H - 900 * s) / 2) + 'px) scale(' + s + ')';
  cv.style.transform = t; if (uiEl) uiEl.style.transform = t;
}
addEventListener('resize', fit); addEventListener('load', fit); if (window.visualViewport) visualViewport.addEventListener('resize', fit); fit();

/* ---------- 도우미 ---------- */
function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
var ghost = el('div', ''); ghost.id = 'ghost'; backEl.parentNode.insertBefore(ghost, backEl); /* 장면이 바뀌는 동안 이전 배경을 뒤에 남겨 두는 층 (번쩍임 방지) */
function scene(name) {
  ghost.style.transition = 'none'; ghost.style.opacity = '1';
  var prev = backEl.querySelector('.bgimg');
  if (prev && prev.dataset.done === '1') { ghost.innerHTML = ''; var g = prev.cloneNode(); g.removeAttribute('style'); g.className = 'bgimg'; ghost.appendChild(g); }
  root.setAttribute('data-scene', name); cv.innerHTML = ''; backEl.innerHTML = ''; backEl.className = '';
}
function showBg(im) { /* 새 배경을 이전 배경 위에서 서서히 나타나게 */
  im.style.opacity = '0'; backEl.insertBefore(im, backEl.firstChild); void im.offsetWidth;
  im.style.transition = 'opacity .7s ease'; im.style.opacity = '1'; /* 이미지 전환의 페이드는 항상 켜 둔다 */
  setTimeout(function () { if (im.parentNode) { im.dataset.done = '1'; ghost.innerHTML = ''; } }, 740);
}
function fadeOutGhost() { /* 다음 컷에 이미지가 없으면 이전 이미지가 서서히 사라진다 */
  if (!ghost.firstChild) return; void ghost.offsetWidth; ghost.style.transition = 'opacity .7s ease'; ghost.style.opacity = '0';
  setTimeout(function () { ghost.innerHTML = ''; ghost.style.transition = 'none'; ghost.style.opacity = '1'; }, 740);
}
var PH = !/[?&]ph=0/.test(Q); /* 이미지가 없는 컷은 컷 번호·스토리보드 설명을 보여 준다 (?ph=0 이면 숨김) */

/* ---------- 소리 · 설정 ---------- */
var VOL = { v: 0.7, mute: false };
try { var sv = JSON.parse(localStorage.getItem('gbd_vol') || 'null'); if (sv && typeof sv.v === 'number') { VOL.v = Math.max(0, Math.min(1, sv.v)); VOL.mute = !!sv.mute; } } catch (e) {}
function saveVol() { try { localStorage.setItem('gbd_vol', JSON.stringify(VOL)); } catch (e) {} }
var AU = { bgm: null, ctx: null };
function gain() { return VOL.mute ? 0 : VOL.v; }
function applyVol() { if (AU.bgm) AU.bgm.volume = gain(); }
function startBgm() { /* script.json 의 audio.bgm 경로가 있을 때만. 브라우저 규칙상 첫 클릭 뒤에 시작 */
  var src = SC && SC.audio && SC.audio.bgm; if (!src || AU.bgm) return;
  var a = new Audio(src); a.loop = true; a.volume = gain(); a.onerror = function () { AU.bgm = null; }; AU.bgm = a; a.play().catch(function () {});
}
function sfx(src) { if (!src || gain() === 0) return; try { var a = new Audio(src); a.volume = gain(); a.play().catch(function () {}); } catch (e) {} }
function beep() { /* 설정에서 음량을 맞출 때 확인용으로 짧게 울리는 소리 */
  try { var C = window.AudioContext || window.webkitAudioContext; if (!C || gain() === 0) return; AU.ctx = AU.ctx || new C(); var o = AU.ctx.createOscillator(), g = AU.ctx.createGain(); o.type = 'sine'; o.frequency.value = 523; g.gain.value = gain() * 0.25; o.connect(g); g.connect(AU.ctx.destination); o.start(); o.stop(AU.ctx.currentTime + 0.18); } catch (e) {}
}
var setOpen = false, panel = null, setDim = null;
var ICON_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6"/><path d="M18 6.5a8 8 0 0 1 0 11"/></svg>';
var ICON_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
function openSettings() {
  if (setOpen) return; setOpen = true;
  var inGame = root.getAttribute('data-scene') !== 'title';
  panel = el('div', 'setp', '<div class="card" role="dialog" aria-label="설정"><h3>설정</h3>' +
    '<div class="srow"><button class="smute" id="smute" aria-label="소리 켜기/끄기"></button><input id="svol" type="range" min="0" max="100" step="5" aria-label="음량"><output id="sout"></output></div>' +
    (!KIOSK ? '<div class="srow one"><button class="sbtn" id="sweb">웹사이트로 돌아가기</button></div>' : '') + /* 웹 방문자 전용 (전시장 ?zone=1 에는 없음) */
    (inGame ? '<div class="srow one"><button class="sbtn" id="shome">처음 화면으로</button></div>' : '') +
    '<div class="sfoot"><span class="snote">Esc로 설정을 열고 닫을 수 있어요' + ' · F로 전체 화면' + '</span><button class="sbtn primary" id="sclose">닫기</button></div></div>');
  setDim = el('div', 'setdim'); document.body.appendChild(setDim); setDim.addEventListener('click', closeSettings); /* 화면 전체(레터박스 포함)를 덮는 딤 */
  uiEl.appendChild(panel);
  var rv = panel.querySelector('#svol'), ro = panel.querySelector('#sout'), rm = panel.querySelector('#smute');
  function draw() { rv.value = VOL.mute ? 0 : Math.round(VOL.v * 100); ro.textContent = VOL.mute ? '꺼짐' : rv.value; rm.innerHTML = VOL.mute ? ICON_OFF : ICON_ON; rv.style.opacity = VOL.mute ? 0.4 : 1; }
  rv.oninput = function () { VOL.v = rv.value / 100; VOL.mute = VOL.v === 0; applyVol(); saveVol(); draw(); };
  rv.onchange = function () { beep(); };
  rm.onclick = function () { VOL.mute = !VOL.mute; if (!VOL.mute && VOL.v === 0) VOL.v = 0.7; applyVol(); saveVol(); draw(); if (!VOL.mute) beep(); };
  var w = panel.querySelector('#sweb'); if (w) w.onclick = function () { location.href = '../index.html'; };
  var h = panel.querySelector('#shome'); if (h) h.onclick = function () { restart(); };
  panel.querySelector('#sclose').onclick = closeSettings;
  panel.addEventListener('click', function (e) { if (e.target === panel) closeSettings(); });
  draw();
}
function closeSettings() { if (!setOpen) return; setOpen = false; if (panel) panel.remove(); panel = null; if (setDim) setDim.remove(); setDim = null; }
(function () {
  var g = el('button', '', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>');
  g.id = 'gear'; g.setAttribute('aria-label', '설정'); g.onclick = function () { setOpen ? closeSettings() : openSettings(); };
  if (uiEl) uiEl.appendChild(g);
})();

/* 입력: 선택 대기 / 다음 대기 */
var onNext = null, idleT = 0;
var IDLE_MS = (/[?&]idle=(\d+)/.exec(Q) ? +/[?&]idle=(\d+)/.exec(Q)[1] * 1000 : 90000), idleBox = null, idleCt = 0;
function restart() { /* 처음으로: 페이지를 새로 불러오지 않고 상태만 초기화한다 (전체 화면이 풀리지 않게). 모든 인물이 다시 선택지에 나타남 */
  run++; played = {}; reached = {}; S = { ci: 0, c1: 0, c2: 0 }; onNext = null;
  closeSettings(); idleClose(); clearTimeout(idleT);
  if (AU.bgm) { try { AU.bgm.pause(); } catch (e) {} AU.bgm = null; }
  boot(); poke();
}
function idleClose() { clearInterval(idleCt); if (idleBox) { idleBox.remove(); idleBox = null; } }
function idlePrompt() { /* 전시장: 무입력이 이어지면 화면을 어둡게 하고 5초 카운트다운, 그래도 반응이 없으면 처음 화면으로 */
  if (root.getAttribute('data-scene') === 'title') return poke();
  idleClose(); var n = 5;
  idleBox = el('div', 'idle'); var inner = el('div', 'idlein', '<div class="it">아직 거기 계시나요?</div><div class="in">' + n + '</div><div class="ih">화면을 누르면 계속할 수 있어요</div>');
  inner.style.transform = uiEl.style.transform; idleBox.appendChild(inner); document.body.appendChild(idleBox);
  idleCt = setInterval(function () { n--; if (n <= 0) { clearInterval(idleCt); restart(); return; } var c = idleBox && idleBox.querySelector('.in'); if (c) c.textContent = n; }, 1000);
}
function poke() {
  if (!KIOSK) return; clearTimeout(idleT); idleClose();
  idleT = setTimeout(idlePrompt, IDLE_MS);
}
document.addEventListener('keydown', function (e) {
  poke();
  if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) { /* F = 전체 화면 켜기/끄기 (웹·전시장 공통) */
    e.preventDefault();
    if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen(); }
    else if (root.requestFullscreen) { try { var p = root.requestFullscreen(); if (p && p.catch) p.catch(function () {}); } catch (x) {} }
    return;
  }
  if (e.key === 'Escape') { e.preventDefault(); setOpen ? closeSettings() : openSettings(); return; }
  if (setOpen) return;
  if ((e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') && onNext) { e.preventDefault(); onNext(); }
});
function goFull() { if (document.fullscreenElement || !root.requestFullscreen) return; try { var p = root.requestFullscreen(); if (p && p.catch) p.catch(function () {}); } catch (x) {} }
document.addEventListener('pointerdown', function () { poke(); if (KIOSK) goFull(); }); /* 전시장: 화면을 클릭하면 전체 화면으로 (브라우저는 클릭·키 입력 뒤에만 허용) */

/* ---------- 서버 기록 ---------- */
function postJson(url, o) { return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) }); }
function prog(step, ans) { try { postJson('/api/progress', { step: step, ans: ans == null ? undefined : String(ans) }).catch(function () {}); } catch (e) {} }
function qGet() { try { return JSON.parse(localStorage.getItem('gbd_q') || '[]'); } catch (e) { return []; } }
function qSet(a) { try { localStorage.setItem('gbd_q', JSON.stringify(a)); } catch (e) {} }
function flush() { var q = qGet(); if (!q.length) return; qSet([]); q.forEach(function (p) { postJson('/api/play', p).catch(function () { qSet(qGet().concat([p])); }); }); }
function report(p) { postJson('/api/play', p).then(function (r) { if (!r.ok && r.status !== 200) throw 0; }).catch(function () { qSet(qGet().concat([p])); }); }
flush();

/* ---------- 장면 요소 ---------- */
var IMG_PREFIX = { A: 'SY' }; /* 컷 A-S<n> → media/SY_S<n>.webp. 다른 인물은 이름이 정해지면 여기에 추가 (예: B: 'RS') */
function imgCands(id, src) {
  var c = src ? [src] : [], m = /^([A-Z])-S(\d+)$/.exec(id || '');
  if (m && IMG_PREFIX[m[1]]) { var base = 'media/' + IMG_PREFIX[m[1]] + '_S' + m[2]; c.push(base + '.webp', base + '.png'); }
  ['webp', 'png', 'jpg'].forEach(function (e) { c.push('scenes/' + id + '.' + e); });
  return c;
}
function bg(id, desc, src) { /* 배경은 화면 전체(#back, cover)에 깔고, 안내 칩만 1600x900 안에 둔다 */
  var b = el('div', 'layer bg'); cv.appendChild(b);
  function none() { fadeOutGhost(); if (!PH) return; backEl.className = 'ph'; b.classList.add('ph'); b.innerHTML = '<span class="id">' + esc(id || '') + '</span><div class="ds">' + esc(desc || '') + '</div>'; }
  if (!id) { none(); return b; }
  var c = imgCands(id, src), i = 0, im = new Image(); im.className = 'bgimg';
  im.onload = function () { if (!b.isConnected) return; showBg(im); };
  im.onerror = function () { if (!b.isConnected) return; if (++i < c.length) im.src = c[i]; else none(); };
  im.src = c[0];
  return b;
}
function zoomOf(src) { var z = 1; CH.forEach(function (c) { if (c.portrait === src && +c.zoom > 0) z = +c.zoom; }); return z; }
function zoomYOf(src) { var y = null; CH.forEach(function (c) { if (c.portrait === src && c.zoomY != null && c.zoomY !== '') y = +c.zoomY; }); return y; } /* 확대 기준점의 높이(%) : 클수록 사진의 더 아래쪽이 중심 */ /* 인물별 사진 확대 배율 (script.json 의 zoom) */
function avatarEl(src) { /* 둥근 프로필 사진. 파일이 없으면 만들지 않는다 (자리표시 없음) */
  if (!src) return null; var d = el('span', 'av'), im = new Image(); im.alt = ''; im.onerror = function () { d.remove(); }; im.src = src; if (zoomOf(src) !== 1) im.style.setProperty('--z', zoomOf(src)); if (zoomYOf(src) != null) im.style.setProperty('--zy', zoomYOf(src) + '%'); d.appendChild(im); return d;
}
function speakerImg(ln) { /* 말한 사람의 사진: 줄의 img → 인물의 cast[이름] → 주인공 본인의 portrait */
  var c = CH[S.ci], who = ln.who || ''; if (ln.img) return ln.img; if (!c || !who || ln.kind === 'hook') return '';
  var base = who.replace(/\s*\(.*\)\s*$/, '').trim(), cast = c.cast || {};
  if (cast[who]) return cast[who]; if (cast[base]) return cast[base];
  return (who === c.name || base === c.name) ? (c.portrait || '') : '';
}
function hud(step) { /* 좌측 위: 인물 사진(타원)만. 이름은 표시하지 않는다 */
  var c = step > 0 ? CH[S.ci] : null; if (!c) return;
  var av = avatarEl(c.portrait); if (!av) return; var h = el('div', 'hud'); h.appendChild(av); cv.appendChild(h);
}
function frame(img, cls) { return '<div class="frame ' + (cls || '') + '">' + (img ? '<img src="' + esc(img) + '" alt="">' : '<span class="nop">PROFILE</span>') + '</div>'; }
function showCard(html) { var d = el('div', 'pcard', html); cv.appendChild(d); return d; }
function infoCard(big) { /* [길티 바이 디폴트] 소개 팝업 */
  var o = SC.org || {}, d = el('div', 'icard' + (big ? ' big' : ''), '<div class="it">' + esc(o.title || '') + '</div><div class="ix">' + esc(o.text || '') + '</div>');
  cv.appendChild(d); return d;
}
/* 한 컷: 배경 + 자막 줄들. 클릭/Enter 로 넘김. 줄마다 ms>0 이면 그 시간 뒤 자동으로 넘어감
 * 컷 옵션: card='org'(소개 팝업) · mark={id,name}(엔딩 이름표) · top(자막 위쪽) · scene · sfx */
function match(w) { /* 조건 {c1:[0,2], c2:[1]} : 고른 선택이 목록에 있어야 통과 (칸이 없으면 상관없음) */
  if (!w) return true; var ok = true;
  ['c1', 'c2'].forEach(function (k) { if (w[k] && w[k].length && w[k].indexOf(S[k]) < 0) ok = false; });
  return ok;
}
function resolveLines(arr) { /* 조건에 안 맞는 줄은 빼고, 맞는 ‘다른 대사’가 있으면 그 줄을 바꿔 끼운다 */
  var out = [];
  (arr || []).forEach(function (ln) {
    if (!match(ln.when)) return;
    var r = ln, alts = ln.alts || [];
    for (var i = 0; i < alts.length; i++) if (match(alts[i].when)) { r = Object.assign({}, ln, { who: alts[i].who != null && alts[i].who !== '' ? alts[i].who : ln.who, text: alts[i].text != null ? alts[i].text : ln.text, kind: alts[i].kind != null && alts[i].kind !== '' ? alts[i].kind : ln.kind }); break; }
    out.push(r);
  });
  return out;
}
async function cut(o, my) {
  if (my !== run) return;
  if (!match(o.when)) return; /* 컷 전체 조건 */
  var lines = resolveLines(o.lines);
  if ((o.lines || []).length && !lines.length && !o.profile && !o.mark && !o.card) return; /* 대사가 전부 조건에 안 맞으면 컷을 건너뜀 */
  scene(o.scene || 'cine'); bg(o.id, o.desc, o.src); var shaded = false;
  if (o.step != null) hud(o.step);
  if (o.mark) cv.appendChild(el('div', 'endmark', '<div class="id">' + esc(o.mark.id) + '</div><h2>' + esc(o.mark.name) + '</h2>'));
  var tap = el('div', 'tap'); cv.appendChild(tap);
  var hit = el('div', 'hit', '▼'); cv.appendChild(hit);
  tap.addEventListener('click', function () { if (onNext) onNext(); });
  function hold(ms, showHit) { return new Promise(function (res) { var t = ms ? setTimeout(go, ms) : 0; function go() { clearTimeout(t); hit.classList.remove('on'); onNext = null; res(); } if (showHit) hit.classList.add('on'); onNext = go; }); }
  if (o.sfx) sfx(o.sfx);
  if (o.lead) await hold(o.lead, false);
  if (o.card && SC.org) infoCard(!lines.length);
  if (o.profile) { var p = o.profile, d = showCard(frame(p.img, 'sm') + '<div class="pn">' + esc(p.name) + '</div><div class="pr">' + esc(p.role) + '</div>'); await hold(0, true); d.remove(); }
  for (var i = 0; i < lines.length; i++) {
    if (my !== run) return;
    var ln = lines[i], old = cv.querySelector('.cap'); if (old) old.remove();
    if (+ln.delay > 0) await hold(+ln.delay, false); /* 이 줄이 뜨기 전에 이미지만 보여 주는 시간 (누르면 건너뜀) */
    if (my !== run) return;
    if (!shaded) { shaded = true; backEl.appendChild(el('div', 'layer shade' + (o.top ? ' up' : ''))); }
    var cap = el('div', 'cap ' + (ln.kind || '') + (o.right ? ' right' : '') + (o.top ? ' top' : '')), nm = el('span', 'nm'), tx = el('span', 'tx'), body = el('div', 'body');
    var av = avatarEl(speakerImg(ln)); if (av) cap.appendChild(av);
    nm.textContent = ln.kind === 'hook' ? '' : (ln.who || ''); tx.textContent = ln.text; /* 타이핑 없이 바로 */
    body.appendChild(nm); body.appendChild(tx); cap.appendChild(body); cv.appendChild(cap);
    await hold(+ln.ms || 0, true);
  }
  if (!lines.length && !o.profile) await hold(0, true);
}
/* 선택: 카드 N장 (마우스 클릭) */
function choose(o, my) { /* 선택: 앞 컷의 이미지를 어둡게 깔고, 자막 자리에 선택지를 위에서 아래로 나열 (글자만, 호버하면 심볼 로고 + 버건디) */
  return new Promise(function (res) {
    if (my !== run) return;
    var pv = backEl.querySelector('.bgimg'), pvSrc = pv ? pv.getAttribute('src') : '';
    scene('cine');
    if (pvSrc) { var im = new Image(); im.className = 'bgimg'; im.onload = function () { if (root.getAttribute('data-scene') === 'cine' && backEl.isConnected) showBg(im); }; im.src = pvSrc; }
    backEl.appendChild(el('div', 'layer scrim dim')); if (o.step != null) hud(o.step);
    var box = el('div', 'choice');
    box.innerHTML = '<h2 class="q">' + esc(o.q) + '</h2>';
    var row = el('div', 'opts');
    o.options.forEach(function (op, i) {
      var b = el('button', 'opt', '<span class="lg" aria-hidden="true"></span><span class="say">' + esc(op.label || op.say || '') + '</span>'); b.addEventListener('click', function () { onNext = null; res(i); }); row.appendChild(b);
    });
    box.appendChild(row); cv.appendChild(box);
  });
}

/* ---------- 흐름 ---------- */
function titleScreen() { /* 첫 화면: 오프닝 이미지 + 플레이 / 설정 */
  scene('title'); prog('title');
  var im = new Image(); im.className = 'bgimg'; im.onload = function () { if (root.getAttribute('data-scene') === 'title') showBg(im); }; im.onerror = function () { backEl.className = 'ph'; }; im.src = 'media/s0_delivered.png';
  backEl.appendChild(el('div', 'layer shade'));
  var box = el('div', 'title', '<div class="ttl"><h1>So Who’s<br>Responsible?</h1><p>그래서, 누가 책임질건데?</p></div><div class="btns"></div>');
  var row = box.querySelector('.btns');
  cv.appendChild(box);
  return new Promise(function (res) {
    var p = el('button', 'tbtn', '플레이'), s = el('button', 'tbtn', '설정');
    function go() { startBgm(); res(); }
    p.onclick = go; s.onclick = openSettings;
    row.appendChild(p); row.appendChild(s);
  });
}
async function openingSeq(my) {
  prog('p0');
  for (var k = 0; k < SC.opening.length; k++) await cut(Object.assign({ step: 0 }, SC.opening[k]), my);
}
async function selectScreen() { /* 버건디 페인트 벽 + 거울 같은 아치 액자 속 인물. 마우스를 올린 인물의 소개가 아래에 뜬다 */
  S = { ci: 0, c1: 0, c2: 0 };
  scene('1'); prog('sel');
  backEl.appendChild(el('div', 'wall'));
  var box = el('div', 'sel'); box.innerHTML = '<h1>이 사건에서 당신은<br>누구를 위한 책임을 주장하시겠습니까?</h1>';
  var row = el('div', 'opts'); box.appendChild(row); cv.appendChild(box);
  return new Promise(function (res) {
    CH.forEach(function (c, i) {
      if (played[i]) return; /* 이미 플레이한 인물은 보여주지 않는다 */
      var pic = c.portrait ? '<img src="' + esc(c.portrait) + '" alt=""' + ((+c.zoom > 0 && +c.zoom !== 1) || (c.zoomY != null && c.zoomY !== '') ? ' style="' + (+c.zoom > 0 && +c.zoom !== 1 ? '--z:' + (+c.zoom) + ';' : '') + (c.zoomY != null && c.zoomY !== '' ? '--zy:' + (+c.zoomY) + '%' : '') + '"' : '') + '>' : '<span class="nop">PROFILE</span>';
      var b = el('button', 'opt', '<div class="mirror"><div class="pf">' + pic + '</div></div><div class="top"><span class="rl">' + esc(c.role || c.name) + '</span></div><div class="pr">' + esc(c.prem) + '</div>');
      b.addEventListener('click', function () { res(i); }); row.appendChild(b);
    });
  });
}
async function play(ci) {
  var my = ++run; S = { ci: ci, c1: -1, c2: -1 }; var c = CH[ci], k; /* 아직 고르지 않은 선택은 -1 */
  prog('p1', ci);
  for (k = 0; k < c.intro.length; k++) await cut(Object.assign({ step: 1 }, c.intro[k]), my);
  prog('c1', ci);
  S.c1 = await choose({ step: 2, id: c.key + '-C1', desc: c.c1.q, kicker: c.c1.kicker, q: c.c1.q, options: c.c1.options }, my);
  prog('p3', ci);
  var a1 = c.after1[S.c1];
  for (k = 0; k < a1.length; k++) await cut(Object.assign({ step: 3 }, a1[k]), my);
  prog('p4', ci);
  for (k = 0; k < c.mid.length; k++) await cut(Object.assign({ step: 4 }, c.mid[k]), my);
  prog('c2', ci);
  S.c2 = await choose({ step: 5, id: c.key + '-C2', desc: c.c2.q, kicker: c.c2.kicker, q: c.c2.q, options: c.c2.options }, my);
  var e = c.endings[c.map[S.c1][S.c2]];
  if (my !== run) return;
  played[ci] = true; reached[e.id] = true; save(); prog('end', e.id);
  report({ sid: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), src: KIOSK ? 'kiosk' : 'browser', test: TEST, ch: ci, c1: S.c1, c2: S.c2, ending: e.id });
  await cut(Object.assign({}, e, { scene: 'turn', top: true, mark: { id: e.id, name: e.name } }), my);
  if (my !== run) return;
  finalScreen(c, ci);
}
function finalScreen(c, ci) {
  scene('turn');
  var f = el('div', 'final', '<div class="big">누가, 누구를 위해 책임을 졌나요?</div><div class="more">이 캐릭터에는 다른 엔딩이 ' + (c.endings.length - 1) + '개 더 있습니다</div><div class="btns"></div><div class="lower"></div>');
  var btns = f.querySelector('.btns'), lower = f.querySelector('.lower');
  var left = CH.some(function (_, i) { return !played[i]; });
  function home() { restart(); } /* 새로 불러오면 모든 인물이 다시 선택지에 나타난다 */
  if (left) { var a = el('button', 'btn primary', '다른 인물로'); a.onclick = function () { start(); }; btns.appendChild(a); }
  var b = el('button', 'btn primary', '같은 인물로 다시'); b.onclick = function () { play(ci); }; btns.appendChild(b);
  var h = el('button', 'btn ghost', '처음으로'); h.onclick = home; lower.appendChild(h);
  cv.appendChild(f); poke();
}
async function start() { run++; var ci = await selectScreen(); await play(ci); }
async function boot() { var my = ++run; await titleScreen(); if (my !== run) return; await openingSeq(my); if (my !== run) return; await start(); }
function load() {
  return fetch('script.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .catch(function () { return fetch('script.default.json').then(function (r) { return r.json(); }); });
}
if (location.protocol === 'file:') { cv.innerHTML = '<div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center;font-size:34px;line-height:1.6;color:#FAF4EF;padding:0 120px">파일을 직접 열면 실행되지 않아요.<br>터미널에서 npm run dev 후<br>http://localhost:3000 으로 열어 주세요.</div>'; root.setAttribute('data-scene', 'turn'); } else load().then(function (j) {
  SC = j; CH = SC.chars; CH.forEach(function (c, i) { c.n = i + 1; });
  poke(); boot();
});
window.addEventListener('beforeunload', function () { if (AU.bgm) AU.bgm.pause(); });
})();
