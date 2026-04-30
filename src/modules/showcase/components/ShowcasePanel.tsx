import { useEffect, useState } from 'react';
import { getPublicShowcase } from '../../../api';
import { useShowcase } from '../hooks/useShowcase';
import type { ShowcaseSet, ShowcaseSortKey } from '../types';

export function ShowcasePanel() {
  const [sets, setSets] = useState<ShowcaseSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { search, setSearch, sortKey, sortDir, toggleSort, sortedSets } = useShowcase(sets);

  useEffect(() => {
    getPublicShowcase()
      .then(data => setSets(data.sets || []))
      .catch(() => setError('쇼케이스 데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  const SortBtn = ({ k, label }: { k: ShowcaseSortKey; label: string }) => (
    <button onClick={() => toggleSort(k)} className="px-2 py-1 rounded bg-secondary text-xs">
      {label} {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </button>
  );

  return (
    <section className="panel p-4 space-y-3">
      <h3 className="text-lg font-bold">TC 쇼케이스</h3>
      <p className="text-xs text-muted">TCshowcase 프로젝트의 상점 목록 UX를 모듈 형태로 통합했습니다.</p>
      <div className="flex gap-2 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="게임 검색" className="input max-w-xs" />
        <SortBtn k="name" label="이름" /><SortBtn k="sets" label="세트" /><SortBtn k="price" label="가격" />
      </div>
      {loading && <p className="text-sm text-muted">로딩 중...</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {sortedSets.map(set => (
            <div key={set.appId} className="rounded border border-border p-3 bg-card/40">
              <div className="font-medium text-sm">{set.gameName}</div>
              <div className="text-xs text-muted mt-1">세트: {set.completeSets.toLocaleString()}</div>
              <div className="text-xs text-primary mt-1">가격: {set.sellPrice.toLocaleString()} gems</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
