/* 글꼴 자동 분리: 한글이 한 글자라도 들어간 글 → 전체를 한글 서체(Orbit)로,
   영어만 / 영어+숫자만 있는 글 → 영어 서체(PP Frama · Orbit). 영어·한글 혼용 문장이 섞여 보이지 않게 합니다. */
(function () {
  if (window.__fontmix) return; window.__fontmix = 1;
  var KO = /[ᄀ-ᇿㄱ-ㆎ가-힣]/;
  /* Orbit은 Pretendard보다 글자·띄어쓰기 폭이 넓어 줄바꿈이 달라지므로, 폭을 맞추는 보정판(Orbit Fit)을 씁니다 */
  var base = ''; try { base = document.currentScript.src.replace(/[^\/]*$/, ''); } catch (x) {}
  var ff0 = document.createElement('style');
  ff0.textContent = "@font-face{font-family:'Orbit Fit';font-weight:400;font-display:swap;size-adjust:96%;src:url('" + base + "fonts/Orbit/Orbit-Regular.ttf') format('truetype')}";
  (document.head || document.documentElement).appendChild(ff0);
  var KOF = "'Orbit Fit', 'Orbit', 'Pretendard Variable', Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif";
  var ENF = "'PP Frama', 'Orbit', " + KOF;
  var st = document.createElement('style');
  st.textContent = '.fm-ko{font-family:' + KOF + ' !important}.fm-ok .fm-ko{word-spacing:-.32em}.fm-en{font-family:' + ENF + ' !important}';
  (document.head || document.documentElement).appendChild(st);
  /* Orbit 이 실제로 불러와진 뒤에만 띄어쓰기를 좁힌다 (못 불러왔을 때 글자가 붙어 보이는 것 방지) */
  try { document.fonts.load("16px 'Orbit Fit'", '가').then(function (r) { if (r && r.length) document.documentElement.classList.add('fm-ok'); }); } catch (x) {}
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, NOSCRIPT: 1, HTML: 1, HEAD: 1, BODY: 1, CODE: 1, PRE: 1 };
  function hasOwnText(e) { for (var n = e.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && /\S/.test(n.nodeValue)) return true; return false; }
  function fix(e) {
    if (!e || e.nodeType !== 1 || SKIP[e.tagName] || !e.classList) return;
    if (e.closest && e.closest('.cap.ai')) { e.classList.remove('fm-ko', 'fm-en'); return; } /* AI 대사는 game.css 에서 한 서체로 고정 */
    if (!hasOwnText(e)) { e.classList.remove('fm-ko', 'fm-en'); return; }
    var ko = KO.test(e.textContent);
    if (ko) {
      if (!e.classList.contains('fm-ko')) {
        var ff = ''; try { ff = getComputedStyle(e).fontFamily; } catch (x) {}
        if (/mono/i.test(ff) && !e.classList.contains('fm-en')) return; /* 모노스페이스(AI 대사)는 그대로 */
        e.classList.add('fm-ko'); e.classList.remove('fm-en');
      }
    } else {
      e.classList.remove('fm-ko');
      var up = e.parentElement && e.parentElement.closest('.fm-ko');
      if (up) e.classList.add('fm-en'); else e.classList.remove('fm-en');
    }
  }
  function walk(r) { if (r.nodeType !== 1) return; fix(r); var all = r.getElementsByTagName('*'); for (var i = 0; i < all.length; i++) fix(all[i]); }
  var pend = new Set(), mo;
  function flush(recs) {
    recs.forEach(function (m) {
      if (m.type === 'characterData') { var p = m.target.parentElement; if (p) { pend.add(p); } }
      else if (m.type === 'childList') {
        if (m.target.nodeType === 1) pend.add(m.target);
        m.addedNodes.forEach(function (n) { if (n.nodeType === 1) walk(n); else if (n.nodeType === 3 && n.parentElement) pend.add(n.parentElement); });
      }
    });
    pend.forEach(function (e) { fix(e); var u = e; while ((u = u.parentElement)) { if (u.classList.contains('fm-ko') || u.classList.contains('fm-en')) fix(u); } });
    pend.clear();
  }
  mo = new MutationObserver(flush);
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  function init() { walk(document.documentElement); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
