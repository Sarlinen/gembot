interface ServerErrorBannerProps {
  checking: boolean;
  serverError: boolean;
  onRetry: () => void;
}

export function ServerErrorBanner({ checking, serverError, onRetry }: ServerErrorBannerProps) {
  if (checking || !serverError) {
    return null;
  }

  return (
    <div className="bg-danger/20 border-b border-danger/40 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center gap-3">
        <span className="text-danger text-lg">⚠️</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-danger">서버에 연결할 수 없습니다</p>
          <p className="text-xs text-danger/80 mt-0.5">
            백엔드 서버가 실행 중인지 확인해주세요. <code className="bg-danger/20 px-1 rounded">cd server && node server.js</code>
          </p>
        </div>
        <button
          onClick={onRetry}
          className="px-3 py-1.5 bg-danger/30 text-danger text-xs font-medium rounded hover:bg-danger/40 transition"
        >
          재연결
        </button>
      </div>
    </div>
  );
}
