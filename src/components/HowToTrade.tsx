import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function HowToTrade() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-steam-card border border-steam-border rounded-lg overflow-hidden fade-in">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-steam-hover/30 transition"
      >
        <span className="text-sm font-semibold text-white">📖 거래 방법</span>
        {open ? <ChevronUp className="w-4 h-4 text-steam-muted" /> : <ChevronDown className="w-4 h-4 text-steam-muted" />}
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-steam-muted space-y-2 border-t border-steam-border pt-3">
          <div className="flex items-start gap-2">
            <span className="text-steam-blue font-bold">1.</span>
            <span>위에 Steam 거래 URL을 입력하고 저장하세요. (1시간 동안 유지됩니다)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-steam-blue font-bold">2.</span>
            <span>거래할 아이템 종류를 선택하세요. (무기, 모자, 폐기금속, 재활용금속, 정제금속, 복무권, 열쇠)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-steam-blue font-bold">3.</span>
            <span><strong className="text-gem">구매</strong> 또는 <strong className="text-success">판매</strong>를 선택한 뒤 <strong className="text-steam-blue">인벤토리 불러오기</strong> 버튼을 눌러주세요.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-steam-blue font-bold">4.</span>
            <span>목록에서 거래할 아이템을 직접 선택하거나 수량을 입력하세요.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-steam-blue font-bold">5.</span>
            <span>거래 요청 버튼을 누르면 Steam 거래 제안이 전송됩니다.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-steam-blue font-bold">6.</span>
            <span>Steam 클라이언트 또는 모바일 앱에서 거래를 수락하세요.</span>
          </div>
          <div className="mt-3 p-2 bg-warning/10 border border-warning/20 rounded text-xs text-warning">
            ⚠️ Steam Guard 모바일 인증이 활성화되어 있어야 합니다. 에스크로(7일 대기) 계정은 거래가 불가합니다.
          </div>
        </div>
      )}
    </div>
  );
}
