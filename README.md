# Steam 보석 거래소 🤖💎

TF2 아이템 ↔ 보석 자동 거래 웹 애플리케이션

---

## 🚀 서버 설치 및 실행 방법

### 요구사항
- **Node.js 18+** (20 LTS 권장)
- **npm 9+**
- **Linux/Windows 서버** (Ubuntu 22.04 권장)
- **Steam 봇 계정** (Steam Guard 모바일 인증 필수)
- **Steam Web API 키** ([여기서 발급](https://steamcommunity.com/dev/apikey))

---

### 1단계: 프로젝트 다운로드

```bash
# 프로젝트 폴더로 이동
cd /home/steam-gem-bot

# 또는 git clone 후 이동
git clone <repo-url> steam-gem-bot
cd steam-gem-bot
```

### 2단계: 프론트엔드 빌드

```bash
# 프론트엔드 의존성 설치
npm install

# 프론트엔드 빌드 (dist/ 폴더 생성)
npm run build
```

### 3단계: 백엔드 서버 설치

```bash
# 서버 폴더로 이동
cd server

# 서버 의존성 설치
npm install
```

### 4단계: 초기 설정

```bash
# 대화형 설정 (관리자 비밀번호, 봇 계정 정보 입력)
npm run setup
```

설정 스크립트가 다음을 물어봅니다:
- 관리자 비밀번호 (bcrypt 해시로 저장됨)
- 봇 Steam 아이디/비밀번호
- Shared Secret / Identity Secret
- Steam Web API 키
- 봇 Steam ID64
- 서버 포트

설정은 `server/data/config.json`에 저장됩니다.

### 5단계: 서버 시작

```bash
# 서버 시작
npm start
```

서버가 `http://localhost:3000`에서 시작됩니다.

---

## 📋 전체 설치 명령어 (한번에 복사)

```bash
# Ubuntu/Debian 기준
# Node.js 20 설치
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 프로젝트 폴더 생성
mkdir -p /home/steam-gem-bot
cd /home/steam-gem-bot

# 파일 업로드 후 (또는 git clone)

# 프론트엔드 빌드
npm install
npm run build

# 서버 설정
cd server
npm install
npm run setup   # 대화형 설정
npm start       # 서버 시작
```

---

## 🔧 PM2로 24시간 운영 (권장)

```bash
# PM2 설치
sudo npm install -g pm2

# 서버를 PM2로 시작
cd /home/steam-gem-bot/server
pm2 start server.js --name "steam-gem-bot"

# 서버 재시작 시 자동 시작
pm2 startup
pm2 save

# 로그 확인
pm2 logs steam-gem-bot

# 상태 확인
pm2 status

# 서버 재시작
pm2 restart steam-gem-bot

# 서버 중지
pm2 stop steam-gem-bot
```

---

## 🌐 Nginx 리버스 프록시 (도메인 연결)

```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/steam-gem-bot
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/steam-gem-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### HTTPS (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 📁 파일 구조

```
steam-gem-bot/
├── dist/                    # 빌드된 프론트엔드 (npm run build)
│   └── index.html
├── src/                     # 프론트엔드 소스
│   ├── App.tsx
│   ├── api.ts               # Steam API 서비스
│   ├── store.ts             # 상태 관리 (Zustand)
│   ├── types.ts
│   └── components/
├── server/                  # 백엔드 서버
│   ├── package.json
│   ├── server.js            # Express + Steam Bot
│   ├── setup.js             # 초기 설정 스크립트
│   └── data/
│       └── config.json      # 설정 파일 (자동 생성)
├── package.json             # 프론트엔드
├── vite.config.ts
└── README.md
```

---

## 🔐 관리자 접속

1. 웹사이트 하단 "© 2024 Steam 보석 거래소" 텍스트를 **5번 클릭**
2. 설정한 관리자 비밀번호 입력
3. 관리자 패널 접속

### 관리자 패널 탭
| 탭 | 설명 |
|----|------|
| 봇 설정 | 봇 계정 정보, 상태, 배낭 용량 |
| 저장봇 | 무기/모자 저장 봇 관리 |
| 시세 | Steam 장터 가격, 자동/수동 |
| 교환비율 | 아이템별 보석 가격 (자동 계산 + 직접 설정) |
| 관리자 | 진입점 ON/OFF, 블랙리스트 |

---

## 🔒 보안 기능

| 기능 | 설명 |
|------|------|
| 일회용 토큰 | 매 거래마다 32자 랜덤 토큰 생성, 거래 메시지에 `[TOKEN:xxx]` 포함 |
| 외부 거래 거절 | 토큰 없는 거래 제안 자동 거절 |
| 역제안 거절 | 역제안(counter-offer) 자동 거절 |
| 에스크로 차단 | Steam Guard 미인증 계정 거래 차단 |
| VAC/밴 차단 | VAC밴, 트레이드밴, 커뮤니티밴 계정 거래 거절 |
| JWT 인증 | 관리자 API bcrypt 해시 + JWT 24시간 만료 |
| 토큰 만료 | 보안 토큰 5분 후 자동 만료 |

---

## ⚙️ 설정 파일 (data/config.json) 구조

```json
{
  "server": {
    "port": 3000,
    "jwtSecret": "(자동 생성)"
  },
  "admin": {
    "enabled": true,
    "passwordHash": "(bcrypt 해시)"
  },
  "bot": {
    "username": "봇 아이디",
    "password": "봇 비밀번호",
    "sharedSecret": "...",
    "identitySecret": "...",
    "apiKey": "Steam API 키",
    "steamId64": "76561198xxxxxxxxx",
    "customGameName": "Steam 보석 거래소",
    "status": "online"
  },
  "storageBots": [],
  "prices": {
    "gemBundleMarket": 1500,
    "keyMarket": 2800,
    "ticketMarket": 1200,
    "keyToRefined": 62,
    "buyMultiplier": 1.10,
    "sellMultiplier": 0.85,
    "overrides": {},
    "autoFetchPrices": true
  },
  "blacklists": {
    "weapon": [],
    "hat": []
  },
  "tf2AutoRun": {
    "enabled": true,
    "startHour": 5,
    "endHour": 22,
    "durationMinutes": 30
  }
}
```

---

## 🛠️ 문제 해결

| 증상 | 해결 |
|------|------|
| `ENOENT: config.json` | `cd server && npm run setup` 실행 |
| Steam 로그인 실패 | Shared Secret 확인, Steam Guard 모바일 인증 활성화 확인 |
| 인벤토리 비공개 오류 | 봇/유저 Steam 프로필 + 인벤토리 공개 설정 |
| 거래 에스크로 | 봇 계정 Steam Guard 모바일 인증 7일 이상 경과 필요 |
| 404 오류 | `npm run build`로 프론트엔드 빌드 후 서버 재시작 |
| 포트 충돌 | `data/config.json`에서 port 변경 |
| 봇 오프라인 | 서버 로그 확인 (`pm2 logs`), Steam 서버 상태 확인 |
