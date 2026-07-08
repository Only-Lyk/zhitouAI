import { useEffect, useRef } from 'react';
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

export default function KLineChart({ data, ma5, ma10, ma20, ma60 }: KLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ma5SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma10SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma60SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#9CA3AF',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
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
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        timeVisible: false,
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
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    if (ma5) {
      const ma5Series = chart.addSeries(LineSeries, {
        color: '#D4A853',
        lineWidth: 2,
        title: 'MA5',
        lastValueVisible: false,
      });
      ma5SeriesRef.current = ma5Series;
    }

    if (ma10) {
      const ma10Series = chart.addSeries(LineSeries, {
        color: '#22D3EE',
        lineWidth: 1,
        title: 'MA10',
        lastValueVisible: false,
      });
      ma10SeriesRef.current = ma10Series;
    }

    if (ma20) {
      const ma20Series = chart.addSeries(LineSeries, {
        color: '#3B82F6',
        lineWidth: 2,
        title: 'MA20',
        lastValueVisible: false,
      });
      ma20SeriesRef.current = ma20Series;
    }

    if (ma60) {
      const ma60Series = chart.addSeries(LineSeries, {
        color: '#A855F7',
        lineWidth: 1,
        title: 'MA60',
        lastValueVisible: false,
      });
      ma60SeriesRef.current = ma60Series;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.applyOptions({ width, height });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ma5SeriesRef.current = null;
      ma10SeriesRef.current = null;
      ma20SeriesRef.current = null;
      ma60SeriesRef.current = null;
    };
  }, []);

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

    if (ma5SeriesRef.current && ma5) {
      const ma5Data: LineData[] = data
        .map((d, i) => {
          const val = ma5[i];
          return val != null
            ? ({ time: d.date, value: val } as LineData)
            : null;
        })
        .filter(Boolean) as LineData[];
      ma5SeriesRef.current.setData(ma5Data);
    }

    if (ma20SeriesRef.current && ma20) {
      const ma20Data: LineData[] = data
        .map((d, i) => {
          const val = ma20[i];
          return val != null
            ? ({ time: d.date, value: val } as LineData)
            : null;
        })
        .filter(Boolean) as LineData[];
      ma20SeriesRef.current.setData(ma20Data);
    }

    if (ma10SeriesRef.current && ma10) {
      const ma10Data: LineData[] = data
        .map((d, i) => {
          const val = ma10[i];
          return val != null
            ? ({ time: d.date, value: val } as LineData)
            : null;
        })
        .filter(Boolean) as LineData[];
      ma10SeriesRef.current.setData(ma10Data);
    }

    if (ma60SeriesRef.current && ma60) {
      const ma60Data: LineData[] = data
        .map((d, i) => {
          const val = ma60[i];
          return val != null
            ? ({ time: d.date, value: val } as LineData)
            : null;
        })
        .filter(Boolean) as LineData[];
      ma60SeriesRef.current.setData(ma60Data);
    }

    chartRef.current?.timeScale().fitContent();
  }, [data, ma5, ma10, ma20, ma60]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '340px',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    />
  );
}
