import { useEffect, useState } from 'react';
import { fetchBotHealth } from '../../../api';
import { useStore } from '../../../store';

export function useAppBootstrap() {
  const { fetchMarketPrices, prices, setBotStatus } = useStore();
  const loadBotInventory = useStore(s => s.loadBotInventory);
  const loadConfigFromServer = useStore(s => s.loadConfigFromServer);
  const setBotConfig = useStore(s => s.setBotConfig);
  const adminToken = useStore(s => s.adminToken);
  const botSteamId64 = useStore(s => s.botConfig.steamId64);

  const [serverError, setServerError] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const data = await fetchBotHealth();
        if (data) {
          const status = data.status || 'online';
          setBotStatus(status as 'online' | 'offline' | 'maintenance');
          setServerError(false);
          if (data.steamId64 && /^\d{17}$/.test(data.steamId64)) {
            setBotConfig({ steamId64: data.steamId64 });
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

      try {
        const pubRes = await fetch('/api/public/config');
        if (pubRes.ok) {
          const pubData = await pubRes.json();
          useStore.getState().applyPublicConfig(pubData);
        }
      } catch {
        // 공개 설정 로드 실패는 치명적이지 않음
      }

      if (adminToken) {
        await loadConfigFromServer();
      }

      if (prices.autoFetchPrices && (Date.now() - prices.lastPriceFetch > 30 * 60 * 1000)) {
        setTimeout(() => fetchMarketPrices(), 3000);
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (botSteamId64) {
      loadBotInventory();
    }
  }, [botSteamId64]);

  const retryServerConnection = () => {
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
  };

  return {
    checking,
    serverError,
    retryServerConnection,
  };
}
