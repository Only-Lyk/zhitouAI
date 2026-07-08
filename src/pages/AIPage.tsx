import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, RefreshCw } from 'lucide-react';
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

export default function AIPage() {
  const { token } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="animate-fade-in space-y-6 pt-4">
      {/* Header */}
      <div className="px-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-gradient-gold">AI 智能选股</span>
            </h1>
            <p className="mt-1 text-xs text-text-tertiary">基于技术指标与量化模型每日扫描</p>
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
              <StockCard {...rec} showAI />
            </div>
          ))
        )}
      </section>

      {/* Methodology */}
      <div className="mx-4 rounded-xl border border-border-default bg-bg-secondary/50 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">评分逻辑</h3>
        <div className="mt-3 space-y-2 text-xs text-text-secondary">
          <p>• 均线系统：MA5/MA10/MA20排列形态及金叉死叉</p>
          <p>• MACD：DIF/DEA位置及柱状图动能方向</p>
          <p>• RSI：超买超卖区间判断</p>
          <p>• 布林带：价格相对位置及带宽变化</p>
          <p>• 基本面：PE/PB估值分位</p>
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
