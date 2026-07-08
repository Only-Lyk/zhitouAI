/**
 * 技术指标计算工具函数
 * 消除前端各页面重复计算
 */

export function calcSMA(values: number[], n: number): (number | null)[] {
  const res: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < n - 1) { res.push(null); continue; }
    const sum = values.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0);
    res.push(Math.round((sum / n) * 100) / 100);
  }
  return res;
}

export function calcEMA(values: number[], n: number): number[] {
  const k = 2 / (n + 1);
  const ema: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

export interface MACDResult {
  dif: number;
  dea: number;
  hist: number;
}

export function calcMACD(closes: number[]): MACDResult {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const dif = ema12.map((v, i) => v - ema26[i]);
  const dea = calcEMA(dif, 9);
  const hist = dif.map((v, i) => v - dea[i]);
  return {
    dif: Math.round(dif[dif.length - 1] * 100) / 100,
    dea: Math.round(dea[dea.length - 1] * 100) / 100,
    hist: Math.round(hist[hist.length - 1] * 100) / 100,
  };
}

export function calcRSI(closes: number[], n = 14): number {
  let gains = 0, losses = 0;
  for (let i = closes.length - n; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return Math.round((100 - 100 / (1 + rs)) * 100) / 100;
}

export interface BollingerResult {
  up: number;
  mid: number;
  down: number;
}

export function calcBollinger(closes: number[], n = 20, k = 2): BollingerResult {
  const slice = closes.slice(-n);
  const ma = slice.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(slice.reduce((sum, v) => sum + Math.pow(v - ma, 2), 0) / n);
  return {
    up: Math.round((ma + k * std) * 100) / 100,
    mid: Math.round(ma * 100) / 100,
    down: Math.round((ma - k * std) * 100) / 100,
  };
}

export interface KLineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorsResult {
  ma5: number | null;
  ma10: number | null;
  ma20: number | null;
  ma60: number | null;
  macd_dif: number;
  macd_dea: number;
  macd_hist: number;
  rsi14: number;
  boll_up: number;
  boll_mid: number;
  boll_down: number;
}

export function calcIndicatorsFromKlines(klines: KLineData[]): Partial<IndicatorsResult> {
  if (klines.length < 60) return {};
  const closes = klines.map((k) => k.close);
  const sma5 = calcSMA(closes, 5);
  const sma10 = calcSMA(closes, 10);
  const sma20 = calcSMA(closes, 20);
  const sma60 = calcSMA(closes, 60);
  const macd = calcMACD(closes);
  const rsi = calcRSI(closes, 14);
  const boll = calcBollinger(closes, 20, 2);
  return {
    ma5: sma5[sma5.length - 1],
    ma10: sma10[sma10.length - 1],
    ma20: sma20[sma20.length - 1],
    ma60: sma60[sma60.length - 1],
    macd_dif: macd.dif,
    macd_dea: macd.dea,
    macd_hist: macd.hist,
    rsi14: rsi,
    boll_up: boll.up,
    boll_mid: boll.mid,
    boll_down: boll.down,
  };
}
