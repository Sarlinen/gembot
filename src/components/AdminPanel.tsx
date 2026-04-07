import { useState, useEffect } from 'react';
import { useStore, computeGemPrice } from '../store';
import type { ItemCategory, BotStatus } from '../types';
import {
  ArrowLeft, Settings, Database, TrendingUp, Percent, Shield,
  Plus, Trash2, Save, Eye, EyeOff, Power, Wrench, WifiOff,
  Gem, AlertCircle, Check, RefreshCw, Loader2, Download
} from 'lucide-react';

type AdminTab = 'bot' | 'storage' | 'prices' | 'ratios' | 'admin';

const tabs: { id: AdminTab; label: string; icon: typeof Settings }[] = [
  { id: 'bot', label: '봇 설정', icon: Settings },
  { id: 'storage', label: '저장봇', icon: Database },
  { id: 'prices', label: '시세', icon: TrendingUp },
  { id: 'ratios', label: '교환비율', icon: Percent },
  { id: 'admin', label: '관리자', icon: Shield },
];

// ========== Bot Settings Tab ==========
function BotSettingsTab() {
  const { botConfig, setBotConfig, botStatus, setBotStatus, mainBotCapacity, mainBotUsed, mainBotCapacityLoading, fetchMainBotCapacity } = useStore();
  const [showSecrets, setShowSecrets] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const statusOptions: { value: BotStatus; label: string; icon: typeof Power; color: string }[] = [
    { value: 'online', label: '온라인', icon: Power, color: 'text-success' },
    { value: 'maintenance', label: '점검중', icon: Wrench, color: 'text-warning' },
    { value: 'offline', label: '오프라인', icon: WifiOff, color: 'text-danger' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-steam-muted mb-1">Steam 아이디</label>
          <input
            type="text"
            value={botConfig.username}
            onChange={(e) => setBotConfig({ username: e.target.value })}
            placeholder="봇 Steam 계정 아이디"
            className="w-full bg-steam-input text-white px-3 py-2 rounded border border-steam-border text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-steam-muted mb-1">비밀번호</label>
          <div className="relative">
            <input
              type={showSecrets ? 'text' : 'password'}
              value={botConfig.password}
              onChange={(e) => setBotConfig({ password: e.target.value })}
              placeholder="봇 Steam 비밀번호"
              className="w-full bg-steam-input text-white px-3 py-2 rounded border border-steam-border text-sm pr-10"
            />
            <button
              onClick={() => setShowSecrets(!showSecrets)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-steam-muted hover:text-white"
            >
              {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs text-steam-muted mb-1">Identity Secret</label>
          <input
            type={showSecrets ? 'text' : 'password'}
            value={botConfig.identitySecret}
            onChange={(e) => setBotConfig({ identitySecret: e.target.value })}
            placeholder="Steam Guard Identity Secret"
            className="w-full bg-steam-input text-white px-3 py-2 rounded border border-steam-border text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-steam-muted mb-1">Shared Secret</label>
          <input
            type={showSecrets ? 'text' : 'password'}
            value={botConfig.sharedSecret}
            onChange={(e) => setBotConfig({ sharedSecret: e.target.value })}
            placeholder="Steam Guard Shared Secret"
            className="w-full bg-steam-input text-white px-3 py-2 rounded border border-steam-border text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-steam-muted mb-1">API 키</label>
          <input
            type={showSecrets ? 'text' : 'password'}
            value={botConfig.apiKey}
            onChange={(e) => setBotConfig({ apiKey: e.target.value })}
            placeholder="Steam Web API Key"
            className="w-full bg-steam-input text-white px-3 py-2 rounded border border-steam-border text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-steam-muted mb-1">Steam ID64</label>
          <input
            type="text"
            value={botConfig.steamId64}
            onChange={(e) => setBotConfig({ steamId64: e.target.value })}
            placeholder="76561198xxxxxxxxx"
            className="w-full bg-steam-input text-white px-3 py-2 rounded border border-steam-border text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-steam-muted mb-1">커스텀 게임 이름</label>
          <input
            type="text"
            value={botConfig.customGameName}
            onChange={(e) => setBotConfig({ customGameName: e.target.value })}
            placeholder="Steam에 표시될 게임 이름"
            className="w-full bg-steam-input text-white px-3 py-2 rounded border border-steam-border text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-steam-muted mb-1">배낭 용량 (사용 가능: 200칸)</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-steam-input text-white px-3 py-2 rounded border border-steam-border text-sm flex items-center justify-between">
              <span>{mainBotUsed} / {mainBotCapacity}</span>
              <span className={`text-xs ${mainBotUsed >= mainBotCapacity ? 'text-danger font-bold' : 'text-steam-muted'}`}>
                {mainBotUsed >= mainBotCapacity ? '⚠️ 가득 참!' : `(여유: ${mainBotCapacity - mainBotUsed})`}
              </span>
            </div>
            <button
              onClick={fetchMainBotCapacity}
              disabled={mainBotCapacityLoading || !botConfig.steamId64}
              className="p-2 bg-steam-blue text-white rounded hover:bg-steam-blue/80 transition disabled:opacity-40"
              title="배낭 용량 자동 가져오기"
            >
              {mainBotCapacityLoading ? <Loader2 className="w-4 h-4 spin-slow" /> : <Download className="w-4 h-4" />}
            </button>
          </div>
          <div className="mt-1 h-2 bg-steam-input rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                mainBotUsed / mainBotCapacity > 0.9 ? 'bg-danger' :
                mainBotUsed / mainBotCapacity > 0.7 ? 'bg-warning' : 'bg-success'
              }`}
              style={{ width: `${Math.min(100, (mainBotUsed / mainBotCapacity) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs text-steam-muted mb-2">봇 상태</label>
        <div className="flex gap-2">
          {statusOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setBotStatus(opt.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition text-sm ${
                botStatus === opt.value
                  ? `border-steam-blue bg-steam-blue/10 ${opt.color}`
                  : 'border-steam-border text-steam-muted hover:border-steam-hover'
              }`}
            >
              <opt.icon className="w-4 h-4" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 bg-steam-darker rounded-lg border border-steam-border text-xs text-steam-muted">
        <p>⏰ TF2 자동 실행: 매일 05:00~22:00 랜덤 시간에 30분간 TF2 메인메뉴 실행 (아이템 수령용)</p>
        <p className="mt-1">🔒 보안: 사이트 외 거래 제안 자동 거절 / 역제안 자동 거절 / 에스크로·밴 계정 거래 차단</p>
      </div>

      <button
        onClick={handleSave}
        className="flex items-center gap-2 px-6 py-2 bg-steam-blue text-white rounded-lg text-sm font-medium hover:bg-steam-blue/80 transition"
      >
        {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? '저장 완료!' : '봇 설정 저장'}
      </button>
    </div>
  );
}

// ========== Storage Bots Tab ==========
function StorageBotsTab() {
  const { storageBots, addStorageBot, removeStorageBot, updateStorageBot, fetchBotCapacity, fetchAllBotCapacities } = useStore();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [fetchingAll, setFetchingAll] = useState(false);

  const handleAdd = () => {
    const id = `storage_${Date.now()}`;
    const label = String.fromCharCode(65 + storageBots.length);
    addStorageBot({
      id,
      name: `저장봇 ${label}`,
      username: '',
      password: '',
      identitySecret: '',
      sharedSecret: '',
      apiKey: '',
      steamId64: '',
      status: 'offline',
      capacity: 200,
      used: 0,
      capacityLoading: false,
      capacityError: '',
    });
  };

  const handleFetchAll = async () => {
    setFetchingAll(true);
    await fetchAllBotCapacities();
    setFetchingAll(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-steam-muted">무기/모자 저장용 봇 관리 (여유공간 없는 순서대로 분산 이전)</p>
        <div className="flex gap-2">
          {storageBots.length > 0 && (
            <button
              onClick={handleFetchAll}
              disabled={fetchingAll}
              className="flex items-center gap-1 px-3 py-1.5 bg-steam-green text-white text-sm rounded hover:bg-steam-green-dark transition disabled:opacity-50"
            >
              {fetchingAll ? <Loader2 className="w-4 h-4 spin-slow" /> : <Download className="w-4 h-4" />}
              전체 용량 갱신
            </button>
          )}
          <button
            onClick={handleAdd}
            className="flex items-center gap-1 px-3 py-1.5 bg-steam-blue text-white text-sm rounded hover:bg-steam-blue/80 transition"
          >
            <Plus className="w-4 h-4" />
            저장봇 추가
          </button>
        </div>
      </div>

      {storageBots.length === 0 && (
        <div className="text-center py-8 text-sm text-steam-muted border border-dashed border-steam-border rounded-lg">
          등록된 저장봇이 없습니다. 메인 봇의 배낭이 사용됩니다.
        </div>
      )}

      {storageBots.map((bot) => (
        <div key={bot.id} className="bg-steam-darker border border-steam-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                bot.status === 'online' ? 'bg-success' : bot.status === 'maintenance' ? 'bg-warning' : 'bg-danger'
              }`} />
              <input
                type="text"
                value={bot.name}
                onChange={(e) => updateStorageBot(bot.id, { name: e.target.value })}
                className="bg-transparent text-white font-medium text-sm border-none outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={bot.status}
                onChange={(e) => updateStorageBot(bot.id, { status: e.target.value as BotStatus })}
                className="bg-steam-input text-xs text-steam-muted px-2 py-1 rounded border border-steam-border"
              >
                <option value="online">온라인</option>
                <option value="maintenance">점검중</option>
                <option value="offline">오프라인</option>
              </select>
              <button
                onClick={() => removeStorageBot(bot.id)}
                className="text-danger hover:text-danger/80 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-steam-muted mb-1">Steam ID</label>
              <input
                type="text"
                value={bot.username}
                onChange={(e) => updateStorageBot(bot.id, { username: e.target.value })}
                placeholder="아이디"
                className="w-full bg-steam-input text-white px-3 py-1.5 rounded border border-steam-border text-xs"
              />
            </div>
            <div>
              <label className="block text-xs text-steam-muted mb-1">비밀번호</label>
              <input
                type={showSecrets[bot.id] ? 'text' : 'password'}
                value={bot.password}
                onChange={(e) => updateStorageBot(bot.id, { password: e.target.value })}
                placeholder="비밀번호"
                className="w-full bg-steam-input text-white px-3 py-1.5 rounded border border-steam-border text-xs"
              />
            </div>
            <div>
              <label className="block text-xs text-steam-muted mb-1">Identity Secret</label>
              <input
                type={showSecrets[bot.id] ? 'text' : 'password'}
                value={bot.identitySecret}
                onChange={(e) => updateStorageBot(bot.id, { identitySecret: e.target.value })}
                placeholder="Identity Secret"
                className="w-full bg-steam-input text-white px-3 py-1.5 rounded border border-steam-border text-xs"
              />
            </div>
            <div>
              <label className="block text-xs text-steam-muted mb-1">Shared Secret</label>
              <input
                type={showSecrets[bot.id] ? 'text' : 'password'}
                value={bot.sharedSecret}
                onChange={(e) => updateStorageBot(bot.id, { sharedSecret: e.target.value })}
                placeholder="Shared Secret"
                className="w-full bg-steam-input text-white px-3 py-1.5 rounded border border-steam-border text-xs"
              />
            </div>
            <div>
              <label className="block text-xs text-steam-muted mb-1">API 키</label>
              <input
                type={showSecrets[bot.id] ? 'text' : 'password'}
                value={bot.apiKey}
                onChange={(e) => updateStorageBot(bot.id, { apiKey: e.target.value })}
                placeholder="Steam Web API Key"
                className="w-full bg-steam-input text-white px-3 py-1.5 rounded border border-steam-border text-xs"
              />
            </div>
            <div>
              <label className="block text-xs text-steam-muted mb-1">Steam ID64</label>
              <input
                type="text"
                value={bot.steamId64}
                onChange={(e) => updateStorageBot(bot.id, { steamId64: e.target.value })}
                placeholder="76561198xxxxxxxxx"
                className="w-full bg-steam-input text-white px-3 py-1.5 rounded border border-steam-border text-xs"
              />
            </div>
          </div>

          {/* Capacity - Auto fetch */}
          <div>
            <label className="block text-xs text-steam-muted mb-1">배낭 용량 (사용 가능: 200칸)</label>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${bot.used >= bot.capacity ? 'text-danger font-bold' : 'text-white'}`}>
                {bot.used}/{bot.capacity}{bot.used >= bot.capacity ? ' ⚠️' : ''}
              </span>
              <div className="flex-1 h-2 bg-steam-input rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    bot.used / bot.capacity > 0.9 ? 'bg-danger' :
                    bot.used / bot.capacity > 0.7 ? 'bg-warning' : 'bg-success'
                  }`}
                  style={{ width: `${Math.min(100, (bot.used / bot.capacity) * 100)}%` }}
                />
              </div>
              <span className={`text-xs ${bot.used >= bot.capacity ? 'text-danger' : 'text-steam-muted'}`}>
                {bot.used >= bot.capacity ? '가득 참!' : `여유: ${bot.capacity - bot.used}`}
              </span>
              <button
                onClick={() => fetchBotCapacity(bot.id)}
                disabled={bot.capacityLoading || !bot.steamId64}
                className="p-1 bg-steam-blue text-white rounded hover:bg-steam-blue/80 transition disabled:opacity-40"
                title="배낭 용량 자동 가져오기"
              >
                {bot.capacityLoading ? <Loader2 className="w-3 h-3 spin-slow" /> : <Download className="w-3 h-3" />}
              </button>
            </div>
            {bot.capacityError && (
              <span className="text-xs text-danger mt-1 block flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {bot.capacityError} (봇 오프라인 처리됨)
              </span>
            )}
          </div>

          <button
            onClick={() => setShowSecrets(s => ({ ...s, [bot.id]: !s[bot.id] }))}
            className="text-xs text-steam-muted hover:text-white transition flex items-center gap-1"
          >
            {showSecrets[bot.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showSecrets[bot.id] ? '비밀정보 숨기기' : '비밀정보 보기'}
          </button>
        </div>
      ))}
    </div>
  );
}

// ========== Prices Tab ==========
function PricesTab() {
  const { prices, setPrices, fetchMarketPrices, pricesFetching } = useStore();
  const [saved, setSaved] = useState(false);

  // Auto-fetch prices on mount
  useEffect(() => {
    if (prices.autoFetchPrices && (Date.now() - prices.lastPriceFetch > 30 * 60 * 1000)) {
      fetchMarketPrices();
    }
  }, []);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const gemUnit = prices.gemBundleMarket / 1000;
  const lastFetchTime = prices.lastPriceFetch
    ? new Date(prices.lastPriceFetch).toLocaleString('ko-KR')
    : '없음';

  return (
    <div className="space-y-6">
      {/* Auto-fetch toggle */}
      <div className="bg-steam-darker rounded-lg border border-steam-border p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold text-white">자동 시세 가져오기</h4>
            <p className="text-xs text-steam-muted mt-0.5">
              Steam 장터에서 보석 더미, 열쇠, 복무권 가격을 자동으로 가져옵니다.
            </p>
          </div>
          <button
            onClick={() => setPrices({ ...prices, autoFetchPrices: !prices.autoFetchPrices })}
            className={`w-12 h-6 rounded-full transition relative ${
              prices.autoFetchPrices ? 'bg-steam-blue' : 'bg-steam-input'
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
              prices.autoFetchPrices ? 'translate-x-6' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchMarketPrices}
            disabled={pricesFetching}
            className="flex items-center gap-2 px-4 py-2 bg-steam-blue text-white text-sm rounded hover:bg-steam-blue/80 transition disabled:opacity-50"
          >
            {pricesFetching ? <Loader2 className="w-4 h-4 spin-slow" /> : <RefreshCw className="w-4 h-4" />}
            지금 가져오기
          </button>
          <span className="text-xs text-steam-muted">마지막 갱신: {lastFetchTime}</span>
        </div>
        {prices.priceFetchError && (
          <div className="flex items-center gap-1 mt-2 text-xs text-danger">
            <AlertCircle className="w-3 h-3" />
            {prices.priceFetchError}
          </div>
        )}
      </div>

      <div className="bg-steam-darker rounded-lg border border-steam-border p-4">
        <h4 className="text-sm font-semibold text-white mb-3">Steam 장터 기준 가격 (₩)</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-steam-muted mb-1">
              보석 더미 (1,000개) 장터가
              {pricesFetching && <Loader2 className="inline w-3 h-3 ml-1 spin-slow" />}
            </label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-steam-muted">₩</span>
              <input
                type="number"
                value={prices.gemBundleMarket}
                onChange={(e) => setPrices({ ...prices, gemBundleMarket: parseFloat(e.target.value) || 0 })}
                className="w-full bg-steam-input text-white px-3 py-2 rounded border border-steam-border text-sm"
              />
            </div>
            <span className="text-xs text-steam-muted mt-1 block">→ 보석 1개 = ₩{gemUnit.toFixed(2)}</span>
          </div>
          <div>
            <label className="block text-xs text-steam-muted mb-1">
              열쇠 장터가
              {pricesFetching && <Loader2 className="inline w-3 h-3 ml-1 spin-slow" />}
            </label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-steam-muted">₩</span>
              <input
                type="number"
                value={prices.keyMarket}
                onChange={(e) => setPrices({ ...prices, keyMarket: parseFloat(e.target.value) || 0 })}
                className="w-full bg-steam-input text-white px-3 py-2 rounded border border-steam-border text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-steam-muted mb-1">
              복무권 장터가
              {pricesFetching && <Loader2 className="inline w-3 h-3 ml-1 spin-slow" />}
            </label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-steam-muted">₩</span>
              <input
                type="number"
                value={prices.ticketMarket}
                onChange={(e) => setPrices({ ...prices, ticketMarket: parseFloat(e.target.value) || 0 })}
                className="w-full bg-steam-input text-white px-3 py-2 rounded border border-steam-border text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-steam-darker rounded-lg border border-steam-border p-4">
        <h4 className="text-sm font-semibold text-white mb-3">거래 배율</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-steam-muted mb-1">구매 배율 (봇이 파는 가격)</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                value={prices.buyMultiplier}
                onChange={(e) => setPrices({ ...prices, buyMultiplier: parseFloat(e.target.value) || 1 })}
                className="w-full bg-steam-input text-white px-3 py-2 rounded border border-steam-border text-sm"
              />
              <span className="text-xs text-steam-muted whitespace-nowrap">({(prices.buyMultiplier * 100).toFixed(0)}%)</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-steam-muted mb-1">판매 배율 (봇이 사는 가격)</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                value={prices.sellMultiplier}
                onChange={(e) => setPrices({ ...prices, sellMultiplier: parseFloat(e.target.value) || 1 })}
                className="w-full bg-steam-input text-white px-3 py-2 rounded border border-steam-border text-sm"
              />
              <span className="text-xs text-steam-muted whitespace-nowrap">({(prices.sellMultiplier * 100).toFixed(0)}%)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-steam-darker rounded-lg border border-steam-border p-4">
        <h4 className="text-sm font-semibold text-white mb-3">키 → 정제 변환</h4>
        <div className="flex items-center gap-2">
          <span className="text-sm text-white">1 키 =</span>
          <input
            type="number"
            step="0.1"
            value={prices.keyToRefined}
            onChange={(e) => setPrices({ ...prices, keyToRefined: parseFloat(e.target.value) || 1 })}
            className="w-24 bg-steam-input text-white px-3 py-2 rounded border border-steam-border text-sm"
          />
          <span className="text-sm text-white">정제금속</span>
        </div>
      </div>

      <button
        onClick={handleSave}
        className="flex items-center gap-2 px-6 py-2 bg-steam-blue text-white rounded-lg text-sm font-medium hover:bg-steam-blue/80 transition"
      >
        {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? '저장 완료!' : '시세 설정 저장'}
      </button>
    </div>
  );
}

// ========== Ratios Tab (with overrides) ==========
function RatiosTab() {
  const { prices, setPrices } = useStore();
  const [saved, setSaved] = useState(false);

  const allCategories: { id: ItemCategory; label: string }[] = [
    { id: 'weapon', label: '무기' },
    { id: 'hat', label: '모자' },
    { id: 'scrap', label: '폐기금속' },
    { id: 'reclaimed', label: '재활용금속' },
    { id: 'refined', label: '정제금속' },
    { id: 'ticket', label: '복무권' },
    { id: 'key', label: '열쇠' },
  ];

  const handleOverride = (cat: ItemCategory, mode: 'buy' | 'sell', value: string) => {
    const key = `${cat}_${mode}`;
    const newOverrides = { ...prices.overrides };
    if (value === '' || isNaN(Number(value))) {
      delete newOverrides[key];
    } else {
      newOverrides[key] = Number(value);
    }
    setPrices({ ...prices, overrides: newOverrides });
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-steam-muted mb-2">
        <AlertCircle className="w-4 h-4" />
        <span>자동 계산된 보석 가격을 확인하고, 필요시 직접 보석 수량을 입력하여 덮어쓸 수 있습니다.</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-steam-border">
              <th className="text-left py-2 px-3 text-steam-muted font-medium text-xs">아이템</th>
              <th className="text-center py-2 px-3 text-steam-muted font-medium text-xs">자동 구매가</th>
              <th className="text-center py-2 px-3 text-gem font-medium text-xs">구매 직접설정</th>
              <th className="text-center py-2 px-3 text-steam-muted font-medium text-xs">자동 판매가</th>
              <th className="text-center py-2 px-3 text-success font-medium text-xs">판매 직접설정</th>
            </tr>
          </thead>
          <tbody>
            {allCategories.map(({ id, label }) => {
              const autoBuy = computeGemPrice(id, 'buy', { ...prices, overrides: {} });
              const autoSell = computeGemPrice(id, 'sell', { ...prices, overrides: {} });
              const buyOverride = prices.overrides[`${id}_buy`];
              const sellOverride = prices.overrides[`${id}_sell`];

              return (
                <tr key={id} className="border-b border-steam-border/30 hover:bg-steam-hover/20">
                  <td className="py-2.5 px-3 text-white font-medium">{label}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-steam-muted flex items-center justify-center gap-1">
                      <Gem className="w-3 h-3" />{autoBuy.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      placeholder={String(autoBuy)}
                      value={buyOverride ?? ''}
                      onChange={(e) => handleOverride(id, 'buy', e.target.value)}
                      className="w-full bg-steam-input text-gem text-center px-2 py-1 rounded border border-steam-border text-xs"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-steam-muted flex items-center justify-center gap-1">
                      <Gem className="w-3 h-3" />{autoSell.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      placeholder={String(autoSell)}
                      value={sellOverride ?? ''}
                      onChange={(e) => handleOverride(id, 'sell', e.target.value)}
                      className="w-full bg-steam-input text-success text-center px-2 py-1 rounded border border-steam-border text-xs"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        onClick={handleSave}
        className="flex items-center gap-2 px-6 py-2 bg-steam-blue text-white rounded-lg text-sm font-medium hover:bg-steam-blue/80 transition"
      >
        {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? '저장 완료!' : '교환비율 저장'}
      </button>
    </div>
  );
}

// ========== Admin Tab ==========
function AdminTab() {
  const {
    adminEnabled, setAdminEnabled, adminLogout, adminToken,
    debug, setDebug,
    weaponBlacklist, hatBlacklist, addToBlacklist, removeFromBlacklist,
  } = useStore();
  const [newWeaponBL, setNewWeaponBL] = useState('');
  const [newHatBL, setNewHatBL] = useState('');
  const [saved, setSaved] = useState(false);
  const [credCurrentPw, setCredCurrentPw] = useState('');
  const [credNewUsername, setCredNewUsername] = useState('');
  const [credNewPw, setCredNewPw] = useState('');
  const [credResult, setCredResult] = useState('');

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Admin toggle */}
      <div className="bg-steam-darker rounded-lg border border-steam-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-white">관리자 진입점</h4>
            <p className="text-xs text-steam-muted mt-1">
              OFF: 푸터 진입점 비활성화 / ON: 저작권 5번 클릭으로 진입
            </p>
          </div>
          <button
            onClick={() => setAdminEnabled(!adminEnabled)}
            className={`w-12 h-6 rounded-full transition relative ${
              adminEnabled ? 'bg-steam-blue' : 'bg-steam-input'
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
              adminEnabled ? 'translate-x-6' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
      </div>

      {/* Debug Mode */}
      <div className="bg-steam-darker rounded-lg border border-steam-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-white">🐛 디버그 모드</h4>
            <p className="text-xs text-steam-muted mt-1">
              ON: 터미널에 거래 상세 로그 출력 (시뮬레이션/실제 구분, 아이템 상세, 보석 상세 등)
            </p>
          </div>
          <button
            onClick={() => setDebug(!debug)}
            className={`w-12 h-6 rounded-full transition relative ${
              debug ? 'bg-yellow-500' : 'bg-steam-input'
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
              debug ? 'translate-x-6' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
        {debug && (
          <p className="text-xs text-yellow-400 mt-2">⚠️ 디버그 모드가 활성화되어 있습니다. 모든 거래 상세 정보가 서버 터미널에 출력됩니다.</p>
        )}
      </div>

      {/* Admin Credentials Change */}
      <div className="bg-steam-darker rounded-lg border border-steam-border p-4">
        <h4 className="text-sm font-semibold text-white mb-3">🔑 관리자 계정 변경</h4>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-steam-muted block mb-1">현재 비밀번호 (필수)</label>
            <input
              type="password"
              value={credCurrentPw}
              onChange={(e) => setCredCurrentPw(e.target.value)}
              placeholder="현재 비밀번호"
              className="w-full bg-steam-input text-white px-3 py-2 rounded border border-steam-border text-xs"
            />
          </div>
          <div>
            <label className="text-xs text-steam-muted block mb-1">새 아이디 (변경 시에만 입력)</label>
            <input
              type="text"
              value={credNewUsername}
              onChange={(e) => setCredNewUsername(e.target.value)}
              placeholder="새 아이디 (2자 이상)"
              className="w-full bg-steam-input text-white px-3 py-2 rounded border border-steam-border text-xs"
            />
          </div>
          <div>
            <label className="text-xs text-steam-muted block mb-1">새 비밀번호 (변경 시에만 입력)</label>
            <input
              type="password"
              value={credNewPw}
              onChange={(e) => setCredNewPw(e.target.value)}
              placeholder="새 비밀번호 (4자 이상)"
              className="w-full bg-steam-input text-white px-3 py-2 rounded border border-steam-border text-xs"
            />
          </div>
          <button
            onClick={async () => {
              if (!credCurrentPw) { setCredResult('❌ 현재 비밀번호를 입력하세요.'); return; }
              if (!credNewUsername && !credNewPw) { setCredResult('❌ 변경할 아이디 또는 비밀번호를 입력하세요.'); return; }
              setCredResult('저장 중...');
              try {
                const res = await fetch('/api/admin/credentials', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
                  body: JSON.stringify({ currentPassword: credCurrentPw, newUsername: credNewUsername || undefined, newPassword: credNewPw || undefined }),
                });
                const data = await res.json();
                if (res.ok) {
                  setCredResult('✅ ' + (data.message || '변경 완료'));
                  setCredCurrentPw(''); setCredNewUsername(''); setCredNewPw('');
                } else {
                  setCredResult('❌ ' + (data.error || '변경 실패'));
                }
              } catch {
                setCredResult('❌ 서버 연결 실패');
              }
              setTimeout(() => setCredResult(''), 5000);
            }}
            disabled={!credCurrentPw}
            className="w-full py-2 bg-gem text-white text-xs rounded hover:bg-gem/80 transition disabled:opacity-50"
          >
            계정 정보 변경
          </button>
          {credResult && (
            <p className={`text-xs ${credResult.startsWith('✅') ? 'text-green-400' : credResult.startsWith('❌') ? 'text-danger' : 'text-steam-muted'}`}>
              {credResult}
            </p>
          )}
        </div>
      </div>

      {/* Weapon Blacklist */}
      <div className="bg-steam-darker rounded-lg border border-steam-border p-4">
        <h4 className="text-sm font-semibold text-white mb-3">🔫 무기 블랙리스트</h4>
        <p className="text-xs text-steam-muted mb-2">이 목록의 무기는 거래에서 제외됩니다.</p>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newWeaponBL}
            onChange={(e) => setNewWeaponBL(e.target.value)}
            placeholder="무기 이름 입력"
            className="flex-1 bg-steam-input text-white px-3 py-1.5 rounded border border-steam-border text-xs"
          />
          <button
            onClick={() => { if (newWeaponBL.trim()) { addToBlacklist('weapon', newWeaponBL.trim()); setNewWeaponBL(''); } }}
            className="px-3 py-1.5 bg-danger text-white text-xs rounded hover:bg-danger/80 transition"
          >
            추가
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {weaponBlacklist.length === 0 && <span className="text-xs text-steam-muted">블랙리스트가 비어있습니다.</span>}
          {weaponBlacklist.map(name => (
            <span key={name} className="flex items-center gap-1 px-2 py-1 bg-danger/10 border border-danger/20 rounded text-xs text-danger">
              {name}
              <button onClick={() => removeFromBlacklist('weapon', name)} className="hover:text-white transition">
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Hat Blacklist */}
      <div className="bg-steam-darker rounded-lg border border-steam-border p-4">
        <h4 className="text-sm font-semibold text-white mb-3">🎩 모자 블랙리스트</h4>
        <p className="text-xs text-steam-muted mb-2">이 목록의 모자는 거래에서 제외됩니다.</p>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newHatBL}
            onChange={(e) => setNewHatBL(e.target.value)}
            placeholder="모자 이름 입력"
            className="flex-1 bg-steam-input text-white px-3 py-1.5 rounded border border-steam-border text-xs"
          />
          <button
            onClick={() => { if (newHatBL.trim()) { addToBlacklist('hat', newHatBL.trim()); setNewHatBL(''); } }}
            className="px-3 py-1.5 bg-danger text-white text-xs rounded hover:bg-danger/80 transition"
          >
            추가
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {hatBlacklist.length === 0 && <span className="text-xs text-steam-muted">블랙리스트가 비어있습니다.</span>}
          {hatBlacklist.map(name => (
            <span key={name} className="flex items-center gap-1 px-2 py-1 bg-danger/10 border border-danger/20 rounded text-xs text-danger">
              {name}
              <button onClick={() => removeFromBlacklist('hat', name)} className="hover:text-white transition">
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2 bg-steam-blue text-white rounded-lg text-sm font-medium hover:bg-steam-blue/80 transition"
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? '저장 완료!' : '관리자 설정 저장'}
        </button>
        <button
          onClick={adminLogout}
          className="flex items-center gap-2 px-6 py-2 bg-danger/20 text-danger rounded-lg text-sm font-medium hover:bg-danger/30 transition"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}

// ========== XIcon for blacklist tags ==========
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ========== Main AdminPanel ==========
export function AdminPanel() {
  const setShowAdmin = useStore(s => s.setShowAdmin);
  const adminLogout = useStore(s => s.adminLogout);
  const loadConfig = useStore(s => s.loadConfigFromServer);
  const saveConfig = useStore(s => s.saveConfigToServer);
  const configLoading = useStore(s => s.configLoading);
  const configError = useStore(s => s.configError);
  const configSaving = useStore(s => s.configSaving);
  const configSaveResult = useStore(s => s.configSaveResult);
  const [activeTab, setActiveTab] = useState<AdminTab>('bot');
  const [saveMsg, setSaveMsg] = useState('');
  const [loaded, setLoaded] = useState(false);

  // 패널 열릴 때 서버에서 설정 불러오기 (1회만)
  useEffect(() => {
    if (!loaded) {
      loadConfig();
      setLoaded(true);
    }
  }, [loaded, loadConfig]);

  const handleSaveAll = async () => {
    setSaveMsg('');
    const success = await saveConfig();
    if (success) {
      setSaveMsg('✅ 모든 설정이 서버에 저장되었습니다!');
    } else {
      setSaveMsg('❌ 저장 실패. 다시 시도해주세요.');
    }
    setTimeout(() => setSaveMsg(''), 4000);
  };

  return (
    <div className="min-h-screen bg-steam-darker">
      {/* Top Bar */}
      <div className="bg-steam-dark border-b border-steam-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAdmin(false)}
              className="flex items-center gap-1 text-sm text-steam-muted hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
              거래소
            </button>
            <div className="w-px h-5 bg-steam-border" />
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-gem" />
              관리자 패널
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* 서버 저장 버튼 */}
            <button
              onClick={handleSaveAll}
              disabled={configSaving}
              className="flex items-center gap-2 px-4 py-1.5 bg-steam-green text-white text-sm rounded font-medium hover:bg-steam-green-dark transition disabled:opacity-50"
            >
              {configSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              💾 모든 설정 서버에 저장
            </button>
            <button
              onClick={adminLogout}
              className="text-xs text-steam-muted hover:text-danger transition"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* 저장 결과 메시지 */}
      {(saveMsg || configSaveResult || configError) && (
        <div className="max-w-5xl mx-auto px-4 pt-3">
          {saveMsg && (
            <div className={`px-4 py-2 rounded text-sm font-medium ${saveMsg.includes('✅') ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
              {saveMsg}
            </div>
          )}
          {!saveMsg && configSaveResult && (
            <div className={`px-4 py-2 rounded text-sm font-medium ${configSaveResult.includes('✅') ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
              {configSaveResult}
            </div>
          )}
          {configError && (
            <div className="px-4 py-2 rounded text-sm font-medium bg-danger/20 text-danger flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              설정 불러오기 실패: {configError}
            </div>
          )}
        </div>
      )}

      {/* 로딩 중 */}
      {configLoading && (
        <div className="max-w-5xl mx-auto px-4 pt-3">
          <div className="px-4 py-2 rounded text-sm bg-steam-blue/20 text-steam-blue flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            서버에서 설정을 불러오는 중...
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-steam-dark border-b border-steam-border">
        <div className="max-w-5xl mx-auto px-4 flex overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                activeTab === id
                  ? 'text-steam-blue border-steam-blue'
                  : 'text-steam-muted border-transparent hover:text-white hover:border-steam-hover'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6 fade-in">
        {activeTab === 'bot' && <BotSettingsTab />}
        {activeTab === 'storage' && <StorageBotsTab />}
        {activeTab === 'prices' && <PricesTab />}
        {activeTab === 'ratios' && <RatiosTab />}
        {activeTab === 'admin' && <AdminTab />}
      </div>
    </div>
  );
}
