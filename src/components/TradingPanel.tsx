import { useStore, computeGemPrice } from '../store';
import { Gem, ShoppingCart, ArrowRightLeft, Loader2, Search, X, PackageOpen, RefreshCw, AlertCircle } from 'lucide-react';
import { useState, useMemo } from 'react';
import { getDisplayName } from '../utils/itemNames';


const categoryLabels: Record<string, string> = {
  weapon: '무기',
  hat: '모자',
  scrap: '고철',
  reclaimed: '재생 금속',
  refined: '정제 금속',
  ticket: '복무권',
  key: '열쇠',
};

export function TradingPanel() {
  const {
    selectedCategory, tradeMode, setTradeMode,
    selectedItems, toggleItem, clearSelection,
    quantity, setQuantity,
    prices, botStatus, isTrading, executeTrade,
    tradeUrl, weaponBlacklist, hatBlacklist,
    userInventory, loadUserInventory,
    botInventory, loadBotInventory,
  } = useStore();

  const [searchTerm, setSearchTerm] = useState('');

  const needsSelection = selectedCategory === 'weapon' || selectedCategory === 'hat';
  const blacklist = selectedCategory === 'weapon' ? weaponBlacklist : hatBlacklist;

  // sell mode = user gives items to bot → show user's inventory
  // buy mode = user buys from bot → show bot's inventory
  const sourceInventory = tradeMode === 'sell' ? userInventory : botInventory;

  const filteredItems = useMemo(() => {
    if (!sourceInventory.loaded) return [];
    return sourceInventory.items.filter(item =>
      item.category === selectedCategory &&
      !blacklist.includes(item.name) &&
      item.tradable &&
      (needsSelection ? item.name.toLowerCase().includes(searchTerm.toLowerCase()) : true)
    );
  }, [sourceInventory, selectedCategory, blacklist, searchTerm, needsSelection]);

  const availableCount = useMemo(() => {
    if (needsSelection) return 0;
    // assetids.length(실제 보유 수량) 합산 - 그룹핑된 아이템의 실제 총 개수
    return filteredItems.reduce((sum, item) => {
      return sum + (item.assetids?.length || item.quantity || 1);
    }, 0);
  }, [filteredItems, needsSelection]);

  // parseSteamInventory에서 이미 그룹핑 완료 (classid_instanceid 기준)
  // item.assetids = 실제 개별 Steam assetid 배열, item.quantity = 실제 보유 수량
  const displayItems = useMemo(() => {
    if (!needsSelection) return [];
    return filteredItems.map(item => ({
      item,
      count: item.assetids?.length || item.quantity || 1,
    }));
  }, [filteredItems, needsSelection]);

  const buyPrice = computeGemPrice(selectedCategory, 'buy', prices);
  const sellPrice = computeGemPrice(selectedCategory, 'sell', prices);
  const currentPrice = tradeMode === 'buy' ? buyPrice : sellPrice;

  const totalItems = needsSelection ? selectedItems.length : quantity;
  const totalGems = currentPrice * totalItems;

  const noTradeUrl = !tradeUrl;
  const inventoryNotLoaded = !sourceInventory.loaded && !sourceInventory.loading;
  const inventoryLoading = sourceInventory.loading;

  const isDisabled = botStatus !== 'online' || noTradeUrl || isTrading ||
    (needsSelection && selectedItems.length === 0) ||
    (!needsSelection && quantity < 1) ||
    !sourceInventory.loaded;

  const maxQuantity = !needsSelection ? availableCount : 0;

  const handleLoadInventory = async () => {
    if (tradeMode === 'sell') {
      await loadUserInventory();
    } else {
      await loadBotInventory();
    }
  };

  const handleModeSwitch = (mode: 'buy' | 'sell') => {
    setTradeMode(mode);
  };

  const getCategoryIcon = (): string => {
    if (!sourceInventory.loaded || filteredItems.length === 0) return '';
    return filteredItems[0]?.iconUrl || '';
  };

  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  const handleImgError = (id: string) => {
    setImgErrors(prev => new Set(prev).add(id));
  };

  return (
    <div className="bg-steam-card border border-steam-border rounded-lg overflow-hidden fade-in">
      {/* Mode Toggle */}
      <div className="flex border-b border-steam-border">
        <button
          onClick={() => handleModeSwitch('buy')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition ${
            tradeMode === 'buy'
              ? 'bg-gem/15 text-gem border-b-2 border-gem'
              : 'text-steam-muted hover:bg-steam-hover/30'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          구매 (보석 → 아이템)
        </button>
        <button
          onClick={() => handleModeSwitch('sell')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition ${
            tradeMode === 'sell'
              ? 'bg-success/15 text-success border-b-2 border-success'
              : 'text-steam-muted hover:bg-steam-hover/30'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          판매 (아이템 → 보석)
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* No Trade URL Warning */}
        {noTradeUrl && (
          <div className="flex items-center gap-3 p-4 bg-warning/10 border border-warning/30 rounded-lg">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-warning">거래 URL을 먼저 입력해주세요</p>
              <p className="text-xs text-steam-muted mt-0.5">상단에서 Steam 거래 URL을 입력하고 저장하면 인벤토리를 불러올 수 있습니다.</p>
            </div>
          </div>
        )}

        {/* Load Inventory Button */}
        {!noTradeUrl && inventoryNotLoaded && !inventoryLoading && !sourceInventory.error && (
          <div className="flex flex-col items-center gap-3 p-6 bg-steam-darker border border-steam-border rounded-lg">
            <PackageOpen className="w-10 h-10 text-steam-muted" />
            <div className="text-center">
              <p className="text-sm font-medium text-white">
                {tradeMode === 'sell' ? '내 인벤토리' : '봇 인벤토리'}를 불러와야 합니다
              </p>
              <p className="text-xs text-steam-muted mt-1">
                아래 버튼을 눌러 {tradeMode === 'sell' ? '보유 중인 아이템' : '구매 가능한 아이템'} 목록을 불러오세요.
              </p>
            </div>
            <button
              onClick={handleLoadInventory}
              className="flex items-center gap-2 px-5 py-2.5 bg-steam-blue text-white text-sm font-medium rounded-lg hover:bg-steam-blue/80 transition"
            >
              <RefreshCw className="w-4 h-4" />
              인벤토리 불러오기
            </button>
          </div>
        )}

        {/* Loading State */}
        {inventoryLoading && (
          <div className="flex flex-col items-center gap-3 p-8 bg-steam-darker border border-steam-border rounded-lg">
            <Loader2 className="w-8 h-8 text-steam-blue spin-slow" />
            <div className="text-center">
              <p className="text-sm font-medium text-white">인벤토리 불러오는 중...</p>
              <p className="text-xs text-steam-muted mt-1">Steam 서버에서 아이템 정보를 가져오고 있습니다.</p>
            </div>
            <div className="w-48 h-1.5 bg-steam-input rounded-full overflow-hidden">
              <div className="h-full bg-steam-blue rounded-full shimmer" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* Inventory Error */}
        {sourceInventory.error && (
          <div className="flex items-center gap-3 p-4 bg-danger/10 border border-danger/30 rounded-lg">
            <AlertCircle className="w-5 h-5 text-danger flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-danger">{sourceInventory.error}</p>
            </div>
            <button onClick={handleLoadInventory} className="text-xs text-steam-blue hover:underline whitespace-nowrap">
              다시 시도
            </button>
          </div>
        )}

        {/* Content when inventory is loaded */}
        {sourceInventory.loaded && (
          <>
            {/* Price Info */}
            <div className="flex items-center justify-between p-3 bg-steam-darker rounded-lg border border-steam-border">
              <div className="flex items-center gap-2 text-sm">
                {getCategoryIcon() && !imgErrors.has('cat_icon') && (
                  <img
                    src={getCategoryIcon()}
                    alt=""
                    className="w-8 h-8 object-contain"
                    onError={() => handleImgError('cat_icon')}
                  />
                )}
                <span className="text-steam-muted">{categoryLabels[selectedCategory]} 1개당</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Gem className="w-4 h-4 text-gem" />
                <span className="text-lg font-bold text-gem">{currentPrice.toLocaleString()}</span>
                <span className="text-xs text-steam-muted">보석</span>
              </div>
            </div>

            {/* Refresh Inventory */}
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">
                {tradeMode === 'sell' ? '내 아이템' : '봇 보유 아이템'}
                <span className="text-steam-muted font-normal ml-1">
                  ({filteredItems.length}개)
                </span>
              </h4>
              <button
                onClick={handleLoadInventory}
                disabled={inventoryLoading}
                className="flex items-center gap-1 text-xs text-steam-blue hover:text-steam-light-blue transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${inventoryLoading ? 'spin-slow' : ''}`} />
                새로고침
              </button>
            </div>

            {/* Item Selection for weapons/hats */}
            {needsSelection && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs text-steam-muted">
                    {tradeMode === 'buy' ? '받을' : '보낼'} {categoryLabels[selectedCategory]} 선택
                  </h4>
                  {selectedItems.length > 0 && (
                    <button onClick={clearSelection} className="text-xs text-steam-muted hover:text-danger transition flex items-center gap-1">
                      <X className="w-3 h-3" />
                      선택 초기화 ({selectedItems.length}개)
                    </button>
                  )}
                </div>

                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steam-muted" />
                  <input
                    type="text"
                    placeholder="아이템 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-steam-input text-sm text-white pl-9 pr-3 py-2 rounded border border-steam-border"
                  />
                </div>

                <div className="max-h-96 overflow-y-auto border border-steam-border rounded-lg">
                  {displayItems.length === 0 ? (
                    <div className="p-6 text-center">
                      <PackageOpen className="w-8 h-8 text-steam-muted mx-auto mb-2" />
                      <p className="text-sm text-steam-muted">
                        {searchTerm ? '검색 결과가 없습니다.' : `거래 가능한 ${categoryLabels[selectedCategory]}이(가) 없습니다.`}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 divide-y divide-steam-border/50">
                      {displayItems.map(({ item, count }) => {
                        // 선택 여부는 item.id 기준으로 체크 (이미 그룹핑된 아이템)
                        const selectedItem = selectedItems.find(si => si.id === item.id);
                        const isSelected = !!selectedItem;
                        const allSelected = isSelected;

                        const handleClick = () => {
                          toggleItem(item);
                        };

                        return (
                          <button
                            key={item.id}
                            onClick={handleClick}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition hover:bg-steam-hover/30 ${
                              isSelected ? 'bg-steam-blue/10' : ''
                            }`}
                          >
                            {/* Checkbox */}
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition flex-shrink-0 ${
                              allSelected ? 'border-steam-blue bg-steam-blue' :
                              isSelected ? 'border-steam-blue bg-steam-blue/50' :
                              'border-steam-border'
                            }`}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>

                            {/* Item Icon */}
                            <div className="w-12 h-12 bg-steam-darker rounded border border-steam-border/50 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {item.iconUrl && !imgErrors.has(item.id) ? (
                                <img
                                  src={item.iconUrl}
                                  alt={item.name}
                                  className="w-11 h-11 object-contain"
                                  loading="lazy"
                                  onError={() => handleImgError(item.id)}
                                />
                              ) : (
                                <div className="w-full h-full bg-steam-input flex items-center justify-center">
                                  <span className="text-lg">
                                    {selectedCategory === 'weapon' ? '🔫' : '🎩'}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Item Info */}
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-white truncate block font-medium">{getDisplayName(item.name)}</span>
                              <span className="text-xs text-steam-muted">
                                {item.quality} · 거래 가능
                                {count > 1 && (
                                  <span className="text-steam-blue ml-1">
                                    보유 {count}개{isSelected ? ' · 선택됨' : ''}
                                  </span>
                                )}
                              </span>
                            </div>

                            {/* Price */}
                            <div className="flex items-center gap-1 text-xs text-gem flex-shrink-0">
                              <Gem className="w-3 h-3" />
                              {currentPrice.toLocaleString()}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quantity for metals/ticket/key */}
            {!needsSelection && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-white">
                    {tradeMode === 'buy' ? '받을' : '보낼'} 수량
                  </h4>
                  <span className="text-xs text-steam-muted">
                    보유: {availableCount}개
                  </span>
                </div>

                {/* Show category item icon */}
                {getCategoryIcon() && !imgErrors.has('qty_icon') && (
                  <div className="flex items-center gap-2 mb-3 p-2 bg-steam-darker rounded border border-steam-border/50">
                    <img
                      src={getCategoryIcon()}
                      alt=""
                      className="w-10 h-10 object-contain"
                      onError={() => handleImgError('qty_icon')}
                    />
                    <span className="text-sm text-white">{categoryLabels[selectedCategory]}</span>
                  </div>
                )}

                {availableCount === 0 ? (
                  <div className="p-4 text-center bg-steam-darker border border-steam-border rounded-lg">
                    <PackageOpen className="w-8 h-8 text-steam-muted mx-auto mb-2" />
                    <p className="text-sm text-steam-muted">
                      {tradeMode === 'sell' ? '보유 중인' : '봇이 보유 중인'} {categoryLabels[selectedCategory]}이(가) 없습니다.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 bg-steam-input rounded border border-steam-border text-white font-bold hover:bg-steam-hover transition"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={maxQuantity}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.min(maxQuantity, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-24 text-center bg-steam-input text-white text-lg font-semibold py-2 rounded border border-steam-border"
                    />
                    <button
                      onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                      className="w-10 h-10 bg-steam-input rounded border border-steam-border text-white font-bold hover:bg-steam-hover transition"
                    >
                      +
                    </button>
                    <div className="flex gap-1 ml-2 flex-wrap">
                      {[5, 10, 25].filter(n => n <= maxQuantity).map(n => (
                        <button
                          key={n}
                          onClick={() => setQuantity(n)}
                          className={`px-2 py-1 text-xs rounded border transition ${
                            quantity === n
                              ? 'border-steam-blue bg-steam-blue/20 text-steam-blue'
                              : 'border-steam-border text-steam-muted hover:border-steam-hover'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                      {maxQuantity > 0 && (
                        <button
                          onClick={() => setQuantity(maxQuantity)}
                          className={`px-2 py-1 text-xs rounded border transition ${
                            quantity === maxQuantity
                              ? 'border-steam-blue bg-steam-blue/20 text-steam-blue'
                              : 'border-steam-border text-steam-muted hover:border-steam-hover'
                          }`}
                        >
                          전체 ({maxQuantity})
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Summary */}
            <div className="bg-steam-darker rounded-lg border border-steam-border p-4 space-y-3">
              <h4 className="text-sm font-semibold text-white">거래 요약</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-3 rounded-lg border ${tradeMode === 'buy' ? 'border-gem/30 bg-gem/5' : 'border-success/30 bg-success/5'}`}>
                  <div className="text-xs text-steam-muted mb-1">
                    {tradeMode === 'buy' ? '💎 지불 (보석)' : '📦 지불 (아이템)'}
                  </div>
                  <div className={`text-lg font-bold ${tradeMode === 'buy' ? 'text-gem' : 'text-success'}`}>
                    {tradeMode === 'buy'
                      ? `${totalGems.toLocaleString()} 보석`
                      : `${totalItems}개`
                    }
                  </div>
                </div>
                <div className={`p-3 rounded-lg border ${tradeMode === 'buy' ? 'border-success/30 bg-success/5' : 'border-gem/30 bg-gem/5'}`}>
                  <div className="text-xs text-steam-muted mb-1">
                    {tradeMode === 'buy' ? '📦 수령 (아이템)' : '💎 수령 (보석)'}
                  </div>
                  <div className={`text-lg font-bold ${tradeMode === 'buy' ? 'text-success' : 'text-gem'}`}>
                    {tradeMode === 'buy'
                      ? `${totalItems}개`
                      : `${totalGems.toLocaleString()} 보석`
                    }
                  </div>
                </div>
              </div>

              <button
                onClick={executeTrade}
                disabled={isDisabled}
                className={`w-full py-3 rounded-lg font-semibold text-white transition flex items-center justify-center gap-2 ${
                  isDisabled
                    ? 'bg-steam-input cursor-not-allowed opacity-50'
                    : tradeMode === 'buy'
                      ? 'bg-gem hover:bg-gem/80 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                      : 'bg-steam-green hover:bg-steam-green-dark shadow-[0_0_20px_rgba(92,126,16,0.2)]'
                }`}
              >
                {isTrading ? (
                  <>
                    <Loader2 className="w-5 h-5 spin-slow" />
                    거래 처리중...
                  </>
                ) : botStatus !== 'online' ? (
                  botStatus === 'maintenance' ? '🔧 봇 점검중' : '🔴 서버 오프라인'
                ) : noTradeUrl ? (
                  '거래 URL을 먼저 입력해주세요'
                ) : !sourceInventory.loaded ? (
                  '인벤토리를 먼저 불러와주세요'
                ) : (
                  <>
                    거래 요청 보내기
                    <span className="text-xs opacity-70">
                      ({tradeMode === 'buy' ? `${totalGems.toLocaleString()} 보석 지불` : `${totalItems}개 지불`})
                    </span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
