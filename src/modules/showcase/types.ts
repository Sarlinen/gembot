export interface ShowcaseSet {
  appId: number;
  gameName: string;
  completeSets: number;
  sellPrice: number;
}

export type ShowcaseSortKey = 'name' | 'sets' | 'price';
export type ShowcaseSortDir = 'asc' | 'desc';
