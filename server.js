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
var LOG = path.join(DATA_DIR, 'plays2-' + MODE + '.jsonl');
var MIN_N = 20; /* 이 수 미만이면 퍼센트를 보여 주지 않는다 */
fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---------- storage: append-only JSON lines, kept in memory for stats ---------- */
var plays = [];
try {
  fs.readFileSync(LOG, 'utf8').split('\n').forEach(function (l) { if (l.trim()) { try { plays.push(JSON.parse(l)); } catch (e) {} } });
} catch (e) {}
var seen = {}; plays.forEach(function (p) { seen[p.sid] = 1; });

var ENDS = ['E1', 'E2', 'E3', 'E4', 'E5'], VAL = ['M', 'T', 'P'], LIAB = ['AI', '인간', '공동'];
function int(v, max) { v = +v; return v === Math.floor(v) && v >= 0 && v < max ? v : null; }
function clean(b) { /* v3 게임 한 판: 인물(ch) / 작은 선택(mc) / 선택1(c1) / 선택2(c2) / 근거 약함(weak) / 엔딩 */
  if (!b || typeof b !== 'object') return null;
  var ch = int(b.ch, 3), mc = int(b.mc, 2), c1 = int(b.c1, 3), c2 = int(b.c2, 3), end = ENDS.indexOf(b.ending) >= 0 ? b.ending : null;
  if (ch === null || mc === null || c1 === null || c2 === null || !end) return null;
  var sid = String(b.sid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  if (!sid) return null;
  return { sid: sid, t: Date.now(), src: b.src === 'kiosk' ? 'kiosk' : 'browser', test: !!b.test, ch: ch, mc: mc, c1: c1, c2: c2, weak: !!b.weak, ending: end };
}

function stats() {
  var L = plays.filter(function (p) { return !p.test; }), n = L.length;
  var r = { mode: MODE, n: n, ready: n >= MIN_N, min: MIN_N };
  var cnt = function (f) { return L.filter(f).length; };
  r.byChar = [0, 1, 2].map(function (i) { return cnt(function (p) { return p.ch === i; }); }); /* 인원수는 퍼센트가 아니므로 항상 공개 */
  if (!r.ready) return r;
  var share = function (f) { return cnt(f) / n; };
  r.ending = {}; ENDS.forEach(function (e) { r.ending[e] = share(function (p) { return p.ending === e; }); });
  r.value = {}; VAL.forEach(function (v, i) { r.value[v] = share(function (p) { return p.c1 === i; }); });
  r.liab = {}; LIAB.forEach(function (v, i) { r.liab[v] = share(function (p) { return p.c2 === i; }); });
  r.weak = share(function (p) { return p.weak; });
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
  if (u.pathname === '/api/cues' && req.method === 'POST') { /* 자막 타이밍 에디터(cue-editor.html) 저장 — 공개(web) 모드에서는 막는다 */
    if (MODE === 'web') return json(res, 403, { ok: false });
    return body(req, function (b) {
      if (!b || !Array.isArray(b.cues) || !b.cues.length || b.cues.length > 40) return json(res, 400, { ok: false });
      var ok = b.cues.every(function (c) { return c && typeof c.step === 'string' && /^[a-z0-9]{2,6}$/.test(c.step) && typeof c.t === 'number' && isFinite(c.t) && (c.c === 0 || c.c === 1); });
      if (!ok) return json(res, 400, { ok: false });
      var num = function (n, d) { return typeof n === 'number' && isFinite(n) ? n : d; };
      var clips = Array.isArray(b.clips) ? b.clips.slice(0, 2).map(function (c) { c = c || {}; return { end: num(c.end, 0) > 0 ? c.end : null, x: Math.max(0, Math.min(100, num(c.x, 50))), y: Math.max(0, Math.min(100, num(c.y, 50))), z: Math.max(1, Math.min(3, num(c.z, 1))), sp: (Array.isArray(c.sp) ? c.sp : []).slice(0, 24).map(function (q) { q = q || {}; return { a: Math.max(0, num(q.a, 0)), b: Math.max(0, num(q.b, 0)), r: Math.max(0.1, Math.min(4, num(q.r, 1))) }; }).filter(function (q) { return q.b > q.a; }) }; }) : undefined;
      var out = { hold: typeof b.hold === 'number' && b.hold >= 0 ? b.hold : 0, clips: clips, cues: b.cues.map(function (c) { return { step: c.step, c: c.c, t: c.t }; }) };
      try { fs.mkdirSync(path.join(PUBLIC, 'media'), { recursive: true }); fs.writeFileSync(path.join(PUBLIC, 'media', 'n1_cues.json'), JSON.stringify(out, null, 2)); } catch (e) { return json(res, 500, { ok: false }); }
      console.log('[cues] n1_cues.json 저장됨 (' + out.cues.length + '개 자막)');
      json(res, 200, { ok: true });
    });
  }
  if (u.pathname === '/api/script' && req.method === 'POST') { /* 스크립트 편집기(editor.html) 저장 — 공개(web) 모드에서는 막는다 */
    if (MODE === 'web') return json(res, 403, { ok: false });
    return body(req, function (b) {
      if (!b || !Array.isArray(b.chars) || b.chars.length !== 3 || !Array.isArray(b.endings) || b.endings.length !== 5 || !Array.isArray(b.opening)) return json(res, 400, { ok: false, msg: '구조가 맞지 않습니다' });
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
