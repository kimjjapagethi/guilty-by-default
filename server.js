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
var LOG = path.join(DATA_DIR, 'plays-' + MODE + '.jsonl');
var MIN_N = 20; /* 이 수 미만이면 퍼센트를 보여 주지 않는다 */
fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---------- storage: append-only JSON lines, kept in memory for stats ---------- */
var plays = [];
try {
  fs.readFileSync(LOG, 'utf8').split('\n').forEach(function (l) { if (l.trim()) { try { plays.push(JSON.parse(l)); } catch (e) {} } });
} catch (e) {}
var seen = {}; plays.forEach(function (p) { seen[p.sid] = 1; });

function pick(v, ok) { return ok.indexOf(v) >= 0 ? v : null; }
function clean(b) {
  if (!b || typeof b !== 'object') return null;
  var feel = pick(b.feel, ['ease', 'anx']), guilt = pick(b.guilt, ['yes', 'no']), burden = pick(b.burden, ['yes', 'no']), fin = pick(b.final, ['withdraw', 'build']), method = cleanMethod(b.method);
  if (!feel || !guilt || !burden) return null;
  var sid = String(b.sid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  if (!sid) return null;
  return { sid: sid, t: Date.now(), src: b.src === 'kiosk' ? 'kiosk' : 'browser', test: !!b.test, feel: feel, guilt: guilt, burden: burden, method: method, final: fin };
}
function cleanMethod(m) {
  if (m === 'none') return 'none';
  if (typeof m !== 'string') return null;
  var out = ['retr', 'det', 'corr'].filter(function (k) { return m.split('+').indexOf(k) >= 0; });
  return out.length ? out.join('+') : null;
}
function typ(p) { return (p.guilt === 'yes' ? 'O' : 'X') + (p.burden === 'yes' ? 'O' : 'X'); } /* 귀책 x 감당 */

function stats() {
  var L = plays.filter(function (p) { return !p.test; }), n = L.length;
  var r = { mode: MODE, n: n, ready: n >= MIN_N, min: MIN_N };
  if (!r.ready) return r;
  var share = function (f) { return L.filter(f).length / n; };
  r.feelEase = share(function (p) { return p.feel === 'ease'; });
  r.guiltYes = share(function (p) { return p.guilt === 'yes'; });
  r.burdenYes = share(function (p) { return p.burden === 'yes'; });
  r.types = { OO: 0, OX: 0, XO: 0, XX: 0 };
  ['OO', 'OX', 'XO', 'XX'].forEach(function (t) { r.types[t] = share(function (p) { return typ(p) === t; }); });
  r.final = { withdraw: share(function (p) { return p.final === 'withdraw'; }), build: share(function (p) { return p.final === 'build'; }) };
  r.method = { retr: 0, det: 0, corr: 0, none: 0 };
  ['retr', 'det', 'corr', 'none'].forEach(function (m) { r.method[m] = share(function (p) { return p.method === m || (typeof p.method === 'string' && p.method.split('+').indexOf(m) >= 0); }); });
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
function body(req, cb) {
  var d = '';
  req.on('data', function (c) { d += c; if (d.length > 20000) { req.destroy(); } });
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
      broadcast({ type: 'play', kind: typ(p), method: p.method, test: p.test, stats: stats() });
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
  var rel = u.pathname === '/' ? '/index.html' : u.pathname === '/side' ? '/side.html' : u.pathname === '/design' ? '/design.html' : decodeURIComponent(u.pathname);
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
  console.log('[Guilty by Default] MODE=' + MODE + '  http://localhost:' + PORT + '  (옆 화면: /side)');
  console.log('저장 파일: ' + LOG + '  (현재 ' + plays.length + '건)');
  console.log('관리 토큰: ' + ADMIN_TOKEN + (process.env.ADMIN_TOKEN ? '' : '  (환경변수 ADMIN_TOKEN 으로 고정 가능)'));
});
