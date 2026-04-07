import { useStore } from '../store';
import type { ItemCategory } from '../types';
import { Sword, Crown, Trash2, Recycle, Disc, Ticket, Key } from 'lucide-react';

const categories: { id: ItemCategory; label: string; icon: typeof Sword; color: string }[] = [
  { id: 'weapon', label: '무기', icon: Sword, color: 'text-orange-400' },
  { id: 'hat', label: '모자', icon: Crown, color: 'text-yellow-400' },
  { id: 'scrap', label: '폐기금속', icon: Trash2, color: 'text-gray-400' },
  { id: 'reclaimed', label: '재활용금속', icon: Recycle, color: 'text-gray-300' },
  { id: 'refined', label: '정제금속', icon: Disc, color: 'text-white' },
  { id: 'ticket', label: '복무권', icon: Ticket, color: 'text-green-400' },
  { id: 'key', label: '열쇠', icon: Key, color: 'text-yellow-300' },
];

export function CategorySelector() {
  const { selectedCategory, setSelectedCategory } = useStore();

  return (
    <div className="fade-in">
      <h3 className="text-sm font-semibold text-white mb-3">아이템 종류</h3>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {categories.map(({ id, label, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => setSelectedCategory(id)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all ${
              selectedCategory === id
                ? 'border-steam-blue bg-steam-blue/10 shadow-[0_0_12px_rgba(26,159,255,0.15)]'
                : 'border-steam-border bg-steam-card hover:border-steam-hover hover:bg-steam-hover/30'
            }`}
          >
            <Icon className={`w-5 h-5 ${selectedCategory === id ? 'text-steam-blue' : color}`} />
            <span className={`text-xs font-medium ${selectedCategory === id ? 'text-steam-blue' : 'text-steam-muted'}`}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
