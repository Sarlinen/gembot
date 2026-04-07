import { useState, useRef } from 'react';
import { useStore } from '../store';

export function Footer() {
  const { adminEnabled, setShowAdmin } = useStore();
  const [clickCount, setClickCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopyrightClick = () => {
    if (!adminEnabled) return;

    const newCount = clickCount + 1;
    setClickCount(newCount);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setClickCount(0), 3000);

    if (newCount >= 5) {
      setClickCount(0);
      setShowAdmin(true);
    }
  };

  return (
    <footer className="border-t border-steam-border bg-steam-dark">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <span
          onClick={handleCopyrightClick}
          className={`text-xs text-steam-muted select-none ${adminEnabled ? 'cursor-default' : 'cursor-default'}`}
        >
          © 2024 Steam 보석 거래소
        </span>
        <div className="flex items-center gap-4">
          <a
            href="https://store.steampowered.com"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-steam-muted hover:text-steam-blue transition"
          >
            Steam Store
          </a>
          <a
            href="https://steamcommunity.com"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-steam-muted hover:text-steam-blue transition"
          >
            Community
          </a>
        </div>
      </div>
    </footer>
  );
}
