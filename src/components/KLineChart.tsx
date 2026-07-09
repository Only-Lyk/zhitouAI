import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type MouseEventParams,
  type Time,
} from 'lightweight-charts';

interface KLineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface KLineChartProps {
  data: KLineData[];
  ma5?: (number | null)[];
  ma10?: (number | null)[];
  ma20?: (number | null)[];
  ma60?: (number | null)[];
}

type MaKey = 'ma5' | 'ma10' | 'ma20' | 'ma60';

const MA_META: { key: MaKey; label: string; color: string }[] = [
  { key: 'ma5', label: 'MA5', color: '#D4A853' },
  { key: 'ma10', label: 'MA10', color: '#22D3EE' },
  { key: 'ma20', label: 'MA20', color: '#3B82F6' },
  { key: 'ma60', label: 'MA60', color: '#A855F7' },
];

interface HoverInfo {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  prevClose: number;
}

export default function KLineChart({ data, ma5, ma10, ma20, ma60 }: KLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const maRefs: Record<MaKey, React.MutableRefObject<ISeriesApi<'Line'> | null>> = {
    ma5: useRef<ISeriesApi<'Line'> | null>(null),
    ma10: useRef<ISeriesApi<'Line'> | null>(null),
    ma20: useRef<ISeriesApi<'Line'> | null>(null),
    ma60: useRef<ISeriesApi<'Line'> | null>(null),
  };
  const dataRef = useRef<KLineData[]>(data);
  const maDataRef = useRef<Record<MaKey, (number | null)[] | undefined>>({ ma5, ma10, ma20, ma60 });

  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [maVisible, setMaVisible] = useState<Record<MaKey, boolean>>({
    ma5: true, ma10: true, ma20: true, ma60: true,
  });

  dataRef.current = data;
  maDataRef.current = { ma5, ma10, ma20, ma60 };

  // 创建图表（仅一次，与数据无关，避免异步数据未到时图表永不创建）
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: 'transparent' },
        textColor: '#9CA3AF',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: 'rgba(212,168,83,0.5)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#D4A853',
        },
        horzLine: {
          color: 'rgba(212,168,83,0.5)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#D4A853',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        scaleMargins: { top: 0.1, bottom: 0.28 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        timeVisible: false,
        rightOffset: 4,
      },
      handleScroll: { vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: { time: true, price: false } },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#EF4444',
      borderUpColor: '#10B981',
      borderDownColor: '#EF4444',
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });
    candleSeriesRef.current = candleSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#10B981',
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    for (const m of MA_META) {
      const series = chart.addSeries(LineSeries, {
        color: m.color,
        lineWidth: m.key === 'ma5' || m.key === 'ma20' ? 2 : 1,
        title: m.label,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
      });
      maRefs[m.key].current = series;
    }

    // 十字光标移动 → 更新悬浮信息（同花顺式 OHLCV）
    const onMove = (param: MouseEventParams<Time>) => {
      const ds = param.seriesData as Map<unknown, unknown>;
      const candle = candleSeriesRef.current
        ? (ds.get(candleSeriesRef.current) as CandlestickData | undefined)
        : undefined;
      const vol = volumeSeriesRef.current
        ? (ds.get(volumeSeriesRef.current) as HistogramData | undefined)
        : undefined;
      if (!param.time || !candle) {
        setHover(null);
        return;
      }
      const all = dataRef.current;
      const t = String(param.time);
      const idx = all.findIndex((d) => d.date === t);
      const prevClose = idx > 0 ? all[idx - 1].close : candle.open;
      setHover({
        date: String(param.time),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: vol?.value ?? 0,
        prevClose,
      });
    };
    chart.subscribeCrosshairMove(onMove);

    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      for (const m of MA_META) maRefs[m.key].current = null;
    };
  }, []);

  // 数据到达/更新 → setData
  useEffect(() => {
    if (!data.length || !candleSeriesRef.current || !volumeSeriesRef.current) return;

    const candleData: CandlestickData[] = data.map((d) => ({
      time: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumeData: HistogramData[] = data.map((d) => ({
      time: d.date,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)',
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);

    const maMap: Record<MaKey, (number | null)[] | undefined> = { ma5, ma10, ma20, ma60 };
    for (const m of MA_META) {
      const series = maRefs[m.key].current;
      const arr = maMap[m.key];
      if (!series || !arr) continue;
      const maData: LineData[] = data
        .map((d, i) => {
          const val = arr[i];
          return val != null ? ({ time: d.date, value: val } as LineData) : null;
        })
        .filter(Boolean) as LineData[];
      series.setData(maData);
    }

    chartRef.current?.timeScale().fitContent();
  }, [data, ma5, ma10, ma20, ma60]);

  // MA 显隐切换
  useEffect(() => {
    for (const m of MA_META) {
      maRefs[m.key].current?.applyOptions({ visible: maVisible[m.key] });
    }
  }, [maVisible]);

  const toggleMa = (key: MaKey) =>
    setMaVisible((prev) => ({ ...prev, [key]: !prev[key] }));

  // 悬浮信息（无 hover 时显示最后一根）
  const shown: HoverInfo | null = hover ?? (() => {
    if (!data.length) return null;
    const last = data[data.length - 1];
    return {
      date: last.date,
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
      volume: last.volume,
      prevClose: data.length > 1 ? data[data.length - 2].close : last.open,
    };
  })();

  const change = shown ? shown.close - shown.prevClose : 0;
  const changePct = shown && shown.prevClose ? (change / shown.prevClose) * 100 : 0;
  const amplitude = shown && shown.prevClose ? ((shown.high - shown.low) / shown.prevClose) * 100 : 0;
  const up = change >= 0;

  const fmtDate = (s: string) => {
    // 'YYYY-MM-DD' → 'YYYY/MM/DD'
    return s.replace(/-/g, '/');
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '360px' }}>
      {shown && (
        <div className="pointer-events-none absolute left-2 top-2 z-10 select-none text-[11px] leading-relaxed text-text-tertiary">
          <div className="font-mono text-text-secondary">{fmtDate(shown.date)}</div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            <span>开 <span className="font-mono text-text-primary">{shown.open.toFixed(2)}</span></span>
            <span>高 <span className="font-mono text-up">{shown.high.toFixed(2)}</span></span>
            <span>低 <span className="font-mono text-down">{shown.low.toFixed(2)}</span></span>
            <span>收 <span className="font-mono text-text-primary">{shown.close.toFixed(2)}</span></span>
          </div>
          <div className="flex flex-wrap gap-x-3">
            <span>
              涨跌 <span className={`font-mono ${up ? 'text-up' : 'text-down'}`}>
                {up ? '+' : ''}{change.toFixed(2)}
              </span>
            </span>
            <span>
              涨幅 <span className={`font-mono ${up ? 'text-up' : 'text-down'}`}>
                {up ? '+' : ''}{changePct.toFixed(2)}%
              </span>
            </span>
            <span>振幅 <span className="font-mono text-text-primary">{amplitude.toFixed(2)}%</span></span>
          </div>
          <div>量 <span className="font-mono text-text-secondary">{(shown.volume).toFixed(2)}万</span></div>
        </div>
      )}

      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', borderRadius: '8px', overflow: 'hidden' }}
      />

      {/* MA 图例（可点击切换显隐） */}
      <div className="mt-2 flex items-center justify-center gap-4 text-[10px]">
        {MA_META.map((m) => {
          const arr = maDataRef.current[m.key];
          const lastVal = arr ? arr[arr.length - 1] : null;
          const dim = !maVisible[m.key];
          return (
            <button
              key={m.key}
              onClick={() => toggleMa(m.key)}
              className={`flex items-center gap-1 transition-opacity ${dim ? 'opacity-30' : ''}`}
            >
              <span className="inline-block h-1 w-3 rounded" style={{ backgroundColor: m.color }} />
              <span className="text-text-secondary">{m.label}</span>
              {lastVal != null && (
                <span className="font-mono text-text-tertiary">{lastVal.toFixed(2)}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
