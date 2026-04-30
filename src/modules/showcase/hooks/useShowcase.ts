import { useMemo, useState } from 'react';
import type { ShowcaseSet, ShowcaseSortDir, ShowcaseSortKey } from '../types';

export function useShowcase(sets: ShowcaseSet[]) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<ShowcaseSortKey>('name');
  const [sortDir, setSortDir] = useState<ShowcaseSortDir>('asc');

  const sortedSets = useMemo(() => {
    const filtered = sets.filter(s => s.gameName.toLowerCase().includes(search.toLowerCase()));
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.gameName.localeCompare(b.gameName, 'ko');
      if (sortKey === 'sets') cmp = a.completeSets - b.completeSets;
      if (sortKey === 'price') cmp = a.sellPrice - b.sellPrice;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [sets, search, sortKey, sortDir]);

  const toggleSort = (key: ShowcaseSortKey) => {
    if (sortKey === key) setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  return { search, setSearch, sortKey, sortDir, toggleSort, sortedSets };
}
