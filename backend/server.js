/**
 * 钓鱼天气 - 钓点模块后端 API
 * Node.js + Express + SQLite (sql.js 纯JS实现)
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { seedDemoSpots } = require('./seed');

// ============ 配置 ============
const PORT = process.env.PORT || 3456;
const JWT_SECRET = process.env.JWT_SECRET || 'fishing-spot-secret-key-2026';
// 微信小程序配置（部署到Render时设置环境变量）
const WECHAT_APPID = process.env.WECHAT_APPID || '';
const WECHAT_SECRET = process.env.WECHAT_SECRET || '';
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'data', 'uploads');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'fishing.db');
const QWEATHER_KEY = '195df4dbb8574d3dbbf024de1e1230b7';
const QWEATHER_HOST = 'ma6x8a83gy.re.qweatherapi.com';

// 确保目录存在
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

// ============ Express 初始化 ============
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb', type: ['application/json', 'application/*+json'], charset: 'utf-8' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));
// 同源托管 Web 管理后台（访问 /admin 即可打开）
// 注意：不再挂载项目根目录为静态资源（避免容器文件系统通过 HTTP 暴露）
app.use('/admin', express.static(path.join(__dirname, '..', 'web-admin')));

// ============ sql.js 数据库封装层 ============
let SQL, sqlDb;

/**
 * Statement 包装类 - 模拟 better-sqlite3 Statement API
 */
class StmtWrapper {
  constructor(dbs, sql) {
    this.__dbs = dbs;
    this.__sql = sql;
  }

  get(...params) {
    const stmt = this.__dbs.prepare(this.__sql);
    if (params.length > 0) stmt.bind(params);
    let row = undefined;
    if (stmt.step()) row = stmt.getAsObject();
    stmt.free();
    return row;
  }

  all(...params) {
    const stmt = this.__dbs.prepare(this.__sql);
    if (params.length > 0) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  run(...params) {
    this.__dbs.run(this.__sql, params);
    const changes = this.__dbs.getRowsModified();
    let lastInsertRowid = 0;
    try {
      const r = this.__dbs.exec('SELECT last_insert_rowid() as id');
      if (r && r.length && r[0].values && r[0].values.length) {
        lastInsertRowid = r[0].values[0][0];
      }
    } catch (e) { /* ignore */ }
    __saveDb();
    return { changes, lastInsertRowid };
  }
}

/**
 * 数据库包装对象 - 模拟 better-sqlite3 Database API
 */
const dbWrap = {
  prepare(sql) {
    return new StmtWrapper(sqlDb, sql);
  },

  exec(sql) {
    sqlDb.run(sql);
    __saveDb();
  },

  pragma(config) {
    // "journal_mode = WAL" → PRAGMA journal_mode = WAL
    sqlDb.run('PRAGMA ' + config);
  },

  transaction(fn) {
    return (...args) => {
      sqlDb.run('BEGIN');
      try {
        const result = fn(...args);
        sqlDb.run('COMMIT');
        __saveDb();
        return result;
      } catch (e) {
        sqlDb.run('ROLLBACK');
        throw e;
      }
    };
  },

  close() {
    sqlDb.close();
  }
};

let __saveDbTimeout = null;
function __saveDb() {
  // 防抖保存，100ms 内的多次写入只保存一次
  clearTimeout(__saveDbTimeout);
  __saveDbTimeout = setTimeout(() => {
    try {
      const data = sqlDb.export();
      const buf = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buf);
    } catch (e) {
      console.error('[DB] 保存失败:', e.message);
    }
  }, 100);
}

function __saveDbNow() {
  clearTimeout(__saveDbTimeout);
  try {
    const data = sqlDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('[DB] 保存失败:', e.message);
  }
}

// ============ 数据库初始化（异步） ============
async function initDatabase() {
  SQL = await initSqlJs();

  // 确保数据库文件所在目录存在（支持外部挂载路径）
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  // 尝试加载已有数据库文件
  if (fs.existsSync(DB_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      sqlDb = new SQL.Database(fileBuffer);
      console.log('[DB] 已加载现有数据库');
    } catch (e) {
      console.log('[DB] 数据库文件损坏，创建新库');
      sqlDb = new SQL.Database();
    }
  } else {
    sqlDb = new SQL.Database();
    console.log('[DB] 创建新数据库');
  }

  // 设置数据库配置
  sqlDb.run('PRAGMA journal_mode = WAL');
  sqlDb.run('PRAGMA foreign_keys = ON');

  // 建表
  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      nickname TEXT,
      password_hash TEXT DEFAULT '',
      wechat_openid TEXT,
      avatar TEXT,
      role TEXT DEFAULT 'user' CHECK(role IN ('super_admin','admin','user')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active','banned')),
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      updated_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `);

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS regions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER DEFAULT 0,
      name TEXT NOT NULL,
      level TEXT NOT NULL CHECK(level IN ('province','city','district')),
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `);

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS fishing_spots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      province_id INTEGER,
      city_id INTEGER,
      district_id INTEGER,
      province TEXT,
      city TEXT,
      district TEXT,
      address TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      water_type TEXT CHECK(water_type IN ('river','reservoir','lake','pond','stream')),
      target_fish TEXT,
      avg_depth REAL,
      best_time TEXT,
      best_season TEXT,
      fee_type TEXT CHECK(fee_type IN ('free','daily','weight','other')),
      fee_price TEXT,
      parking INTEGER DEFAULT 0,
      restroom INTEGER DEFAULT 0,
      shade INTEGER DEFAULT 0,
      rod_limit TEXT,
      flood_warning TEXT,
      description TEXT,
      images TEXT DEFAULT '[]',
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','pending','published','offline','deleted')),
      fishing_index INTEGER DEFAULT 60,
      weather_data TEXT DEFAULT '{}',
      favorites_count INTEGER DEFAULT 0,
      catches_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      submitter_id TEXT,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      updated_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (submitter_id) REFERENCES users(id)
    )
  `);

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      spot_id TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      UNIQUE(user_id, spot_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (spot_id) REFERENCES fishing_spots(id)
    )
  `);

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS catches (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      spot_id TEXT NOT NULL,
      image TEXT,
      weight REAL,
      feeling TEXT,
      status TEXT DEFAULT 'approved' CHECK(status IN ('approved','pending','rejected')),
      reject_reason TEXT,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (spot_id) REFERENCES fishing_spots(id)
    )
  `);

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      spot_id TEXT NOT NULL,
      content TEXT NOT NULL,
      image TEXT,
      status TEXT DEFAULT 'approved' CHECK(status IN ('approved','pending','rejected')),
      reject_reason TEXT,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (spot_id) REFERENCES fishing_spots(id)
    )
  `);

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL,
      target_type TEXT NOT NULL CHECK(target_type IN ('spot','comment','catch')),
      target_id TEXT NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','ignored','handled')),
      handler_id TEXT,
      result TEXT,
      handled_at DATETIME,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (reporter_id) REFERENCES users(id)
    )
  `);

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      detail TEXT,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (admin_id) REFERENCES users(id)
    )
  `);

  // 索引
  sqlDb.run('CREATE INDEX IF NOT EXISTS idx_spots_status ON fishing_spots(status)');
  sqlDb.run('CREATE INDEX IF NOT EXISTS idx_spots_district ON fishing_spots(district_id)');
  sqlDb.run('CREATE INDEX IF NOT EXISTS idx_spots_coords ON fishing_spots(latitude, longitude)');
  sqlDb.run('CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id)');
  sqlDb.run('CREATE INDEX IF NOT EXISTS idx_catches_spot ON catches(spot_id)');
  sqlDb.run('CREATE INDEX IF NOT EXISTS idx_comments_spot ON comments(spot_id)');
  sqlDb.run('CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)');

  // 运营公告表（页面管理模块）
  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT,
      type TEXT DEFAULT 'announcement' CHECK(type IN ('announcement','banner')),
      link TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      updated_at DATETIME
    )
  `);
  sqlDb.run('CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status)');

  // 迁移：为已有数据库添加 wechat_openid 列
  try {
    sqlDb.run('ALTER TABLE users ADD COLUMN wechat_openid TEXT');
    console.log('[DB] 已添加 wechat_openid 列');
  } catch(e) { /* 列已存在，忽略 */ }

  __saveDbNow();

  // 初始化默认管理员
  const adminExists = dbWrap.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    dbWrap.prepare('INSERT INTO users (id, username, nickname, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv4(), 'admin', '超级管理员', hash, 'super_admin');
    console.log('[DB] 默认管理员已创建: admin / admin123');
  }

  // 初始化默认地区数据
  const regionCount = dbWrap.prepare('SELECT COUNT(*) as cnt FROM regions').get();
  if (regionCount && regionCount.cnt === 0) {
    initDefaultRegions();
  }

  // 初始化演示钓点（库为空时自动 seed，保证线上钓点列表非空）
  try {
    seedDemoSpots(dbWrap);
  } catch (e) {
    console.error('[DB] seed 演示钓点失败:', e.message);
  }
}

// ============ 图片上传 ============
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + uuidv4().slice(0, 8) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    cb(null, allowed.test(path.extname(file.originalname)));
  }
});

// ============ 认证中间件 ============
function authRequired(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '请先登录' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = dbWrap.prepare('SELECT id, username, nickname, role, status FROM users WHERE id = ?').get(decoded.userId);
    if (!user || user.status === 'banned') return res.status(401).json({ error: '用户已被禁用' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

function adminRequired(req, res, next) {
  if (!req.user || !['super_admin', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: '无管理员权限' });
  }
  next();
}

function superAdminRequired(req, res, next) {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ error: '仅超级管理员可操作' });
  }
  next();
}

// ============ 辅助函数 ============
function getPagination(page = 1, size = 20) {
  page = Math.max(1, parseInt(page));
  size = Math.min(100, Math.max(1, parseInt(size)));
  return { offset: (page - 1) * size, limit: size, page, size };
}

function paginateResponse(stmt, params, page = 1, size = 20) {
  const { offset, limit, page: p, size: s } = getPagination(page, size);
  const countStmt = stmt.replace(/SELECT .*? FROM/, 'SELECT COUNT(*) as total FROM');
  const totalResult = dbWrap.prepare(countStmt).get(...params) || { total: 0 };
  const total = totalResult.total || 0;
  const rows = dbWrap.prepare(stmt + ' LIMIT ? OFFSET ?').all(...params, limit, offset);
  return {
    data: rows,
    pagination: { page: p, size: s, total, totalPages: Math.ceil(total / s) }
  };
}

function addLog(adminId, action, targetType, targetId, detail) {
  dbWrap.prepare('INSERT INTO operation_logs (admin_id, action, target_type, target_id, detail) VALUES (?,?,?,?,?)')
    .run(adminId || 'system', action, targetType || '', targetId || '', detail || '');
}

// ============ 敏感词过滤 ============
const SENSITIVE_WORDS = ['广告', '代开发票', '办证', '赌博', '色情', '招嫖', '枪支', '毒品'];
function filterSensitive(text) {
  let filtered = text;
  for (const word of SENSITIVE_WORDS) {
    filtered = filtered.replace(new RegExp(word, 'g'), '***');
  }
  return filtered;
}

// ============ 天气API ============
async function fetchWeatherForSpot(lat, lon) {
  try {
    const https = require('https');
    const url = `https://${QWEATHER_HOST}/v7/weather/now?location=${lon.toFixed(2)},${lat.toFixed(2)}&key=${QWEATHER_KEY}`;
    return new Promise((resolve) => {
      https.get(url, { rejectUnauthorized: false }, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          try {
            const buffer = Buffer.concat(chunks);
            const isGzip = res.headers['content-encoding'] === 'gzip';
            const raw = isGzip ? zlib.gunzipSync(buffer) : buffer;
            const json = JSON.parse(raw.toString());
            if (json.code === '200' && json.now) {
              const n = json.now;
              const pressure = parseInt(n.pressure);
              const temp = parseInt(n.temp);
              const wind = parseInt(n.windScale) || 1;
              const precip = parseFloat(n.precip || '0');
              const humidity = parseInt(n.humidity);

              let index = 80;
              if (pressure < 995 || pressure > 1020) index -= 15;
              if (wind > 3) index -= 10;
              if (precip > 0.5) index -= 20;
              if (humidity > 90) index -= 5;
              const level = index >= 75 ? '优' : index >= 60 ? '良' : index >= 40 ? '一般' : '不适宜';

              resolve({
                temperature: temp, humidity, pressure,
                wind_direction: n.windDir, wind_power: wind + '级',
                precipitation: precip,
                fishing_index: Math.max(10, index),
                fishing_level: level,
                weather: n.text, obs_time: n.obsTime
              });
            } else {
              resolve(null);
            }
          } catch (e) { resolve(null); }
        });
      }).on('error', () => resolve(null));
    });
  } catch (e) { return null; }
}

async function updateSpotWeather(spotId) {
  const spot = dbWrap.prepare('SELECT latitude, longitude FROM fishing_spots WHERE id = ?').get(spotId);
  if (!spot) return;
  const weather = await fetchWeatherForSpot(spot.latitude, spot.longitude);
  if (weather) {
    dbWrap.prepare('UPDATE fishing_spots SET weather_data = ?, fishing_index = ?, updated_at = datetime("now","localtime") WHERE id = ?')
      .run(JSON.stringify(weather), weather.fishing_index, spotId);
  }
}

// 通用和风天气代理（小程序不再直接暴露 key）
async function proxyQweather(type, location) {
  const typeMap = {
    'now': '/v7/weather/now',
    '24h': '/v7/weather/24h',
    '7d': '/v7/weather/7d'
  };
  const path = typeMap[type];
  if (!path) return null;
  try {
    const https = require('https');
    const url = `https://${QWEATHER_HOST}${path}?location=${encodeURIComponent(location)}&key=${QWEATHER_KEY}`;
    return new Promise((resolve) => {
      https.get(url, { rejectUnauthorized: false }, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          try {
            const buffer = Buffer.concat(chunks);
            const isGzip = res.headers['content-encoding'] === 'gzip';
            const raw = isGzip ? zlib.gunzipSync(buffer) : buffer;
            resolve(JSON.parse(raw.toString()));
          } catch (e) { resolve(null); }
        });
      }).on('error', () => resolve(null));
    });
  } catch (e) { return null; }
}

// ============ 默认地区初始化 ============
function initDefaultRegions() {
  const regions = [
    { name: '北京市', level: 'province', cities: ['东城区','西城区','朝阳区','海淀区','丰台区','石景山区','通州区','大兴区','顺义区','昌平区','房山区','怀柔区','密云区','延庆区','平谷区','门头沟区'] },
    { name: '上海市', level: 'province', cities: ['黄浦区','徐汇区','长宁区','静安区','普陀区','虹口区','杨浦区','浦东新区','闵行区','宝山区','嘉定区','金山区','松江区','青浦区','奉贤区','崇明区'] },
    { name: '浙江省', level: 'province', cities: ['杭州市','宁波市','温州市','嘉兴市','湖州市','绍兴市','金华市','衢州市','舟山市','台州市','丽水市'] },
    { name: '江苏省', level: 'province', cities: ['南京市','无锡市','徐州市','常州市','苏州市','南通市','连云港市','淮安市','盐城市','扬州市','镇江市','泰州市','宿迁市'] },
    { name: '广东省', level: 'province', cities: ['广州市','深圳市','珠海市','汕头市','佛山市','韶关市','湛江市','肇庆市','江门市','茂名市','惠州市','梅州市','汕尾市','河源市','阳江市','清远市','东莞市','中山市','潮州市','揭阳市','云浮市'] },
    { name: '山东省', level: 'province', cities: ['济南市','青岛市','淄博市','枣庄市','东营市','烟台市','潍坊市','济宁市','泰安市','威海市','日照市','临沂市','德州市','聊城市','滨州市','菏泽市'] },
    { name: '湖北省', level: 'province', cities: ['武汉市','黄石市','十堰市','宜昌市','襄阳市','鄂州市','荆门市','孝感市','荆州市','黄冈市','咸宁市','随州市','恩施土家族苗族自治州'] },
    { name: '湖南省', level: 'province', cities: ['长沙市','株洲市','湘潭市','衡阳市','邵阳市','岳阳市','常德市','张家界市','益阳市','郴州市','永州市','怀化市','娄底市','湘西土家族苗族自治州'] },
  ];

  const insertRegion = dbWrap.prepare('INSERT INTO regions (parent_id, name, level, sort_order) VALUES (?, ?, ?, ?)');
  const insertMany = dbWrap.transaction(() => {
    for (const province of regions) {
      const pResult = insertRegion.run(0, province.name, 'province', 0);
      for (const city of province.cities) {
        insertRegion.run(pResult.lastInsertRowid, city, 'city', 0);
      }
    }
  });
  insertMany();
  console.log('[DB] 默认地区数据已初始化');
}

// ======================================================================
// ============================ API 路由 ==================================
// ======================================================================

// ---------- 用户认证 ----------
app.post('/api/auth/register', (req, res) => {
  const { username, password, nickname } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
  if (username.length < 3) return res.status(400).json({ error: '用户名至少3个字符' });
  const exists = dbWrap.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(400).json({ error: '用户名已存在' });
  const hash = bcrypt.hashSync(password, 10);
  const id = uuidv4();
  dbWrap.prepare('INSERT INTO users (id, username, nickname, password_hash) VALUES (?,?,?,?)').run(id, username, nickname || username, hash);
  const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id, username, nickname: nickname || username, role: 'user' } });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = dbWrap.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: '用户名或密码错误' });
  if (user.status === 'banned') return res.status(403).json({ error: '账号已被禁用' });
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username, nickname: user.nickname, role: user.role } });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

// ---------- 微信小程序登录 ----------
app.post('/api/auth/wechat-login', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: '缺少code参数' });
  try {
    // 调用微信API换取openid
    const https = require('https');
    const wxApiUrl = 'https://api.weixin.qq.com/sns/jscode2session?appid=' + WECHAT_APPID +
      '&secret=' + WECHAT_SECRET + '&js_code=' + code + '&grant_type=authorization_code';
    const wxResp = await new Promise((resolve, reject) => {
      https.get(wxApiUrl, (resp) => {
        let data = '';
        resp.on('data', (chunk) => data += chunk);
        resp.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });
    if (!wxResp.openid) return res.status(401).json({ error: '微信登录失败: ' + (wxResp.errmsg || '未知错误') });

    // 查找或创建用户
    let user = dbWrap.prepare('SELECT * FROM users WHERE wechat_openid = ?').get(wxResp.openid);
    if (!user) {
      const id = uuidv4();
      const username = 'wx_' + wxResp.openid.slice(-8);
      dbWrap.prepare('INSERT INTO users (id, username, nickname, password_hash, wechat_openid) VALUES (?,?,?,?,?)')
        .run(id, username, '微信用户', '', wxResp.openid);
      user = dbWrap.prepare('SELECT * FROM users WHERE id = ?').get(id);
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, nickname: user.nickname, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: '微信登录异常: ' + e.message });
  }
});

// ---------- 更新用户资料（昵称 / 头像） ----------
// 兼容两种提交方式：
//  1) 仅昵称：application/json  PUT { nickname }
//  2) 含头像：multipart/form-data（wx.uploadFile），file 字段名 avatar，formData 可带 nickname
app.put('/api/auth/profile', authRequired, upload.single('avatar'), (req, res) => {
  try {
    const userId = req.user.id;
    const sets = [];
    const values = [];
    if (req.body && req.body.nickname) {
      sets.push('nickname = ?');
      values.push(String(req.body.nickname).slice(0, 32));
    }
    if (req.file) {
      sets.push('avatar = ?');
      values.push('/uploads/' + req.file.filename);
    }
    if (sets.length === 0) {
      return res.json({ user: req.user });
    }
    sets.push("updated_at = datetime('now','localtime')");
    values.push(userId);
    dbWrap.prepare('UPDATE users SET ' + sets.join(', ') + ' WHERE id = ?').run(...values);
    const user = dbWrap.prepare('SELECT id, username, nickname, avatar, role FROM users WHERE id = ?').get(userId);
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: '更新资料失败: ' + e.message });
  }
});

// ---------- 地区接口 ----------
app.get('/api/regions', (req, res) => {
  const { parent_id } = req.query;
  let rows;
  if (parent_id) {
    rows = dbWrap.prepare('SELECT * FROM regions WHERE parent_id = ? ORDER BY sort_order').all(parseInt(parent_id));
  } else {
    rows = dbWrap.prepare('SELECT * FROM regions WHERE level = "province" ORDER BY sort_order').all();
  }
  res.json({ data: rows });
});

app.get('/api/regions/tree', (req, res) => {
  const provinces = dbWrap.prepare('SELECT * FROM regions WHERE level = "province" ORDER BY sort_order').all();
  const tree = provinces.map(p => {
    const cities = dbWrap.prepare('SELECT * FROM regions WHERE parent_id = ? ORDER BY sort_order').all(p.id);
    const citiesWithDistricts = cities.map(c => {
      const districts = dbWrap.prepare('SELECT * FROM regions WHERE parent_id = ? ORDER BY sort_order').all(c.id);
      return { ...c, children: districts };
    });
    return { ...p, children: citiesWithDistricts };
  });
  res.json({ data: tree });
});

// 地区管理（管理员）
app.post('/api/admin/regions', authRequired, adminRequired, (req, res) => {
  const { parent_id, name, level, sort_order } = req.body;
  if (!name || !level) return res.status(400).json({ error: '名称和级别不能为空' });
  const result = dbWrap.prepare('INSERT INTO regions (parent_id, name, level, sort_order) VALUES (?,?,?,?)')
    .run(parseInt(parent_id) || 0, name, level, parseInt(sort_order) || 0);
  addLog(req.user.id, '新增地区', 'region', String(result.lastInsertRowid), `新增${level}: ${name}`);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/admin/regions/:id', authRequired, adminRequired, (req, res) => {
  const { name, sort_order } = req.body;
  dbWrap.prepare('UPDATE regions SET name = COALESCE(?, name), sort_order = COALESCE(?, sort_order) WHERE id = ?')
    .run(name || null, sort_order != null ? parseInt(sort_order) : null, req.params.id);
  addLog(req.user.id, '编辑地区', 'region', req.params.id, `修改地区: ${name}`);
  res.json({ success: true });
});

app.delete('/api/admin/regions/:id', authRequired, superAdminRequired, (req, res) => {
  const regionId = parseInt(req.params.id);
  const spots = dbWrap.prepare('SELECT COUNT(*) as cnt FROM fishing_spots WHERE district_id = ? AND status != "deleted"').get(regionId);
  if (spots && spots.cnt > 0) return res.status(400).json({ error: `该地区下有 ${spots.cnt} 个钓点，请先转移钓点归属` });
  dbWrap.prepare('DELETE FROM regions WHERE id = ?').run(regionId);
  addLog(req.user.id, '删除地区', 'region', req.params.id, '删除地区');
  res.json({ success: true });
});

// ---------- 钓点 API（前台） ----------
app.get('/api/spots', (req, res) => {
  let { page, size, province_id, city_id, district_id, water_type, fee_type, fish_type,
        keyword, sort, fishing_level, lat, lon } = req.query;

  let conditions = ['s.status = "published"'];
  let params = [];

  if (province_id) { conditions.push('s.province_id = ?'); params.push(parseInt(province_id)); }
  if (city_id) { conditions.push('s.city_id = ?'); params.push(parseInt(city_id)); }
  if (district_id) { conditions.push('s.district_id = ?'); params.push(parseInt(district_id)); }
  if (water_type) { conditions.push('s.water_type = ?'); params.push(water_type); }
  if (fee_type) { conditions.push('s.fee_type = ?'); params.push(fee_type); }
  if (fish_type) { conditions.push('s.target_fish LIKE ?'); params.push(`%${fish_type}%`); }
  if (keyword) { conditions.push('(s.name LIKE ? OR s.address LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
  if (fishing_level) {
    if (fishing_level === '优') conditions.push('s.fishing_index >= 75');
    else if (fishing_level === '良') conditions.push('s.fishing_index >= 60 AND s.fishing_index < 75');
    else if (fishing_level === '一般') conditions.push('s.fishing_index >= 40 AND s.fishing_index < 60');
    else if (fishing_level === '不适宜') conditions.push('s.fishing_index < 40');
  }

  let orderBy = 's.updated_at DESC';
  if (sort === 'latest') orderBy = 's.created_at DESC';
  else if (sort === 'favorites') orderBy = 's.favorites_count DESC';
  else if (sort === 'comments') orderBy = 's.comments_count DESC';

  if (sort === 'nearest' && lat && lon) {
    const userLat = parseFloat(lat), userLon = parseFloat(lon);
    if (!isNaN(userLat) && !isNaN(userLon)) {
      orderBy = `((s.latitude - ${userLat})*(s.latitude - ${userLat}) + (s.longitude - ${userLon})*(s.longitude - ${userLon})) ASC`;
    }
  }

  const where = conditions.join(' AND ');
  const baseStmt = `SELECT s.*, COALESCE(u.nickname, u.username) as submitter_name FROM fishing_spots s LEFT JOIN users u ON s.submitter_id = u.id WHERE ${where} ORDER BY ${orderBy}`;
  const result = paginateResponse(baseStmt, params, page, size);
  res.json(result);
});

app.get('/api/spots/nearby', (req, res) => {
  const { lat, lon, radius = 50 } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: '请提供经纬度' });
  const r = parseFloat(radius) / 111;
  const spots = dbWrap.prepare(`
    SELECT * FROM fishing_spots WHERE status = "published"
    AND latitude BETWEEN ? - ? AND ? + ?
    AND longitude BETWEEN ? - ? AND ? + ?
    ORDER BY ((latitude-?)*(latitude-?)+(longitude-?)*(longitude-?)) ASC LIMIT 50
  `).all(parseFloat(lat), r, parseFloat(lat), r, parseFloat(lon), r, parseFloat(lon), r, parseFloat(lat), parseFloat(lat), parseFloat(lon), parseFloat(lon));
  res.json({ data: spots });
});

app.get('/api/spots/:id', (req, res) => {
  const spot = dbWrap.prepare('SELECT s.*, COALESCE(u.nickname, u.username) as submitter_name FROM fishing_spots s LEFT JOIN users u ON s.submitter_id = u.id WHERE s.id = ?').get(req.params.id);
  if (!spot || spot.status === 'deleted') return res.status(404).json({ error: '钓点不存在' });
  spot.images = safeJSON(spot.images);
  spot.weather_data = safeJSON(spot.weather_data);
  res.json({ data: spot });
});

// ---------- 收藏 ----------
app.post('/api/spots/:id/favorite', authRequired, (req, res) => {
  const spotId = req.params.id;
  const spot = dbWrap.prepare('SELECT id FROM fishing_spots WHERE id = ? AND status = "published"').get(spotId);
  if (!spot) return res.status(404).json({ error: '钓点不存在' });

  const existing = dbWrap.prepare('SELECT id FROM favorites WHERE user_id = ? AND spot_id = ?').get(req.user.id, spotId);
  if (existing) {
    dbWrap.prepare('DELETE FROM favorites WHERE user_id = ? AND spot_id = ?').run(req.user.id, spotId);
    dbWrap.prepare('UPDATE fishing_spots SET favorites_count = MAX(0, favorites_count - 1) WHERE id = ?').run(spotId);
    res.json({ favorited: false, message: '已取消收藏' });
  } else {
    dbWrap.prepare('INSERT INTO favorites (user_id, spot_id) VALUES (?,?)').run(req.user.id, spotId);
    dbWrap.prepare('UPDATE fishing_spots SET favorites_count = favorites_count + 1 WHERE id = ?').run(spotId);
    res.json({ favorited: true, message: '收藏成功' });
  }
});

app.get('/api/user/favorites', authRequired, (req, res) => {
  const { page, size } = req.query;
  const stmt = `SELECT f.*, s.name as spot_name, s.address, s.water_type, s.fee_type, s.fishing_index, s.images FROM favorites f JOIN fishing_spots s ON f.spot_id = s.id WHERE f.user_id = ? AND s.status != 'deleted' ORDER BY f.created_at DESC`;
  const result = paginateResponse(stmt, [req.user.id], page, size);
  result.data = result.data.map(r => ({ ...r, images: safeJSON(r.images) }));
  res.json(result);
});

app.delete('/api/user/favorites', authRequired, (req, res) => {
  const { ids } = req.body;
  if (!ids || !ids.length) return res.status(400).json({ error: '请提供要取消的收藏ID' });
  const placeholders = ids.map(() => '?').join(',');
  const favs = dbWrap.prepare(`SELECT spot_id FROM favorites WHERE id IN (${placeholders}) AND user_id = ?`).all(...ids, req.user.id);
  dbWrap.prepare(`DELETE FROM favorites WHERE id IN (${placeholders}) AND user_id = ?`).run(...ids, req.user.id);
  for (const f of favs) {
    dbWrap.prepare('UPDATE fishing_spots SET favorites_count = MAX(0, favorites_count - 1) WHERE id = ?').run(f.spot_id);
  }
  res.json({ success: true });
});

// ---------- 渔获 ----------
app.post('/api/spots/:id/catches', authRequired, upload.single('image'), (req, res) => {
  const spotId = req.params.id;
  const spot = dbWrap.prepare('SELECT id FROM fishing_spots WHERE id = ?').get(spotId);
  if (!spot) return res.status(404).json({ error: '钓点不存在' });

  const { weight, feeling } = req.body;
  const id = uuidv4();
  const imagePath = req.file ? '/uploads/' + req.file.filename : null;

  dbWrap.prepare('INSERT INTO catches (id, user_id, spot_id, image, weight, feeling, status) VALUES (?,?,?,?,?,?,"approved")')
    .run(id, req.user.id, spotId, imagePath, parseFloat(weight) || 0, filterSensitive(feeling || ''));
  dbWrap.prepare('UPDATE fishing_spots SET catches_count = catches_count + 1 WHERE id = ?').run(spotId);

  res.json({ id, message: '发布成功' });
});

app.get('/api/spots/:id/catches', (req, res) => {
  const { page, size } = req.query;
  const stmt = `SELECT c.*, u.nickname, u.avatar FROM catches c JOIN users u ON c.user_id = u.id WHERE c.spot_id = ? AND c.status = "approved" ORDER BY c.created_at DESC`;
  res.json(paginateResponse(stmt, [req.params.id], page, size));
});

app.delete('/api/catches/:id', authRequired, (req, res) => {
  const catch_ = dbWrap.prepare('SELECT * FROM catches WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!catch_) return res.status(404).json({ error: '渔获不存在' });
  dbWrap.prepare('DELETE FROM catches WHERE id = ?').run(req.params.id);
  dbWrap.prepare('UPDATE fishing_spots SET catches_count = MAX(0, catches_count - 1) WHERE id = ?').run(catch_.spot_id);
  res.json({ success: true });
});

// ---------- 评论 ----------
app.post('/api/spots/:id/comments', authRequired, upload.single('image'), (req, res) => {
  const spotId = req.params.id;
  const spot = dbWrap.prepare('SELECT id FROM fishing_spots WHERE id = ? AND status = "published"').get(spotId);
  if (!spot) return res.status(404).json({ error: '钓点不存在' });

  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '评论内容不能为空' });

  const id = uuidv4();
  const imagePath = req.file ? '/uploads/' + req.file.filename : null;

  dbWrap.prepare('INSERT INTO comments (id, user_id, spot_id, content, image, status) VALUES (?,?,?,?,?,"approved")')
    .run(id, req.user.id, spotId, filterSensitive(content.trim()), imagePath);
  dbWrap.prepare('UPDATE fishing_spots SET comments_count = comments_count + 1 WHERE id = ?').run(spotId);

  res.json({ id, message: '评论成功' });
});

app.get('/api/spots/:id/comments', (req, res) => {
  const { page, size } = req.query;
  const stmt = `SELECT c.*, u.nickname, u.avatar FROM comments c JOIN users u ON c.user_id = u.id WHERE c.spot_id = ? AND c.status = "approved" ORDER BY c.created_at DESC`;
  res.json(paginateResponse(stmt, [req.params.id], page, size));
});

app.delete('/api/comments/:id', authRequired, (req, res) => {
  const comment = dbWrap.prepare('SELECT * FROM comments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (req.user.role !== 'super_admin' && !comment) return res.status(404).json({ error: '评论不存在' });
  dbWrap.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
  if (comment) dbWrap.prepare('UPDATE fishing_spots SET comments_count = MAX(0, comments_count - 1) WHERE id = ?').run(comment.spot_id);
  res.json({ success: true });
});

// ---------- 举报 ----------
app.post('/api/reports', authRequired, (req, res) => {
  const { target_type, target_id, reason } = req.body;
  if (!target_type || !target_id) return res.status(400).json({ error: '请提供举报目标信息' });
  const id = uuidv4();
  dbWrap.prepare('INSERT INTO reports (id, reporter_id, target_type, target_id, reason) VALUES (?,?,?,?,?)')
    .run(id, req.user.id, target_type, target_id, filterSensitive(reason || ''));
  res.json({ id, message: '举报已提交，管理员将尽快处理' });
});

// ---------- 用户投稿 ----------
app.post('/api/spots/submit', authRequired, upload.array('images', 10), async (req, res) => {
  try {
    const {
      name, province_id, city_id, district_id, province, city, district,
      address, latitude, longitude, water_type, target_fish, avg_depth,
      best_time, best_season, fee_type, fee_price, parking, restroom, shade,
      rod_limit, flood_warning, description
    } = req.body;

    if (!name || !latitude || !longitude) return res.status(400).json({ error: '钓点名称、经纬度为必填项' });

    const images = req.files ? JSON.stringify(req.files.map(f => '/uploads/' + f.filename)) : '[]';
    const id = uuidv4();

    dbWrap.prepare(`INSERT INTO fishing_spots (id, name, province_id, city_id, district_id, province, city, district,
      address, latitude, longitude, water_type, target_fish, avg_depth, best_time, best_season,
      fee_type, fee_price, parking, restroom, shade, rod_limit, flood_warning, description, images, status, submitter_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,"pending",?)`)
      .run(id, name, parseInt(province_id) || null, parseInt(city_id) || null, parseInt(district_id) || null,
        province || null, city || null, district || null, address || null,
        parseFloat(latitude), parseFloat(longitude),
        water_type || null, target_fish || null, parseFloat(avg_depth) || null, best_time || null, best_season || null,
        fee_type || null, fee_price || null, parseInt(parking) || 0, parseInt(restroom) || 0, parseInt(shade) || 0,
        rod_limit || null, flood_warning || null, filterSensitive(description || ''), images, req.user.id);

    updateSpotWeather(id).catch(() => {});
    addLog(req.user.id, '用户投稿', 'spot', id, `投稿钓点: ${name}`);
    res.json({ id, message: '投稿已提交，管理员审核通过后将展示' });
  } catch (e) {
    console.error('submit error:', e);
    res.status(500).json({ error: '投稿失败：' + e.message });
  }
});

// ---------- 个人中心 ----------
app.get('/api/user/catches', authRequired, (req, res) => {
  const { page, size } = req.query;
  const stmt = `SELECT c.*, s.name as spot_name FROM catches c JOIN fishing_spots s ON c.spot_id = s.id WHERE c.user_id = ? ORDER BY c.created_at DESC`;
  res.json(paginateResponse(stmt, [req.user.id], page, size));
});

app.get('/api/user/comments', authRequired, (req, res) => {
  const { page, size } = req.query;
  const stmt = `SELECT c.*, s.name as spot_name FROM comments c JOIN fishing_spots s ON c.spot_id = s.id WHERE c.user_id = ? ORDER BY c.created_at DESC`;
  res.json(paginateResponse(stmt, [req.user.id], page, size));
});

// 我的投稿
app.get('/api/user/submissions', authRequired, (req, res) => {
  const { page, size } = req.query;
  const stmt = `SELECT * FROM fishing_spots WHERE submitter_id = ? ORDER BY created_at DESC`;
  const result = paginateResponse(stmt, [req.user.id], page, size);
  result.data = result.data.map(r => ({ ...r, images: safeJSON(r.images) }));
  res.json(result);
});

// ======================================================================
// ======================== 管理员 API ===================================
// ======================================================================

// ---------- 钓点管理 ----------
app.get('/api/admin/spots', authRequired, adminRequired, (req, res) => {
  let { page, size, status, water_type, fee_type, keyword, sort, province_id, city_id, district_id } = req.query;
  let conditions = ['s.status != "deleted"'];
  let params = [];

  if (status) { conditions.push('s.status = ?'); params.push(status); }
  if (province_id) { conditions.push('s.province_id = ?'); params.push(parseInt(province_id)); }
  if (city_id) { conditions.push('s.city_id = ?'); params.push(parseInt(city_id)); }
  if (district_id) { conditions.push('s.district_id = ?'); params.push(parseInt(district_id)); }
  if (water_type) { conditions.push('s.water_type = ?'); params.push(water_type); }
  if (fee_type) { conditions.push('s.fee_type = ?'); params.push(fee_type); }
  if (keyword) { conditions.push('(s.name LIKE ? OR s.address LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }

  let orderBy = 's.created_at DESC';
  if (sort === 'favorites') orderBy = 's.favorites_count DESC';
  else if (sort === 'comments') orderBy = 's.comments_count DESC';

  const where = conditions.join(' AND ');
  const stmt = `SELECT s.*, COALESCE(u.nickname, u.username) as submitter_name FROM fishing_spots s LEFT JOIN users u ON s.submitter_id = u.id WHERE ${where} ORDER BY ${orderBy}`;
  res.json(paginateResponse(stmt, params, page, 50));
});

app.post('/api/admin/spots', authRequired, adminRequired, upload.array('images', 10), (req, res) => {
  const fields = req.body;
  if (!fields.name || !fields.latitude || !fields.longitude) return res.status(400).json({ error: '名称和经纬度为必填' });

  const id = uuidv4();
  const images = req.files ? JSON.stringify(req.files.map(f => '/uploads/' + f.filename)) : '[]';

  dbWrap.prepare(`INSERT INTO fishing_spots (id, name, province_id, city_id, district_id, province, city, district,
    address, latitude, longitude, water_type, target_fish, avg_depth, best_time, best_season,
    fee_type, fee_price, parking, restroom, shade, rod_limit, flood_warning, description, images, status, submitter_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, fields.name, parseInt(fields.province_id) || null, parseInt(fields.city_id) || null,
      parseInt(fields.district_id) || null, fields.province || null, fields.city || null, fields.district || null,
      fields.address || null, parseFloat(fields.latitude), parseFloat(fields.longitude),
      fields.water_type || null, fields.target_fish || null,
      parseFloat(fields.avg_depth) || null, fields.best_time || null, fields.best_season || null,
      fields.fee_type || null, fields.fee_price || null, parseInt(fields.parking) || 0,
      parseInt(fields.restroom) || 0, parseInt(fields.shade) || 0,
      fields.rod_limit || null, fields.flood_warning || null, fields.description || '', images,
      fields.status || 'published', null);

  addLog(req.user.id, '新增钓点', 'spot', id, `管理员新增: ${fields.name}`);
  updateSpotWeather(id).catch(() => {});
  res.json({ id });
});

app.put('/api/admin/spots/:id', authRequired, adminRequired, upload.array('images', 10), (req, res) => {
  const spotId = req.params.id;
  const spot = dbWrap.prepare('SELECT * FROM fishing_spots WHERE id = ?').get(spotId);
  if (!spot) return res.status(404).json({ error: '钓点不存在' });

  const f = req.body;
  let images = spot.images;
  if (req.files && req.files.length > 0) {
    const oldImages = safeJSON(f.keepImages || spot.images);
    const newImages = req.files.map(file => '/uploads/' + file.filename);
    images = JSON.stringify([...oldImages, ...newImages]);
  }

  dbWrap.prepare(`UPDATE fishing_spots SET
    name = COALESCE(?, name), province_id = COALESCE(?, province_id), city_id = COALESCE(?, city_id),
    district_id = COALESCE(?, district_id), province = COALESCE(?, province), city = COALESCE(?, city),
    district = COALESCE(?, district), address = COALESCE(?, address),
    latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude),
    water_type = COALESCE(?, water_type), target_fish = COALESCE(?, target_fish),
    avg_depth = COALESCE(?, avg_depth), best_time = COALESCE(?, best_time),
    best_season = COALESCE(?, best_season), fee_type = COALESCE(?, fee_type),
    fee_price = COALESCE(?, fee_price), parking = COALESCE(?, parking),
    restroom = COALESCE(?, restroom), shade = COALESCE(?, shade),
    rod_limit = COALESCE(?, rod_limit), flood_warning = COALESCE(?, flood_warning),
    description = COALESCE(?, description), images = ?, status = COALESCE(?, status),
    updated_at = datetime('now','localtime')
    WHERE id = ?`)
    .run(f.name || null, f.province_id ? parseInt(f.province_id) : null, f.city_id ? parseInt(f.city_id) : null,
      f.district_id ? parseInt(f.district_id) : null, f.province || null, f.city || null, f.district || null,
      f.address || null, f.latitude ? parseFloat(f.latitude) : null, f.longitude ? parseFloat(f.longitude) : null,
      f.water_type || null, f.target_fish || null, f.avg_depth ? parseFloat(f.avg_depth) : null,
      f.best_time || null, f.best_season || null, f.fee_type || null, f.fee_price || null,
      f.parking != null ? parseInt(f.parking) : null, f.restroom != null ? parseInt(f.restroom) : null,
      f.shade != null ? parseInt(f.shade) : null, f.rod_limit || null, f.flood_warning || null,
      f.description || null, images, f.status || null, spotId);

  addLog(req.user.id, '编辑钓点', 'spot', spotId, `编辑钓点: ${f.name || spot.name}`);
  if (f.latitude || f.longitude) updateSpotWeather(spotId).catch(() => {});
  res.json({ success: true });
});

app.put('/api/admin/spots/:id/status', authRequired, adminRequired, (req, res) => {
  const { status } = req.body;
  if (!['published', 'offline', 'draft', 'deleted'].includes(status)) return res.status(400).json({ error: '无效状态' });
  if (status === 'deleted' && req.user.role !== 'super_admin') return res.status(403).json({ error: '仅超级管理员可删除钓点' });
  dbWrap.prepare('UPDATE fishing_spots SET status = ?, updated_at = datetime("now","localtime") WHERE id = ?').run(status, req.params.id);
  const actionMap = { published: '上架', offline: '下架', draft: '转草稿', deleted: '软删除' };
  addLog(req.user.id, actionMap[status] || '修改状态', 'spot', req.params.id, `${actionMap[status]}钓点`);
  res.json({ success: true });
});

app.post('/api/admin/spots/batch', authRequired, adminRequired, (req, res) => {
  const { ids, action, params: actionParams } = req.body;
  if (!ids || !ids.length) return res.status(400).json({ error: '请选择钓点' });
  const placeholders = ids.map(() => '?').join(',');

  if (action === 'offline') {
    dbWrap.prepare(`UPDATE fishing_spots SET status = 'offline', updated_at = datetime("now","localtime") WHERE id IN (${placeholders})`).run(...ids);
    addLog(req.user.id, '批量下架', 'spot', ids.join(','), `批量下架 ${ids.length} 个钓点`);
  } else if (action === 'publish') {
    dbWrap.prepare(`UPDATE fishing_spots SET status = 'published', updated_at = datetime("now","localtime") WHERE id IN (${placeholders})`).run(...ids);
    addLog(req.user.id, '批量上架', 'spot', ids.join(','), `批量上架 ${ids.length} 个钓点`);
  } else if (action === 'delete' && req.user.role === 'super_admin') {
    dbWrap.prepare(`UPDATE fishing_spots SET status = 'deleted', updated_at = datetime("now","localtime") WHERE id IN (${placeholders})`).run(...ids);
    addLog(req.user.id, '批量删除', 'spot', ids.join(','), `批量删除 ${ids.length} 个钓点`);
  } else if (action === 'transfer_district' && actionParams?.district_id) {
    dbWrap.prepare(`UPDATE fishing_spots SET district_id = ?, updated_at = datetime("now","localtime") WHERE id IN (${placeholders})`).run(parseInt(actionParams.district_id), ...ids);
    addLog(req.user.id, '批量转移', 'spot', ids.join(','), `批量转移 ${ids.length} 个钓点`);
  }
  res.json({ success: true });
});

app.get('/api/admin/spots/export', authRequired, adminRequired, (req, res) => {
  const spots = dbWrap.prepare('SELECT * FROM fishing_spots WHERE status != "deleted" ORDER BY created_at DESC').all();
  const headers = ['ID', '名称', '省', '市', '区县', '水体类型', '收费类型', '垂钓指数', '状态', '收藏数', '评论数', '创建时间'];
  const csvRows = [headers.join(',')];
  for (const s of spots) {
    csvRows.push([s.id, `"${s.name}"`, s.province, s.city, s.district, s.water_type, s.fee_type, s.fishing_index, s.status, s.favorites_count, s.comments_count, s.created_at].join(','));
  }
  const csv = '\uFEFF' + csvRows.join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=spots_export.csv');
  res.send(csv);
});

// ---------- 投稿审核 ----------
app.get('/api/admin/submissions', authRequired, adminRequired, (req, res) => {
  const { page, size, status } = req.query;
  let conditions = ["s.status IN ('pending','rejected')"];
  let params = [];
  if (status) { conditions = ['s.status = ?']; params = [status]; }
  const where = conditions.join(' AND ');
  const stmt = `SELECT s.*, COALESCE(u.nickname, u.username) as submitter_name FROM fishing_spots s LEFT JOIN users u ON s.submitter_id = u.id WHERE ${where} ORDER BY s.created_at DESC`;
  res.json(paginateResponse(stmt, params, page, size));
});

app.put('/api/admin/submissions/:id/review', authRequired, adminRequired, (req, res) => {
  const { action, reason } = req.body;
  if (action === 'approve') {
    dbWrap.prepare("UPDATE fishing_spots SET status = 'published', updated_at = datetime('now','localtime') WHERE id = ? AND status = 'pending'").run(req.params.id);
    addLog(req.user.id, '审核通过', 'spot', req.params.id, '审核通过用户投稿');
    updateSpotWeather(req.params.id).catch(() => {});
  } else if (action === 'reject') {
    dbWrap.prepare("UPDATE fishing_spots SET status = 'rejected', updated_at = datetime('now','localtime') WHERE id = ?").run(req.params.id);
    addLog(req.user.id, '审核驳回', 'spot', req.params.id, `驳回理由: ${reason || '无'}`);
  }
  res.json({ success: true });
});

// ---------- 渔获管理 ----------
app.get('/api/admin/catches', authRequired, adminRequired, (req, res) => {
  const { page, size, status, spot_id } = req.query;
  let conditions = [];
  let params = [];
  if (status) { conditions.push('c.status = ?'); params.push(status); }
  if (spot_id) { conditions.push('c.spot_id = ?'); params.push(spot_id); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const stmt = `SELECT c.*, s.name as spot_name, u.nickname, u.username FROM catches c JOIN fishing_spots s ON c.spot_id = s.id JOIN users u ON c.user_id = u.id ${where} ORDER BY c.created_at DESC`;
  res.json(paginateResponse(stmt, params, page, 30));
});

app.put('/api/admin/catches/:id/review', authRequired, adminRequired, (req, res) => {
  const { action, reason } = req.body;
  if (action === 'approve') {
    dbWrap.prepare('UPDATE catches SET status = "approved" WHERE id = ?').run(req.params.id);
  } else {
    dbWrap.prepare('UPDATE catches SET status = "rejected", reject_reason = ? WHERE id = ?').run(reason || '', req.params.id);
  }
  addLog(req.user.id, '审核渔获', 'catch', req.params.id, `${action === 'approve' ? '通过' : '驳回'}渔获`);
  res.json({ success: true });
});

app.delete('/api/admin/catches/:id', authRequired, adminRequired, (req, res) => {
  const c = dbWrap.prepare('SELECT * FROM catches WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: '不存在' });
  dbWrap.prepare('DELETE FROM catches WHERE id = ?').run(req.params.id);
  dbWrap.prepare('UPDATE fishing_spots SET catches_count = MAX(0, catches_count - 1) WHERE id = ?').run(c.spot_id);
  addLog(req.user.id, '删除渔获', 'catch', req.params.id, '管理员删除渔获');
  res.json({ success: true });
});

// ---------- 评论管理 ----------
app.get('/api/admin/comments', authRequired, adminRequired, (req, res) => {
  const { page, size, status, spot_id } = req.query;
  let conditions = [];
  let params = [];
  if (status) { conditions.push('c.status = ?'); params.push(status); }
  if (spot_id) { conditions.push('c.spot_id = ?'); params.push(spot_id); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const stmt = `SELECT c.*, s.name as spot_name, u.nickname, u.username FROM comments c JOIN fishing_spots s ON c.spot_id = s.id JOIN users u ON c.user_id = u.id ${where} ORDER BY c.created_at DESC`;
  res.json(paginateResponse(stmt, params, page, 30));
});

app.put('/api/admin/comments/:id/review', authRequired, adminRequired, (req, res) => {
  const { action, reason } = req.body;
  if (action === 'approve') {
    dbWrap.prepare('UPDATE comments SET status = "approved" WHERE id = ?').run(req.params.id);
  } else {
    dbWrap.prepare('UPDATE comments SET status = "rejected", reject_reason = ? WHERE id = ?').run(reason || '', req.params.id);
  }
  addLog(req.user.id, '审核评论', 'comment', req.params.id, `${action === 'approve' ? '通过' : '驳回'}评论`);
  res.json({ success: true });
});

app.delete('/api/admin/comments/:id', authRequired, adminRequired, (req, res) => {
  const c = dbWrap.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: '不存在' });
  dbWrap.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
  if (c) dbWrap.prepare('UPDATE fishing_spots SET comments_count = MAX(0, comments_count - 1) WHERE id = ?').run(c.spot_id);
  addLog(req.user.id, '删除评论', 'comment', req.params.id, '管理员删除评论');
  res.json({ success: true });
});

app.post('/api/admin/comments/batch-delete', authRequired, adminRequired, (req, res) => {
  const { ids } = req.body;
  if (!ids || !ids.length) return res.status(400).json({ error: '请选择评论' });
  const placeholders = ids.map(() => '?').join(',');
  const comments = dbWrap.prepare(`SELECT * FROM comments WHERE id IN (${placeholders})`).all(...ids);
  dbWrap.prepare(`DELETE FROM comments WHERE id IN (${placeholders})`).run(...ids);
  for (const c of comments) {
    dbWrap.prepare('UPDATE fishing_spots SET comments_count = MAX(0, comments_count - 1) WHERE id = ?').run(c.spot_id);
  }
  addLog(req.user.id, '批量删除评论', 'comment', ids.join(','), `批量删除 ${ids.length} 条评论`);
  res.json({ success: true });
});

// ---------- 举报处理 ----------
app.get('/api/admin/reports', authRequired, adminRequired, (req, res) => {
  const { page, size, status } = req.query;
  let conditions = [];
  let params = [];
  if (status) { conditions.push('r.status = ?'); params.push(status); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const stmt = `SELECT r.*, u1.nickname as reporter_name, u2.nickname as handler_name FROM reports r LEFT JOIN users u1 ON r.reporter_id = u1.id LEFT JOIN users u2 ON r.handler_id = u2.id ${where} ORDER BY r.created_at DESC`;
  res.json(paginateResponse(stmt, params, page, 30));
});

app.put('/api/admin/reports/:id/handle', authRequired, adminRequired, (req, res) => {
  const { action, reason } = req.body;
  const report = dbWrap.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).json({ error: '举报不存在' });

  if (action === 'ignore') {
    dbWrap.prepare('UPDATE reports SET status = "ignored", handler_id = ?, result = ?, handled_at = datetime("now","localtime") WHERE id = ?')
      .run(req.user.id, reason || '已忽略', req.params.id);
  } else if (action === 'handle') {
    if (report.target_type === 'spot') {
      dbWrap.prepare('UPDATE fishing_spots SET status = "offline" WHERE id = ?').run(report.target_id);
    } else if (report.target_type === 'comment') {
      dbWrap.prepare('DELETE FROM comments WHERE id = ?').run(report.target_id);
    } else if (report.target_type === 'catch') {
      dbWrap.prepare('DELETE FROM catches WHERE id = ?').run(report.target_id);
    }
    dbWrap.prepare('UPDATE reports SET status = "handled", handler_id = ?, result = ?, handled_at = datetime("now","localtime") WHERE id = ?')
      .run(req.user.id, reason || '已处理', req.params.id);
  }
  addLog(req.user.id, '处理举报', 'report', req.params.id, `${action === 'ignore' ? '忽略' : '处理'}举报`);
  res.json({ success: true });
});

// ---------- 数据统计 ----------
app.get('/api/admin/statistics', authRequired, adminRequired, (req, res) => {
  const cnt = (sql, params = []) => (dbWrap.prepare(sql).get(...params) || {}).cnt || 0;

  res.json({
    totals: {
      spots: cnt("SELECT COUNT(*) as cnt FROM fishing_spots WHERE status != 'deleted'"),
      published: cnt("SELECT COUNT(*) as cnt FROM fishing_spots WHERE status = 'published'"),
      offline: cnt("SELECT COUNT(*) as cnt FROM fishing_spots WHERE status = 'offline'"),
      draft: cnt("SELECT COUNT(*) as cnt FROM fishing_spots WHERE status = 'draft'"),
      pending: cnt("SELECT COUNT(*) as cnt FROM fishing_spots WHERE status = 'pending'"),
      catches: cnt("SELECT COUNT(*) as cnt FROM catches WHERE status = 'approved'"),
      comments: cnt("SELECT COUNT(*) as cnt FROM comments WHERE status = 'approved'"),
      pendingSubmissions: cnt("SELECT COUNT(*) as cnt FROM fishing_spots WHERE status = 'pending'"),
      pendingReports: cnt("SELECT COUNT(*) as cnt FROM reports WHERE status = 'pending'")
    },
    topFavorites: dbWrap.prepare('SELECT id, name, favorites_count FROM fishing_spots WHERE status = "published" ORDER BY favorites_count DESC LIMIT 10').all(),
    topCatches: dbWrap.prepare('SELECT id, name, catches_count FROM fishing_spots WHERE status = "published" ORDER BY catches_count DESC LIMIT 10').all(),
    topComments: dbWrap.prepare('SELECT id, name, comments_count FROM fishing_spots WHERE status = "published" ORDER BY comments_count DESC LIMIT 10').all(),
    trends: {
      spots: dbWrap.prepare("SELECT date(created_at) as day, COUNT(*) as cnt FROM fishing_spots WHERE created_at >= datetime('now','-7 days') GROUP BY date(created_at) ORDER BY day").all(),
      catches: dbWrap.prepare("SELECT date(created_at) as day, COUNT(*) as cnt FROM catches WHERE created_at >= datetime('now','-7 days') GROUP BY date(created_at) ORDER BY day").all()
    }
  });
});

app.get('/api/admin/statistics/districts', authRequired, adminRequired, (req, res) => {
  const districts = dbWrap.prepare(`
    SELECT r.id, r.name, COUNT(s.id) as spot_count
    FROM regions r LEFT JOIN fishing_spots s ON s.district_id = r.id AND s.status != 'deleted'
    WHERE r.level = 'district'
    GROUP BY r.id ORDER BY spot_count DESC
  `).all();
  res.json({ data: districts });
});

// ---------- 操作日志 ----------
app.get('/api/admin/logs', authRequired, adminRequired, (req, res) => {
  const { page, size, admin_id } = req.query;
  let conditions = [];
  let params = [];
  if (admin_id) { conditions.push('admin_id = ?'); params.push(admin_id); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const stmt = `SELECT l.*, u.nickname as admin_name FROM operation_logs l LEFT JOIN users u ON l.admin_id = u.id ${where} ORDER BY l.created_at DESC`;
  res.json(paginateResponse(stmt, params, page, 30));
});

// ---------- 气象缓存刷新 ----------
app.post('/api/admin/weather/refresh', authRequired, adminRequired, async (req, res) => {
  const spots = dbWrap.prepare("SELECT id, latitude, longitude FROM fishing_spots WHERE status = 'published' AND (latitude != 0 AND longitude != 0)").all();
  let updated = 0;
  for (const spot of spots) {
    const weather = await fetchWeatherForSpot(spot.latitude, spot.longitude);
    if (weather) {
      dbWrap.prepare('UPDATE fishing_spots SET weather_data = ?, fishing_index = ?, updated_at = datetime("now","localtime") WHERE id = ?')
        .run(JSON.stringify(weather), weather.fishing_index, spot.id);
      updated++;
    }
  }
  addLog(req.user.id, '刷新气象缓存', 'system', '', `刷新了 ${updated}/${spots.length} 个钓点的天气数据`);
  res.json({ updated, total: spots.length });
});

// ---------- 用户管理 ----------
app.get('/api/admin/users', authRequired, adminRequired, (req, res) => {
  const { page, size } = req.query;
  const stmt = 'SELECT id, username, nickname, role, status, created_at FROM users ORDER BY created_at DESC';
  res.json(paginateResponse(stmt, [], page, size));
});

// ---------- 页面管理 / 运营公告 ----------
app.get('/api/admin/announcements', authRequired, adminRequired, (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM announcements';
  const params = [];
  if (status) { sql += ' WHERE status = ?'; params.push(status); }
  sql += ' ORDER BY sort_order ASC, created_at DESC';
  const list = dbWrap.prepare(sql).all(...params);
  res.json({ data: list });
});

app.post('/api/admin/announcements', authRequired, adminRequired, (req, res) => {
  const { title, content, type, link, status, sort_order } = req.body;
  if (!title) return res.status(400).json({ error: '标题不能为空' });
  const id = uuidv4();
  dbWrap.prepare('INSERT INTO announcements (id, title, content, type, link, status, sort_order) VALUES (?,?,?,?,?,?,?)')
    .run(id, title, content || '', type || 'announcement', link || '', status || 'active', parseInt(sort_order) || 0);
  addLog(req.user.id, '新增公告', 'announcement', id, `新增运营公告: ${title}`);
  res.json({ id });
});

app.put('/api/admin/announcements/:id', authRequired, adminRequired, (req, res) => {
  const { title, content, type, link, status, sort_order } = req.body;
  dbWrap.prepare(`UPDATE announcements SET
    title = COALESCE(?, title), content = COALESCE(?, content), type = COALESCE(?, type),
    link = COALESCE(?, link), status = COALESCE(?, status),
    sort_order = COALESCE(?, sort_order), updated_at = datetime('now','localtime') WHERE id = ?`)
    .run(title || null, content || null, type || null, link || null, status || null,
      sort_order != null ? parseInt(sort_order) : null, req.params.id);
  addLog(req.user.id, '编辑公告', 'announcement', req.params.id, '编辑运营公告');
  res.json({ success: true });
});

app.delete('/api/admin/announcements/:id', authRequired, adminRequired, (req, res) => {
  dbWrap.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  addLog(req.user.id, '删除公告', 'announcement', req.params.id, '删除运营公告');
  res.json({ success: true });
});

// 公开接口（小程序首页读取运营公告）
app.get('/api/announcements', (req, res) => {
  const list = dbWrap.prepare("SELECT id, title, content, type, link, sort_order FROM announcements WHERE status = 'active' ORDER BY sort_order ASC, created_at DESC").all();
  res.json({ data: list });
});

// 和风天气代理接口（小程序不再直接请求和风域名，避免暴露 key）
app.get('/api/weather/:type', async (req, res) => {
  const { type } = req.params;
  const { location } = req.query;
  if (!location) return res.status(400).json({ error: '缺少 location 参数' });
  const data = await proxyQweather(type, location);
  if (!data) return res.status(502).json({ error: '天气服务暂不可用' });
  res.json(data);
});

app.put('/api/admin/users/:id', authRequired, superAdminRequired, (req, res) => {
  const { role, status } = req.body;
  dbWrap.prepare('UPDATE users SET role = COALESCE(?, role), status = COALESCE(?, status) WHERE id = ?')
    .run(role || null, status || null, req.params.id);
  addLog(req.user.id, '修改用户', 'user', req.params.id, '修改用户角色/状态');
  res.json({ success: true });
});

// ============ 健康检查 (Render 必需) ============
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

// ============ 辅助 ============
function safeJSON(str) {
  try { return JSON.parse(str); } catch (e) { return []; }
}

// ============ 启动 ============
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`钓鱼天气后端服务已启动: http://localhost:${PORT}`);
    console.log(`API 基础路径: http://localhost:${PORT}/api/`);
    console.log(`管理后台: http://localhost:${PORT}/admin/  (需将 web-admin 挂载进容器，详见 DEPLOY.md)`);
  });
}).catch(err => {
  console.error('[DB] 数据库初始化失败:', err);
  process.exit(1);
});

// 优雅退出
process.on('SIGINT', () => { __saveDbNow(); dbWrap.close(); process.exit(); });
process.on('SIGTERM', () => { __saveDbNow(); dbWrap.close(); process.exit(); });
