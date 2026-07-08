import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface IndexData {
  name: string;
  code: string;
  price: number;
  change: number;
  change_pct: number;
}

export default function MarketOverview() {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/market/indices')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setIndices(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-4">
      {indices.map((idx) => {
        const isUp = idx.change_pct >= 0;
        return (
          <div
            key={idx.code}
            className="glass-card flex flex-col items-start p-3 transition-all hover:border-border-hover"
          >
            <span className="text-xs text-text-tertiary">{idx.name}</span>
            <span className="mt-1 text-lg font-semibold font-mono tracking-tight">
              {idx.price.toFixed(2)}
            </span>
            <div className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${isUp ? 'text-up' : 'text-down'}`}>
              {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>{isUp ? '+' : ''}{idx.change_pct.toFixed(2)}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
