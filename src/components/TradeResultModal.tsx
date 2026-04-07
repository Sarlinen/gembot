import { useStore } from '../store';
import { CheckCircle, XCircle, AlertTriangle, ExternalLink, X } from 'lucide-react';

export function TradeResultModal() {
  const { tradeResult, setTradeResult } = useStore();

  if (!tradeResult) return null;

  const icons = {
    success: <CheckCircle className="w-12 h-12 text-success" />,
    escrow: <AlertTriangle className="w-12 h-12 text-warning" />,
    tradeban: <XCircle className="w-12 h-12 text-danger" />,
    vacban: <XCircle className="w-12 h-12 text-danger" />,
    communityban: <XCircle className="w-12 h-12 text-danger" />,
    error: <XCircle className="w-12 h-12 text-danger" />,
    no_space: <AlertTriangle className="w-12 h-12 text-warning" />,
  };

  const titles = {
    success: '거래 요청 완료!',
    escrow: '에스크로 계정',
    tradeban: '거래 제한',
    vacban: 'VAC 밴 감지',
    communityban: '커뮤니티 밴',
    error: '거래 오류',
    no_space: '저장 공간 부족',
  };

  const bgColors = {
    success: 'border-success/30',
    escrow: 'border-warning/30',
    tradeban: 'border-danger/30',
    vacban: 'border-danger/30',
    communityban: 'border-danger/30',
    error: 'border-danger/30',
    no_space: 'border-warning/30',
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
      <div className={`bg-steam-dark border-2 ${bgColors[tradeResult.type]} rounded-xl max-w-md w-full p-6 relative`}>
        <button
          onClick={() => setTradeResult(null)}
          className="absolute top-4 right-4 text-steam-muted hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center space-y-4">
          {icons[tradeResult.type]}
          <h3 className="text-xl font-bold text-white">{titles[tradeResult.type]}</h3>
          <p className="text-sm text-steam-muted leading-relaxed">{tradeResult.message}</p>

          {tradeResult.success && tradeResult.tradeOfferId && (
            <a
              href="https://steamcommunity.com/my/tradeoffers/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-6 py-3 bg-steam-blue text-white rounded-lg font-semibold hover:bg-steam-blue/80 transition shadow-lg"
            >
              <ExternalLink className="w-4 h-4" />
              Steam 거래 확인하기
            </a>
          )}

          <button
            onClick={() => setTradeResult(null)}
            className="px-6 py-2 bg-steam-input text-steam-muted rounded-lg hover:bg-steam-hover hover:text-white transition text-sm"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
