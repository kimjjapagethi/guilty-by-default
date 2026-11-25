/* KO/EN 전환. data-en 속성이 있는 요소는 영어 문구로 교체, 아래 사전은 그 외 제목·표 등.
   번역은 초안입니다. 문구를 고치려면 data-en 또는 아래 DICT를 수정하세요. */
(function(){
  var DICT = {
    "홈":"Home","리서치":"Research","팀":"Team","이해관계자":"Stakeholder",
    "이해관계자 지도":"Stakeholder Map",
    "우리가 설득하려는 세 가지":"Three things we want to convince you of",
    "아직 답하지 못한 질문":"Questions we haven't answered yet",
    "판단의 고리 안에 사람이 있는가":"Is a human inside the loop?",
    "사람이 승인한다":"A human approves","사람이 지켜본다":"A human watches","사람이 개입할 수 없다":"A human cannot intervene",
    "주제 확정에서 워크숍까지":"From topic to workshop",
    "세 가지":"Three claims","06주차":"Week 06","08주차":"Week 08"
  };
  var store = new WeakMap(), done = false;
  function leaves(){ return document.querySelectorAll('h1,h2,h3,a.sbtn,.hd .nav a,.eyebrow,th,td,figcaption,text,tspan,.slede'); }
  function apply(l){
    try{document.documentElement.lang=l;}catch(e){}
    var els=document.querySelectorAll('[data-en]');
    els.forEach(function(el){
      if(!store.has(el)) store.set(el, el.innerHTML);
      el.innerHTML = l==='en' ? el.getAttribute('data-en') : store.get(el);
    });
    leaves().forEach(function(el){
      if(el.hasAttribute('data-en')||el.children.length) return;
      var k=store.has(el)?store.get(el):el.textContent.trim();
      if(!(k in DICT)) return;
      if(!store.has(el)) store.set(el,k);
      el.textContent = l==='en' ? DICT[k] : store.get(el);
    });
    document.querySelectorAll('.lang').forEach(function(b){ b.setAttribute('data-cur',l); });
  }
  function get(){ try{return localStorage.getItem('gbd-lang')||'ko';}catch(e){return 'ko';} }
  function set(l){ try{localStorage.setItem('gbd-lang',l);}catch(e){} apply(l); }
  function init(){
    document.querySelectorAll('.lang').forEach(function(b){
      b.addEventListener('click',function(){ set(get()==='en'?'ko':'en'); });
    });
    if(get()==='en') apply('en'); else document.querySelectorAll('.lang').forEach(function(b){b.setAttribute('data-cur','ko');});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
