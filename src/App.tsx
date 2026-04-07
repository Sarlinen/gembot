import { useEffect, useState } from 'react';
import { useStore } from './store';
import { fetchBotHealth } from './api';
import { Header } from './components/Header';
import { TradeUrlInput } from './components/TradeUrlInput';
import { CategorySelector } from './components/CategorySelector';
import { TradingPanel } from './components/TradingPanel';
import { TradeResultModal } from './components/TradeResultModal';
import { Footer } from './components/Footer';
import { AdminLogin } from './components/AdminLogin';
import { AdminPanel } from './components/AdminPanel';
import { HowToTrade } from './components/HowToTrade';

export default function App() {
  const { showAdmin, isAdminLoggedIn, fetchMarketPrices, prices, setBotStatus } = useStore();
  const loadBotInventory = useStore(s => s.loadBotInventory);
  const loadConfigFromServer = useStore(s => s.loadConfigFromServer);
  const setBotConfig = useStore(s => s.setBotConfig);
  const adminToken = useStore(s => s.adminToken);
  const botSteamId64 = useStore(s => s.botConfig.steamId64);
  const [serverError, setServerError] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const init = async () => {
      // 서버에서 봇 상태 + steamId64 가져오기
      try {
        const data = await fetchBotHealth();
        if (data) {
          const status = data.status || 'online';
          setBotStatus(status as 'online' | 'offline' | 'maintenance');
          setServerError(false);
          console.log(`🤖 봇 상태: ${status}`);
          // health에서 steamId64 받아서 바로 인벤토리 로드
          if (data.steamId64 && /^\d{17}$/.test(data.steamId64)) {
            setBotConfig({ steamId64: data.steamId64 });
            console.log(`💎 봇 steamId64: ${data.steamId64} → 인벤토리 로드 시작`);
          }
        } else {
          setBotStatus('online');
          setServerError(false);
        }
      } catch {
        setBotStatus('offline');
        setServerError(true);
      } finally {
        setChecking(false);
      }

      // 공개 API로 블랙리스트 + 가격 불러오기 (인증 불필요)
      try {
        const pubRes = await fetch('/api/public/config');
        if (pubRes.ok) {
          const pubData = await pubRes.json();
          useStore.getState().applyPublicConfig(pubData);
          console.log(`📋 공개 설정 로드: 블랙리스트 무기 ${pubData.blacklists?.weapon?.length || 0}개, 모자 ${pubData.blacklists?.hat?.length || 0}개, 가격 ${pubData.prices ? '✅' : '❌'}`);
        }
      } catch (e) {
        console.warn('공개 설정 로드 실패:', e);
      }

      // 관리자 토큰이 있으면 서버에서 전체 설정 로드
      if (adminToken) {
        await loadConfigFromServer();
      }

      // 장터 가격 자동 갱신 (30분 이상 경과 시)
      if (prices.autoFetchPrices && (Date.now() - prices.lastPriceFetch > 30 * 60 * 1000)) {
        setTimeout(() => fetchMarketPrices(), 3000);
      }
    };
    init();
  }, []);

  // 봇 SteamID64가 설정되면 봇 인벤토리 즉시 로드 (보석 수량 표시용)
  useEffect(() => {
    if (botSteamId64) {
      loadBotInventory();
    }
  }, [botSteamId64]);

  if (showAdmin && !isAdminLoggedIn) {
    return <AdminLogin />;
  }

  if (showAdmin && isAdminLoggedIn) {
    return <AdminPanel />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* 서버 연결 오류 배너 */}
      {!checking && serverError && (
        <div className="bg-danger/20 border-b border-danger/40 px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <span className="text-danger text-lg">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-danger">서버에 연결할 수 없습니다</p>
              <p className="text-xs text-danger/80 mt-0.5">
                백엔드 서버가 실행 중인지 확인해주세요. <code className="bg-danger/20 px-1 rounded">cd server && node server.js</code>
              </p>
            </div>
            <button
              onClick={() => {
                setChecking(true);
                fetchBotHealth()
                  .then(data => {
                    if (data?.status) {
                      setBotStatus(data.status as 'online' | 'offline' | 'maintenance');
                      setServerError(false);
                    } else {
                      setServerError(true);
                    }
                  })
                  .catch(() => setServerError(true))
                  .finally(() => setChecking(false));
              }}
              className="px-3 py-1.5 bg-danger/30 text-danger text-xs font-medium rounded hover:bg-danger/40 transition"
            >
              재연결
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 space-y-6">
        <TradeUrlInput />
        <HowToTrade />
        <CategorySelector />
        <TradingPanel />
        <TradeResultModal />
      </main>
      <Footer />
    </div>
  );
}
