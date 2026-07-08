import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowUpDown } from 'lucide-react';

interface StockRow {
  code: string;
  name: string;
  price: number | null;
  change_pct: number | null;
  pe: number | null;
  market_cap: number | null;
  turnover: number | null;
}

type SortKey = 'change_pct' | 'price' | 'market_cap' | 'pe';
const PAGE_SIZE = 30;

function fmtCap(v: number | null): string {
  if (v == null) return '-';
  if (v >= 10000) return `${(v / 10000).toFixed(2)}万亿`;
  return `${v.toFixed(0)}亿`;
}

export default function StockListPage() {
  const navigate = useNavigate();
  const [list, setList] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('change_pct');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    fetch('/api/stock/list')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const f = q
      ? list.filter((s) => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      : list;
    const dir = sortDir === 'desc' ? -1 : 1;
    return [...f].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return (av - bv) * dir;
    });
  }, [list, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  };

  return (
    <div className="animate-fade-in space-y-4 pt-4">
      {/* Header */}
      <div className="px-4">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-gradient-gold">行情中心</span>
          <span className="ml-2 text-sm font-normal text-text-secondary">全部A股</span>
        </h1>
        <p className="mt-1 text-xs text-text-tertiary">共 {list.length} 只 · 点击查看详情</p>
      </div>

      {/* Search */}
      <div className="px-4">
        <div className="flex items-center gap-2 rounded-xl bg-bg-tertiary px-3 py-2.5 border border-border-default focus-within:border-accent-gold/50 transition-colors">
          <Search size={18} className="text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="搜索代码或名称..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-tertiary"
          />
        </div>
      </div>

      {/* Sort bar */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
        {([
          { k: 'change_pct', label: '涨幅' },
          { k: 'price', label: '价格' },
          { k: 'market_cap', label: '市值' },
          { k: 'pe', label: '市盈率' },
        ] as { k: SortKey; label: string }[]).map(({ k, label }) => {
          const active = sortKey === k;
          return (
            <button
              key={k}
              onClick={() => onSort(k)}
              className={`flex flex-shrink-0 items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'bg-accent-gold text-bg-primary'
                  : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
              }`}
            >
              {label}
              {active && <ArrowUpDown size={10} />}
              {active && <span className="text-[10px]">{sortDir === 'desc' ? '↓' : '↑'}</span>}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="space-y-2 px-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-card h-16 animate-pulse" />
          ))
        ) : pageItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
            <Search size={32} className="mb-2 opacity-30" />
            <p className="text-sm">未找到匹配的股票</p>
          </div>
        ) : (
          pageItems.map((s) => {
            const isUp = (s.change_pct ?? 0) >= 0;
            return (
              <button
                key={s.code}
                onClick={() => navigate(`/stock/${s.code}`)}
                className="glass-card flex w-full items-center justify-between p-3 text-left transition-all hover:border-border-hover"
              >
                <div>
                  <div className="text-sm font-semibold">{s.name}</div>
                  <div className="text-xs text-text-tertiary font-mono">{s.code}</div>
                  <div className="mt-0.5 text-[10px] text-text-tertiary">
                    市值 {fmtCap(s.market_cap)} · PE {s.pe != null ? s.pe.toFixed(1) : '-'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold font-mono">
                    {s.price != null ? s.price.toFixed(2) : '-'}
                  </div>
                  <div className={`text-xs font-medium ${isUp ? 'text-up' : 'text-down'}`}>
                    {s.change_pct == null ? '-' : `${isUp ? '+' : ''}${s.change_pct.toFixed(2)}%`}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-center gap-4 px-4 pb-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="rounded-lg bg-bg-tertiary px-3 py-1.5 text-xs text-text-secondary disabled:opacity-40"
          >
            上一页
          </button>
          <span className="text-xs text-text-tertiary">
            {safePage} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="rounded-lg bg-bg-tertiary px-3 py-1.5 text-xs text-text-secondary disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
