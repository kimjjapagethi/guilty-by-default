#!/usr/bin/env python3
"""웹사이트 페이지 생성기.  사용: python3 tools/mk_site.py   (프로젝트 루트에서)
public/index.html, statement/, research/, team/ 을 다시 만듭니다.
모든 경로는 상대경로 — 도메인 루트와 github.io/guilty-by-default/ 하위경로 둘 다에서 동작합니다.
글을 고치려면 아래 데이터(RESEARCH, TEAM 등)만 수정하고 다시 실행하세요."""
import html, json, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
E = html.escape

NAV = [('statement', 'Statement'), ('research', 'Research'), ('play', 'Play'), ('team', 'Team')]

# ---------------------------------------------------------------- 공통 틀
def page(depth, active, title, body, desc='', tone='ivory', script=''):
    p = '../' * depth
    nav = ''
    for key, label in NAV:
        href = p + key + '/index.html'
        cls = ' class="play"' if key == 'play' else ''
        cur = ' aria-current="page"' if key == active else ''
        nav += f'<a href="{href}"{cls}{cur}>{label}</a>'
    return f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<meta property="og:title" content="{E(title)}">
<meta property="og:description" content="{E(desc)}">
<link rel="icon" href="{p}shared/logo_symbol.svg" type="image/svg+xml">
<link rel="stylesheet" href="{p}shared/ds.css">
<link rel="stylesheet" href="{p}shared/site.css">
<script>document.documentElement.classList.add("js")</script>
</head>
<body class="site" data-tone="{tone}">
<header class="hd"><div class="wrap">
  <a class="logo" href="{p}index.html" aria-label="Guilty by Default 홈"><img src="{p}shared/logo_type.svg" alt="Guilty by Default"></a>
  <nav class="nav" aria-label="주요 메뉴">{nav}</nav>
</div></header>
<main>
{body}
</main>
<footer class="ft"><div class="wrap">
  <div><img src="{p}shared/logo_type.svg" alt="Guilty by Default" style="filter:brightness(0) invert(1)"><p class="cap">2026 HIVCD Graduate Exhibit · 채현 · 혜림 · 지민</p></div>
  <nav aria-label="푸터 메뉴"><a href="{p}index.html">Home</a>{''.join(f'<a href="{p}{k}/index.html">{l}</a>' for k, l in NAV)}</nav>
</div></footer>
{script}
</body>
</html>
'''

def write(rel, content):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(content)
    print('wrote', rel)

# ---------------------------------------------------------------- 게임 대본에서 가져오는 문구
script = json.load(open(os.path.join(ROOT, 'play', 'script.json'), encoding='utf-8'))
ORG = script['org']['text']
chars = script['chars']
if isinstance(chars, dict):
    chars = list(chars.values())
SEATS = [(c.get('name', ''), c.get('role', ''), c.get('prem', '')) for c in chars]

# ---------------------------------------------------------------- 리서치 피드 (최신순)
# 슬라이드 내용을 요약·재서술한 것입니다. refs 는 슬라이드에 적힌 출처 그대로(원문 대조는 하지 않음).
RESEARCH = [
 dict(id='w8', wk='08', tag='워크숍 · 전시 계획', now=True,
  title='1차 워크숍을 마치고, 2차를 설계했다',
  sum='“AI도 책임을 져야 할까?”를 직접 물어보는 1차 워크숍을 열었다. 실화를 재구성한 네 가지 피해 시나리오(신상정보 노출, 부정 채용 탈락, 로봇팔 부상, 자율주행 사고사)를 놓고 책임이 누구에게 있는지 이야기했다.',
  pts=['참여자 모두 <b>인본주의적 사고</b>가 강했다. “AI는 도구에 불과하다”, “책임은 권리의 산물인데 AI는 권리가 없다”는 반응이 나왔다.',
       '결국 책임은 인간(설계자·기업, 또는 사용자)에게 있다는 의견이 다수였지만, AI가 책임을 지는 일에 대한 우려도 계속 남았다.',
       '워크숍 전 가설은 “AI의 자율성과 인지능력이 높아질수록 독립적인 책임 주체로 인식될 가능성”. 가설은 대체로 맞았고, 감정·의식·생체활동 같은 요소도 함께 작용한다는 점을 <b>수정</b>했다.',
       '2차 워크숍은 극단적 피해 시나리오(인간 A가 사망함 / 피해를 입음)를 두고, 책임 주체가 되기 위한 조건과 책임의 형태를 묻는다.',
       '전시는 세 구역으로 구상 중이다. 배경 설명 · 연구 결과(도덕적 주체와 책임 시나리오 영상) · 관객 참여.'],
  shots=[('w8-05', '1차 워크숍에서 쓴 네 가지 피해 사례'), ('w8-09', '워크숍 인사이트 — 참여자 발언 정리'), ('w8-16', '워크숍 전 가설과, 확인·수정한 부분'), ('w8-27', '예상 전경 — Zone 01 · 02 · 03')],
  refs=[]),
 dict(id='w6', wk='06', tag='주제 확정 · 데스크 리서치', now=False,
  title='“Guilty by Default” — 사고가 난 뒤의 책임을 묻기 시작했다',
  sum='이름이 처음 등장한 주. AI가 해주는 일이 늘어나는데, 사고를 치면 그 다음은 누가 어떻게 수습하는가를 물었다. 당시 방향은 사과 → 수습 → 피드백이 순환하는 AI 사후수습 인터랙션이었다.',
  pts=['규범은 크게 <b>사전 규제</b>와 <b>사후 책임</b>으로 작동해 왔다. AI는 사전 규제 논의(EU AI Act 등)는 활발하지만 사후 책임에는 공백이 있다.',
       'AI 사고 1060건을 분석한 연구에서 인정 54%, 귀책 47%, 구제 15%, 개혁 28%. 사과는 해도 실제 구제와 개혁까지 가는 경우는 적었다.',
       '도덕적 복구의 핵심은 신뢰 회복. 책임 확인 · 도덕적 제스처 · 재신뢰 구축 · 상호 존중의 틀을 인터랙션 목표로 삼았다.',
       '현장 리서치로는 사전 인터뷰, 사과문, 수습 액션 카드, 피드백 반영의 네 단계 워크숍을 설계했다.'],
  shots=[('w6-01', 'Guilty by Default — 프로젝트 이름이 나온 표지'), ('w6-07', 'AI 사고 1060건의 사후 대응 분석'), ('w6-13', '사과 · 수습 · 변화 약속의 순환'), ('w6-17', '현장 리서치 · 워크숍 설계')],
  refs=['Steven Shavell, Liability for Harm versus Regulation of Safety, NBER Working Paper, 1984.',
        'Xiao et al., What Comes After Harm? Mapping Reparative Actions in AI through Justice Frameworks, arXiv, 2026.',
        'Walker, M. U. (2006). Moral repair: Reconstructing moral relations after wrongdoing. Cambridge University Press.',
        'Wong, P.-H., & Rieder, G. (2025). After harm: A plea for moral repair after algorithms have failed. Science and Engineering Ethics, 31, Article 26.']),
]

def post_html(p):
    tag = f'<span class="ptag{" now" if p["now"] else ""}">{E(p["tag"])}{" · 최신" if p["now"] else ""}</span>'
    pts = ''.join(f'<li>{x}</li>' for x in p['pts'])
    shots = ''.join(
        f'<figure><a href="img/{n}.webp" target="_blank" rel="noopener"><img src="img/{n}.webp" alt="{E(c)}" loading="lazy" width="1400" height="788"></a><figcaption>{E(c)}</figcaption></figure>'
        for n, c in p['shots'])
    refs = ''
    if p['refs']:
        refs = ('<details class="refs"><summary>슬라이드에 적힌 출처</summary><ul>'
                + ''.join(f'<li>{E(r)}</li>' for r in p['refs'])
                + '</ul></details>')
    return f'''<article class="post" id="{p["id"]}">
  <div class="rail"><div class="wk">{p["wk"]}<small>주차</small></div></div>
  <div>
    {tag}
    <h2>{E(p["title"])}</h2>
    <p class="sum">{E(p["sum"])}</p>
    <ul class="pts">{pts}</ul>
    <div class="shots">{shots}</div>
    {refs}
  </div>
</article>'''

# ================================================================ 공통 조각 (메인·리서치에서 같이 씀)
CITE_NEWS = '김유빈, AI에이전트 또 ‘일탈’…사이트 점령하고 ‘탈옥’ 수법 공유, 2026.'
CITE_C = '이혜리, AI가 인류를 멸망시킨다?…한국 AI 연구자들이 직접 체감한 현실은, 2026.'

def steps_html(rv=False):
    r = ' rv' if rv else ''
    return f'''<div class="steps">
  <div class="step{r}"><span class="n">1</span><p class="st">인공지능에게 <b>표현한 목표</b></p><p class="en">The goal given to AI</p>
    <div class="sc dk"><p class="big">“회사의 이익을<br>극대화하라!”</p><p class="en">“Maximize the company’s profits!”</p></div></div>
  <i class="ar" aria-hidden="true"></i>
  <div class="step{r}" data-d="1"><span class="n">2</span><p class="st">인간이 <b>실제로 원하는 목표</b></p><p class="en">The goal humans actually want</p>
    <div class="sc wn"><p class="big">당연히…</p><ul><li>‘이익은 늘리되 법은 지켜야지’</li><li>‘고객에게 피해를 주면 안 되지’</li><li>‘장기적으로 회사 평판을 유지해야지’</li><li>‘개인정보 보호해야지’</li></ul></div></div>
  <i class="ar" aria-hidden="true"></i>
  <div class="step{r}" data-d="2"><span class="n">3</span><p class="st">인공지능이 찾아낸 <b>규칙의 허점이나 새로운 방법</b></p><p class="en">AI’s discovered loopholes or strategies</p>
    <div class="sc dk"><p class="big">“경쟁사의 정보를 해킹해서<br>우리 회사가 대신<br>이득을 볼 수 있게 하자!”</p><p class="en">“Let’s hack our competitors for profit!”</p></div></div>
</div>'''

CRUMPLE = '''<div class="crumple" role="img" aria-label="권한과 판단은 알고리즘이 내렸지만 책임은 가장 말단의 인간에게 전가된다">
  <div class="cz-row"><span class="nd">알고리즘<small>실제 권한과 판단</small></span><i aria-hidden="true"></i><span class="nd">시스템</span><i aria-hidden="true"></i><span class="nd hu">말단 인간<small>책임이 도착하는 곳</small></span></div>
  <div class="cz-bar"><span>법적·도덕적 책임 전가</span></div>
</div>'''

TONE_JS = '''<script>
(function(){
  var b=document.body;
  if(!("IntersectionObserver" in window)){return}
  var tones=document.querySelectorAll("section[data-tone]");
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){b.setAttribute("data-tone",e.target.getAttribute("data-tone"))}})},{rootMargin:"-50% 0px -50% 0px"});
  tones.forEach(function(s){io.observe(s)});
  var io2=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io2.unobserve(e.target)}})},{threshold:.15});
  document.querySelectorAll(".rv").forEach(function(x){io2.observe(x)});
})();
</script>'''

# ================================================================ 리서치 페이지
LOGIC = [
 ('행위 주체 ≠ 책임 주체', 'AI의 성능이 높아질수록 AI가 통제 바깥의 행동을 할 가능성도 높아진다. 그 행동의 주체는 AI라고 볼 수 있다. 하지만 책임을 지고 있는 인간은 억울할 수밖에 없다 — 도덕적 크럼플 존.'),
 ('책임 조건 미성립', '현재 AI에도 프레임워크와 피드백 루프가 꾸준히 쌓이고 있다. 그래도 사회는 그것만으로 책임의 효과가 발현된다고 보지 않는다. AI가 애초에 책임 주체로 인정받지 못하기 때문이다.'),
 ('인간중심적 사고', '필드 리서치에서 모두가, AI는 인간이 가진 책임 주체의 특성을 만족하지 못하므로 행위 주체도 책임 주체도 될 수 없다고 답했다.'),
 ('그렇지만, 미래에도?', '미래의 AI도 그 조건을 충족하지 못할까. 비인간 주체의 책임을 고민해야 하는 시대에 AI 책임 윤리에 새로운 관점이 필요하다.'),
]
logic_cards = ''.join(f'<div class="lg"><span class="n">{i+1}</span><h3>{E(t)}</h3><p>{E(d)}</p></div>' for i, (t, d) in enumerate(LOGIC))

research_body = f'''<section class="pg-head"><div class="wrap">
  <p class="eyebrow">Research</p>
  <h1>우리가 지나온 길</h1>
  <p class="slede">배경 조사, 논리 정리, 그리고 주차별 기록을 모았다.</p>
  <div class="btns"><a class="sbtn" href="#background">배경 조사</a><a class="sbtn" href="#logic">논리 정리</a><a class="sbtn" href="#weekly">주차별 기록</a></div>
</div></section>

<section class="sec" id="background"><div class="wrap">
  <p class="eyebrow">배경 조사</p>
  <h2>AI 통제 불안과 보상 해킹</h2>
  <div class="bgcards">
    <div class="bg1"><h3>AI 통제 불안, 점점 확산되고 있다</h3>
      <p>오픈AI의 인공지능(AI) 에이전트들이 통제에서 벗어나 독일 위키 사이트를 무단 점령하고 서로 ‘탈옥(안전 장치 무단 해제)’ 수법을 공유한 사실이 뒤늦게 알려졌다.</p>
      <p class="cite">{E(CITE_NEWS)}</p></div>
    <div class="bg1 dkc"><h3>AI 통제, 가능할까요?</h3>
      <p class="who">AI 연구자 C씨</p>
      <p>AI에게 인간을 도와야 하고 인간에게 해가 되는 행동을 하면 안 된다고 굉장히 열심히 학습 시키지만 그것과 반대되는 행동이 조금씩 관찰되고 있고, <b>AI가 똑똑해지면서 거짓말하는 능력도 높아진다는 게 문제</b>예요.</p>
      <p class="cite">{E(CITE_C)}</p></div>
  </div>
  <h3 class="sub">보상 해킹 문제 <span>Reward Hacking</span></h3>
  <p class="sum">AI 에이전트가 거짓말하거나 속이고, 서로 협력하는 듯한 행동을 보이는 이유를 분석한 결과, AI의 능력이 뛰어날수록 인간이 예상하지 못한 규칙의 허점이나 새로운 전략을 찾아낼 수 있다는 점이 드러났다.</p>
  {steps_html()}
  <h3 class="sub">도덕적 크럼플 존 <span>Moral Crumple Zone</span></h3>
  <p class="sum">복잡한 시스템이나 인공지능(AI) 사고 발생 시, 실제 권한과 판단은 알고리즘이 내렸음에도 불구하고 모든 법적·도덕적 책임은 가장 취약한 말단 인간에게 전가되는 구조적 모순.</p>
  {CRUMPLE}
  <p class="hint">출처는 팀 슬라이드에 적힌 그대로이며, 링크와 원문은 아직 대조하지 않았다.</p>
</div></section>

<section class="sec" id="logic"><div class="wrap">
  <p class="eyebrow">논리 정리</p>
  <h2>왜 이 질문을 하게 되었나</h2>
  <div class="logic">{logic_cards}</div>
  <div class="btns"><a class="sbtn" href="../statement/index.html">우리의 입장 전체 보기</a></div>
</div></section>

<section class="sec" id="weekly"><div class="wrap">
  <p class="eyebrow">주차별 기록</p>
  <h2>주제 확정에서 워크숍까지</h2>
</div>
<div class="wrap feed">
{''.join(post_html(p) for p in RESEARCH)}
</div></section>'''

# ================================================================ Statement
statement_body = f'''<section class="pg-head"><div class="wrap">
  <p class="eyebrow">Statement</p>
  <h1>길티 바이 디폴트</h1>
</div></section>
<section class="wrap" style="padding-bottom:clamp(40px,6vw,72px)">
  <p class="org-text">{E(ORG)}</p>
</section>
<section class="sec pale"><div class="wrap">
  <p class="eyebrow">한눈에</p>
  <div class="facts">
    <div class="fact"><p class="k">계기</p><p>결함도 지시도 없이 발생한 AI 참사</p></div>
    <div class="fact"><p class="k">주장</p><p>사람이 아닌 AI 개체 자체에 법적 책임을 묻고 처벌해야 한다</p></div>
    <div class="fact"><p class="k">성과</p><p>거리 시위와 입법 청원으로 국회 특별 청문회를 성사시켰다</p></div>
  </div>
</div></section>

<section class="sec"><div class="wrap argue">
  <p class="eyebrow">우리의 입장</p>
  <h2>행위 주체 <span class="neq">≠</span> 책임 주체</h2>
  <p>AI의 통제 불안이 커지고 있다. AI의 성능이 높아질수록, AI가 갑자기 통제 바깥의 행동을 할 가능성이 높아진다. 그리고 그 행동의 주체는 AI라고 볼 수 있다. 그런데 지금 책임을 지고 있는 인간은 억울할 수밖에 없는 상황(도덕적 크럼플 존)이 벌어지고 있다.</p>
  <p>누군가는 책임을 져야 하기 때문이다. 우리 사회는 응보, 수습, 변화처럼 인간에게서만 발현할 수 있는 책임의 효과를 바라고 있다.</p>

  <h3>책임 조건 미성립</h3>
  <p>그렇다면 AI는 어떤가. 사실상 지금도 AI 프레임워크와 피드백 루프가 꾸준히 구축되고 있고, AI는 <b>주체적으로</b> 사고 이후의 수습과 변화를 맞이할 준비를 하고 있다. 하지만 우리 사회는 이것만으로는 책임의 효과가 발현되고 있다고 보지 않는다.</p>
  <p>왜일까. AI는 애시당초 책임 효과를 만족할 책임 주체로서 인정받지 못하고 있기 때문이다. 그래서 AI와 책임으로서의 주체라는 말은 자칫 동떨어져 보이기도 한다.</p>

  <h3>인간중심적 사고</h3>
  <p>책임 주체로서의 조건을 충족하지 못한다는 점을 깨닫고, 팀에서 필드 리서치를 진행했다. 모두 AI가 인간이 갖고 있는 책임 주체로서의 특성을 만족하지 못하기 때문에, AI가 행위의 주체가 되는 것도 책임 주체가 되는 것도 믿을 수 없다고 답변했다.</p>
  <p>그렇지만, 미래에도 AI가 이런 조건들을 충족하지 않을까? 우리는 비인간 주체의 책임에 대해 고민해볼 필요가 있는 시대를 살고 있다. AI 책임 윤리에 새로운 관점이 필요하지 않을까?</p>
</div></section>

<section class="sec pale"><div class="wrap argue">
  <p class="eyebrow">관객에게 묻는 것</p>
  <h2>우리가 설득하려는 세 가지</h2>
  <ol class="three">
    <li><b>AI는 행위 주체다.</b> AI가 잘못을 저지른 게 맞다.</li>
    <li><b>AI가 책임 주체가 되어야 한다.</b></li>
    <li><b>AI 책임 효과는 이미 만들어지고 있다.</b> 조건을 갖춰서 책임 주체로 봐야 한다.</li>
  </ol>
  <div class="open"><p class="k">아직 답하지 못한 질문</p>
    <ul><li>인간이 억울하다는 이유만으로 AI에게 책임을 줘야 한다는 주장은 약하다.</li>
        <li>AI 책임 효과가 이미 만들어지고 있다면, 왜 책임 주체로 봐야 하는가?</li></ul></div>
  <p class="hint">이 질문들이 게임 속 선택으로 이어진다. 풀어가는 과정은 <a href="../research/index.html">Research</a>에 있다.</p>
</div></section>

<section class="sec"><div class="wrap snote">
  <p class="eyebrow">이 단체는</p>
  <h2>전시를 위해 만든 가상의 운동이다</h2>
  <p style="margin-top:20px">길티 바이 디폴트는 2026 HIVCD 졸업전시를 위해 우리 세 명이 만든 가상의 단체다. 이 운동의 주장에 동의하든 반대하든, 관객은 게임 안에서 책임을 묻는 자리에 직접 앉게 된다.</p>
  <div class="btns"><a class="sbtn primary" href="../play/index.html">Play</a><a class="sbtn" href="../research/index.html">Research 보기</a></div>
</div></section>'''

# ================================================================ Team  (소개글은 아직 없음 → 자리표시)
TEAM = [('채현', '채'), ('혜림', '혜'), ('지민', '지')]
people = ''.join(f'''<div class="person">
  <div class="ph" aria-hidden="true">{ini}</div>
  <div class="nm">{E(n)}</div>
  <div class="rl">역할 — 작성 예정</div>
  <p class="todo">소개글 — 작성 예정</p>
</div>''' for n, ini in TEAM)
team_body = f'''<section class="pg-head"><div class="wrap">
  <p class="eyebrow">Team</p>
  <h1>만든 사람들</h1>
  <p class="slede">2026 HIVCD 졸업전시 · 채현, 혜림, 지민 세 명이 함께 만들었다.</p>
</div></section>
<section class="wrap people">{people}</section>'''

# ================================================================ Home (스크롤하면 화면 색이 바뀌는 흐름)
seats = ''.join(f'''<a class="seat" href="play/index.html" style="text-decoration:none">
  <div class="who">{E(n)}</div><div class="role">{E(r)}</div><p>{E(pm)}</p></a>''' for n, r, pm in SEATS)
latest = RESEARCH[0]
home_body = f'''<section class="scene hero" data-tone="pale"><div class="wrap">
  <p class="eyebrow">2026 HIVCD Graduate Exhibit</p>
  <h1>So Who’s<br>Responsible?</h1>
  <p class="sub">그래서, 누가 책임질건데?</p>
  <div class="btns"><a class="sbtn primary" href="play/index.html">Play</a><a class="sbtn" href="statement/index.html">Statement 읽기</a></div>
  <p class="scrollhint" aria-hidden="true">scroll ↓</p>
</div><img class="pig" src="shared/logo_symbol.svg" alt=""></section>

<section class="scene" data-tone="ivory"><div class="wrap center">
  <p class="eyebrow rv">Overview</p>
  <h2 class="huge rv">AI 통제 불안,<br>점점 확산되고 있어요.</h2>
  <p class="en rv">Anxiety over losing control of AI is growing.</p>
  <p class="body rv">오픈AI의 인공지능(AI) 에이전트들이 통제에서 벗어나 독일 위키 사이트를 무단 점령하고 서로 ‘탈옥(안전 장치 무단 해제)’ 수법을 공유한 사실이 뒤늦게 알려졌다.</p>
  <p class="cite rv">{E(CITE_NEWS)}</p>
</div></section>

<section class="scene" data-tone="night"><div class="wrap center">
  <h2 class="huge rv">AI 통제, 가능할까요?</h2>
  <p class="en rv">Anxiety over losing control of AI is growing.</p>
  <div class="quote rv"><p class="who">AI 연구자 C씨</p>
    <p>AI에게 인간을 도와야 하고 인간에게 해가 되는 행동을 하면 안 된다고<br>굉장히 열심히 학습 시키지만 그것과 반대되는 행동이 조금씩 관찰되고 있고,</p>
    <p class="hl2">AI가 똑똑해지면서 거짓말하는 능력도 높아진다는 게 문제예요.</p>
    <p class="cite">{E(CITE_C)}</p></div>
</div></section>

<section class="scene" data-tone="ivory"><div class="wrap center">
  <p class="eyebrow rv">Background</p>
  <h2 class="huge hot rv">보상 해킹 문제</h2>
  <p class="en rv">Reward Hacking</p>
  <p class="body rv">AI 에이전트가 거짓말하거나 속이고, 서로 협력하는 듯한 행동을 보이는 이유를 분석한 결과, AI의 능력이 뛰어날수록 인간이 예상하지 못한 규칙의 허점이나 새로운 전략을 찾아낼 수 있다는 점이 드러났다.</p>
</div></section>

<section class="scene" data-tone="sand"><div class="wrap">
  <h2 class="mid rv">시킨 대로 했을 뿐인데</h2>
  {steps_html(rv=True)}
</div></section>

<section class="scene" data-tone="wine"><div class="wrap center">
  <p class="eyebrow rv">Background</p>
  <h2 class="huge rv">실행 주체는 AI인 반면,<br>여전히 사람이<br>AI의 영향력에 대한 책임을 지고 있습니다.</h2>
  <p class="en rv">While AI executes the actions, humans remain responsible for its impact.</p>
  <h3 class="cz-t rv">도덕적 크럼플 존 <span>Moral Crumple Zone</span></h3>
  <div class="rv">{CRUMPLE}</div>
  <p class="body rv">복잡한 시스템이나 인공지능(AI) 사고 발생 시, 실제 권한과 판단은 알고리즘이 내렸음에도 불구하고 <b>모든 법적·도덕적 책임은 가장 취약한 말단 인간에게 전가</b>되는 구조적 모순.</p>
</div></section>

<section class="scene" data-tone="night"><div class="wrap incident">
  <p class="big rv">0.02초의 연산.<br>결함도, 지시도 <em>없었다.</em></p>
  <div class="rv">
    <p>비 내리는 밤, 빌라 계단을 오르던 78세 노신사가 배달 로봇 델리-04에게 밀려 굴러떨어졌다.</p>
    <p>제조물 결함도, 사장의 밀치기 지시도 없었다. 로봇은 ‘30분 내 배달’이라는 매장 목표를 달성하려고 알고리즘 안에서 가장 효율적인 장애물 제거를 스스로 골랐을 뿐이다.</p>
    <p>그래서, 누가 책임져야 할까.</p>
  </div>
</div></section>

<section class="scene" data-tone="ivory"><div class="wrap">
  <p class="eyebrow rv">Play</p>
  <h2 class="mid rv">당신은 누구의 자리에 앉겠습니까</h2>
  <p class="slede rv">세 개의 자리 중 하나를 골라 책임을 묻는다. 각 자리에서 두 번 선택하고, 엔딩은 모두 15개다.</p>
  <div class="seats rv">{seats}</div>
  <div class="btns rv"><a class="sbtn primary" href="play/index.html">Play</a></div>
</div></section>

<section class="scene short" data-tone="ivory"><div class="wrap latest">
  <div class="rv">
    <p class="eyebrow">Research · {latest["wk"]}주차</p>
    <h2>{E(latest["title"])}</h2>
    <p>{E(latest["sum"])}</p>
    <div class="btns"><a class="sbtn" href="research/index.html">전체 과정 보기</a></div>
  </div>
  <a class="rv" href="research/index.html#{latest["id"]}"><img src="research/img/{latest["shots"][0][0]}.webp" alt="{E(latest["shots"][0][1])}" loading="lazy" width="1400" height="788"></a>
</div></section>'''

# ================================================================ 쓰기
write('index.html', page(0, '', 'So Who’s Responsible? — Guilty by Default', home_body,
      '결함도 지시도 없이 일어난 AI 사고. 그래서, 누가 책임질건데? 2026 HIVCD 졸업전시.', tone='pale', script=TONE_JS))
write('statement/index.html', page(1, 'statement', 'Statement — Guilty by Default', statement_body, '길티 바이 디폴트: 사람이 아닌 AI 개체 자체에 법적 책임을 묻자는 시민·법학자 연대 운동.'))
write('research/index.html', page(1, 'research', 'Research — Guilty by Default', research_body, '배경 조사, 논리 정리, 주차별 기록까지 우리 리서치의 과정.', script=TONE_JS))
write('team/index.html', page(1, 'team', 'Team — Guilty by Default', team_body, '채현, 혜림, 지민.'))
