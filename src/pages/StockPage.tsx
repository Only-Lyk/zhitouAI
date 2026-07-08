import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Activity, BarChart3, Brain } from 'lucide-react';
import KLineChart from '../components/KLineChart';
import AIScoreBadge from '../components/AIScoreBadge';

interface StockQuote {
  code: string;
  name: string;
  price: number;
  change: number;
  change_pct: number;
  volume: number;
  market_cap?: number;
  pe?: number;
  pb?: number;
}

interface Indicators {
  ma5?: number;
  ma10?: number;
  ma20?: number;
  ma60?: number;
  macd_dif?: number;
  macd_dea?: number;
  macd_hist?: number;
  rsi14?: number;
  boll_up?: number;
  boll_mid?: number;
  boll_down?: number;
}

interface KLineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Diagnosis {
  score: number;
  signal: string;
  trend: string;
  support?: number;
  pressure?: number;
  risk_level: string;
  reason: string;
  suggestion: string;
}

type Period = 'day' | 'week' | 'month';

function calcSMA(values: number[], n: number): (number | null)[] {
  const res: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < n - 1) {
      res.push(null);
      continue;
    }
    const sum = values.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0);
    res.push(Math.round((sum / n) * 100) / 100);
  }
  return res;
}

export default function StockPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [klines, setKlines] = useState<KLineData[]>([]);
  const [indicators, setIndicators] = useState<Indicators>({});
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chart' | 'indicators' | 'ai'>('chart');
  const [period, setPeriod] = useState<Period>('day');

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/stock/quote?code=${code}`).then((r) => r.json()),
      fetch(`/api/stock/kline?code=${code}&days=120&period=${period}`).then((r) => r.json()),
      fetch(`/api/stock/indicators?code=${code}&period=${period}`).then((r) => r.json()),
      fetch(`/api/ai/diagnose?code=${code}`).then((r) => r.json()),
    ])
      .then(([q, k, i, d]) => {
        setQuote(q);
        setKlines(k);
        setIndicators(i);
        setDiagnosis(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [code, period]);

  const ma5Series = useMemo(() => {
    if (!klines.length) return [];
    return calcSMA(klines.map((k) => k.close), 5);
  }, [klines]);

  const ma20Series = useMemo(() => {
    if (!klines.length) return [];
    return calcSMA(klines.map((k) => k.close), 20);
  }, [klines]);

  if (loading || !quote) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-gold border-t-transparent" />
      </div>
    );
  }

  const isUp = quote.change_pct >= 0;
  const periodLabels: Record<Period, string> = { day: '日K', week: '周K', month: '月K' };

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border-default bg-bg-primary/90 backdrop-blur-md px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="text-base font-bold">{quote.name}</div>
            <div className="text-xs text-text-tertiary font-mono">{quote.code}</div>
          </div>
        </div>
      </div>

      {/* Price Hero */}
      <div className="px-4 py-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-4xl font-bold font-mono tracking-tight">
              {quote.price.toFixed(2)}
            </div>
            <div className={`mt-1 flex items-center gap-2 text-sm font-medium ${isUp ? 'text-up' : 'text-down'}`}>
              {isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>{isUp ? '+' : ''}{quote.change.toFixed(2)} ({isUp ? '+' : ''}{quote.change_pct.toFixed(2)}%)</span>
            </div>
          </div>
          {diagnosis && (
            <div className="text-right">
              <AIScoreBadge score={diagnosis.score} size="md" />
              <div className="mt-1 text-xs text-text-secondary">{diagnosis.signal}</div>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { label: '成交量', value: `${(quote.volume / 10000).toFixed(1)}万` },
            { label: '市值', value: quote.market_cap ? `${(quote.market_cap / 10000).toFixed(1)}亿` : '-' },
            { label: 'PE', value: quote.pe?.toFixed(1) ?? '-' },
            { label: 'PB', value: quote.pb?.toFixed(2) ?? '-' },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-bg-secondary px-2 py-2 text-center">
              <div className="text-[10px] text-text-tertiary">{s.label}</div>
              <div className="mt-0.5 text-xs font-semibold font-mono">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-default px-4">
        {[
          { key: 'chart', label: 'K线图', icon: BarChart3 },
          { key: 'indicators', label: '技术指标', icon: Activity },
          { key: 'ai', label: 'AI诊断', icon: Brain },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'text-accent-gold' : 'text-text-tertiary'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-accent-gold" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-4 py-4">
        {activeTab === 'chart' && (
          <div className="glass-card p-3">
            {/* Period Switcher */}
            <div className="mb-3 flex items-center justify-center gap-2">
              {( ['day', 'week', 'month'] as Period[] ).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    period === p
                      ? 'bg-accent-gold text-bg-primary'
                      : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>
            <KLineChart
              data={klines}
              ma5={ma5Series}
              ma20={ma20Series}
            />
            <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-text-tertiary">
              <span className="flex items-center gap-1"><span className="inline-block h-1 w-3 rounded bg-accent-gold" />MA5</span>
              <span className="flex items-center gap-1"><span className="inline-block h-1 w-3 rounded bg-blue-400" />MA20</span>
            </div>
          </div>
        )}

        {activeTab === 'indicators' && (
          <div className="space-y-3">
            <IndicatorCard title="均线系统" items={[
              { label: 'MA5', value: indicators.ma5 },
              { label: 'MA10', value: indicators.ma10 },
              { label: 'MA20', value: indicators.ma20 },
              { label: 'MA60', value: indicators.ma60 },
            ]} />
            <IndicatorCard title="MACD" items={[
              { label: 'DIF', value: indicators.macd_dif },
              { label: 'DEA', value: indicators.macd_dea },
              { label: '柱状', value: indicators.macd_hist, color: (indicators.macd_hist ?? 0) >= 0 ? 'text-up' : 'text-down' },
            ]} />
            <IndicatorCard title="RSI & 布林带" items={[
              { label: 'RSI(14)', value: indicators.rsi14 },
              { label: 'BOLL上轨', value: indicators.boll_up },
              { label: 'BOLL中轨', value: indicators.boll_mid },
              { label: 'BOLL下轨', value: indicators.boll_down },
            ]} />
          </div>
        )}

        {activeTab === 'ai' && diagnosis && (
          <div className="space-y-3">
            <div className="glass-card p-4">
              <div className="flex items-center justify-between">
                <AIScoreBadge score={diagnosis.score} size="lg" />
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                  diagnosis.risk_level === '低' ? 'bg-up-bg text-up' :
                  diagnosis.risk_level === '高' ? 'bg-down-bg text-down' : 'bg-bg-tertiary text-text-secondary'
                }`}>
                  风险:{diagnosis.risk_level}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-text-tertiary">信号：</span><span className="font-medium">{diagnosis.signal}</span></div>
                <div><span className="text-text-tertiary">趋势：</span><span className="font-medium">{diagnosis.trend}</span></div>
                <div><span className="text-text-tertiary">支撑：</span><span className="font-mono">{diagnosis.support?.toFixed(2)}</span></div>
                <div><span className="text-text-tertiary">压力：</span><span className="font-mono">{diagnosis.pressure?.toFixed(2)}</span></div>
              </div>
            </div>

            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold text-accent-gold">技术解读</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{diagnosis.reason}</p>
            </div>

            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold text-accent-gold">操作建议</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{diagnosis.suggestion}</p>
            </div>

            <button
              onClick={() => navigate(`/chat?stock=${code}`)}
              className="w-full rounded-xl bg-gradient-to-r from-accent-gold/20 to-accent-gold/5 border border-accent-gold/30 py-3 text-sm font-semibold text-accent-gold transition-all hover:bg-accent-gold/10"
            >
              向AI助手深度咨询此股
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function IndicatorCard({ title, items }: { title: string; items: { label: string; value?: number; color?: string }[] }) {
  return (
    <div className="glass-card p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">{title}</h3>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <div className="text-[10px] text-text-tertiary">{item.label}</div>
            <div className={`mt-0.5 text-sm font-mono font-semibold ${item.color || 'text-text-primary'}`}>
              {item.value !== undefined ? item.value.toFixed(2) : '-'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
