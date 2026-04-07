#!/bin/bash
# ============================================================
# Steam 보석 거래소 - 원클릭 설치 스크립트
# ============================================================
# 사용법: chmod +x install.sh && ./install.sh
# ============================================================

set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Steam 보석 거래소 - 설치 스크립트       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 현재 디렉토리 확인
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "📁 프로젝트 경로: $PROJECT_DIR"
echo "📁 서버 경로: $SCRIPT_DIR"
echo ""

# Node.js 버전 확인
if ! command -v node &> /dev/null; then
    echo "❌ Node.js가 설치되어 있지 않습니다."
    echo ""
    echo "Node.js 20 설치 방법:"
    echo "  Ubuntu/Debian:"
    echo "    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "    sudo apt-get install -y nodejs"
    echo ""
    echo "  CentOS/RHEL:"
    echo "    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -"
    echo "    sudo yum install -y nodejs"
    echo ""
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js 버전: $NODE_VERSION"

# npm 버전 확인
NPM_VERSION=$(npm -v)
echo "✅ npm 버전: $NPM_VERSION"
echo ""

# 1. 프론트엔드 빌드
echo "── [1/4] 프론트엔드 의존성 설치 ──"
cd "$PROJECT_DIR"
npm install --production=false
echo ""

echo "── [2/4] 프론트엔드 빌드 ──"
npm run build
echo ""

# 2. 서버 의존성 설치
echo "── [3/4] 서버 의존성 설치 ──"
cd "$SCRIPT_DIR"
npm install
echo ""

# 3. 초기 설정
echo "── [4/4] 초기 설정 ──"
if [ -f "$SCRIPT_DIR/data/config.json" ]; then
    echo "⚠️  기존 설정 파일이 존재합니다."
    read -p "설정을 다시 하시겠습니까? (y/N): " REDO
    if [ "$REDO" = "y" ] || [ "$REDO" = "Y" ]; then
        node setup.js
    else
        echo "기존 설정을 유지합니다."
    fi
else
    node setup.js
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   ✅ 설치 완료!                          ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "서버 시작:"
echo "  cd $SCRIPT_DIR"
echo "  npm start"
echo ""
echo "PM2로 백그라운드 실행:"
echo "  pm2 start server.js --name steam-gem-bot"
echo ""
echo "로그 확인:"
echo "  pm2 logs steam-gem-bot"
echo ""
