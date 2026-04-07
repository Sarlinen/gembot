import { useStore } from '../store';
import { Gem, Wifi, WifiOff, Wrench } from 'lucide-react';

export function Header() {
  const botStatus = useStore(s => s.botStatus);
  const botGemCount = useStore(s => s.botGemCount);
  const userGemCount = useStore(s => s.userGemCount);
  const botInventory = useStore(s => s.botInventory);
  const userInventory = useStore(s => s.userInventory);

  const statusConfig = {
    online:      { label: '온라인',           color: 'bg-success',  textColor: 'text-success',  borderColor: 'border-success/30',  bgColor: 'bg-success/10',  icon: Wifi },
    offline:     { label: '🔴 서버 오프라인', color: 'bg-danger',   textColor: 'text-danger',   borderColor: 'border-danger/30',   bgColor: 'bg-danger/10',   icon: WifiOff },
    maintenance: { label: '🔧 봇 점검중',     color: 'bg-warning',  textColor: 'text-warning',  borderColor: 'border-warning/30',  bgColor: 'bg-warning/10',  icon: Wrench },
  };

  const status = statusConfig[botStatus];
  const StatusIcon = status.icon;

  const fmt = (n: number) => n.toLocaleString();

  const botLoaded = botInventory.loaded;
  const userLoaded = userInventory.loaded;

  return (
    <header className="bg-steam-dark border-b border-steam-border">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">

        {/* 로고 */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-gem/20 flex items-center justify-center gem-pulse shrink-0">
            <Gem className="w-6 h-6 text-gem" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Steam 보석 거래소
            </h1>
            <p className="text-xs text-steam-muted">TF2 아이템 ↔ 보석 자동 거래</p>
          </div>
        </div>

        {/* 우측: 보석 수량 + 봇 상태 */}
        <div className="flex items-center gap-3 shrink-0">

          {/* 보석 수량: [봇] : [유저] */}
          {botLoaded && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gem/30 bg-gem/10">
              <Gem className="w-3.5 h-3.5 text-gem shrink-0" />
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                {/* 봇 보석 */}
                <span className="text-gem" title="봇 보유 보석">
                  {fmt(botGemCount)}
                </span>
                {/* 구분자 */}
                <span className="text-gem/40 font-normal">:</span>
                {/* 유저 보석 */}
                {userLoaded ? (
                  <span className="text-blue-400" title="유저 보유 보석">
                    {fmt(userGemCount)}
                  </span>
                ) : (
                  <span className="text-steam-muted text-xs" title="유저 인벤토리 미로드">
                    —
                  </span>
                )}
              </div>
              <span className="text-xs text-gem/60">보석</span>
            </div>
          )}

          {/* 봇 상태 */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${status.borderColor} ${status.bgColor}`}>
            <StatusIcon className={`w-4 h-4 ${status.textColor}`} />
            <span className={`text-sm font-medium ${status.textColor}`}>{status.label}</span>
            <span className={`w-2 h-2 rounded-full ${status.color} ${botStatus === 'online' ? 'animate-pulse' : ''}`} />
          </div>
        </div>

      </div>
    </header>
  );
}
