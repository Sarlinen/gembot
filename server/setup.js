#!/usr/bin/env node
// ============================================================
// Steam 보석 거래소 - 초기 설정 스크립트
// ============================================================
// 실행: node setup.js
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

// ── readline 기반 입력 ──
function createPrompt() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  function ask(question) {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  function close() {
    rl.close();
  }

  return { ask, close };
}

async function main() {
  const { ask, close } = createPrompt();

  try {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   Steam 보석 거래소 - 초기 설정          ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');

    // data 폴더 생성
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log('✅ data/ 폴더 생성 완료');
    }

    // 기존 설정 확인
    if (fs.existsSync(CONFIG_PATH)) {
      try {
        JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        console.log('⚠️  기존 설정 파일이 발견되었습니다.');
        const overwrite = await ask('덮어쓰시겠습니까? (y/N): ');
        if (overwrite.toLowerCase() !== 'y') {
          console.log('설정을 유지합니다.');
          close();
          return;
        }
      } catch {
        // 파일이 손상된 경우 무시
      }
    }

    // ── 관리자 계정 ──
    console.log('');
    console.log('── 관리자 계정 설정 ──');
    console.log('(입력 내용이 화면에 표시됩니다. 주변에 주의하세요)');
    const adminUsername = await ask('관리자 아이디 (2자 이상): ');
    if (!adminUsername || adminUsername.trim().length < 2) {
      console.log('❌ 아이디는 2자 이상이어야 합니다.');
      close();
      return;
    }
    const password = await ask('관리자 비밀번호 (4자 이상): ');
    if (!password || password.trim().length < 4) {
      console.log('❌ 비밀번호는 4자 이상이어야 합니다.');
      close();
      return;
    }
    const confirmPw = await ask('비밀번호 확인: ');
    if (password.trim() !== confirmPw.trim()) {
      console.log('❌ 비밀번호가 일치하지 않습니다.');
      close();
      return;
    }

    // bcrypt 해시
    let bcrypt;
    try {
      bcrypt = require('bcrypt');
    } catch {
      console.log('');
      console.log('⚠️  bcrypt 모듈을 찾을 수 없습니다.');
      console.log('   다음 명령어를 먼저 실행해주세요:');
      console.log('   npm install');
      console.log('');
      close();
      return;
    }
    const hash = await bcrypt.hash(password.trim(), 12);
    console.log('✅ 비밀번호 암호화 완료');

    // ── 메인 봇 설정 ──
    console.log('');
    console.log('── 메인 봇 설정 ──');
    console.log('(나중에 관리자 패널에서도 변경 가능합니다)');
    console.log('(지금 설정하지 않으려면 Enter를 누르세요)');
    console.log('');

    const botUsername = await ask('봇 Steam 로그인 ID: ');
    const botPassword = await ask('봇 Steam 비밀번호: ');
    const sharedSecret = await ask('Shared Secret: ');
    const identitySecret = await ask('Identity Secret: ');
    const apiKey = await ask('Steam Web API 키 (https://steamcommunity.com/dev/apikey): ');
    const steamId64 = await ask('봇 Steam ID64 (https://steamid.io): ');
    const customGameName = await ask('커스텀 게임 이름 (Enter = "Steam 보석 거래소"): ');

    // ── 서버 설정 ──
    console.log('');
    console.log('── 서버 설정 ──');
    const port = await ask('서버 포트 (Enter = 3000): ');

    const jwtSecret = crypto.randomBytes(32).toString('hex');

    const config = {
      server: {
        port: parseInt(port) || 3000,
        jwtSecret: jwtSecret,
      },
      admin: {
        enabled: true,
        username: adminUsername.trim(),
        passwordHash: hash,
        debug: false,
      },
      bot: {
        username: (botUsername || '').trim(),
        password: (botPassword || '').trim(),
        sharedSecret: (sharedSecret || '').trim(),
        identitySecret: (identitySecret || '').trim(),
        apiKey: (apiKey || '').trim(),
        steamId64: (steamId64 || '').trim(),
        customGameName: (customGameName || '').trim() || 'Steam 보석 거래소',
        status: 'online',
      },
      storageBots: [],
      prices: {
        gemBundleMarket: 1500,
        keyMarket: 2800,
        ticketMarket: 1200,
        keyToRefined: 62,
        buyMultiplier: 1.10,
        sellMultiplier: 0.85,
        overrides: {},
        autoFetchPrices: true,
        lastPriceFetch: 0,
      },
      blacklists: {
        weapon: [],
        hat: [],
      },
      tf2AutoRun: {
        enabled: true,
        startHour: 5,
        endHour: 22,
        durationMinutes: 30,
      },
    };

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');

    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   ✅ 설정 완료!                          ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
    console.log(`  📁 설정 파일: ${CONFIG_PATH}`);
    console.log(`  🌐 서버 포트: ${parseInt(port) || 3000}`);
    console.log(`  🔑 JWT 시크릿: (자동 생성됨)`);
    if (!botUsername) {
      console.log('');
      console.log('  ⚠️  봇 계정이 설정되지 않았습니다.');
      console.log('  관리자 패널에서 설정하거나 data/config.json을 직접 편집하세요.');
    }
    console.log('');
    console.log('  서버 시작: npm start');
    console.log('  또는: node server.js');
    console.log('');

    close();
  } catch (err) {
    console.error('오류 발생:', err.message);
    close();
    process.exit(1);
  }
}

main();
