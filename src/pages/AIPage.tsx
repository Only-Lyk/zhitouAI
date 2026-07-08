import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, RefreshCw } from 'lucide-react';
import StockCard from '../components/StockCard';
import { addToWatchlist, removeFromWatchlist, getWatchlist } from '../utils/watchlist';

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

interface YesterdayItem {
  code: string;
  name: string;
  day_price: number | null;
  day_change_pct: number | null;
  today_price: number | null;
  today_change_pct: number | null;
  hold_return: number | null;
  signal: string;
  score: number;
}

export default function AIPage() {
  const { token } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [watchSet, setWatchSet] = useState<Set<string>>(new Set());
  const [yesterday, setYesterday] = useState<{ date: string | null; items: YesterdayItem[] }>({ date: null, items: [] });

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/ai/recommendations', { headers });
      if (!res.ok) throw new Error('Unauthorized');
      const data = await res.json();
      setRecommendations(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setRecommendations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchYesterday = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/ai/recommendations/yesterday', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setYesterday({ date: data.date ?? null, items: Array.isArray(data.items) ? data.items : [] });
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchData();
    fetchYesterday();
    if (token) {
      getWatchlist(token).then((list) => setWatchSet(new Set(list.map((w) => w.code))));
    }
  }, []);

  const toggleWatch = async (rec: Recommendation) => {
    if (!token) return;
    if (watchSet.has(rec.code)) {
      await removeFromWatchlist(rec.code, token);
      setWatchSet((prev) => {
        const next = new Set(prev);
        next.delete(rec.code);
        return next;
      });
    } else {
      await addToWatchlist(rec.code, rec.name, token);
      setWatchSet((prev) => new Set(prev).add(rec.code));
    }
  };

  return (
    <div className="animate-fade-in space-y-6 pt-4">
      {/* Header */}
      <div className="px-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-gradient-gold">AI 智能选股</span>
            </h1>
            <p className="mt-1 text-xs text-text-tertiary">全市场量化扫描 + LLM 解读</p>
          </div>
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="rounded-lg bg-bg-tertiary p-2 text-text-secondary transition-colors hover:text-accent-gold disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      {!loading && recommendations.length > 0 && (
        <div className="grid grid-cols-3 gap-3 px-4">
          <div className="glass-card p-3 text-center">
            <div className="text-lg font-bold text-accent-gold">{recommendations.length}</div>
            <div className="text-[10px] text-text-tertiary">今日推荐</div>
          </div>
          <div className="glass-card p-3 text-center">
            <div className="text-lg font-bold text-up">
              {recommendations.filter((r) => r.score >= 70).length}
            </div>
            <div className="text-[10px] text-text-tertiary">强烈关注</div>
          </div>
          <div className="glass-card p-3 text-center">
            <div className="text-lg font-bold font-mono">
              {Math.round(recommendations.reduce((a, b) => a + b.score, 0) / recommendations.length)}
            </div>
            <div className="text-[10px] text-text-tertiary">平均评分</div>
          </div>
        </div>
      )}

      {/* Yesterday Comparison */}
      {yesterday.items.length > 0 && (
        <section className="px-4">
          <div className="mb-3 flex items-center gap-1.5">
            <Sparkles size={14} className="text-accent-gold" />
            <h2 className="text-sm font-semibold text-text-secondary">
              昨日推荐今日表现（{yesterday.date}）
            </h2>
          </div>
          <div className="glass-card divide-y divide-border-default">
            {yesterday.items.map((it) => {
              const ret = it.hold_return;
              const isUp = (ret ?? 0) >= 0;
              return (
                <div key={it.code} className="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <div className="text-sm font-semibold">{it.name}</div>
                    <div className="text-xs text-text-tertiary font-mono">{it.code}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-semibold font-mono ${ret === null ? 'text-text-tertiary' : isUp ? 'text-up' : 'text-down'}`}>
                      {ret === null ? '—' : `${isUp ? '+' : ''}${ret.toFixed(2)}%`}
                    </div>
                    <div className="text-[10px] text-text-tertiary">
                      昨 {it.day_change_pct?.toFixed(2)}% → 今 {it.today_change_pct?.toFixed(2)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recommendations List */}
      <section className="px-4 space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card h-32 animate-pulse" />
          ))
        ) : (
          recommendations.map((rec, index) => (
            <div key={rec.code} className="relative">
              {index === 0 && (
                <div className="absolute -top-2 left-3 z-10 flex items-center gap-1 rounded-md bg-accent-gold px-2 py-0.5 text-[10px] font-bold text-bg-primary">
                  <Sparkles size={10} /> 首推
                </div>
              )}
              <StockCard
                {...rec}
                showAI
                added={watchSet.has(rec.code)}
                onAdd={() => toggleWatch(rec)}
              />
            </div>
          ))
        )}
      </section>

      {/* Methodology */}
      <div className="mx-4 rounded-xl border border-border-default bg-bg-secondary/50 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">评分逻辑</h3>
        <div className="mt-3 space-y-2 text-xs text-text-secondary">
          <p>• 全市场扫描：剔除ST/退市、市值过小的标的</p>
          <p>• 动量：当日涨跌幅与换手率</p>
          <p>• 估值：市盈率(PE)分位与合理性</p>
          <p>• LLM 解读：对初筛候选生成信号与风险提示</p>
        </div>
      </div>

      <div className="px-4 pb-4">
        <p className="text-[10px] leading-relaxed text-text-tertiary/60 text-center">
          AI评分基于历史数据与技术指标计算，仅供研究参考，不构成投资建议。
        </p>
      </div>
    </div>
  );
}
