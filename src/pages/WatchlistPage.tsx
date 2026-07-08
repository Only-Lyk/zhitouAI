import { useEffect, useState } from 'react';
import { Search, Plus, X, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface WatchItem {
  code: string;
  name: string;
  price: number;
  change_pct: number;
}

const API_BASE = import.meta.env.VITE_API_BASE || '';

export default function WatchlistPage() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addCode, setAddCode] = useState('');
  const [addName, setAddName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchWatchlist = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/watchlist`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWatchlist(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, [token]);

  const removeItem = async (code: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/watchlist/${code}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setWatchlist((prev) => prev.filter((i) => i.code !== code));
      }
    } catch {
      // ignore
    }
  };

  const addItem = async () => {
    if (!token || !addCode.trim() || !addName.trim()) return;
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/watchlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: addCode.trim(), name: addName.trim() }),
      });
      if (res.ok) {
        setWatchlist((prev) => [...prev, { code: addCode.trim(), name: addName.trim(), price: 0, change_pct: 0 }]);
        setAddCode('');
        setAddName('');
        setShowAdd(false);
      } else {
        const data = await res.json();
        setError(data.error || '添加失败');
      }
    } catch {
      setError('网络错误');
    }
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

      {/* Add Dialog */}
      {showAdd && (
        <div className="mx-4 space-y-2 rounded-xl border border-border-default bg-bg-secondary p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={addCode}
              onChange={(e) => setAddCode(e.target.value)}
              placeholder="股票代码"
              className="w-24 rounded-lg border border-border-default bg-bg-tertiary px-2 py-2 text-sm outline-none focus:border-accent-gold"
            />
            <input
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="股票名称"
              className="flex-1 rounded-lg border border-border-default bg-bg-tertiary px-2 py-2 text-sm outline-none focus:border-accent-gold"
            />
            <button
              onClick={addItem}
              className="rounded-lg bg-accent-gold px-3 py-2 text-xs font-semibold text-bg-primary"
            >
              添加
            </button>
          </div>
          {error && <p className="text-xs text-down">{error}</p>}
        </div>
      )}

      {/* Login Prompt */}
      {!user && (
        <div className="mx-4 rounded-xl border border-accent-gold/20 bg-accent-gold/5 px-4 py-3">
          <p className="text-sm text-text-secondary">登录后查看您的自选股列表</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-2 flex items-center gap-1 rounded-lg bg-accent-gold px-3 py-1.5 text-xs font-semibold text-bg-primary"
          >
            立即登录
          </button>
        </div>
      )}

      {/* List */}
      <div className="space-y-2 px-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card h-16 animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
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
