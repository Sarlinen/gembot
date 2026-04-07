export type BotStatus = 'online' | 'offline' | 'maintenance';

// gem_internal = 보석 (UI에 표시 안 됨, 거래 시 자동으로 포함)
export type ItemCategory = 'weapon' | 'hat' | 'scrap' | 'reclaimed' | 'refined' | 'ticket' | 'key' | 'gem_internal';

export type TradeMode = 'buy' | 'sell';

export interface TradableItem {
  id: string;
  name: string;
  category: ItemCategory;
  iconUrl: string;
  tradable: boolean;
  marketable: boolean;
  quality: string;
  appid: number;
  contextid: string;
  assetid: string;
  assetids: string[];
  amount?: number;      // 낱개 보석: 1, 보석 더미: 1000
  quantity?: number;    // 인벤토리에서 가진 개수 (assetids.length)
  stackAmount?: number; // Steam amount 필드 (낱개 보석 등 스택 수량)
  isGemSack?: boolean;  // true = Sack of Gems (1000개짜리 더미)
}

export interface PriceInfo {
  marketPrice: number;
  buyPrice: number;
  sellPrice: number;
  override?: number;
}

export interface StorageBot {
  id: string;
  name: string;
  username: string;
  password: string;
  identitySecret: string;
  sharedSecret: string;
  apiKey: string;
  steamId64: string;
  status: BotStatus;
  capacity: number;
  used: number;
  capacityLoading: boolean;
  capacityError: string;
}

export interface BotConfig {
  username: string;
  password: string;
  identitySecret: string;
  sharedSecret: string;
  apiKey: string;
  steamId64: string;
  customGameName: string;
  status: BotStatus;
}

export interface PriceConfig {
  gemBundleMarket: number;
  keyMarket: number;
  ticketMarket: number;
  keyToRefined: number;
  buyMultiplier: number;
  sellMultiplier: number;
  overrides: Record<string, number>;
  autoFetchPrices: boolean;
  lastPriceFetch: number;
  priceFetchError: string;
}

export interface AdminConfig {
  adminEnabled: boolean;
  adminPasswordHash: string;
  weaponBlacklist: string[];
  hatBlacklist: string[];
  debug: boolean;
}

export interface TradeResult {
  success: boolean;
  type: 'success' | 'escrow' | 'tradeban' | 'vacban' | 'communityban' | 'error' | 'no_space';
  message: string;
  tradeOfferId?: string;
}

export interface InventoryState {
  loaded: boolean;
  loading: boolean;
  error: string;
  items: TradableItem[];
  steamId64: string;
}

export interface AppConfig {
  bot: BotConfig;
  storageBots: StorageBot[];
  prices: PriceConfig;
  admin: AdminConfig;
}
