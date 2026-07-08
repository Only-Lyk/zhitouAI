import { useState } from 'react';
import { Search, Plus, X, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface WatchItem {
  code: string;
  name: string;
  price: number;
  change_pct: number;
}

const defaultWatchlist: WatchItem[] = [
  { code: '600519', name: '贵州茅台', price: 1528.50, change_pct: 1.21 },
  { code: '002594', name: '比亚迪', price: 268.80, change_pct: 3.31 },
  { code: '300750', name: '宁德时代', price: 198.50, change_pct: 2.69 },
  { code: '000333', name: '美的集团', price: 62.35, change_pct: 1.38 },
];

export default function WatchlistPage() {
  const navigate = useNavigate();
  const [watchlist, setWatchlist] = useState<WatchItem[]>(defaultWatchlist);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const removeItem = (code: string) => {
    setWatchlist((prev) => prev.filter((i) => i.code !== code));
  };

  const filtered = watchlist.filter(
    (i) => i.code.includes(search) || i.name.includes(search)
  );

  return (
    <div className="animate-fade-in space-y-4 pt-4">
      {/* Header */}
      <div className="px-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-gradient-gold">自选股</span>
          </h1>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 rounded-lg bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-accent-gold"
          >
            <Plus size={14} /> 添加
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4">
        <div className="flex items-center gap-2 rounded-xl bg-bg-tertiary px-3 py-2.5 border border-border-default">
          <Search size={16} className="text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索自选股..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-tertiary"
          />
        </div>
      </div>

      {/* List */}
      <div className="space-y-2 px-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
            <Star size={32} className="mb-2 opacity-30" />
            <p className="text-sm">暂无自选股</p>
            <p className="mt-1 text-xs">点击右上角添加关注股票</p>
          </div>
        ) : (
          filtered.map((item) => {
            const isUp = item.change_pct >= 0;
            return (
              <div
                key={item.code}
                className="glass-card flex items-center justify-between p-3 transition-all hover:border-border-hover"
              >
                <button
                  onClick={() => navigate(`/stock/${item.code}`)}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-tertiary">
                    <span className="text-xs font-bold text-accent-gold">{item.name.slice(0, 1)}</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{item.name}</div>
                    <div className="text-xs text-text-tertiary font-mono">{item.code}</div>
                  </div>
                </button>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-semibold font-mono">{item.price.toFixed(2)}</div>
                    <div className={`text-xs font-medium ${isUp ? 'text-up' : 'text-down'}`}>
                      {isUp ? '+' : ''}{item.change_pct.toFixed(2)}%
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(item.code)}
                    className="p-1 text-text-tertiary transition-colors hover:text-down"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
