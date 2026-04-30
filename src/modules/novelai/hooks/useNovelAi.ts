import { useEffect, useState } from 'react';
import { generateNovelAiImage, getNovelAiConfig } from '../../../api';
import type { NovelAiConfig } from '../types';

const DEFAULT_CONFIG: NovelAiConfig = { enabled: false, cost: 0, model: 'nai-diffusion-4-5-curated' };

export function useNovelAi() {
  const [config, setConfig] = useState<NovelAiConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getNovelAiConfig()
      .then(data => setConfig(data))
      .catch(() => setError('NovelAI 설정을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  const generate = async () => {
    if (!prompt.trim() || generating || !config.enabled) return;
    setGenerating(true);
    setError('');
    setImageUrl('');
    try {
      const res = await generateNovelAiImage({ prompt, negativePrompt, model: config.model });
      setImageUrl(res.imageUrl);
    } catch (e: any) {
      setError(e.message || '이미지 생성 실패');
    } finally {
      setGenerating(false);
    }
  };

  return { config, loading, prompt, setPrompt, negativePrompt, setNegativePrompt, imageUrl, generating, error, generate };
}
