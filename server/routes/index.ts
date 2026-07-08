import { Router } from 'express';

const router = Router();

// 模拟大盘指数
const mockIndices = [
  { name: '上证指数', code: '000001', price: 3052.18, change: 14.32, change_pct: 0.47 },
  { name: '深证成指', code: '399001', price: 9785.42, change: -18.65, change_pct: -0.19 },
  { name: '创业板指', code: '399006', price: 1925.68, change: 12.41, change_pct: 0.65 },
  { name: '科创50', code: '000688', price: 852.36, change: 8.92, change_pct: 1.06 },
];

// 模拟股票池
const mockStocks: Record<string, any> = {
  '600519': { code: '600519', name: '贵州茅台', price: 1528.50, change: 18.20, change_pct: 1.21, volume: 12500, market_cap: 19200, pe: 25.3, pb: 8.1 },
  '000858': { code: '000858', name: '五粮液', price: 138.20, change: -1.50, change_pct: -1.07, volume: 28500, market_cap: 5360, pe: 18.5, pb: 4.2 },
  '002594': { code: '002594', name: '比亚迪', price: 268.80, change: 8.60, change_pct: 3.31, volume: 45200, market_cap: 7820, pe: 32.1, pb: 5.8 },
  '300750': { code: '300750', name: '宁德时代', price: 198.50, change: 5.20, change_pct: 2.69, volume: 32100, market_cap: 8730, pe: 28.4, pb: 6.2 },
  '000333': { code: '000333', name: '美的集团', price: 62.35, change: 0.85, change_pct: 1.38, volume: 18600, market_cap: 4360, pe: 14.2, pb: 3.1 },
  '600036': { code: '600036', name: '招商银行', price: 35.18, change: -0.22, change_pct: -0.62, volume: 42100, market_cap: 8870, pe: 5.8, pb: 0.92 },
};

// 生成K线数据
function generateKline(code: string, days = 120) {
  const klines = [];
  const base = code.startsWith('600') ? 150 : 80;
  let price = base;
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const change = (Math.random() - 0.48) * 0.04;
    const open = price;
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.015);
    const low = Math.min(open, close) * (1 - Math.random() * 0.015);
    klines.push({
      date: d.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.round(Math.random() * 40000 + 5000),
    });
    price = close;
  }
  return klines;
}

// 计算指标
function calcIndicators(klines: any[]) {
  if (klines.length < 60) return {};
  const closes = klines.map(k => k.close);
  const ma = (n: number) => {
    const slice = closes.slice(-n);
    return Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 100) / 100;
  };
  return {
    ma5: ma(5), ma10: ma(10), ma20: ma(20), ma60: ma(60),
    macd_dif: 0.85, macd_dea: 0.62, macd_hist: 0.23,
    rsi14: 58.5,
    boll_up: closes[closes.length - 1] * 1.05,
    boll_mid: closes[closes.length - 1],
    boll_down: closes[closes.length - 1] * 0.95,
  };
}

// ========== API Routes ==========

router.get('/api/market/indices', (req, res) => {
  res.json(mockIndices);
});

router.get('/api/market/sectors', (req, res) => {
  res.json([
    { name: '半导体', change_pct: 3.52, leader: '中芯国际' },
    { name: '新能源', change_pct: 2.18, leader: '宁德时代' },
    { name: '白酒', change_pct: -1.05, leader: '贵州茅台' },
    { name: '银行', change_pct: 0.85, leader: '招商银行' },
    { name: '医药', change_pct: 1.42, leader: '恒瑞医药' },
  ]);
});

router.get('/api/stock/quote', (req, res) => {
  const code = req.query.code as string;
  if (mockStocks[code]) {
    return res.json(mockStocks[code]);
  }
  res.status(404).json({ error: 'Stock not found' });
});

router.get('/api/stock/kline', (req, res) => {
  const code = req.query.code as string;
  const days = parseInt(req.query.days as string) || 120;
  res.json(generateKline(code, days));
});

router.get('/api/stock/indicators', (req, res) => {
  const code = req.query.code as string;
  const klines = generateKline(code, 60);
  res.json(calcIndicators(klines));
});

router.get('/api/stock/search', (req, res) => {
  const keyword = (req.query.keyword as string || '').toLowerCase();
  const results = Object.values(mockStocks).filter((s: any) =>
    s.code.includes(keyword) || s.name.includes(keyword)
  );
  res.json(results);
});

router.get('/api/ai/diagnose', (req, res) => {
  const code = req.query.code as string;
  const stock = mockStocks[code];
  if (!stock) return res.status(404).json({ error: 'Stock not found' });

  const score = Math.round(55 + Math.random() * 30);
  const signals = score > 75 ? '强烈关注' : score > 60 ? '值得关注' : score > 40 ? '中性观望' : '谨慎回避';
  const trend = score > 60 ? '上升趋势' : score > 40 ? '震荡整理' : '下行风险';

  res.json({
    code, name: stock.name, score, signal: signals, trend,
    support: Math.round(stock.price * 0.95 * 100) / 100,
    pressure: Math.round(stock.price * 1.08 * 100) / 100,
    risk_level: score > 70 ? '低' : score > 50 ? '中' : '高',
    reason: 'MA5上穿MA20，短期趋势向上；MACD红柱，多头动能；RSI处于中性区域。',
    suggestion: score > 60 ? '技术指标积极，可考虑逢低布局' : '建议观望等待明确信号',
    indicators: { ma5: stock.price * 0.98, ma10: stock.price * 0.97, ma20: stock.price * 0.95, ma60: stock.price * 0.92, macd_dif: 0.85, macd_dea: 0.62, macd_hist: 0.23, rsi14: 58.5, boll_up: stock.price * 1.05, boll_mid: stock.price, boll_down: stock.price * 0.95 },
    generated_at: new Date().toISOString(),
  });
});

router.get('/api/ai/diagnose/stream', (req, res) => {
  const code = req.query.code as string;
  const stock = mockStocks[code] || { name: '未知股票' };
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const text = `正在分析 ${stock.name}(${code})...\n\n【综合评分】72/100\n【信号判断】值得关注\n【趋势判断】震荡上行\n\n【技术解读】\nMA5上穿MA20，短期趋势向上；MACD红柱，多头动能；RSI处于中性区域。\n\n【关键价位】\n支撑位：${Math.round((stock.price || 100) * 0.95 * 100) / 100} 元\n压力位：${Math.round((stock.price || 100) * 1.08 * 100) / 100} 元\n\n【操作建议】\n趋势向好，但需关注量能配合，建议回调至支撑位附近逢低关注。\n\n【风险提示】\n当前风险等级：中。股票投资有风险，以上分析仅供参考，不构成投资建议。`;

  let i = 0;
  const interval = setInterval(() => {
    if (i >= text.length) {
      res.write('data: [DONE]\n\n');
      clearInterval(interval);
      res.end();
      return;
    }
    const chunk = text.slice(i, i + 3);
    res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    i += 3;
  }, 20);
});

router.get('/api/ai/recommendations', (req, res) => {
  const recs = [
    { code: '002594', name: '比亚迪', price: 268.80, change_pct: 3.31, score: 82, signal: '强烈关注', reason: '突破年线，量能放大，MACD金叉。', risk_level: '低' },
    { code: '300750', name: '宁德时代', price: 198.50, change_pct: 2.69, score: 78, signal: '值得关注', reason: '新能源龙头，基本面稳健，RSI回升。', risk_level: '中' },
    { code: '600519', name: '贵州茅台', price: 1528.50, change_pct: 1.21, score: 71, signal: '值得关注', reason: '白酒龙头，估值修复中，机构持仓稳定。', risk_level: '中' },
    { code: '000333', name: '美的集团', price: 62.35, change_pct: 1.38, score: 65, signal: '中性观望', reason: '家电复苏，但出口业务存不确定性。', risk_level: '中' },
  ];
  res.json(recs);
});

router.post('/api/ai/chat', (req, res) => {
  const { message } = req.body;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const reply = `我收到了您的问题："${message}"\n\n在实际部署环境中，这里会调用大语言模型（如DeepSeek/豆包）进行深度分析。当前为演示模式，展示了系统的问答交互能力。\n\n您可以问我：\n1. 某只股票的技术分析\n2. 市场热点解读\n3. 投资策略建议\n4. 财务指标含义`;

  let i = 0;
  const interval = setInterval(() => {
    if (i >= reply.length) {
      res.write('data: [DONE]\n\n');
      clearInterval(interval);
      res.end();
      return;
    }
    const chunk = reply.slice(i, i + 4);
    res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    i += 4;
  }, 15);
});

router.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.COZE_PROJECT_ENV, timestamp: new Date().toISOString() });
});

export default router;
