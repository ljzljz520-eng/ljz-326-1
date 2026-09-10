'use strict';

/**
 * 星尘公会 · 招募站服务器
 * 零依赖：静态文件 + JSON API + JSON 文件持久化
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'applications.json');
const SECRET_FILE = path.join(DATA_DIR, 'admin-secret.json');

const CLASSES = ['warrior', 'mage', 'archer', 'priest', 'rogue', 'summoner'];
const TIME_SLOTS = ['wd-morning', 'wd-afternoon', 'wd-night', 'wd-late', 'we-day', 'we-night'];
const NAME_RE = /^[一-龥A-Za-z0-9·_\-]{2,16}$/;
const INTRO_MIN = 20;
const INTRO_MAX = 500;
const NOTE_MAX = 200;
const TOKEN_TTL = 2 * 60 * 60 * 1000; // 管理端令牌 2 小时（滑动续期）

/* ---------------- 数据存储（JSON 文件，原子写入） ---------------- */

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadDB() {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) return { seq: 1000, items: [] };
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!Array.isArray(db.items)) db.items = [];
    if (typeof db.seq !== 'number') db.seq = 1000;
    return db;
  } catch (e) {
    const bak = DB_FILE + '.broken-' + Date.now();
    try { fs.copyFileSync(DB_FILE, bak); } catch (_) {}
    console.error('[db] applications.json 损坏，已备份为 ' + path.basename(bak) + ' 并重新初始化');
    return { seq: 1000, items: [] };
  }
}

const db = loadDB();

function saveDB() {
  ensureDataDir();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE); // 原子替换，避免写一半损坏
}

// 首次启动写入示例申请，方便立刻体验审核流程
function migrateDB() {
  // 旧数据没有查询码：为历史申请补签，保证状态查询鉴权一致
  let changed = false;
  for (const it of db.items) {
    if (typeof it.queryToken !== 'string' || it.queryToken.length < 16) {
      it.queryToken = crypto.randomBytes(16).toString('hex');
      changed = true;
    }
  }
  if (changed) saveDB();
}
migrateDB();

// 首次启动写入示例申请，方便立刻体验审核流程
function seedIfEmpty() {
  if (db.items.length > 0) return;
  const now = Date.now();
  const H = 3600 * 1000;
  const D = 24 * H;
  const samples = [
    { characterName: '月见里', classId: 'mage', timeSlots: ['wd-night', 'we-night'], status: 'pending', age: -2 * H,
      intro: '主玩法师八年，上版本团本 WCL 橙分。想找个氛围好、不强制社交的公会稳定开荒，可接受试训，语音可上。' },
    { characterName: '铁头娃', classId: 'warrior', timeSlots: ['wd-night', 'wd-late'], status: 'pending', age: -26 * H,
      intro: '主T，装等 535，之前的公会解散了。时间稳定、脾气好，希望能跟进度团，也可以顺手带新人打低保。' },
    { characterName: '奶糖布丁', classId: 'priest', timeSlots: ['we-day', 'we-night'], status: 'pending', age: -50 * H,
      intro: '休闲玩家，主玩治疗，喜欢钓鱼和截图。想参加周末活动，平时晚上偶尔在线，求收留～' },
    { characterName: '影之歌', classId: 'rogue', timeSlots: ['wd-afternoon', 'wd-night'], status: 'approved', age: -4 * D,
      note: '欢迎回归！已邀请进会，记得加群。',
      intro: '回归玩家，老版本全通经验，这版本刚满级，装等 522 正在追赶。希望从见习成员做起，出勤可以保证。' }
  ];
  for (const s of samples) {
    db.items.push({
      id: 'A' + (++db.seq),
      characterName: s.characterName,
      classId: s.classId,
      timeSlots: s.timeSlots,
      intro: s.intro,
      status: s.status,
      note: s.note || '',
      queryToken: crypto.randomBytes(16).toString('hex'),
      createdAt: new Date(now + s.age).toISOString(),
      reviewedAt: s.status === 'pending' ? null : new Date(now + s.age + 5 * H).toISOString()
    });
  }
  saveDB();
  console.log('[db] 已写入 ' + samples.length + ' 条示例申请（删除 data/applications.json 可重置）');
}

/* ---------------- 管理密码 ---------------- */

function loadAdminPassword() {
  if (process.env.ADMIN_PASSWORD) return { password: process.env.ADMIN_PASSWORD, generated: false };
  ensureDataDir();
  try {
    const s = JSON.parse(fs.readFileSync(SECRET_FILE, 'utf8'));
    if (s && typeof s.password === 'string' && s.password.length >= 6) {
      return { password: s.password, generated: true };
    }
  } catch (_) {}
  const password = crypto.randomBytes(4).toString('hex');
  fs.writeFileSync(SECRET_FILE, JSON.stringify({
    password,
    note: '本地演示管理密码。生产环境请使用环境变量 ADMIN_PASSWORD 覆盖，并删除本文件。'
  }, null, 2));
  return { password, generated: true };
}

const adminAuth = loadAdminPassword();

/* ---------------- 会话与限流 ---------------- */

const sessions = new Map(); // token -> expiresAt
const buckets = new Map();  // key -> [timestamps]

function issueToken() {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, Date.now() + TOKEN_TTL);
  return token;
}

function bearerToken(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : '';
}

function isAuthed(req) {
  const token = bearerToken(req);
  const exp = token && sessions.get(token);
  if (!exp) return false;
  if (Date.now() > exp) { sessions.delete(token); return false; }
  sessions.set(token, Date.now() + TOKEN_TTL); // 滑动续期
  return true;
}

function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter(t => now - t < windowMs);
  if (arr.length >= limit) { buckets.set(key, arr); return false; }
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

// 定期清理过期数据，避免内存泄漏
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of buckets) {
    const kept = arr.filter(t => now - t < 15 * 60 * 1000);
    if (kept.length) buckets.set(k, kept); else buckets.delete(k);
  }
  for (const [t, exp] of sessions) if (now > exp) sessions.delete(t);
}, 5 * 60 * 1000).unref();

/* ---------------- 工具 ---------------- */

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0, done = false;
    req.on('data', c => {
      if (done) return;
      size += c.length;
      if (size > limit) {
        done = true;
        const e = new Error('请求体过大');
        e.status = 413;
        reject(e);
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => { if (!done) resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', reject);
  });
}

async function readJsonBody(req) {
  const raw = await readBody(req);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (_) {
    const e = new Error('请求格式错误');
    e.status = 400;
    throw e;
  }
}

function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function validateApplication(body) {
  const errors = [];
  const characterName = String((body && body.characterName) || '').trim();
  if (!NAME_RE.test(characterName)) errors.push('角色名需为 2-16 个字符（中文 / 字母 / 数字 / · _ -）');
  const classId = String((body && body.classId) || '');
  if (!CLASSES.includes(classId)) errors.push('请选择常玩职业');
  let timeSlots = Array.isArray(body && body.timeSlots) ? body.timeSlots.map(String) : [];
  timeSlots = [...new Set(timeSlots)].filter(s => TIME_SLOTS.includes(s));
  if (timeSlots.length < 1) errors.push('请至少选择一个在线时段');
  const intro = String((body && body.intro) || '').trim();
  if (intro.length < INTRO_MIN) errors.push('自我介绍至少 ' + INTRO_MIN + ' 字');
  if (intro.length > INTRO_MAX) errors.push('自我介绍最多 ' + INTRO_MAX + ' 字');
  return { errors, value: { characterName, classId, timeSlots, intro } };
}

function publicItem(it) {
  return {
    id: it.id, characterName: it.characterName, classId: it.classId,
    timeSlots: it.timeSlots, intro: it.intro, status: it.status,
    note: it.note, queryToken: it.queryToken,
    createdAt: it.createdAt, reviewedAt: it.reviewedAt
  };
}

/* ---------------- API ---------------- */

async function handleApi(req, res, url, pathname) {
  const ip = clientIp(req);

  // 提交申请
  if (req.method === 'POST' && pathname === '/api/applications') {
    // 宽松限流：防止恶意刷请求体 / 刷接口（字段不合法的请求也计入）
    if (!rateLimit('sub-try:' + ip, 30, 10 * 60 * 1000)) {
      return sendJSON(res, 429, { error: '请求过于频繁，请 10 分钟后再试' });
    }
    const body = await readJsonBody(req);
    const { errors, value } = validateApplication(body);
    // 先返回字段错误，且不消耗正式提交额度——
    // 否则访客修正无效表单（例如自我介绍不足 20 字）连续几次后，
    // 合法提交反而会收到 429，而不是字段错误或正常受理
    if (errors.length) return sendJSON(res, 400, { error: errors[0], errors });
    // 字段校验通过后才消耗正式提交限流额度
    if (!rateLimit('sub:' + ip, 5, 10 * 60 * 1000)) {
      return sendJSON(res, 429, { error: '提交太频繁了，请 10 分钟后再试' });
    }
    // 同名且未被拒绝的申请 → 拦截重复提交
    const dup = db.items.find(it =>
      it.characterName.toLowerCase() === value.characterName.toLowerCase() && it.status !== 'rejected'
    );
    if (dup) {
      return sendJSON(res, 409, { error: '角色「' + value.characterName + '」已提交过申请（编号 ' + dup.id + '），可在页面下方查询进度' });
    }
    const item = {
      id: 'A' + (++db.seq),
      ...value,
      status: 'pending',
      note: '',
      // 随机查询码：仅凭角色名无法查询他人申请，状态查询需同时提供本码
      queryToken: crypto.randomBytes(16).toString('hex'),
      createdAt: new Date().toISOString(),
      reviewedAt: null
    };
    db.items.push(item);
    saveDB();
    return sendJSON(res, 201, {
      ok: true,
      id: item.id,
      queryToken: item.queryToken,
      createdAt: item.createdAt
    });
  }

  // 查询申请状态（需角色名 + 提交时签发的查询码，防止仅凭角色名枚举他人申请与留言）
  if (req.method === 'GET' && pathname === '/api/applications/status') {
    if (!rateLimit('st:' + ip, 30, 60 * 1000)) {
      return sendJSON(res, 429, { error: '查询太频繁了，请稍后再试' });
    }
    const name = (url.searchParams.get('name') || '').trim();
    const token = (url.searchParams.get('code') || '').trim();
    if (!name || !token) return sendJSON(res, 400, { error: '请输入角色名和查询码' });
    const found = [...db.items].reverse().find(
      it => it.characterName.toLowerCase() === name.toLowerCase()
    );
    // 恒定时间比较；查无此人 / 查询码错误返回完全一致的响应，避免泄露角色名是否存在
    const expected = found && typeof found.queryToken === 'string' ? found.queryToken : '';
    if (!found || !timingSafeEqual(token, expected)) {
      return sendJSON(res, 200, { found: false });
    }
    return sendJSON(res, 200, {
      found: true,
      id: found.id,
      characterName: found.characterName,
      status: found.status,
      createdAt: found.createdAt,
      note: found.status === 'pending' ? '' : (found.note || '')
    });
  }

  // 公开统计（用于首页成员数）
  if (req.method === 'GET' && pathname === '/api/stats') {
    let approved = 0, pending = 0;
    for (const it of db.items) {
      if (it.status === 'approved') approved++;
      else if (it.status === 'pending') pending++;
    }
    return sendJSON(res, 200, { approved, pending, total: db.items.length });
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJSON(res, 200, { ok: true });
  }

  // 管理端登录
  if (req.method === 'POST' && pathname === '/api/admin/login') {
    if (!rateLimit('login:' + ip, 10, 10 * 60 * 1000)) {
      return sendJSON(res, 429, { error: '尝试次数过多，请 10 分钟后再试' });
    }
    const body = await readJsonBody(req);
    const pw = String((body && body.password) || '');
    if (!timingSafeEqual(pw, adminAuth.password)) {
      return sendJSON(res, 401, { error: '密码不正确' });
    }
    return sendJSON(res, 200, { token: issueToken(), expiresIn: TOKEN_TTL / 1000 });
  }

  // 退出登录
  if (req.method === 'POST' && pathname === '/api/admin/logout') {
    const token = bearerToken(req);
    if (token) sessions.delete(token);
    return sendJSON(res, 200, { ok: true });
  }

  // 申请列表（需登录）
  if (req.method === 'GET' && pathname === '/api/admin/applications') {
    if (!isAuthed(req)) return sendJSON(res, 401, { error: '未登录或登录已过期' });
    const status = url.searchParams.get('status') || 'all';
    let items = [...db.items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    if (['pending', 'approved', 'rejected'].includes(status)) {
      items = items.filter(it => it.status === status);
    }
    const stats = { pending: 0, approved: 0, rejected: 0, total: db.items.length };
    for (const it of db.items) if (stats[it.status] !== undefined) stats[it.status]++;
    return sendJSON(res, 200, { items: items.slice(0, 500).map(publicItem), stats });
  }

  // 审核（需登录）
  const m = pathname.match(/^\/api\/admin\/applications\/([A-Za-z0-9]+)\/review$/);
  if (req.method === 'POST' && m) {
    if (!isAuthed(req)) return sendJSON(res, 401, { error: '未登录或登录已过期' });
    const body = await readJsonBody(req);
    const action = String((body && body.action) || '');
    if (!['approve', 'reject'].includes(action)) {
      return sendJSON(res, 400, { error: '无效的审核操作' });
    }
    const note = String((body && body.note) || '').trim().slice(0, NOTE_MAX);
    const item = db.items.find(it => it.id === m[1]);
    if (!item) return sendJSON(res, 404, { error: '申请不存在' });
    item.status = action === 'approve' ? 'approved' : 'rejected';
    item.note = note;
    item.reviewedAt = new Date().toISOString();
    saveDB();
    return sendJSON(res, 200, { ok: true, item: publicItem(item) });
  }

  sendJSON(res, 404, { error: '接口不存在' });
}

/* ---------------- 静态文件 ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function serveStatic(req, res, pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch (_) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Bad Request');
  }
  if (rel === '/') rel = '/index.html';
  if (rel === '/admin') rel = '/admin.html';
  const fp = path.normalize(path.join(PUBLIC_DIR, rel));
  if (fp !== PUBLIC_DIR && !fp.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }
  fs.readFile(fp, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }
    const ext = path.extname(fp).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    res.end(data);
  });
}

/* ---------------- 启动 ---------------- */

seedIfEmpty();

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'");
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url, url.pathname);
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      serveStatic(req, res, url.pathname);
    } else {
      sendJSON(res, 405, { error: 'Method Not Allowed' });
    }
  } catch (err) {
    if (!res.headersSent) {
      sendJSON(res, err.status || 500, { error: err.status ? err.message : '服务器内部错误' });
    }
    if (!err.status) console.error(err);
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ◆ 星尘公会招募站已启动');
  console.log('  ◆ 招募页：http://localhost:' + PORT + '/');
  console.log('  ◆ 管理端：http://localhost:' + PORT + '/admin.html');
  if (adminAuth.generated) {
    console.log('  ◆ 管理密码：' + adminAuth.password + '（见 data/admin-secret.json，可用环境变量 ADMIN_PASSWORD 覆盖）');
  } else {
    console.log('  ◆ 管理密码：来自环境变量 ADMIN_PASSWORD');
  }
  console.log('');
});
