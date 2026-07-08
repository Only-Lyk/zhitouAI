import { useMemo } from 'react';
import {
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Line,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

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
  ma20?: (number | null)[];
}

export default function KLineChart({ data, ma5, ma20 }: KLineChartProps) {
  const chartData = useMemo(() => {
    return data.map((d, i) => ({
      ...d,
      ma5: ma5?.[i] ?? null,
      ma20: ma20?.[i] ?? null,
      color: d.close >= d.open ? '#10B981' : '#EF4444',
    }));
  }, [data, ma5, ma20]);

  const latest = data[data.length - 1];
  if (!latest) return null;

  const yDomain = [
    Math.min(...data.map((d) => d.low)) * 0.98,
    Math.max(...data.map((d) => d.high)) * 1.02,
  ];

  return (
    <div className="h-72 w-full sm:h-96">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#6B7280', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            tickFormatter={(v: string) => v.slice(5)}
            minTickGap={30}
          />
          <YAxis
            domain={yDomain}
            tick={{ fill: '#6B7280', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={(v: number) => v.toFixed(1)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: '#9CA3AF' }}
            itemStyle={{ color: '#F3F4F6' }}
            formatter={(value: any, name: any) => {
              if (name === 'volume') return [value?.toFixed?.(0) ?? value, '成交量'];
              return [typeof value === 'number' ? value.toFixed(2) : value, name];
            }}
          />
          <Bar
            dataKey="close"
            fill="#8884d8"
            barSize={chartData.length > 60 ? 2 : 4}
            shape={(props: any) => {
              const { x, y, width, height, payload } = props;
              const isUp = payload.close >= payload.open;
              const color = isUp ? '#10B981' : '#EF4444';
              const bodyTop = Math.min(y, y + height);
              const bodyHeight = Math.abs(height) || 1;
              return (
                <g>
                  <line
                    x1={x + width / 2}
                    y1={bodyTop + bodyHeight}
                    x2={x + width / 2}
                    y2={bodyTop + bodyHeight + (isUp ? -2 : 2)}
                    stroke={color}
                    strokeWidth={1}
                  />
                  <rect x={x} y={bodyTop} width={width} height={bodyHeight} fill={color} rx={1} />
                </g>
              );
            }}
          />
          {ma5 && (
            <Line
              type="monotone"
              dataKey="ma5"
              stroke="#D4A853"
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
          )}
          {ma20 && (
            <Line
              type="monotone"
              dataKey="ma20"
              stroke="#60A5FA"
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
