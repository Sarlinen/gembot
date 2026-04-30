export interface NovelAiConfig {
  enabled: boolean;
  cost: number;
  model: string;
}

export interface NovelAiGenerateResponse {
  imageUrl: string;
}
