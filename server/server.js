#!/usr/bin/env node
'use strict';
// ============================================================
// Steam 보석 거래소 - 프로덕션 백엔드 서버
// ============================================================

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let fetch;
try {
  fetch = require('node-fetch');
} catch {
  console.error('❌ node-fetch가 설치되지 않았습니다. npm install node-fetch@2 를 실행하세요.');
  process.exit(1);
}

const AbortController = globalThis.AbortController || (() => {
  try { return require('abort-controller'); } catch { return globalThis.AbortController; }
})();

let bcrypt, jwt;
try {
  bcrypt = require('bcrypt');
  jwt = require('jsonwebtoken');
} catch {
  console.error('❌ bcrypt 또는 jsonwebtoken이 설치되지 않았습니다.');
  process.exit(1);
}

let SteamUser, SteamCommunity, TradeOfferManager, SteamTotp;
let steamModulesAvailable = false;
try {
  SteamUser = require('steam-user');
  SteamCommunity = require('steamcommunity');
  TradeOfferManager = require('steam-tradeoffer-manager');
  SteamTotp = require('steam-totp');
  steamModulesAvailable = true;
  console.log('✅ Steam 모듈 로드 완료');
} catch {
  console.log('⚠️  Steam 모듈 미설치 - 거래 기능 비활성화');
}

// ============================================================
// 설정 로드
// ============================================================
const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const DIST_DIR = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  console.log('✅ 설정 파일 로드 완료');
} catch {
  console.log('⚠️  설정 파일 없음. 기본값으로 시작합니다.');
  config = {
    server: { port: 3000, jwtSecret: crypto.randomBytes(32).toString('hex') },
    admin: { enabled: true, username: '', passwordHash: '', debug: false },
    bot: { username: '', password: '', identitySecret: '', sharedSecret: '', apiKey: '', steamId64: '', customGameName: 'Steam 보석 거래소', status: 'online' },
    storageBots: [],
    prices: { gemBundleMarket: 1500, keyMarket: 2800, ticketMarket: 1200, keyToRefined: 62, buyMultiplier: 1.10, sellMultiplier: 0.85, overrides: {} },
    blacklists: { weapon: [], hat: [] },
    tf2AutoRun: { enabled: true, startHour: 5, endHour: 22, durationMinutes: 30 },
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

function saveConfig() {
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8'); }
  catch (e) { console.error('설정 저장 오류:', e.message); }
}

const PORT = config.server?.port || 3000;
const JWT_SECRET = config.server?.jwtSecret || crypto.randomBytes(32).toString('hex');
const TF2_MAX_SLOTS = 200; // 300칸 - 100칸 여유 = 200칸

// ============================================================
// 보안 토큰 관리
// ============================================================
const activeTokens = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [t, d] of activeTokens) {
    if (now - d.createdAt > 5 * 60 * 1000) activeTokens.delete(t);
  }
}, 60 * 1000);

// ============================================================
// Steam 봇
// ============================================================
let client, community, manager;
let botReady = false;
let botStatus = config.bot?.status || 'online';
let tf2Timeout = null;

if (steamModulesAvailable && config.bot?.username) {
  client = new SteamUser();
  community = new SteamCommunity();
  manager = new TradeOfferManager({ steam: client, community, language: 'en', pollInterval: 10000, cancelTime: 5 * 60 * 1000 });

  function loginBot() {
    if (!config.bot?.username || !config.bot?.password) { botStatus = 'offline'; return; }
    const opts = { accountName: config.bot.username, password: config.bot.password };
    if (config.bot.sharedSecret) opts.twoFactorCode = SteamTotp.generateAuthCode(config.bot.sharedSecret);
    client.logOn(opts);
  }

  client.on('loggedOn', () => {
    console.log('✅ Steam 로그인 성공');
    botReady = true;
    botStatus = config.bot?.status === 'maintenance' ? 'maintenance' : 'online';
    if (config.bot.customGameName) client.gamesPlayed([{ game_id: 440, game_extra_info: config.bot.customGameName }]);
    else client.gamesPlayed(440);
    scheduleTF2Run();
  });

  client.on('steamGuard', (domain, cb) => {
    if (config.bot.sharedSecret) cb(SteamTotp.generateAuthCode(config.bot.sharedSecret));
    else { console.error('❌ Steam Guard 코드 필요'); botStatus = 'offline'; }
  });

  client.on('webSession', (sessionID, cookies) => {
    manager.setCookies(cookies);
    community.setCookies(cookies);
    if (config.bot.identitySecret) community.startConfirmationChecker(15000, config.bot.identitySecret);
  });

  client.on('error', (err) => {
    console.error('❌ Steam 오류:', err.message);
    botReady = false; botStatus = 'offline';
    setTimeout(loginBot, 30000);
  });

  client.on('disconnected', () => { botReady = false; botStatus = 'offline'; });

  manager.on('newOffer', (offer) => {
    console.log(`⛔ 외부 거래 제안 자동 거절: #${offer.id} (${offer.partner.getSteamID64()})`);
    offer.decline((err) => {
      if (err) console.error('거절 오류:', err.message);
      else console.log(`✅ 거래 #${offer.id} 거절 완료`);
    });
  });

  function scheduleTF2Run() {
    if (!config.tf2AutoRun?.enabled) return;
    const now = new Date();
    const s = config.tf2AutoRun.startHour || 5;
    const e = config.tf2AutoRun.endHour || 22;
    const minMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), s, 0).getTime();
    const maxMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), e, 0).getTime();
    let target = minMs + Math.random() * (maxMs - minMs);
    if (target < Date.now()) target += 86400000;
    if (tf2Timeout) clearTimeout(tf2Timeout);
    tf2Timeout = setTimeout(() => {
      client.gamesPlayed([440]);
      setTimeout(() => {
        if (config.bot.customGameName) client.gamesPlayed([{ game_id: 440, game_extra_info: config.bot.customGameName }]);
        scheduleTF2Run();
      }, (config.tf2AutoRun.durationMinutes || 30) * 60 * 1000);
    }, target - Date.now());
  }

  setTimeout(loginBot, 1000);
}

// ============================================================
// fetchWithTimeout 헬퍼
// ============================================================
async function fetchWithTimeout(url, options = {}, ms = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('요청 시간이 초과되었습니다');
    throw err;
  }
}

// ============================================================
// 보석 수집 헬퍼 (인벤토리에서 보석 assetid 수집)
// ============================================================
async function collectGemsFromInventory(steamId64) {
  // { assetid, appid, contextid } 형태로 저장
  const sacks = []; // 1개 = 1000보석
  const loose = []; // 1개 = 1보석

  // TF2(440/2)와 Steam 커뮤니티(753/6) 양쪽 검색
  for (const [appid, ctxid] of [[440, 2], [753, 6]]) {
    let startAssetid;
    for (let page = 0; page < 20; page++) {
      const params = new URLSearchParams({ l: 'koreana' });
      if (startAssetid) params.set('start_assetid', startAssetid);
      const url = `https://steamcommunity.com/inventory/${steamId64}/${appid}/${ctxid}?${params}`;
      let data;
      try {
        const res = await fetchWithTimeout(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': `https://steamcommunity.com/profiles/${steamId64}/inventory/`,
          },
        }, 20000);
        if (!res.ok) break;
        const text = await res.text();
        if (!text || text.trim() === 'null' || text.trim() === '') break;
        data = JSON.parse(text);
      } catch { break; }

      if (!data?.assets || !data?.descriptions) break;

      const descMap = new Map();
      for (const d of data.descriptions) descMap.set(`${d.classid}_${d.instanceid}`, d);

      for (const asset of data.assets) {
        const desc = descMap.get(`${asset.classid}_${asset.instanceid}`);
        if (!desc || !desc.tradable) continue;
        const name = (desc.market_name || desc.name || '').toLowerCase();
        const hash = (desc.market_hash_name || '').toLowerCase();
        // appid, contextid를 함께 저장
        const gemEntry = { assetid: asset.assetid, appid, contextid: String(ctxid) };

        // classid로 우선 판별 (언어 무관)
        // 667933237 = Sack of Gems (30개 = 30,000보석)
        // 667924416 = 낱개 보석 Gems (amount 필드가 실제 수량)
        const isSack =
          desc.classid === '667933237' ||
          name.includes('sack of gems') || hash.includes('sack of gems') ||
          name.includes('보석 더미') || name.includes('보석 자루');

        const isLoose =
          desc.classid === '667924416' ||
          name === 'gems' || hash === 'gems' ||
          name === '보석' || name === 'gem' || hash === 'gem' ||
          hash === '753-gems';

        if (isSack) {
          // Sack 1개 = 1000보석, assetid 그대로 push
          sacks.push(gemEntry);
        } else if (isLoose) {
          // 낱개 보석: amount 필드가 실제 수량
          // Steam은 낱개 보석을 1개의 assetid에 amount로 묶어서 반환
          const amt = parseInt(String(asset.amount || '1')) || 1;
          gemEntry.amount = amt;
          loose.push(gemEntry);
        }
      }

      if (!data.more_items || !data.last_assetid) break;
      startAssetid = data.last_assetid;
    }
  }
  const looseTotal = loose.reduce((s, e) => s + (e.amount || 1), 0);
  console.log(`💎 수집 완료: Sack ${sacks.length}개(${sacks.length * 1000}보석), 낱개 ${loose.length}개assetid(${looseTotal}보석)`);
  return { sacks, loose };
}

// 필요한 보석 수만큼 선택 (Sack 우선, 부족하면 낱개로 대체)
// 반환: { gems: [{assetid, appid, contextid}], totalFound, insufficient }
async function findGems(steamId64, gemsNeeded) {
  if (!steamId64 || gemsNeeded <= 0) return { gems: [], totalFound: 0, insufficient: false };

  console.log(`💎 보석 검색: steamId=${steamId64}, 필요=${gemsNeeded}개`);
  const { sacks, loose } = await collectGemsFromInventory(steamId64);

  const totalSackGems = sacks.length * 1000;
  // 낱개 보석은 amount 필드가 실제 수량
  const totalLooseGems = loose.reduce((sum, e) => sum + (e.amount || 1), 0);
  const grandTotal = totalSackGems + totalLooseGems;

  console.log(`💎 보유: Sack ${sacks.length}개(${totalSackGems}보석) + 낱개 ${loose.length}개 = 합계 ${grandTotal}보석`);

  if (grandTotal < gemsNeeded) {
    console.error(`❌ 보석 부족: 필요 ${gemsNeeded}, 보유 ${grandTotal}`);
    return { gems: [], totalFound: grandTotal, insufficient: true };
  }

  const selected = []; // { assetid, appid, contextid }
  let remaining = gemsNeeded;

  // 1단계: Sack으로 1000개 단위 채우기
  const sacksNeeded = Math.floor(remaining / 1000);
  const sacksToUse = Math.min(sacksNeeded, sacks.length);
  for (let i = 0; i < sacksToUse; i++) {
    selected.push(sacks[i]);
    remaining -= 1000;
  }

  // 2단계: Sack이 부족하면 낱개로 대체
  if (sacksNeeded > sacks.length) {
    const missingSacks = sacksNeeded - sacks.length;
    let looseStillNeeded = missingSacks * 1000;
    for (const entry of loose) {
      if (looseStillNeeded <= 0) break;
      const amt = entry.amount || 1;
      const sendAmt = Math.min(amt, looseStillNeeded);
      // sendAmount: 실제로 보낼 보석 수량 (amount 전체가 아닐 수 있음)
      selected.push({ ...entry, sendAmount: sendAmt });
      remaining -= sendAmt;
      looseStillNeeded -= sendAmt;
    }
  }

  // 3단계: 나머지(1000미만) 낱개로 채우기
  if (remaining > 0) {
    const usedSet = new Set(selected.map(e => e.assetid));
    for (const entry of loose) {
      if (remaining <= 0) break;
      if (usedSet.has(entry.assetid)) continue;
      const amt = entry.amount || 1;
      const sendAmt = Math.min(amt, remaining);
      selected.push({ ...entry, sendAmount: sendAmt });
      remaining -= sendAmt;
    }
  }

  const totalFound = gemsNeeded - remaining;
  const sacksUsed = selected.filter(e => sacks.some(s => s.assetid === e.assetid)).length;
  const looseUsed = selected.length - sacksUsed;
  console.log(`💎 준비 완료: Sack ${sacksUsed}개 + 낱개 ${looseUsed}개 = ${totalFound}보석`);
  return { gems: selected, totalFound, insufficient: false };
}

// ============================================================
// Express
// ============================================================
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  console.log(`📁 정적 파일: ${DIST_DIR}`);
} else {
  console.log('⚠️  dist/ 없음. npm run build를 실행하세요.');
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: '인증이 필요합니다.' });
  try {
    req.admin = jwt.verify(h.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
}

// ============================================================
// API: 헬스체크
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: botStatus || config.bot?.status || 'online',
    botReady: botReady || !steamModulesAvailable,
    steamModules: steamModulesAvailable,
    steamId64: config.bot?.steamId64 || '',
    timestamp: Date.now(),
    uptime: process.uptime(),
  });
});

// ============================================================
// API: 공개 설정 (블랙리스트 등 인증 불필요)
// ============================================================
app.get('/api/public/config', (req, res) => {
  res.json({
    blacklists: {
      weapon: config.blacklists?.weapon || [],
      hat: config.blacklists?.hat || [],
    },
    prices: config.prices || {},
  });
});

// ============================================================
// API: 관리자 로그인
// ============================================================
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '아이디와 비밀번호를 입력하세요.' });
    if (!config.admin?.username || !config.admin?.passwordHash) {
      return res.status(500).json({ error: '관리자 계정이 설정되지 않았습니다. npm run setup을 실행하세요.' });
    }
    // 아이디 확인
    if (username !== config.admin.username) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    // 비밀번호 확인 (bcrypt)
    const valid = await bcrypt.compare(password, config.admin.passwordHash);
    if (!valid) return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    const token = jwt.sign({ role: 'admin', user: username, iat: Math.floor(Date.now() / 1000) }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// API: 관리자 설정 조회
// ============================================================
app.get('/api/admin/config', authMiddleware, (req, res) => {
  try {
    // JWT 인증된 관리자에게는 실제 값을 그대로 반환 (마스킹 없음)
    const safe = JSON.parse(JSON.stringify(config));
    delete safe.server;
    if (safe.admin) delete safe.admin.passwordHash;
    safe.botStatus = botStatus;
    console.log('📤 설정 조회 (실제 값 반환)');
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// API: 관리자 설정 저장
// ============================================================
app.post('/api/admin/config', authMiddleware, (req, res) => {
  try {
    const u = req.body;
    console.log('💾 설정 저장:', Object.keys(u));

    if (u.bot && typeof u.bot === 'object') {
      config.bot = { ...(config.bot || {}), ...u.bot };
    }

    if (u.prices && typeof u.prices === 'object') {
      config.prices = { ...(config.prices || {}), ...u.prices };
    }

    if (Array.isArray(u.storageBots)) {
      config.storageBots = u.storageBots.map(nb => ({ ...nb }));
    }

    if (u.blacklists && typeof u.blacklists === 'object') {
      config.blacklists = {
        weapon: Array.isArray(u.blacklists.weapon) ? u.blacklists.weapon : (config.blacklists?.weapon || []),
        hat: Array.isArray(u.blacklists.hat) ? u.blacklists.hat : (config.blacklists?.hat || []),
      };
    }

    if (u.admin && typeof u.admin === 'object') {
      const currentHash = config.admin?.passwordHash;
      const currentUsername = config.admin?.username;
      config.admin = { ...(config.admin || {}), ...u.admin };
      // 비밀번호 해시와 아이디는 덮어쓰지 않음 (별도 API로만 변경)
      if (currentHash) config.admin.passwordHash = currentHash;
      if (currentUsername) config.admin.username = currentUsername;
    }

    if (u.botStatus) {
      botStatus = u.botStatus;
      if (config.bot) config.bot.status = u.botStatus;
    }

    saveConfig();
    console.log('✅ 설정 저장 완료');
    res.json({ success: true });
  } catch (err) {
    console.error('❌ 설정 저장 오류:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// API: 관리자 비밀번호 변경
// ============================================================
app.post('/api/admin/credentials', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newUsername, newPassword } = req.body;
    if (!currentPassword) return res.status(400).json({ error: '현재 비밀번호를 입력하세요.' });
    
    // 현재 비밀번호 확인
    const valid = await bcrypt.compare(currentPassword, config.admin.passwordHash);
    if (!valid) return res.status(401).json({ error: '현재 비밀번호가 틀렸습니다.' });
    
    // 아이디 변경
    if (newUsername && newUsername.trim().length >= 2) {
      config.admin.username = newUsername.trim();
    }
    
    // 비밀번호 변경
    if (newPassword) {
      if (newPassword.length < 4) return res.status(400).json({ error: '새 비밀번호는 4자 이상이어야 합니다.' });
      config.admin.passwordHash = await bcrypt.hash(newPassword, 12);
    }
    
    saveConfig();
    res.json({ success: true, message: '관리자 계정 정보가 변경되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// API: Steam 인벤토리 프록시
// ============================================================
app.get('/api/inventory/:steamId64', async (req, res) => {
  const { steamId64 } = req.params;
  if (!/^\d{17}$/.test(steamId64)) return res.status(400).json({ error: '유효하지 않은 Steam ID64입니다.', success: 0 });

  const appid = req.query.appid || '440';
  const contextid = req.query.contextid || '2';

  const params = new URLSearchParams({ l: 'koreana' });
  if (req.query.start_assetid) params.set('start_assetid', String(req.query.start_assetid));

  const steamUrl = `https://steamcommunity.com/inventory/${steamId64}/${appid}/${contextid}?${params}`;
  console.log(`📦 인벤토리: ${steamId64} → ${steamUrl}`);

  try {
    const response = await fetchWithTimeout(steamUrl, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Referer': `https://steamcommunity.com/profiles/${steamId64}/inventory/`,
      },
    }, 30000);

    console.log(`📦 Steam 응답: HTTP ${response.status}`);

    if (!response.ok) {
      if (response.status === 403) return res.status(403).json({ error: '인벤토리가 비공개입니다. Steam 설정에서 공개로 변경해주세요.', success: 0 });
      if (response.status === 429) return res.status(429).json({ error: 'Steam 요청 제한. 잠시 후 다시 시도해주세요.', success: 0 });
      return res.status(response.status).json({ error: `Steam API 오류 (HTTP ${response.status})`, success: 0 });
    }

    const text = await response.text();
    if (!text || text.trim() === '' || text.trim() === 'null') {
      return res.json({ assets: [], descriptions: [], total_inventory_count: 0, success: 1 });
    }
    if (text.trim().startsWith('<!') || text.trim().startsWith('<html')) {
      return res.status(403).json({ error: '인벤토리에 접근할 수 없습니다.', success: 0 });
    }

    let data;
    try { data = JSON.parse(text); }
    catch { return res.status(502).json({ error: 'Steam 응답 파싱 실패', success: 0 }); }

    if (data.success === false || data.success === 0) {
      return res.status(403).json({ error: data.error || '인벤토리를 가져올 수 없습니다.', success: 0 });
    }

    console.log(`✅ 인벤토리: ${steamId64} (assets: ${data.assets?.length || 0})`);
    res.json(data);
  } catch (err) {
    if (err.message.includes('시간')) return res.status(504).json({ error: '응답 시간 초과', success: 0 });
    res.status(500).json({ error: err.message, success: 0 });
  }
});

// ============================================================
// API: Steam 장터 가격 프록시
// ============================================================
app.get('/api/market/price', async (req, res) => {
  const { appid, name } = req.query;
  if (!appid || !name) return res.status(400).json({ success: false, error: 'appid와 name이 필요합니다.' });

  const params = new URLSearchParams({ currency: '16', appid: String(appid), market_hash_name: String(name) });
  const steamUrl = `https://steamcommunity.com/market/priceoverview/?${params}`;
  console.log(`💰 장터 가격: ${name}`);

  try {
    const response = await fetchWithTimeout(steamUrl, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    }, 15000);

    if (!response.ok) return res.status(response.status).json({ success: false, error: `Steam API ${response.status}` });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch { return res.status(502).json({ success: false, error: 'Steam 응답 파싱 실패' }); }

    console.log(`✅ 장터 가격: ${name} = ${data.lowest_price || data.median_price || 'N/A'}`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// API: 배낭 용량
// ============================================================
app.get('/api/backpack/:steamId64', async (req, res) => {
  const { steamId64 } = req.params;
  const apiKey = req.query.key || config.bot?.apiKey;
  if (!apiKey) return res.status(400).json({ error: 'API 키가 필요합니다.' });
  if (!/^\d{17}$/.test(steamId64)) return res.status(400).json({ error: '유효하지 않은 Steam ID64' });

  const steamUrl = `https://api.steampowered.com/IEconItems_440/GetPlayerItems/v1/?key=${encodeURIComponent(apiKey)}&steamid=${steamId64}`;
  try {
    const response = await fetchWithTimeout(steamUrl, { headers: { 'Accept': 'application/json' } }, 15000);
    if (!response.ok) return res.status(response.status).json({ error: `Steam API 오류 (${response.status})` });

    const data = await response.json();
    if (data?.result?.status === 15) return res.status(403).json({ error: '인벤토리가 비공개입니다.' });

    const used = (data?.result?.items || []).length;
    console.log(`✅ 배낭: ${steamId64} (${used}/${TF2_MAX_SLOTS})`);
    res.json({ capacity: TF2_MAX_SLOTS, used, isFull: used >= TF2_MAX_SLOTS });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// API: 거래 요청 처리
// ============================================================
app.post('/api/trade', async (req, res) => {
  try {
    const { tradeUrl, mode, category, items, quantity, token, gemsAmount, gemAssetIds } = req.body;

    if (!tradeUrl || !mode || !category || !token) {
      return res.status(400).json({ success: false, type: 'error', message: '필수 파라미터 누락' });
    }

    const isDebug = config.admin?.debug === true;

    // 디버그 로깅
    if (isDebug) {
      console.log('\n🔧 ===== 거래 요청 디버그 =====');
      console.log(`📋 모드: ${mode} | 카테고리: ${category}`);
      console.log(`📦 아이템: ${(items || []).length}개`);
      console.log(`💎 보석: ${gemsAmount || 0}개`);
      console.log(`💎 보석 assetIds (프론트 제공): ${(gemAssetIds || []).length}개`);
      console.log(`🔑 토큰: ${token.substring(0, 8)}...`);
      console.log(`🏷️ ${steamModulesAvailable ? '실제 Steam 거래' : '⚠️ 시뮬레이션 (Steam 모듈 미설치)'}`);
      if (items?.length) console.log(`📦 아이템 상세:`, JSON.stringify(items.slice(0, 3)));
      if (gemAssetIds?.length) console.log(`💎 보석 assetIds:`, JSON.stringify(gemAssetIds.slice(0, 3)));
      console.log('🔧 ==============================\n');
    } else {
      console.log(`📨 거래: ${mode}/${category}, 아이템 ${(items||[]).length}개, 보석 ${gemsAmount||0}개`);
    }

    // 봇 상태 체크
    if (botStatus === 'maintenance') return res.json({ success: false, type: 'error', message: '봇이 점검 중입니다.' });
    if (botStatus === 'offline') return res.json({ success: false, type: 'error', message: '봇이 오프라인입니다.' });
    if (steamModulesAvailable && !botReady) return res.json({ success: false, type: 'error', message: '봇이 로그인 중입니다. 잠시 후 다시 시도해주세요.' });
    if (!steamModulesAvailable) return res.json({ success: false, type: 'error', message: 'Steam 거래 모듈이 설치되지 않았습니다. server/ 디렉토리에서 npm install을 실행하세요.' });

    // 거래 URL 파싱
    const partnerMatch = tradeUrl.match(/partner=(\d+)/);
    const tokenMatch = tradeUrl.match(/token=([a-zA-Z0-9_-]+)/);
    if (!partnerMatch || !tokenMatch) return res.json({ success: false, type: 'error', message: '유효하지 않은 거래 URL' });

    const partnerAccountId = partnerMatch[1];
    const partnerSteamId64 = (BigInt('76561197960265728') + BigInt(parseInt(partnerAccountId))).toString();

    // 밴 체크
    if (config.bot?.apiKey) {
      try {
        const banRes = await fetchWithTimeout(
          `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${config.bot.apiKey}&steamids=${partnerSteamId64}`,
          {}, 5000
        );
        if (banRes.ok) {
          const banData = await banRes.json();
          const player = banData?.players?.[0];
          if (player?.VACBanned) return res.json({ success: false, type: 'vacban', message: 'VAC 밴 계정과는 거래할 수 없습니다.' });
          if (player?.CommunityBanned) return res.json({ success: false, type: 'communityban', message: '커뮤니티 밴 계정과는 거래할 수 없습니다.' });
          if (player?.EconomyBan && player.EconomyBan !== 'none') return res.json({ success: false, type: 'tradeban', message: '거래 제한 계정과는 거래할 수 없습니다.' });
        }
      } catch (e) { console.error('밴 체크 오류:', e.message); }
    }

    // 저장 공간 체크 (봇이 받는 경우)
    if (mode === 'sell' && (category === 'weapon' || category === 'hat')) {
      const itemCount = (items || []).length || quantity || 1;
      try {
        let totalFreeSlots = 0;
        if (config.bot?.apiKey && config.bot?.steamId64) {
          const bpRes = await fetchWithTimeout(
            `https://api.steampowered.com/IEconItems_440/GetPlayerItems/v1/?key=${encodeURIComponent(config.bot.apiKey)}&steamid=${config.bot.steamId64}`,
            {}, 10000
          );
          if (bpRes.ok) {
            const bpData = await bpRes.json();
            const bpUsed = (bpData?.result?.items || []).length;
            totalFreeSlots += Math.max(0, TF2_MAX_SLOTS - bpUsed);
          }
        }
        if (itemCount > totalFreeSlots) {
          return res.json({ success: false, type: 'error', message: `저장 공간 부족. 필요: ${itemCount}칸, 여유: ${totalFreeSlots}칸` });
        }
      } catch (e) { console.error('공간 체크 오류:', e.message); }
    }

    // 보안 토큰 등록
    activeTokens.set(token, { createdAt: Date.now(), tradeUrl });

    // 거래 제안 생성
    const offer = manager.createOffer(tradeUrl);
    offer.setMessage(`[TOKEN:${token}]`);

    const needsSelection = category === 'weapon' || category === 'hat';

    // 아이템 유효성 필터
    const validItems = (items || []).filter(item => {
      if (!item.assetid || String(item.assetid).trim() === '' || item.assetid === 'undefined') {
        console.warn(`⚠️  유효하지 않은 assetid 필터: ${JSON.stringify(item)}`);
        return false;
      }
      return true;
    });

    if (needsSelection && validItems.length === 0) {
      activeTokens.delete(token);
      return res.json({ success: false, type: 'error', message: '거래할 유효한 아이템이 없습니다. 인벤토리를 새로고침해주세요.' });
    }

    // 아이템 거래 추가
    for (const item of validItems) {
      const itemObj = { appid: item.appid || 440, contextid: item.contextid || '2', assetid: String(item.assetid) };
      if (mode === 'sell') offer.addTheirItem(itemObj); // 유저가 아이템 줌
      else offer.addMyItem(itemObj);                     // 봇이 아이템 줌
    }

    // ============================================================
    // 보석 처리
    // ============================================================
    const totalGems = gemsAmount || 0;
    if (totalGems > 0) {
      let finalGemAssetIds = [];

      // 프론트에서 gemAssetIds 제공 시 우선 사용
      if (Array.isArray(gemAssetIds) && gemAssetIds.length > 0) {
        finalGemAssetIds = gemAssetIds.map(String);
        console.log(`💎 프론트 제공 보석 assetIds: ${finalGemAssetIds.length}개`);
      } else {
        // 서버에서 직접 인벤토리 조회하여 보석 검색
        // buy = 유저가 보석을 줌 → 유저 인벤토리에서 검색
        // sell = 봇이 보석을 줌 → 봇 인벤토리에서 검색
        const gemSourceId = mode === 'buy' ? partnerSteamId64 : config.bot?.steamId64;

        if (!gemSourceId) {
          activeTokens.delete(token);
          return res.json({ success: false, type: 'error', message: '보석 검색을 위한 Steam ID가 설정되지 않았습니다.' });
        }

        console.log(`💎 서버에서 보석 검색: ${mode === 'buy' ? '유저' : '봇'} (${gemSourceId}), 필요: ${totalGems}개`);
        const gemResult = await findGems(gemSourceId, totalGems);

        if (gemResult.insufficient || gemResult.gems.length === 0) {
          activeTokens.delete(token);
          const who = mode === 'buy' ? '유저' : '봇';
          return res.json({
            success: false,
            type: 'error',
            message: `${who}의 보석이 부족합니다. 필요: ${totalGems.toLocaleString()}개, 보유: ${gemResult.totalFound.toLocaleString()}개`,
          });
        }

        // { assetid, appid, contextid } 형태로 변환
        finalGemAssetIds = gemResult.gems;
      }

      // 보석 아이템 거래에 추가 (appid/contextid/amount 정확히 포함)
      for (const gem of finalGemAssetIds) {
        const gemItem = typeof gem === 'string'
          ? { appid: 753, contextid: '6', assetid: String(gem) }
          : {
              appid: gem.appid || 753,
              contextid: String(gem.contextid || '6'),
              assetid: String(gem.assetid),
              // amount: 낱개 보석은 실제로 보낼 수량 지정
              ...(gem.sendAmount ? { amount: gem.sendAmount } : {}),
            };
        if (mode === 'buy') offer.addTheirItem(gemItem);
        else offer.addMyItem(gemItem);
      }

      if (isDebug) {
        console.log(`💎 보석 ${totalGems}개 거래 추가 완료 (${finalGemAssetIds.length}개 assetId)`);
      }
    }

    // 거래 전송
    offer.send((err, status) => {
      if (err) {
        activeTokens.delete(token);
        console.error('❌ 거래 전송 오류:', err.message);
        if (err.message?.includes('escrow') || err.message?.includes('15 day')) {
          return res.json({ success: false, type: 'escrow', message: 'Steam Guard 인증이 필요합니다. 모바일 인증 설정 후 7일 이상 경과해야 합니다.' });
        }
        if (err.message?.includes('empty')) {
          return res.json({ success: false, type: 'error', message: '거래 아이템이 비어있습니다. 아이템과 보석이 올바르게 설정되었는지 확인하세요.' });
        }
        return res.json({ success: false, type: 'error', message: `거래 전송 실패: ${err.message}` });
      }

      console.log(`✅ 거래 전송: #${offer.id} (${status})`);
      if (isDebug) {
        console.log(`🔧 거래 결과: ID=#${offer.id}, 상태=${status}, 보낸아이템=${offer.itemsToGive?.length||0}개, 받는아이템=${offer.itemsToReceive?.length||0}개`);
      }

      if (config.bot?.identitySecret) {
        community.acceptConfirmationForObject(config.bot.identitySecret, offer.id, (e) => {
          if (e) console.error('확인 오류:', e.message);
        });
      }

      res.json({ success: true, tradeOfferId: offer.id, message: '거래 요청이 전송되었습니다!' });
    });

  } catch (err) {
    console.error('❌ 거래 오류:', err.message);
    res.status(500).json({ success: false, type: 'error', message: '서버 오류: ' + err.message });
  }
});

// ============================================================
// SPA 폴백
// ============================================================
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(503).send(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Steam 보석 거래소</title></head>
      <body style="background:#1b2838;color:#c7d5e0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center;">
          <h1>⚠️ 빌드가 필요합니다</h1>
          <pre style="background:#0e1621;padding:16px;border-radius:8px;">npm install && npm run build</pre>
          <pre style="background:#0e1621;padding:16px;border-radius:8px;margin-top:8px;">cd server && node server.js</pre>
        </div>
      </body></html>
    `);
  }
});

// ============================================================
// 서버 시작
// ============================================================
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   Steam 보석 거래소 서버 시작         ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`📡 http://localhost:${PORT}`);
  console.log(`🤖 봇 상태: ${botStatus} (Steam 모듈: ${steamModulesAvailable ? 'O' : 'X'})`);
  console.log(`🐛 디버그: ${config.admin?.debug ? 'ON' : 'OFF'}`);
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\n🛑 서버 종료...');
  if (client) client.logOff();
  if (tf2Timeout) clearTimeout(tf2Timeout);
  saveConfig();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('치명적 오류:', err.message);
  saveConfig();
});
