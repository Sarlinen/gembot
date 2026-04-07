import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Link, Clock, CheckCircle, AlertCircle } from 'lucide-react';

export function TradeUrlInput() {
  const { tradeUrl, setTradeUrl, tradeUrlExpiry, resetUserInventory } = useStore();
  const [input, setInput] = useState(tradeUrl);
  const [timeLeft, setTimeLeft] = useState('');
  const [saved, setSaved] = useState(!!tradeUrl);

  useEffect(() => {
    if (!tradeUrl || !tradeUrlExpiry) return;
    const timer = setInterval(() => {
      const diff = tradeUrlExpiry - Date.now();
      if (diff <= 0) {
        setTimeLeft('만료됨');
        setTradeUrl('');
        setInput('');
        setSaved(false);
        resetUserInventory();
        clearInterval(timer);
      } else {
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${m}분 ${s}초 남음`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [tradeUrl, tradeUrlExpiry, setTradeUrl, resetUserInventory]);

  const isValidUrl = (url: string) =>
    /^https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=.+$/.test(url.trim());

  const handleSave = () => {
    if (!isValidUrl(input)) return;
    // If URL changed, reset the old inventory
    if (input.trim() !== tradeUrl) {
      resetUserInventory();
    }
    setTradeUrl(input.trim());
    setSaved(true);
  };

  const handleClear = () => {
    setInput('');
    setTradeUrl('');
    setSaved(false);
    resetUserInventory();
  };

  return (
    <div className="bg-steam-card border border-steam-border rounded-lg p-4 fade-in">
      <div className="flex items-center gap-2 mb-3">
        <Link className="w-4 h-4 text-steam-blue" />
        <h3 className="text-sm font-semibold text-white">거래 URL</h3>
        {saved && tradeUrl && (
          <span className="ml-auto flex items-center gap-1 text-xs text-success">
            <CheckCircle className="w-3 h-3" />
            저장됨
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="https://steamcommunity.com/tradeoffer/new/?partner=...&token=..."
          value={input}
          onChange={(e) => { setInput(e.target.value); setSaved(false); }}
          className="flex-1 bg-steam-input text-sm text-white px-3 py-2 rounded border border-steam-border focus:border-steam-blue placeholder:text-steam-muted/50"
        />
        <button
          onClick={handleSave}
          disabled={!isValidUrl(input)}
          className="px-4 py-2 bg-steam-blue text-white text-sm font-medium rounded hover:bg-steam-blue/80 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          저장
        </button>
        {tradeUrl && (
          <button
            onClick={handleClear}
            className="px-3 py-2 bg-steam-input text-steam-muted text-sm rounded hover:bg-steam-hover hover:text-white transition"
          >
            초기화
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mt-2">
        <a
          href="https://steamcommunity.com/my/tradeoffers/privacy#trade_offer_access_url"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-steam-blue hover:underline"
        >
          거래 URL 확인하기 →
        </a>
        {tradeUrl && timeLeft && (
          <span className="flex items-center gap-1 text-xs text-steam-muted">
            <Clock className="w-3 h-3" />
            {timeLeft}
          </span>
        )}
      </div>

      {input && !isValidUrl(input) && (
        <div className="flex items-center gap-1 mt-2 text-xs text-danger">
          <AlertCircle className="w-3 h-3" />
          올바른 Steam 거래 URL 형식이 아닙니다.
        </div>
      )}
    </div>
  );
}
