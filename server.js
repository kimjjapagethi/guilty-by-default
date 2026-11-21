/* Guilty by Default — 전시/웹 공용 서버 (의존성 없음, Node 18+)
 *  MODE=exhibit  전시장 PC에서 실행 (게임 + 옆 화면 + 로컬 저장)
 *  MODE=web      인터넷에 올리는 집에서 하는 버전
 *  PORT, DATA_DIR, ADMIN_TOKEN 은 환경변수로 지정
 */
'use strict';
var http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');

var MODE = process.env.MODE === 'web' ? 'web' : 'exhibit';
var PORT = +process.env.PORT || 3000;
var DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
var ADMIN_TOKEN = process.env.ADMIN_TOKEN || crypto.randomBytes(6).toString('hex');
var PUBLIC = path.join(__dirname, 'public');
var LOG = path.join(DATA_DIR, 'plays3-' + MODE + '.jsonl');
var MIN_N = 20, MIN_C = 5; /* 전체 N 미만이면 퍼센트를 보여 주지 않는다. 인물별 퍼센트는 그 인물 플레이가 MIN_C 이상일 때만 */
fs.mkdirSync(DATA_DIR, { recursive: true });

/* 엔딩 15개: 인물 A(유족) · B(피자 가게 사장) · C(대통령) 각 5개. ENDS[ch*5 + k] */
var ENDS = ['A-1', 'A-2', 'A-3', 'A-4', 'A-5', 'B-1', 'B-2', 'B-3', 'B-4', 'B-5', 'C-1', 'C-2', 'C-3', 'C-4', 'C-5'];

/* ---------- storage: append-only JSON lines, kept in memory for stats ---------- */
var plays = [];
try {
  fs.readFileSync(LOG, 'utf8').split('\n').forEach(function (l) { if (l.trim()) { try { plays.push(JSON.parse(l)); } catch (e) {} } });
} catch (e) {}
plays = plays.filter(function (p) { return ENDS.indexOf(p.ending) >= 0; }); /* 옛 구조의 기록은 무시 */
var seen = {}; plays.forEach(function (p) { seen[p.sid] = 1; });

function int(v, max) { v = +v; return v === Math.floor(v) && v >= 0 && v < max ? v : null; }
function clean(b) { /* 한 판: 인물(ch 0~2) / 선택1(c1 0~2) / 선택2(c2 0~2) / 엔딩(그 인물의 5개 중 하나) */
  if (!b || typeof b !== 'object') return null;
  var ch = int(b.ch, 3), c1 = int(b.c1, 3), c2 = int(b.c2, 3), ei = ENDS.indexOf(b.ending);
  if (ch === null || c1 === null || c2 === null || ei < 0 || Math.floor(ei / 5) !== ch) return null;
  var sid = String(b.sid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  if (!sid) return null;
  return { sid: sid, t: Date.now(), src: b.src === 'kiosk' ? 'kiosk' : 'browser', test: !!b.test, ch: ch, c1: c1, c2: c2, ending: ENDS[ei] };
}

function stats() {
  var L = plays.filter(function (p) { return !p.test; }), n = L.length;
  var r = { mode: MODE, n: n, ready: n >= MIN_N, min: MIN_N, minChar: MIN_C };
  var cnt = function (arr, f) { return arr.filter(f).length; };
  r.byChar = [0, 1, 2].map(function (i) { return cnt(L, function (p) { return p.ch === i; }); }); /* 인원수는 퍼센트가 아니므로 항상 공개 */
  if (!r.ready) return r;
  /* 인물별 분포: 그 인물을 플레이한 사람 안에서의 비율 (MIN_C 미만이면 null) */
  r.chEnding = []; r.c1 = []; r.c2 = [];
  [0, 1, 2].forEach(function (i) {
    var M = L.filter(function (p) { return p.ch === i; }), m = M.length;
    if (m < MIN_C) { r.chEnding.push(null); r.c1.push(null); r.c2.push(null); return; }
    r.chEnding.push(ENDS.slice(i * 5, i * 5 + 5).map(function (e) { return cnt(M, function (p) { return p.ending === e; }) / m; }));
    r.c1.push([0, 1, 2].map(function (k) { return cnt(M, function (p) { return p.c1 === k; }) / m; }));
    r.c2.push([0, 1, 2].map(function (k) { return cnt(M, function (p) { return p.c2 === k; }) / m; }));
  });
  return r;
}

/* ---------- live stream (SSE) for the side screen ---------- */
var clients = [];
function broadcast(obj) { var s = 'data: ' + JSON.stringify(obj) + '\n\n'; clients.forEach(function (c) { try { c.write(s); } catch (e) {} }); }
setInterval(function () { clients.forEach(function (c) { try { c.write(': ping\n\n'); } catch (e) {} }); }, 20000);

/* ---------- tiny per-IP rate limit ---------- */
var hits = {};
function limited(ip, key, ms) { var k = ip + key, t = Date.now(); if (hits[k] && t - hits[k] < ms) return true; hits[k] = t; return false; }
setInterval(function () { hits = {}; }, 600000);

function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
function body(req, cb, max) {
  var d = '';
  req.on('data', function (c) { d += c; if (d.length > (max || 20000)) { req.destroy(); } });
  req.on('end', function () { try { cb(JSON.parse(d || '{}')); } catch (e) { cb(null); } });
}
var TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.woff': 'font/woff', '.otf': 'font/otf', '.ttf': 'font/ttf', '.gif': 'image/gif', '.webm': 'video/webm', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };

http.createServer(function (req, res) {
  var u = new URL(req.url, 'http://x'), ip = req.socket.remoteAddress || '';
  if (u.pathname === '/api/config') return json(res, 200, { mode: MODE });
  if (u.pathname === '/api/attract') { /* public/attract 폴더의 이미지를 이름순(숫자 인식)으로 나열. config.json: {"fps":4,"mode":"flipbook"|"fade","hold":3} */
    var dir = path.join(PUBLIC, 'attract'), files = [], cfg = {};
    try { files = fs.readdirSync(dir).filter(function (f) { return /\.(png|jpe?g|webp|gif|svg)$/i.test(f) && f[0] !== '.'; }).sort(function (a, b) { return a.localeCompare(b, 'en', { numeric: true }); }); } catch (e) {}
    try { cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')); } catch (e) {}
    var video = ['attract/opening_pig.mp4', 'opening_pig.mp4'].filter(function (f) { return fs.existsSync(path.join(PUBLIC, f)) || fs.existsSync(path.join(__dirname, f)); })[0] || null;
    var vector = fs.existsSync(path.join(dir, 'pig-vector.json')) ? 'attract/pig-vector.json' : null;
    return json(res, 200, { vector: vector, video: video, files: files, fps: cfg.fps, mode: cfg.mode, hold: cfg.hold });
  }
  if (u.pathname === '/api/stats') return json(res, 200, stats());
  if (u.pathname === '/api/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write('data: ' + JSON.stringify({ type: 'stats', stats: stats() }) + '\n\n');
    clients.push(res); req.on('close', function () { clients = clients.filter(function (c) { return c !== res; }); });
    return;
  }
  if (u.pathname === '/api/play' && req.method === 'POST') {
    if (MODE === 'web' && limited(ip, 'play', 3000)) return json(res, 429, { ok: false });
    return body(req, function (b) {
      var p = clean(b); if (!p) return json(res, 400, { ok: false });
      if (seen[p.sid]) return json(res, 200, { ok: true, dup: true });
      seen[p.sid] = 1; plays.push(p);
      try { fs.appendFileSync(LOG, JSON.stringify(p) + '\n'); } catch (e) { console.error('write failed', e.message); }
      json(res, 200, { ok: true });
      broadcast({ type: 'play', ending: p.ending, ch: p.ch, test: p.test, stats: stats() });
    });
  }
  if (u.pathname === '/api/script' && req.method === 'POST') { /* 스크립트 편집기(editor.html) 저장 — 공개(web) 모드에서는 막는다 */
    if (MODE === 'web') return json(res, 403, { ok: false });
    return body(req, function (b) {
      var okS = b && Array.isArray(b.chars) && b.chars.length === 3 && Array.isArray(b.opening) && b.chars.every(function (c) { return c && Array.isArray(c.endings) && c.endings.length === 5 && Array.isArray(c.map) && c.map.length === 3 && Array.isArray(c.intro) && Array.isArray(c.after1) && c.after1.length === 3 && Array.isArray(c.mid) && c.c1 && c.c2; });
      if (!okS) return json(res, 400, { ok: false, msg: '구조가 맞지 않습니다' });
      var f = path.join(PUBLIC, 'script.json');
      try { if (fs.existsSync(f)) fs.copyFileSync(f, path.join(PUBLIC, 'script.prev.json')); fs.writeFileSync(f + '.tmp', JSON.stringify(b, null, 1)); fs.renameSync(f + '.tmp', f); } catch (e) { return json(res, 500, { ok: false }); }
      console.log('[script] script.json 저장됨'); json(res, 200, { ok: true });
    }, 2000000);
  }
  if (u.pathname === '/api/scene-image' && req.method === 'POST') { /* 편집기에서 스토리보드 이미지 올리기 → public/scenes/<컷번호>.<확장자> */
    if (MODE === 'web') return json(res, 403, { ok: false });
    var nm = String(u.searchParams.get('id') || '').replace(/[^a-zA-Z0-9_-]/g, ''), ct = String(req.headers['content-type'] || '');
    var ext = /png/.test(ct) ? 'png' : /jpe?g/.test(ct) ? 'jpg' : /webp/.test(ct) ? 'webp' : null;
    if (!nm || !ext) return json(res, 400, { ok: false, msg: 'png/jpg/webp 만 올릴 수 있습니다' });
    var chunks = [], size = 0;
    req.on('data', function (c) { size += c.length; if (size > 25e6) req.destroy(); else chunks.push(c); });
    return req.on('end', function () {
      try {
        var dir = path.join(PUBLIC, 'scenes'); fs.mkdirSync(dir, { recursive: true });
        ['png', 'jpg', 'webp'].forEach(function (e) { if (e !== ext) try { fs.unlinkSync(path.join(dir, nm + '.' + e)); } catch (x) {} });
        fs.writeFileSync(path.join(dir, nm + '.' + ext), Buffer.concat(chunks));
      } catch (e) { return json(res, 500, { ok: false }); }
      json(res, 200, { ok: true, url: 'scenes/' + nm + '.' + ext });
    });
  }
  if (u.pathname === '/api/progress' && req.method === 'POST') {
    if (limited(ip, 'prog', 150)) return json(res, 429, { ok: false });
    return body(req, function (b) {
      if (b && typeof b.step === 'string') broadcast({ type: 'progress', step: b.step.slice(0, 12), ans: typeof b.ans === 'string' ? b.ans.slice(0, 12) : null });
      json(res, 200, { ok: true });
    });
  }
  if (u.pathname.indexOf('/api/admin/') === 0) {
    if (u.searchParams.get('token') !== ADMIN_TOKEN) return json(res, 403, { ok: false });
    if (u.pathname === '/api/admin/export') { res.writeHead(200, { 'Content-Type': 'application/x-ndjson' }); return res.end(plays.map(function (p) { return JSON.stringify(p); }).join('\n')); }
    if (u.pathname === '/api/admin/clear-test') { plays = plays.filter(function (p) { return !p.test; }); fs.writeFileSync(LOG, plays.map(function (p) { return JSON.stringify(p); }).join('\n') + (plays.length ? '\n' : '')); broadcast({ type: 'stats', stats: stats() }); return json(res, 200, { ok: true, left: plays.length }); }
    if (u.pathname === '/api/admin/archive-reset') { try { fs.renameSync(LOG, LOG.replace('.jsonl', '-' + Date.now() + '.bak.jsonl')); } catch (e) {} plays = []; seen = {}; broadcast({ type: 'stats', stats: stats() }); return json(res, 200, { ok: true }); }
    return json(res, 404, { ok: false });
  }
  /* static */
  var rel = u.pathname === '/' ? '/index.html' : u.pathname === '/side' ? '/side.html' : u.pathname === '/design' ? '/design.html' : u.pathname === '/editor' ? '/editor.html' : decodeURIComponent(u.pathname);
  var file = path.normalize(path.join(PUBLIC, rel));
  if (file.indexOf(PUBLIC) !== 0) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) && path.basename(file) === 'opening_pig.mp4') file = path.join(__dirname, 'opening_pig.mp4'); /* 프로젝트 폴더 바로 아래에 둬도 됨 */
  fs.stat(file, function (err, st) {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    var type = TYPES[path.extname(file)] || 'application/octet-stream', range = req.headers.range;
    if (range && /^bytes=/.test(range)) { /* 영상 반복 재생을 위해 Range 요청 지원 */
      var m = /bytes=(\d*)-(\d*)/.exec(range), start = m[1] ? +m[1] : 0, end = m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
      if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': 'bytes ' + start + '-' + end + '/' + st.size, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start: start, end: end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, function () {
  console.log('[Guilty by Default] MODE=' + MODE + '  http://localhost:' + PORT + '  (옆 화면: /side · 스크립트 편집기: /editor)');
  console.log('저장 파일: ' + LOG + '  (현재 ' + plays.length + '건)');
  console.log('관리 토큰: ' + ADMIN_TOKEN + (process.env.ADMIN_TOKEN ? '' : '  (환경변수 ADMIN_TOKEN 으로 고정 가능)'));
});
