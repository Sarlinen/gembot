// ============================================================
// Steam API 서비스 레이어
// 모든 요청은 백엔드 서버(/api/*)를 통해 처리됩니다.
// 백엔드 서버(server/server.js)가 반드시 실행 중이어야 합니다.
// ============================================================

// ============================================================
// Steam 인벤토리 API 타입
// ============================================================
export interface SteamAsset {
  appid: number;
  contextid: string;
  assetid: string;
  classid: string;
  instanceid: string;
  amount: string;
}

export interface SteamTag {
  category: string;
  internal_name: string;
  localized_category_name?: string;
  localized_tag_name?: string;
  color?: string;
}

export interface SteamDescriptionEntry {
  type?: string;
  value: string;
  color?: string;
}

export interface SteamDescription {
  appid: number;
  classid: string;
  instanceid: string;
  name: string;
  market_name: string;
  market_hash_name: string;
  icon_url: string;
  icon_url_large?: string;
  tradable: number;
  marketable: number;
  commodity: number;
  type: string;
  tags?: SteamTag[];
  descriptions?: SteamDescriptionEntry[];
}

export interface SteamInventoryResponse {
  assets?: SteamAsset[];
  descriptions?: SteamDescription[];
  total_inventory_count?: number;
  success?: number;
  more_items?: number;
  last_assetid?: string;
  error?: string;
}

export interface MarketPriceResponse {
  success: boolean;
  lowest_price?: string;
  median_price?: string;
  volume?: string;
}

export interface BackpackCapacityResponse {
  capacity: number;
  used: number;
  isFull: boolean;
}

// TF2 배낭 최대 슬롯 수 (300칸에서 여유분 100칸을 뺀 실사용 가능 칸수)
export const TF2_MAX_SLOTS = 200;

// ============================================================
// Steam CDN
// ============================================================
export const STEAM_CDN = 'https://community.akamai.steamstatic.com/economy/image/';

// ============================================================
// 내부 헬퍼: API 호출 + 에러 처리
// ============================================================
async function apiFetch(url: string, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
    }
    // fetch 자체가 실패 = 서버가 꺼져있거나 네트워크 오류
    throw new Error('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
  }
}

async function parseJsonResponse(response: Response, context: string): Promise<unknown> {
  const text = await response.text();
  if (!text || text.trim() === '') {
    throw new Error(`${context}: 서버가 빈 응답을 반환했습니다.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    // HTML 응답인지 체크
    if (text.trim().startsWith('<')) {
      throw new Error(`${context}: 서버가 HTML 응답을 반환했습니다. 서버 상태를 확인해주세요.`);
    }
    throw new Error(`${context}: 서버 응답을 파싱할 수 없습니다.`);
  }
}

// ============================================================
// 인벤토리 가져오기
// ============================================================
export async function fetchSteamInventory(steamId64: string, appid = 440, contextid = 2): Promise<SteamInventoryResponse> {
  if (!/^\d{17}$/.test(steamId64)) {
    throw new Error('유효하지 않은 Steam ID64입니다.');
  }

  const allAssets: SteamAsset[] = [];
  const descMap = new Map<string, SteamDescription>();
  let lastAssetId: string | undefined;
  let hasMore = true;
  let pageCount = 0;
  const MAX_PAGES = 50;

  while (hasMore && pageCount < MAX_PAGES) {
    pageCount++;

    const params = new URLSearchParams();
    params.set('appid', String(appid));
    params.set('contextid', String(contextid));
    if (lastAssetId) params.set('start_assetid', lastAssetId);
    const qs = params.toString();
    const apiUrl = `/api/inventory/${steamId64}?${qs}`;

    const response = await apiFetch(apiUrl, 35000);

    if (!response.ok) {
      // 서버가 JSON 에러를 반환하는지 확인
      let errorMsg = `인벤토리 로드 실패 (HTTP ${response.status})`;
      try {
        const errData = await response.json() as { error?: string };
        if (errData.error) errorMsg = errData.error;
      } catch {
        // JSON이 아닌 에러 응답
      }
      throw new Error(errorMsg);
    }

    const data = await parseJsonResponse(response, '인벤토리') as SteamInventoryResponse;

    if (data.success === 0 || data.success === false as unknown as number) {
      throw new Error(data.error || '인벤토리를 가져올 수 없습니다. 인벤토리가 비공개이거나 Steam ID가 올바르지 않습니다.');
    }

    if (data.assets) allAssets.push(...data.assets);
    if (data.descriptions) {
      for (const desc of data.descriptions) {
        const key = `${desc.classid}_${desc.instanceid}`;
        if (!descMap.has(key)) {
          descMap.set(key, desc);
        }
      }
    }

    if (data.more_items && data.last_assetid) {
      lastAssetId = data.last_assetid;
    } else {
      hasMore = false;
    }
  }

  return {
    assets: allAssets,
    descriptions: Array.from(descMap.values()),
    total_inventory_count: allAssets.length,
    success: 1,
  };
}

// ============================================================
// 장터 가격 가져오기 (KRW)
// ============================================================
export async function fetchMarketPrice(appid: number, marketHashName: string): Promise<number> {
  const response = await apiFetch(
    `/api/market/price?appid=${appid}&name=${encodeURIComponent(marketHashName)}`,
    15000
  );

  if (!response.ok) {
    throw new Error(`장터 가격 조회 실패: ${marketHashName} (HTTP ${response.status})`);
  }

  const data = await parseJsonResponse(response, `장터 가격 (${marketHashName})`) as MarketPriceResponse;

  if (!data.success) {
    throw new Error(`장터에서 가격을 찾을 수 없습니다: ${marketHashName}`);
  }

  // "₩ 1,234" 또는 "1234₩" 또는 "₩1,234.56" 형식 파싱
  const priceStr = data.lowest_price || data.median_price || '0';
  const numStr = priceStr.replace(/[^\d.,]/g, '').replace(/,/g, '');
  const price = parseFloat(numStr);
  if (isNaN(price) || price <= 0) throw new Error(`유효하지 않은 가격: ${priceStr}`);
  return Math.round(price);
}

// ============================================================
// 배낭 용량 가져오기
// ============================================================
export async function fetchBackpackCapacity(steamId64: string, apiKey: string): Promise<BackpackCapacityResponse> {
  const response = await apiFetch(
    `/api/backpack/${steamId64}?key=${encodeURIComponent(apiKey)}`,
    15000
  );

  if (!response.ok) throw new Error(`배낭 용량 조회 실패 (HTTP ${response.status})`);

  const data = await parseJsonResponse(response, '배낭 용량') as Record<string, unknown>;

  if (typeof data.capacity === 'number' && typeof data.used === 'number') {
    const used = data.used as number;
    return {
      capacity: TF2_MAX_SLOTS,
      used,
      isFull: used >= TF2_MAX_SLOTS,
    };
  }

  const result = data.result as Record<string, unknown> | undefined;
  const used = Array.isArray(result?.items) ? (result.items as unknown[]).length : 0;
  return {
    capacity: TF2_MAX_SLOTS,
    used,
    isFull: used >= TF2_MAX_SLOTS,
  };
}

// ============================================================
// 거래 요청 전송
// ============================================================
export async function sendTradeRequest(tradeData: {
  tradeUrl: string;
  mode: 'buy' | 'sell';
  category: string;
  items: { assetid: string; appid: number; contextid: string; name: string }[];
  quantity: number;
  token: string;
}): Promise<{ success: boolean; tradeOfferId?: string; type?: string; message?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  let response: Response;
  try {
    response = await fetch('/api/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tradeData),
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('거래 요청 시간이 초과되었습니다.');
    }
    throw new Error('서버에 연결할 수 없습니다.');
  }

  const data = await response.json().catch(() => ({})) as Record<string, unknown>;

  if (!response.ok) {
    return {
      success: false,
      type: (data.type as string) || 'error',
      message: (data.message as string) || '거래 전송 중 오류가 발생했습니다.',
    };
  }

  return {
    success: data.success !== false,
    tradeOfferId: data.tradeOfferId as string | undefined,
    type: (data.type as string) || (data.success !== false ? 'success' : 'error'),
    message: (data.message as string) || '거래 요청이 전송되었습니다.',
  };
}

// ============================================================
// 관리자 API
// ============================================================
export async function adminLogin(username: string, password: string): Promise<{ token: string } | null> {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function adminGetConfig(jwtToken: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch('/api/admin/config', {
      headers: { 'Authorization': `Bearer ${jwtToken}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function adminSaveConfig(jwtToken: string, updates: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
      },
      body: JSON.stringify(updates),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ============================================================
// 봇 상태 가져오기
// ============================================================
export async function fetchBotHealth(): Promise<{ status: string; botReady: boolean; steamModules?: boolean; steamId64?: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('/api/health', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ============================================================
// 유틸리티
// ============================================================
export const MARKET_ITEMS = {
  gemBundle: { appid: 753, hashName: 'Sack of Gems' },
  key: { appid: 440, hashName: 'Mann Co. Supply Crate Key' },
  ticket: { appid: 440, hashName: 'Tour of Duty Ticket' },
} as const;

export function tradeUrlToSteamId64(tradeUrl: string): string {
  const match = tradeUrl.match(/partner=(\d+)/);
  if (!match) return '';
  const partnerId = parseInt(match[1]);
  if (isNaN(partnerId) || partnerId <= 0) return '';
  return (BigInt('76561197960265728') + BigInt(partnerId)).toString();
}

export const EXCLUDED_PREFIXES = [
  'Festivized', 'Festive', 'Killstreak', 'Specialized Killstreak', 'Professional Killstreak',
  'Australium', 'Strange', 'Vintage', 'Genuine', 'Haunted', "Collector's", 'Unusual',
];

export function hasExcludedPrefix(name: string): boolean {
  return EXCLUDED_PREFIXES.some(p => name.startsWith(p + ' '));
}
