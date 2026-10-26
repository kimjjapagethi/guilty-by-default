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

function yn(v) { return v === 'yes' || v === 'no'; }
function clean(b) {
  if (!b || typeof b !== 'object') return null;
  var a = b.ans || {}, e = b.e || {};
  for (var k = 0; k <= 4; k++) if (!yn(a[k])) return null;
  for (var j = 1; j <= 3; j++) if (e[j] !== 'a' && e[j] !== 'b') return null;
  if (!yn(b.last) || !yn(b.cross)) return null;
  if (![0, 1, 2].includes(b.a)) return null;
  var sid = String(b.sid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  if (!sid) return null;
  return { sid: sid, t: Date.now(), src: b.src === 'kiosk' ? 'kiosk' : 'browser', test: !!b.test,
    ans: { 0: a[0], 1: a[1], 2: a[2], 3: a[3], 4: a[4] }, a: b.a, last: b.last, e: { 1: e[1], 2: e[2], 3: e[3] }, cross: b.cross };
}
function flip(p) { for (var k = 2; k <= 4; k++) if (p.ans[k] !== p.ans[1]) return k; return 0; }

function stats() {
  var L = plays.filter(function (p) { return !p.test; }), n = L.length;
  var r = { mode: MODE, n: n, ready: n >= MIN_N, min: MIN_N };
  if (!r.ready) return r;
  r.sanction = [0, 1, 2, 3, 4].map(function (k) { return L.filter(function (p) { return p.ans[k] === 'yes'; }).length / n; });
  var f = { 0: 0, 2: 0, 3: 0, 4: 0 }; L.forEach(function (p) { f[flip(p)]++; });
  r.flip = { none: f[0] / n, 2: f[2] / n, 3: f[3] / n, 4: f[4] / n };
  r.lever = [0, 1, 2].map(function (v) { return L.filter(function (p) { return p.a === v; }).length / n; });
  r.lastYes = L.filter(function (p) { return p.last === 'yes'; }).length / n;
  r.aiYes = L.filter(function (p) { return p.cross === 'yes'; }).length / n;
  r.aiDiffers = L.filter(function (p) { return (p.cross === 'yes') !== (p.ans[3] === 'yes'); }).length / n;
  r.blamePig = L.filter(function (p) { return p.e[1] === 'a'; }).length / n;
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
var TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.json': 'application/json' };

http.createServer(function (req, res) {
  var u = new URL(req.url, 'http://x'), ip = req.socket.remoteAddress || '';
  if (u.pathname === '/api/config') return json(res, 200, { mode: MODE });
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
      broadcast({ type: 'play', flip: flip(p), a: p.a, last: p.last, test: p.test, stats: stats() });
    });
  }
  if (u.pathname === '/api/progress' && req.method === 'POST') {
    if (limited(ip, 'prog', 150)) return json(res, 429, { ok: false });
    return body(req, function (b) {
      if (b && typeof b.step === 'string') broadcast({ type: 'progress', step: b.step.slice(0, 12), ans: yn(b.ans) ? b.ans : null });
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
  var rel = u.pathname === '/' ? '/index.html' : u.pathname === '/side' ? '/side.html' : decodeURIComponent(u.pathname);
  var file = path.normalize(path.join(PUBLIC, rel));
  if (file.indexOf(PUBLIC) !== 0) { res.writeHead(403); return res.end(); }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(PORT, function () {
  console.log('[Guilty by Default] MODE=' + MODE + '  http://localhost:' + PORT + '  (옆 화면: /side)');
  console.log('저장 파일: ' + LOG + '  (현재 ' + plays.length + '건)');
  console.log('관리 토큰: ' + ADMIN_TOKEN + (process.env.ADMIN_TOKEN ? '' : '  (환경변수 ADMIN_TOKEN 으로 고정 가능)'));
});
