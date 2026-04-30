export type FeatureTab = 'trade' | 'showcase' | 'novelai';

interface FeatureTabsProps {
  activeTab: FeatureTab;
  onChange: (tab: FeatureTab) => void;
}

const TAB_META: Array<{ key: FeatureTab; label: string }> = [
  { key: 'trade', label: '거래' },
  { key: 'showcase', label: '쇼케이스' },
  { key: 'novelai', label: 'NovelAI' },
];

export function FeatureTabs({ activeTab, onChange }: FeatureTabsProps) {
  return (
    <div className="panel p-2 flex gap-2 flex-wrap">
      {TAB_META.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-3 py-1.5 rounded text-sm font-medium transition ${activeTab === tab.key ? 'bg-primary text-white' : 'bg-secondary text-muted hover:text-foreground'}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
