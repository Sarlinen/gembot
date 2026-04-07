import { create } from 'zustand';
import type { BotStatus, ItemCategory, TradeMode, TradeResult, StorageBot, PriceConfig, TradableItem, InventoryState } from './types';
import {
  fetchSteamInventory, fetchMarketPrice, fetchBackpackCapacity,
  tradeUrlToSteamId64, hasExcludedPrefix, sendTradeRequest,
  adminLogin as apiAdminLogin,
  STEAM_CDN, MARKET_ITEMS, TF2_MAX_SLOTS,
  type SteamAsset, type SteamDescription, type SteamInventoryResponse,
} from './api';

// ============ Trade URL (localStorage, 1시간) ============
const TRADE_URL_KEY = 'steam_trade_url';
const TRADE_URL_EXPIRY_KEY = 'steam_trade_url_expiry';
const ONE_HOUR = 60 * 60 * 1000;

function getSavedTradeUrl(): string {
  try {
    const url = localStorage.getItem(TRADE_URL_KEY);
    const expiry = localStorage.getItem(TRADE_URL_EXPIRY_KEY);
    if (url && expiry && Date.now() < parseInt(expiry)) return url;
    localStorage.removeItem(TRADE_URL_KEY);
    localStorage.removeItem(TRADE_URL_EXPIRY_KEY);
  } catch { /* ignore */ }
  return '';
}

function saveTradeUrl(url: string) {
  try {
    localStorage.setItem(TRADE_URL_KEY, url);
    localStorage.setItem(TRADE_URL_EXPIRY_KEY, String(Date.now() + ONE_HOUR));
  } catch { /* ignore */ }
}

// ============ Admin Auth ============
const ADMIN_TOKEN_KEY = 'admin_jwt_token';

// ============ 보석 수량 계산 ============
// Steam API의 amount 필드(stackAmount)로 실제 보석 수량 계산
// Sack: assetid 1개에 amount=30 → stackAmount=30 → 30×1000=30,000보석
// 낱개: assetid 1개에 amount=1231 → stackAmount=1231 → 1,231보석
function calcGemCount(items: TradableItem[]): number {
  let total = 0;
  for (const item of items) {
    if (item.category !== 'gem_internal') continue;
    // stackAmount는 항상 Steam API의 amount 필드값 (0이면 1로 처리)
    const sa = (item.stackAmount && item.stackAmount > 0) ? item.stackAmount : 1;
    if (item.isGemSack) {
      // Sack 1개 = 1000보석, stackAmount = Sack 개수
      total += sa * 1000;
    } else {
      // 낱개 보석, stackAmount = 실제 보석 개수
      total += sa;
    }
  }
  return total;
}



// ============ Default Prices ============
const defaultPrices: PriceConfig = {
  gemBundleMarket: 1500,
  keyMarket: 2800,
  ticketMarket: 1200,
  keyToRefined: 62,
  buyMultiplier: 1.10,
  sellMultiplier: 0.85,
  overrides: {},
  autoFetchPrices: true,
  lastPriceFetch: 0,
  priceFetchError: '',
};

// ============ 아이템 분류 ============
function classifyItem(
  asset: SteamAsset,
  desc: SteamDescription,
  blacklists: { weapon: string[]; hat: string[] }
): TradableItem | null {
  if (!desc.tradable) return null;

  const name = desc.market_name || desc.name;
  if (hasExcludedPrefix(name)) return null;

  const tags = desc.tags || [];
  const qualityTag = tags.find(t => t.category === 'Quality');
  const typeTag = tags.find(t => t.category === 'Type');

  const qualityInternal = qualityTag?.internal_name || '';
  const typeInternal = typeTag?.internal_name || '';
  const typeLocalized = typeTag?.localized_tag_name || '';
  const qualityLocalized = qualityTag?.localized_tag_name || '';

  const isUnique = qualityInternal === 'Unique' || qualityInternal === 'rarity4';

  // Steam amount 필드 파싱 (낱개 보석 등)
  const stackAmount = parseInt(String(asset.amount || '1')) || 1;

  let category: ItemCategory | null = null;

  // === 보석 먼저 체크 (classid로 확실하게) ===
  // classid: 667933237 = Sack of Gems (보석 더미)
  // classid: 667924416 = Gems (낱개 보석)
  const isSack =
    desc.classid === '667933237' ||
    name === '보석 더미' || name.toLowerCase().includes('sack of gems') ||
    (desc.market_hash_name || '').toLowerCase().includes('sack of gems') ||
    (desc.market_hash_name || '') === '753-Sack of Gems';

  const isLoose =
    desc.classid === '667924416' ||
    name === '보석' || name.toLowerCase() === 'gems' || name.toLowerCase() === 'gem' ||
    (desc.market_hash_name || '') === '753-Gems' ||
    (desc.market_hash_name || '').toLowerCase() === 'gems';

  if (isSack || isLoose) {
    // stackAmount = Steam asset.amount 필드
    // Sack: amount="30" → stackAmount=30 → 30×1000=30,000보석
    // 낱개: amount="1231" → stackAmount=1231 → 1,231보석
    return {
      id: `${desc.classid}_${desc.instanceid}`,
      name,
      category: 'gem_internal',
      iconUrl: desc.icon_url ? STEAM_CDN + desc.icon_url : '',
      tradable: !!desc.tradable,
      marketable: !!desc.marketable,
      quality: qualityLocalized || '',
      appid: asset.appid,
      contextid: asset.contextid,
      assetid: asset.assetid,
      assetids: [asset.assetid],
      quantity: stackAmount,
      stackAmount, // Steam amount 필드 그대로 저장
      amount: isSack ? 1000 : 1,
      isGemSack: isSack,
    };
  }

  // === Weapons ===
  const weaponTypeNames = ['weapon', 'primary', 'secondary', 'melee', 'pda', 'pda2', 'building'];
  const isWeaponType = weaponTypeNames.some(w => typeInternal.toLowerCase().includes(w)) ||
    typeLocalized.includes('무기') || typeLocalized.includes('Weapon') ||
    typeLocalized.includes('주무기') || typeLocalized.includes('보조무기') ||
    typeLocalized.includes('근접무기');

  if (isWeaponType && isUnique && !desc.marketable) {
    if (!blacklists.weapon.includes(name)) category = 'weapon';
  }

  // === Hats/Cosmetics ===
  if (!category) {
    const isCosmeticType = typeInternal.toLowerCase().includes('cosmetic') ||
      typeInternal.toLowerCase().includes('hat') ||
      typeInternal.toLowerCase().includes('misc') ||
      typeLocalized.includes('장식') || typeLocalized.includes('모자') ||
      typeLocalized.includes('기타') ||
      typeLocalized.includes('Cosmetic') || typeLocalized.includes('Hat');

    if (isCosmeticType) {
      // Unique 등급 엄격 체크 - 태그 없으면 무조건 제외
      const qTag = tags.find(t =>
        t.category === 'Quality' || t.category === 'quality' ||
        t.localized_category_name === '품질'
      );
      if (!qTag) return null;
      const qIsUnique =
        qTag.internal_name === 'Unique' ||
        qTag.internal_name === 'unique' ||
        qTag.localized_tag_name === '고유';
      if (!qIsUnique) return null;

      // 페인트 묻은 모자 제외
      const hasPaint = desc.descriptions?.some(d => {
        const v = (d.value || '').toLowerCase();
        return v.includes('paint') || v.includes('페인트') ||
               v.includes('painted') || v.includes('색칠') || v.includes('도색');
      });
      if (hasPaint) return null;

      // 블랙리스트 체크
      if (!blacklists.hat.includes(name)) category = 'hat';
    }
  }

  // === Metals ===
  if (!category) {
    const lowerName = name.toLowerCase();
    const hashName = (desc.market_hash_name || '').toLowerCase();
    if (
      lowerName === 'scrap metal' || hashName === 'scrap metal' ||
      name === '고철' || name === '폐기 금속' || name === '폐기금속' || name === '고물'
    ) category = 'scrap';
    else if (
      lowerName === 'reclaimed metal' || hashName === 'reclaimed metal' ||
      name === '재생 금속' || name === '재활용 금속' || name === '재활용금속'
    ) category = 'reclaimed';
    else if (
      lowerName === 'refined metal' || hashName === 'refined metal' ||
      name === '정제 금속' || name === '정제금속' || name === '정제된 금속' ||
      name === '고급 금속' || name === '고급금속'
    ) category = 'refined';
  }

  // === Tour of Duty Ticket ===
  if (!category) {
    const hashName = (desc.market_hash_name || '').toLowerCase();
    if (
      name.includes('Tour of Duty Ticket') || hashName.includes('tour of duty ticket') ||
      name === '복무권' || name.includes('복무 기록증') || name.includes('복무기록증') ||
      name.includes('작전 기록증') || name.includes('투어 오브 듀티')
    ) category = 'ticket';
  }

  // === Key ===
  if (!category) {
    const hashName = (desc.market_hash_name || '').toLowerCase();
    if (
      name.includes('Mann Co. Supply Crate Key') || hashName.includes('mann co. supply crate key') ||
      name === '만코 보급 상자 열쇠' || name === '맨코. 보급 상자 열쇠' ||
      name === 'Mann Co. 보급 상자 열쇠' ||
      name.includes('보급 상자 열쇠') || name.includes('보급상자열쇠') ||
      name.includes('Supply Crate Key')
    ) category = 'key';
  }

  if (!category) return null;

  return {
    id: `${desc.classid}_${desc.instanceid}`,
    name,
    category,
    iconUrl: desc.icon_url ? STEAM_CDN + desc.icon_url : '',
    tradable: true,
    marketable: !!desc.marketable,
    quality: qualityLocalized || 'Unique',
    appid: asset.appid,
    contextid: asset.contextid,
    assetid: asset.assetid,
    assetids: [asset.assetid],
    quantity: 1,
    stackAmount: 1,
  };
}

function parseSteamInventory(
  data: SteamInventoryResponse,
  blacklists: { weapon: string[]; hat: string[] }
): TradableItem[] {
  if (!data.assets || !data.descriptions) return [];

  const descMap = new Map<string, SteamDescription>();
  for (const desc of data.descriptions) {
    descMap.set(`${desc.classid}_${desc.instanceid}`, desc);
  }

  const groupMap = new Map<string, TradableItem>();

  for (const asset of data.assets) {
    const desc = descMap.get(`${asset.classid}_${asset.instanceid}`);
    if (!desc) continue;

    const groupKey = `${desc.classid}_${desc.instanceid}`;
    const existing = groupMap.get(groupKey);
    const assetAmount = parseInt(String(asset.amount || '1')) || 1;

    if (existing) {
      if (existing.category === 'gem_internal') {
        // 보석/보석더미: assetid 추가 + amount 누적
        // Steam API: assetid 1개에 amount=N (N개가 묶여있음)
        existing.assetids.push(asset.assetid);
        existing.stackAmount = (existing.stackAmount || 0) + assetAmount;
        existing.quantity = existing.stackAmount;
      } else {
        // 일반 아이템: assetid만 추가
        existing.assetids.push(asset.assetid);
        existing.quantity = existing.assetids.length;
        existing.stackAmount = existing.assetids.length;
      }
    } else {
      const item = classifyItem(asset, desc, blacklists);
      if (item) {
        groupMap.set(groupKey, item);
      }
    }
  }

  return Array.from(groupMap.values());
}

// ============ Computed Prices ============
export function computeGemPrice(
  category: ItemCategory,
  mode: TradeMode,
  prices: PriceConfig
): number {
  const gemUnitPrice = prices.gemBundleMarket / 1000;

  let baseMarketPrice = 0;
  switch (category) {
    case 'weapon': baseMarketPrice = 3; break;
    case 'hat': baseMarketPrice = prices.gemBundleMarket * 0.15; break;
    case 'scrap': baseMarketPrice = prices.keyMarket / prices.keyToRefined / 9; break;
    case 'reclaimed': baseMarketPrice = prices.keyMarket / prices.keyToRefined / 3; break;
    case 'refined': baseMarketPrice = prices.keyMarket / prices.keyToRefined; break;
    case 'ticket': baseMarketPrice = prices.ticketMarket; break;
    case 'key': baseMarketPrice = prices.keyMarket; break;
    default: return 0;
  }

  const gemsValue = gemUnitPrice > 0 ? baseMarketPrice / gemUnitPrice : 0;
  const overrideKey = `${category}_${mode}`;
  if (prices.overrides[overrideKey] !== undefined) {
    return Math.round(prices.overrides[overrideKey]);
  }

  if (mode === 'buy') return Math.round(gemsValue * prices.buyMultiplier);
  return Math.round(gemsValue * prices.sellMultiplier);
}

// ============ Store ============
interface AppState {
  botStatus: BotStatus;
  setBotStatus: (s: BotStatus) => void;

  tradeUrl: string;
  setTradeUrl: (url: string) => void;
  tradeUrlExpiry: number;

  userInventory: InventoryState;
  loadUserInventory: () => Promise<void>;
  resetUserInventory: () => void;

  botInventory: InventoryState;
  loadBotInventory: () => Promise<void>;

  selectedCategory: ItemCategory;
  setSelectedCategory: (c: ItemCategory) => void;
  tradeMode: TradeMode;
  setTradeMode: (m: TradeMode) => void;
  selectedItems: TradableItem[];
  toggleItem: (item: TradableItem) => void;
  clearSelection: () => void;
  quantity: number;
  setQuantity: (n: number) => void;

  tradeResult: TradeResult | null;
  setTradeResult: (r: TradeResult | null) => void;
  isTrading: boolean;
  setIsTrading: (b: boolean) => void;
  executeTrade: () => void;

  prices: PriceConfig;
  setPrices: (p: PriceConfig) => void;
  getPrice: (category: ItemCategory, mode: TradeMode) => number;
  fetchMarketPrices: () => Promise<void>;
  pricesFetching: boolean;

  storageBots: StorageBot[];
  setStorageBots: (bots: StorageBot[]) => void;
  addStorageBot: (bot: StorageBot) => void;
  removeStorageBot: (id: string) => void;
  updateStorageBot: (id: string, data: Partial<StorageBot>) => void;
  fetchBotCapacity: (botId: string) => Promise<void>;
  fetchAllBotCapacities: () => Promise<void>;

  mainBotCapacity: number;
  mainBotUsed: number;
  mainBotCapacityLoading: boolean;
  fetchMainBotCapacity: () => Promise<void>;

  botGemCount: number;
  getBotGemCount: () => number;
  userGemCount: number;
  getUserGemCount: () => number;

  weaponBlacklist: string[];
  hatBlacklist: string[];
  setWeaponBlacklist: (list: string[]) => void;
  setHatBlacklist: (list: string[]) => void;
  addToBlacklist: (type: 'weapon' | 'hat', name: string) => void;
  removeFromBlacklist: (type: 'weapon' | 'hat', name: string) => void;
  applyPublicConfig: (data: Record<string, unknown>) => void;

  adminEnabled: boolean;
  setAdminEnabled: (b: boolean) => void;
  debug: boolean;
  setDebug: (b: boolean) => void;
  isAdminLoggedIn: boolean;
  adminToken: string;
  adminLogin: (username: string, password: string) => Promise<boolean>;
  adminLogout: () => void;
  showAdmin: boolean;
  setShowAdmin: (b: boolean) => void;

  botConfig: {
    username: string;
    password: string;
    identitySecret: string;
    sharedSecret: string;
    apiKey: string;
    steamId64: string;
    customGameName: string;
  };
  setBotConfig: (c: Partial<AppState['botConfig']>) => void;

  configLoading: boolean;
  configError: string;
  configSaving: boolean;
  configSaveResult: string;
  loadConfigFromServer: () => Promise<void>;
  saveConfigToServer: () => Promise<boolean>;
}

export const useStore = create<AppState>((set, get) => ({
  botStatus: 'offline',
  setBotStatus: (s) => set({ botStatus: s }),

  tradeUrl: getSavedTradeUrl(),
  setTradeUrl: (url) => {
    if (url) {
      saveTradeUrl(url);
      set({ tradeUrl: url, tradeUrlExpiry: Date.now() + ONE_HOUR });
    } else {
      try {
        localStorage.removeItem(TRADE_URL_KEY);
        localStorage.removeItem(TRADE_URL_EXPIRY_KEY);
      } catch { /* ignore */ }
      set({
        tradeUrl: '',
        tradeUrlExpiry: 0,
        userInventory: { loaded: false, loading: false, error: '', items: [], steamId64: '' },
        selectedItems: [],
      });
    }
  },
  tradeUrlExpiry: (() => {
    try {
      const exp = localStorage.getItem(TRADE_URL_EXPIRY_KEY);
      return exp ? parseInt(exp) : 0;
    } catch { return 0; }
  })(),

  userInventory: { loaded: false, loading: false, error: '', items: [], steamId64: '' },
  loadUserInventory: async () => {
    const state = get();
    if (!state.tradeUrl) return;
    const steamId64 = tradeUrlToSteamId64(state.tradeUrl);
    if (!steamId64) {
      set({ userInventory: { loaded: false, loading: false, error: '유효하지 않은 거래 URL입니다.', items: [], steamId64: '' } });
      return;
    }
    set({ userInventory: { loaded: false, loading: true, error: '', items: [], steamId64 } });
    try {
      const blacklists = { weapon: state.weaponBlacklist, hat: state.hatBlacklist };

      // TF2(440/2) 인벤토리
      const tf2Data = await fetchSteamInventory(steamId64, 440, 2);
      const tf2Items = parseSteamInventory(tf2Data, blacklists);

      // Steam 커뮤니티(753/6) 인벤토리 - 보석/보석더미
      let gemItems: TradableItem[] = [];
      try {
        const gemData = await fetchSteamInventory(steamId64, 753, 6);
        gemItems = parseSteamInventory(gemData, blacklists);
        console.log(`💎 유저 Steam 커뮤니티 인벤토리: ${gemItems.length}개`);
        for (const g of gemItems.filter(i => i.category === 'gem_internal')) {
          console.log(`  ${g.isGemSack ? '🎒 Sack' : '💎 낱개'}: stackAmount=${g.stackAmount}, calc=${g.isGemSack ? (g.stackAmount||1)*1000 : g.stackAmount||1}`);
        }
      } catch (e) {
        console.warn('유저 Steam 커뮤니티 인벤토리 로드 실패:', e instanceof Error ? e.message : e);
      }

      const items = [...tf2Items, ...gemItems];
      const userGemCount = calcGemCount(items);
      console.log(`💎 유저 보석 수량: ${userGemCount.toLocaleString()}개`);
      set({ userInventory: { loaded: true, loading: false, error: '', items, steamId64 }, userGemCount });
    } catch (err) {
      const message = err instanceof Error ? err.message : '인벤토리를 불러오는 데 실패했습니다.';
      set({ userInventory: { loaded: false, loading: false, error: message, items: [], steamId64 } });
    }
  },
  resetUserInventory: () => {
    set({ userInventory: { loaded: false, loading: false, error: '', items: [], steamId64: '' }, selectedItems: [] });
  },

  botInventory: { loaded: false, loading: false, error: '', items: [], steamId64: '' },
  loadBotInventory: async () => {
    const state = get();
    const botSteamId = state.botConfig.steamId64;
    if (!botSteamId) return;
    set({ botInventory: { loaded: false, loading: true, error: '', items: [], steamId64: botSteamId } });
    try {
      // TF2(440/2) 인벤토리 로드
      const tf2Data = await fetchSteamInventory(botSteamId);
      const blacklists = { weapon: state.weaponBlacklist, hat: state.hatBlacklist };
      const tf2Items = parseSteamInventory(tf2Data, blacklists);

      // Steam 커뮤니티(753/6) 인벤토리 로드 (보석, 보석 더미)
      let gemItems: TradableItem[] = [];
      try {
        const gemData = await fetchSteamInventory(botSteamId, 753, 6);
        gemItems = parseSteamInventory(gemData, blacklists);
        console.log(`💎 Steam 커뮤니티 인벤토리: ${gemItems.length}개 아이템`);
      } catch (e) {
        console.warn('Steam 커뮤니티 인벤토리 로드 실패:', e instanceof Error ? e.message : e);
      }

      const items = [...tf2Items, ...gemItems];

      // calcGemCount로 정확한 보석 수량 계산
      const gemCount = calcGemCount(items);
      console.log(`💎 봇 보석 수량: ${gemCount.toLocaleString()}개`);
      const gemInternal = items.filter(i => i.category === 'gem_internal');
      for (const g of gemInternal) {
        console.log(`  ${g.isGemSack ? '🎒 Sack' : '💎 낱개'}: name=${g.name}, stackAmount=${g.stackAmount}, assetids=${g.assetids.length}개`);
      }

      set({
        botInventory: { loaded: true, loading: false, error: '', items, steamId64: botSteamId },
        botGemCount: gemCount,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '봇 인벤토리를 불러오는 데 실패했습니다.';
      set({ botInventory: { loaded: false, loading: false, error: message, items: [], steamId64: botSteamId } });
    }
  },

  selectedCategory: 'weapon',
  setSelectedCategory: (c) => set({ selectedCategory: c, selectedItems: [], quantity: 1 }),
  tradeMode: 'sell',
  setTradeMode: (m) => set({ tradeMode: m, selectedItems: [], quantity: 1 }),
  selectedItems: [],
  toggleItem: (item) => set((s) => {
    const exists = s.selectedItems.find(i => i.id === item.id);
    if (exists) return { selectedItems: s.selectedItems.filter(i => i.id !== item.id) };
    return { selectedItems: [...s.selectedItems, item] };
  }),
  clearSelection: () => set({ selectedItems: [] }),
  quantity: 1,
  setQuantity: (n) => set({ quantity: Math.max(1, n) }),

  tradeResult: null,
  setTradeResult: (r) => set({ tradeResult: r }),
  isTrading: false,
  setIsTrading: (b) => set({ isTrading: b }),

  executeTrade: () => {
    const state = get();
    if (!state.tradeUrl) {
      set({ tradeResult: { success: false, type: 'error', message: '거래 URL을 먼저 입력해주세요.' } });
      return;
    }
    if (state.botStatus === 'maintenance') {
      set({ tradeResult: { success: false, type: 'error', message: '봇이 점검 중입니다. 잠시 후 다시 시도해주세요.' } });
      return;
    }
    if (state.botStatus === 'offline') {
      set({ tradeResult: { success: false, type: 'error', message: '봇이 오프라인입니다. 서버 상태를 확인해주세요.' } });
      return;
    }

    const cat = state.selectedCategory;
    const needsSelection = cat === 'weapon' || cat === 'hat';
    if (needsSelection && state.selectedItems.length === 0) {
      set({ tradeResult: { success: false, type: 'error', message: '거래할 아이템을 선택해주세요.' } });
      return;
    }
    if (!needsSelection && state.quantity < 1) {
      set({ tradeResult: { success: false, type: 'error', message: '수량을 1개 이상 입력해주세요.' } });
      return;
    }

    // 메인봇 공간 체크 (sell 모드: 봇이 아이템 받음)
    if (state.tradeMode === 'sell') {
      const itemCount = needsSelection ? state.selectedItems.length : state.quantity;
      const mainBotFree = Math.max(0, TF2_MAX_SLOTS - state.mainBotUsed);
      if (itemCount > mainBotFree) {
        set({
          tradeResult: {
            success: false, type: 'error',
            message: `메인봇 배낭 공간 부족. 필요: ${itemCount}칸, 여유: ${mainBotFree}칸 (${state.mainBotUsed}/${TF2_MAX_SLOTS})`,
          },
        });
        return;
      }
    }

    set({ isTrading: true, tradeResult: null });

    // 32자 일회용 보안 토큰
    const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // 아이템 assetid 수집
    const tradeItems: { assetid: string; appid: number; contextid: string; name: string }[] = [];

    if (needsSelection) {
      for (const item of state.selectedItems) {
        const assetid = item.assetids?.[0] || item.assetid;
        if (assetid) tradeItems.push({ assetid, appid: item.appid, contextid: item.contextid, name: item.name });
      }
    } else {
      const source = state.tradeMode === 'sell' ? state.userInventory.items : state.botInventory.items;
      const catItems = source.filter(i => i.category === state.selectedCategory);
      let collected = 0;
      for (const item of catItems) {
        for (const assetid of (item.assetids || [item.assetid])) {
          if (collected >= state.quantity) break;
          if (assetid) { tradeItems.push({ assetid, appid: item.appid, contextid: item.contextid, name: item.name }); collected++; }
        }
        if (collected >= state.quantity) break;
      }
    }

    if (tradeItems.length === 0) {
      set({ tradeResult: { success: false, type: 'error', message: '유효한 아이템이 없습니다. 인벤토리를 새로고침해주세요.' }, isTrading: false });
      return;
    }

    // 보석 계산
    const unitPrice = computeGemPrice(state.selectedCategory, state.tradeMode, state.prices);
    const totalGemCost = needsSelection ? unitPrice * tradeItems.length : unitPrice * state.quantity;

    // 보석은 서버에서 직접 인벤토리를 조회하여 처리
    // 낱개 보석은 assetid 1개에 amount가 실제 수량이므로
    // Steam 거래 시 amount를 분할할 수 없음 → 서버에서 직접 처리
    const gemAssetIds: { assetid: string; appid: number; contextid: string }[] = [];
    if (totalGemCost > 0) {
      console.log(`💎 보석 ${totalGemCost}개 필요 → 서버에서 자동 검색`);
    }

    const tradeData = {
      tradeUrl: state.tradeUrl,
      mode: state.tradeMode,
      category: state.selectedCategory,
      items: tradeItems,
      quantity: needsSelection ? tradeItems.length : state.quantity,
      gemsAmount: totalGemCost,
      gemAssetIds,
      token,
    };

    sendTradeRequest(tradeData)
      .then((result) => {
        if (result.success) {
          set({
            tradeResult: {
              success: true, type: 'success',
              message: '거래 요청이 성공적으로 전송되었습니다! Steam에서 거래를 확인하고 수락해주세요.',
              tradeOfferId: result.tradeOfferId || `trade_${Date.now()}`,
            },
            isTrading: false,
            selectedItems: [],
          });
          setTimeout(() => get().loadBotInventory(), 3000);
        } else {
          set({
            tradeResult: {
              success: false,
              type: (result.type as TradeResult['type']) || 'error',
              message: result.message || '거래 전송 중 오류가 발생했습니다.',
            },
            isTrading: false,
          });
        }
      })
      .catch((err) => {
        set({
          tradeResult: { success: false, type: 'error', message: err instanceof Error ? err.message : '서버에 연결할 수 없습니다.' },
          isTrading: false,
        });
      });
  },

  // ============ 시세 ============
  prices: defaultPrices,
  setPrices: (p) => set({ prices: p }),
  getPrice: (category, mode) => computeGemPrice(category, mode, get().prices),
  pricesFetching: false,
  fetchMarketPrices: async () => {
    set({ pricesFetching: true });
    try {
      const results = await Promise.allSettled([
        fetchMarketPrice(MARKET_ITEMS.gemBundle.appid, MARKET_ITEMS.gemBundle.hashName),
        fetchMarketPrice(MARKET_ITEMS.key.appid, MARKET_ITEMS.key.hashName),
        fetchMarketPrice(MARKET_ITEMS.ticket.appid, MARKET_ITEMS.ticket.hashName),
      ]);
      const gemPrice = results[0].status === 'fulfilled' ? results[0].value : null;
      const keyPrice = results[1].status === 'fulfilled' ? results[1].value : null;
      const ticketPrice = results[2].status === 'fulfilled' ? results[2].value : null;
      const errors: string[] = [];
      if (results[0].status === 'rejected') errors.push('보석 더미');
      if (results[1].status === 'rejected') errors.push('열쇠');
      if (results[2].status === 'rejected') errors.push('복무권');
      set((s) => ({
        prices: {
          ...s.prices,
          ...(gemPrice !== null ? { gemBundleMarket: gemPrice } : {}),
          ...(keyPrice !== null ? { keyMarket: keyPrice } : {}),
          ...(ticketPrice !== null ? { ticketMarket: ticketPrice } : {}),
          lastPriceFetch: Date.now(),
          priceFetchError: errors.length > 0 ? `일부 가격 조회 실패: ${errors.join(', ')}` : '',
        },
        pricesFetching: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '장터 가격을 불러오는 데 실패했습니다.';
      set((s) => ({ prices: { ...s.prices, priceFetchError: message }, pricesFetching: false }));
    }
  },

  // ============ 저장봇 ============
  storageBots: [],
  setStorageBots: (bots) => set({ storageBots: bots }),
  addStorageBot: (bot) => set((s) => ({ storageBots: [...s.storageBots, bot] })),
  removeStorageBot: (id) => set((s) => ({ storageBots: s.storageBots.filter(b => b.id !== id) })),
  updateStorageBot: (id, data) => set((s) => ({
    storageBots: s.storageBots.map(b => b.id === id ? { ...b, ...data } : b),
  })),
  fetchBotCapacity: async (botId) => {
    const state = get();
    const bot = state.storageBots.find(b => b.id === botId);
    if (!bot || !bot.steamId64 || !bot.apiKey) return;
    set((s) => ({ storageBots: s.storageBots.map(b => b.id === botId ? { ...b, capacityLoading: true, capacityError: '' } : b) }));
    try {
      const { used } = await fetchBackpackCapacity(bot.steamId64, bot.apiKey);
      set((s) => ({
        storageBots: s.storageBots.map(b => b.id === botId
          ? { ...b, capacity: TF2_MAX_SLOTS, used, capacityLoading: false, capacityError: '', status: 'online' as BotStatus }
          : b),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '용량 조회 실패';
      set((s) => ({
        storageBots: s.storageBots.map(b => b.id === botId
          ? { ...b, capacityLoading: false, capacityError: message, status: 'offline' as BotStatus }
          : b),
      }));
    }
  },
  fetchAllBotCapacities: async () => {
    const state = get();
    await Promise.all(state.storageBots.map(bot => get().fetchBotCapacity(bot.id)));
  },

  mainBotCapacity: TF2_MAX_SLOTS,
  mainBotUsed: 0,
  mainBotCapacityLoading: false,

  botGemCount: 0,
  getBotGemCount: () => calcGemCount(get().botInventory.items),
  userGemCount: 0,
  getUserGemCount: () => calcGemCount(get().userInventory.items),

  fetchMainBotCapacity: async () => {
    const state = get();
    if (!state.botConfig.steamId64 || !state.botConfig.apiKey) return;
    set({ mainBotCapacityLoading: true });
    try {
      const { used } = await fetchBackpackCapacity(state.botConfig.steamId64, state.botConfig.apiKey);
      set({ mainBotCapacity: TF2_MAX_SLOTS, mainBotUsed: used, mainBotCapacityLoading: false });
    } catch {
      set({ mainBotCapacityLoading: false });
    }
  },

  weaponBlacklist: [],
  hatBlacklist: [],
  setWeaponBlacklist: (list) => set({ weaponBlacklist: list }),
  setHatBlacklist: (list) => set({ hatBlacklist: list }),
  applyPublicConfig: (data: Record<string, unknown>) => {
    if (data.blacklists && typeof data.blacklists === 'object') {
      const bl = data.blacklists as Record<string, unknown>;
      if (Array.isArray(bl.weapon)) set({ weaponBlacklist: bl.weapon as string[] });
      if (Array.isArray(bl.hat)) set({ hatBlacklist: bl.hat as string[] });
    }
    if (data.prices && typeof data.prices === 'object') {
      const p = data.prices as Record<string, unknown>;
      set((s) => ({
        prices: {
          ...s.prices,
          ...(typeof p.gemBundleMarket === 'number' ? { gemBundleMarket: p.gemBundleMarket } : {}),
          ...(typeof p.keyMarket === 'number' ? { keyMarket: p.keyMarket } : {}),
          ...(typeof p.ticketMarket === 'number' ? { ticketMarket: p.ticketMarket } : {}),
          ...(typeof p.keyToRefined === 'number' ? { keyToRefined: p.keyToRefined } : {}),
          ...(typeof p.buyMultiplier === 'number' ? { buyMultiplier: p.buyMultiplier } : {}),
          ...(typeof p.sellMultiplier === 'number' ? { sellMultiplier: p.sellMultiplier } : {}),
          ...(p.overrides && typeof p.overrides === 'object' ? { overrides: p.overrides as Record<string, number> } : {}),
        },
      }));
    }
  },
  addToBlacklist: (type, name) => set((s) => {
    if (type === 'weapon') return { weaponBlacklist: [...s.weaponBlacklist, name] };
    return { hatBlacklist: [...s.hatBlacklist, name] };
  }),
  removeFromBlacklist: (type, name) => set((s) => {
    if (type === 'weapon') return { weaponBlacklist: s.weaponBlacklist.filter(n => n !== name) };
    return { hatBlacklist: s.hatBlacklist.filter(n => n !== name) };
  }),

  // ============ 관리자 ============
  adminEnabled: true,
  setAdminEnabled: (b) => set({ adminEnabled: b }),
  debug: false,
  setDebug: (b: boolean) => set({ debug: b }),
  isAdminLoggedIn: (() => { try { return !!localStorage.getItem(ADMIN_TOKEN_KEY); } catch { return false; } })(),
  adminToken: (() => { try { return localStorage.getItem(ADMIN_TOKEN_KEY) || ''; } catch { return ''; } })(),
  adminLogin: async (username: string, password: string) => {
    const result = await apiAdminLogin(username, password);
    if (result?.token) {
      try { localStorage.setItem(ADMIN_TOKEN_KEY, result.token); } catch { /* ignore */ }
      set({ isAdminLoggedIn: true, adminToken: result.token });
      return true;
    }
    return false;
  },
  adminLogout: () => {
    try { localStorage.removeItem(ADMIN_TOKEN_KEY); } catch { /* ignore */ }
    set({ isAdminLoggedIn: false, adminToken: '', showAdmin: false });
  },
  showAdmin: false,
  setShowAdmin: (b) => set({ showAdmin: b }),

  botConfig: {
    username: '',
    password: '',
    identitySecret: '',
    sharedSecret: '',
    apiKey: '',
    steamId64: '',
    customGameName: 'Steam 보석 거래소',
  },
  setBotConfig: (c) => set((s) => ({ botConfig: { ...s.botConfig, ...c } })),

  // ============ 서버 설정 저장/불러오기 ============
  configLoading: false,
  configError: '',
  configSaving: false,
  configSaveResult: '',

  loadConfigFromServer: async () => {
    const state = get();
    if (!state.adminToken) { set({ configError: '관리자 로그인이 필요합니다.' }); return; }
    set({ configLoading: true, configError: '' });
    try {
      const res = await fetch('/api/admin/config', { headers: { 'Authorization': `Bearer ${state.adminToken}` } });
      if (!res.ok) {
        set({ configLoading: false, configError: res.status === 401 ? '인증 만료. 다시 로그인해주세요.' : `서버 오류 (${res.status})` });
        return;
      }
      const data = await res.json();
      if (!data || typeof data !== 'object') { set({ configLoading: false, configError: '빈 설정 응답' }); return; }

      console.log('📥 서버 설정 로드:', Object.keys(data));

      if (data.bot && typeof data.bot === 'object') {
        const bot = data.bot;
        const updates: Record<string, string> = {};
        if (bot.username !== undefined) updates.username = bot.username;
        if (bot.apiKey !== undefined) updates.apiKey = bot.apiKey;
        if (bot.steamId64 !== undefined) updates.steamId64 = bot.steamId64;
        if (bot.customGameName !== undefined) updates.customGameName = bot.customGameName;
        if (bot.password !== undefined) updates.password = bot.password;
        if (bot.identitySecret !== undefined) updates.identitySecret = bot.identitySecret;
        if (bot.sharedSecret !== undefined) updates.sharedSecret = bot.sharedSecret;
        set((s) => ({ botConfig: { ...s.botConfig, ...updates }, botStatus: (bot.status as BotStatus) || s.botStatus }));
      }

      if (data.prices && typeof data.prices === 'object') {
        const p = data.prices;
        set((s) => ({
          prices: {
            ...s.prices,
            ...(typeof p.gemBundleMarket === 'number' ? { gemBundleMarket: p.gemBundleMarket } : {}),
            ...(typeof p.keyMarket === 'number' ? { keyMarket: p.keyMarket } : {}),
            ...(typeof p.ticketMarket === 'number' ? { ticketMarket: p.ticketMarket } : {}),
            ...(typeof p.keyToRefined === 'number' ? { keyToRefined: p.keyToRefined } : {}),
            ...(typeof p.buyMultiplier === 'number' ? { buyMultiplier: p.buyMultiplier } : {}),
            ...(typeof p.sellMultiplier === 'number' ? { sellMultiplier: p.sellMultiplier } : {}),
            ...(p.overrides && typeof p.overrides === 'object' ? { overrides: p.overrides } : {}),
          },
        }));
      }

      if (Array.isArray(data.storageBots)) {
        const bots: StorageBot[] = data.storageBots.map((sb: Record<string, unknown>) => {
          return {
            id: (sb.id as string) || `storage_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            name: (sb.name as string) || '',
            username: (sb.username as string) || '',
            password: (sb.password as string) || '',
            identitySecret: (sb.identitySecret as string) || '',
            sharedSecret: (sb.sharedSecret as string) || '',
            apiKey: (sb.apiKey as string) || '',
            steamId64: (sb.steamId64 as string) || '',
            status: (sb.status as BotStatus) || 'offline',
            capacity: (sb.capacity as number) || TF2_MAX_SLOTS,
            used: (sb.used as number) || 0,
            capacityLoading: false,
            capacityError: '',
          };
        });
        set({ storageBots: bots });
      }

      if (data.blacklists && typeof data.blacklists === 'object') {
        if (Array.isArray(data.blacklists.weapon)) set({ weaponBlacklist: data.blacklists.weapon });
        if (Array.isArray(data.blacklists.hat)) set({ hatBlacklist: data.blacklists.hat });
      }

      if (data.admin && typeof data.admin === 'object') {
        if (typeof data.admin.enabled === 'boolean') set({ adminEnabled: data.admin.enabled });
        if (typeof data.admin.debug === 'boolean') set({ debug: data.admin.debug });
      }

      if (data.botStatus) set({ botStatus: data.botStatus as BotStatus });

      set({ configLoading: false, configError: '' });
      console.log('✅ 서버 설정 로드 완료');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '설정 불러오기 실패';
      set({ configLoading: false, configError: msg });
    }
  },

  saveConfigToServer: async () => {
    const state = get();
    if (!state.adminToken) { set({ configSaveResult: '❌ 관리자 로그인이 필요합니다.' }); return false; }
    set({ configSaving: true, configSaveResult: '' });
    try {
      const payload = {
        bot: {
          username: state.botConfig.username,
          password: state.botConfig.password,
          identitySecret: state.botConfig.identitySecret,
          sharedSecret: state.botConfig.sharedSecret,
          apiKey: state.botConfig.apiKey,
          steamId64: state.botConfig.steamId64,
          customGameName: state.botConfig.customGameName,
          status: state.botStatus,
        },
        prices: {
          gemBundleMarket: state.prices.gemBundleMarket,
          keyMarket: state.prices.keyMarket,
          ticketMarket: state.prices.ticketMarket,
          keyToRefined: state.prices.keyToRefined,
          buyMultiplier: state.prices.buyMultiplier,
          sellMultiplier: state.prices.sellMultiplier,
          overrides: state.prices.overrides,
        },
        storageBots: state.storageBots.map(sb => ({
          id: sb.id, name: sb.name, username: sb.username,
          password: sb.password,
          identitySecret: sb.identitySecret,
          sharedSecret: sb.sharedSecret,
          apiKey: sb.apiKey, steamId64: sb.steamId64,
          status: sb.status, capacity: sb.capacity, used: sb.used,
        })),
        blacklists: { weapon: state.weaponBlacklist, hat: state.hatBlacklist },
        admin: { enabled: state.adminEnabled, debug: state.debug },
        botStatus: state.botStatus,
      };

      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.adminToken}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        const errMsg = (errData as Record<string, string>).error || `저장 실패 (${res.status})`;
        set({ configSaving: false, configSaveResult: `❌ ${errMsg}` });
        return false;
      }

      set({ configSaving: false, configSaveResult: '✅ 저장 완료!' });
      console.log('✅ 설정 저장 완료');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '저장 오류';
      set({ configSaving: false, configSaveResult: `❌ ${msg}` });
      return false;
    }
  },
}));

export { tradeUrlToSteamId64, MARKET_ITEMS };
export { EXCLUDED_PREFIXES } from './api';
