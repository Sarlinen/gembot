@echo off
REM ============================================================
REM Steam 보석 거래소 - Windows 설치 스크립트
REM ============================================================
REM 사용법: install.bat 실행
REM ============================================================

echo.
echo ======================================
echo   Steam 보석 거래소 - 설치 스크립트
echo ======================================
echo.

REM Node.js 확인
where node >nul 2>&1
if errorlevel 1 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo https://nodejs.org 에서 Node.js 20 LTS를 설치하세요.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Node.js 버전: %NODE_VER%

for /f "tokens=*" %%v in ('npm -v') do set NPM_VER=%%v
echo [OK] npm 버전: %NPM_VER%
echo.

REM 프로젝트 루트로 이동
set SCRIPT_DIR=%~dp0
set PROJECT_DIR=%SCRIPT_DIR%..

REM 1. 프론트엔드 빌드
echo -- [1/4] 프론트엔드 의존성 설치 --
cd /d "%PROJECT_DIR%"
call npm install
echo.

echo -- [2/4] 프론트엔드 빌드 --
call npm run build
echo.

REM 2. 서버 의존성
echo -- [3/4] 서버 의존성 설치 --
cd /d "%SCRIPT_DIR%"
call npm install
echo.

REM 3. 초기 설정
echo -- [4/4] 초기 설정 --
if exist "%SCRIPT_DIR%data\config.json" (
    echo [주의] 기존 설정 파일이 존재합니다.
    set /p REDO="설정을 다시 하시겠습니까? (y/N): "
    if /i "%REDO%"=="y" (
        call node setup.js
    ) else (
        echo 기존 설정을 유지합니다.
    )
) else (
    call node setup.js
)

echo.
echo ======================================
echo   설치 완료!
echo ======================================
echo.
echo 서버 시작: npm start
echo.
pause
