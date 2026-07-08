import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Flame, ChevronRight, Sparkles, LogIn, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import MarketOverview from '../components/MarketOverview';
import StockCard from '../components/StockCard';

interface Recommendation {
  code: string;
  name: string;
  price: number;
  change_pct: number;
  score: number;
  signal: string;
  reason: string;
  risk_level: string;
}

interface Sector {
  name: string;
  change_pct: number;
  leader: string;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/ai/recommendations').then((r) => r.json()),
      fetch('/api/market/sectors').then((r) => r.json()),
    ])
      .then(([recs, secs]) => {
        setRecommendations(recs);
        setSectors(secs);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/stock/${search.trim()}`);
    }
  };

  return (
    <div className="animate-fade-in space-y-6 pt-4">
      {/* Header */}
      <div className="px-4">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-gradient-gold">智投AI</span>
          <span className="ml-2 text-sm font-normal text-text-secondary">量化分析系统</span>
        </h1>
        <p className="mt-1 text-xs text-text-tertiary">数据驱动决策，AI赋能投资</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="px-4">
        <div className="flex items-center gap-2 rounded-xl bg-bg-tertiary px-3 py-2.5 border border-border-default focus-within:border-accent-gold/50 transition-colors">
          <Search size={18} className="text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="输入股票代码或名称..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-tertiary"
          />
        </div>
      </form>

      {/* Login banner */}
      {!user && (
        <div className="mx-4 rounded-xl border border-accent-gold/20 bg-accent-gold/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-gold/20">
                <User size={16} className="text-accent-gold" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">登录解锁 AI 分析</p>
                <p className="text-xs text-text-tertiary">智能选股、量化诊断、AI 问答</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-1 rounded-lg bg-accent-gold px-3 py-1.5 text-xs font-semibold text-bg-primary shadow-[0_0_12px_rgba(212,168,83,0.35)] transition-all hover:shadow-[0_0_16px_rgba(212,168,83,0.5)] active:scale-95"
            >
              <LogIn size={14} />
              登录
            </button>
          </div>
        </div>
      )}

      {/* Market Indices */}
      <section>
        <div className="mb-3 flex items-center justify-between px-4">
          <h2 className="text-sm font-semibold text-text-secondary">大盘指数</h2>
        </div>
        <MarketOverview />
      </section>

      {/* Hot Sectors */}
      <section>
        <div className="mb-3 flex items-center justify-between px-4">
          <div className="flex items-center gap-1.5">
            <Flame size={14} className="text-accent-gold" />
            <h2 className="text-sm font-semibold text-text-secondary">热点板块</h2>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
          {sectors.map((s) => (
            <div
              key={s.name}
              className="flex-shrink-0 rounded-lg bg-bg-secondary px-3 py-2 border border-border-default"
            >
              <div className="text-xs font-medium">{s.name}</div>
              <div className={`mt-0.5 text-xs font-mono ${s.change_pct >= 0 ? 'text-up' : 'text-down'}`}>
                {s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* AI Recommendations */}
      <section>
        <div className="mb-3 flex items-center justify-between px-4">
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-accent-gold" />
            <h2 className="text-sm font-semibold text-text-secondary">AI 今日推荐</h2>
          </div>
          <button onClick={() => navigate('/ai')} className="flex items-center gap-0.5 text-xs text-accent-gold">
            查看更多 <ChevronRight size={12} />
          </button>
        </div>
        <div className="space-y-3 px-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-card h-28 animate-pulse" />
            ))
          ) : (
            recommendations.slice(0, 3).map((rec) => (
              <StockCard key={rec.code} {...rec} showAI />
            ))
          )}
        </div>
      </section>

      {/* Disclaimer */}
      <div className="px-4 pb-4">
        <p className="text-[10px] leading-relaxed text-text-tertiary/60 text-center">
          本系统仅为数据分析工具，不构成任何投资建议。股市有风险，投资需谨慎。
        </p>
      </div>
    </div>
  );
}
