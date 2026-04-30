import { useNovelAi } from '../hooks/useNovelAi';

export function NovelAiPanel() {
  const { config, loading, prompt, setPrompt, negativePrompt, setNegativePrompt, imageUrl, generating, error, generate } = useNovelAi();

  return (
    <section className="panel p-4 space-y-3">
      <h3 className="text-lg font-bold">NovelAI 생성 (모듈)</h3>
      <p className="text-xs text-muted">TCshowcase의 NovelAI 기능을 gembot과 분리된 독립 모듈로 구성했습니다.</p>
      {loading ? <p className="text-sm text-muted">설정 로딩 중...</p> : (
        <>
          <div className="text-xs text-muted">상태: {config.enabled ? '활성' : '비활성'} / 모델: {config.model}</div>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="프롬프트" className="input min-h-20" />
          <textarea value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} placeholder="네거티브 프롬프트" className="input min-h-16" />
          <button disabled={!config.enabled || generating || !prompt.trim()} onClick={generate} className="btn-primary px-3 py-2 rounded disabled:opacity-50">
            {generating ? '생성 중...' : '이미지 생성'}
          </button>
          {error && <p className="text-sm text-danger">{error}</p>}
          {imageUrl && <img src={imageUrl} alt="NovelAI result" className="rounded border border-border max-h-80" />}
        </>
      )}
    </section>
  );
}
