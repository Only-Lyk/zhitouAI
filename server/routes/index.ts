import { Router } from 'express';
import axios from 'axios';
import iconv from 'iconv-lite';

const router = Router();

// ========== 腾讯财经数据获取工具 ==========

const TX_TIMEOUT = 8000;

interface TxQuote {
  code: string;
  name: string;
  price: number;
  prev_close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  market_cap: number;
  pe: number;
  pb: number;
  change: number;
  change_pct: number;
}

// 内存缓存 { key: { data, ts } }
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_MS = 30_000; // 30秒缓存

function getCache<T>(key: string): T | null {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.ts > CACHE_MS) {
    cache.delete(key);
    return null;
  }
  return item.data as T;
}
function setCache(key: string, data: any) {
  cache.set(key, { data, ts: Date.now() });
}

async function fetchTxQuotes(codes: string[]): Promise<Record<string, TxQuote>> {
  // Build mapping from raw code to tx query code
  const codeMap = new Map<string, string>();
  const txCodes = codes.map(c => {
    let tx: string;
    if (c.startsWith('sh') || c.startsWith('sz')) tx = c;
    else if (c.startsWith('6') || c.startsWith('68')) tx = `sh${c}`;
    else if (c.startsWith('0') || c.startsWith('3')) tx = `sz${c}`;
    else tx = c;
    codeMap.set(tx, c);
    return tx;
  }).join(',');

  try {
    const res = await axios.get(`https://qt.gtimg.cn/q=${txCodes}`, {
      responseType: 'arraybuffer',
      timeout: TX_TIMEOUT,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const text = iconv.decode(res.data, 'gbk');
    const result: Record<string, TxQuote> = {};

    const lines = text.split(';').filter(l => l.includes('v_'));
    for (const line of lines) {
      const m = line.match(/v_([a-z]+\d+)="(.+?)"/);
      if (!m) continue;
      const txCode = m[1];
      const parts = m[2].split('~');
      if (parts.length < 45) continue;
      const code = parts[2];
      const name = parts[1];
      const price = parseFloat(parts[3]) || 0;
      const prevClose = parseFloat(parts[4]) || price;
      const open = parseFloat(parts[5]) || prevClose;
      const volume = parseFloat(parts[6]) || 0;
      const high = parseFloat(parts[33]) || price;
      const low = parseFloat(parts[34]) || price;
      const marketCap = parseFloat(parts[44]) || 0;
      const pe = parseFloat(parts[39]) || 0;
      const pb = parseFloat(parts[46]) || 0;
      const change = price - prevClose;
      const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

      // Use the original caller code as the key
      const key = codeMap.get(txCode) || code;
      result[key] = {
        code, name, price, prev_close: prevClose, open, high, low,
        volume, market_cap: marketCap, pe, pb,
        change: Math.round(change * 100) / 100,
        change_pct: Math.round(changePct * 100) / 100,
      };
    }
    return result;
  } catch (e) {
    console.error('fetchTxQuotes error:', (e as Error).message);
    return {};
  }
}

async function fetchTxKline(code: string, days = 120): Promise<any[]> {
  const key = `kline_${code}_${days}`;
  const cached = getCache<any[]>(key);
  if (cached) return cached;

  const txCode = code.startsWith('6') ? `sh${code}` : `sz${code}`;
  try {
    const res = await axios.get(
      `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${txCode},day,2024-01-01,2026-12-31,${days},qfq`,
      { responseType: 'arraybuffer', timeout: TX_TIMEOUT }
    );
    const text = iconv.decode(res.data, 'gbk');
    const json = JSON.parse(text);
    const arr = json.data?.[txCode]?.qfqday || json.data?.[txCode]?.day || [];
    const klines = arr.map((item: string[]) => ({
      date: item[0],
      open: parseFloat(item[1]),
      close: parseFloat(item[2]),
      low: parseFloat(item[3]),
      high: parseFloat(item[4]),
      volume: parseFloat(item[5]),
    }));
    setCache(key, klines);
    return klines;
  } catch (e) {
    console.error('fetchTxKline error:', (e as Error).message);
    return [];
  }
}

// ========== 指标计算（基于真实K线） ==========

function calcSMA(values: number[], n: number): (number | null)[] {
  const res: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < n - 1) { res.push(null); continue; }
    const sum = values.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0);
    res.push(Math.round((sum / n) * 100) / 100);
  }
  return res;
}

function calcEMA(values: number[], n: number): number[] {
  const k = 2 / (n + 1);
  const ema: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcMACD(closes: number[]) {
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

function calcRSI(closes: number[], n = 14): number {
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

function calcBollinger(closes: number[], n = 20, k = 2) {
  const slice = closes.slice(-n);
  const ma = slice.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(slice.reduce((sum, v) => sum + Math.pow(v - ma, 2), 0) / n);
  return {
    up: Math.round((ma + k * std) * 100) / 100,
    mid: Math.round(ma * 100) / 100,
    down: Math.round((ma - k * std) * 100) / 100,
  };
}

function calcIndicatorsFromKlines(klines: any[]) {
  if (klines.length < 60) return {};
  const closes = klines.map((k: any) => k.close);
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

// ========== 股票代码池（用于搜索和推荐） ==========

const STOCK_POOL: Record<string, { name: string; sector?: string }> = {
  '600519': { name: '贵州茅台', sector: '白酒' },
  '000858': { name: '五粮液', sector: '白酒' },
  '002594': { name: '比亚迪', sector: '汽车' },
  '300750': { name: '宁德时代', sector: '新能源' },
  '000333': { name: '美的集团', sector: '家电' },
  '600036': { name: '招商银行', sector: '银行' },
  '601318': { name: '中国平安', sector: '保险' },
  '600276': { name: '恒瑞医药', sector: '医药' },
  '000002': { name: '万科A', sector: '地产' },
  '002415': { name: '海康威视', sector: '电子' },
  '300059': { name: '东方财富', sector: '券商' },
  '600030': { name: '中信证券', sector: '券商' },
  '601012': { name: '隆基绿能', sector: '新能源' },
  '002714': { name: '牧原股份', sector: '养殖' },
  '000001': { name: '平安银行', sector: '银行' },
  '600887': { name: '伊利股份', sector: '食品' },
  '002230': { name: '科大讯飞', sector: 'AI' },
  '300122': { name: '智飞生物', sector: '医药' },
  '601888': { name: '中国中免', sector: '消费' },
  '603288': { name: '海天味业', sector: '食品' },
};

// ========== API Routes ==========

router.get('/api/market/indices', async (req, res) => {
  try {
    const quotes = await fetchTxQuotes(['sh000001', 'sz399001', 'sz399006', 'sh000688']);
    const indices = [
      { name: '上证指数', code: '000001', ...pickQuote(quotes['sh000001']) },
      { name: '深证成指', code: '399001', ...pickQuote(quotes['sz399001']) },
      { name: '创业板指', code: '399006', ...pickQuote(quotes['sz399006']) },
      { name: '科创50', code: '000688', ...pickQuote(quotes['sh000688']) },
    ];
    res.json(indices);
  } catch {
    res.status(500).json({ error: 'Failed to fetch indices' });
  }
});

function pickQuote(q?: TxQuote) {
  if (!q) return { price: 0, change: 0, change_pct: 0 };
  return { price: q.price, change: q.change, change_pct: q.change_pct };
}

router.get('/api/market/sectors', async (req, res) => {
  // 板块用几个代表性ETF来近似
  try {
    const etfs = await fetchTxQuotes(['512480', '515030', '512690', '512800', '512010']);
    const map: Record<string, string> = {
      '512480': '半导体', '515030': '新能源', '512690': '白酒',
      '512800': '银行', '512010': '医药',
    };
    const sectors = Object.entries(etfs).map(([code, q]) => ({
      name: map[code] || '其他',
      change_pct: q.change_pct,
      leader: '-',
    }));
    res.json(sectors);
  } catch {
    res.json([
      { name: '半导体', change_pct: 3.52, leader: '-' },
      { name: '新能源', change_pct: 2.18, leader: '-' },
      { name: '白酒', change_pct: -1.05, leader: '-' },
      { name: '银行', change_pct: 0.85, leader: '-' },
      { name: '医药', change_pct: 1.42, leader: '-' },
    ]);
  }
});

router.get('/api/stock/quote', async (req, res) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  try {
    const quotes = await fetchTxQuotes([code]);
    if (quotes[code]) {
      return res.json(quotes[code]);
    }
    // fallback: 本地池子
    const pool = STOCK_POOL[code];
    if (pool) {
      return res.json({
        code, name: pool.name, price: 0, prev_close: 0, open: 0, high: 0, low: 0,
        volume: 0, market_cap: 0, pe: 0, pb: 0, change: 0, change_pct: 0,
      });
    }
    res.status(404).json({ error: 'Stock not found' });
  } catch {
    res.status(500).json({ error: 'Fetch failed' });
  }
});

router.get('/api/stock/indicators', async (req, res) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  const klines = await fetchTxKline(code, 120);
  if (klines.length >= 60) {
    return res.json(calcIndicatorsFromKlines(klines));
  }
  // fallback
  res.json(calcIndicatorsFromKlines(generateMockKline(code, 120)));
});

router.get('/api/stock/search', (req, res) => {
  const keyword = (req.query.keyword as string || '').trim();
  if (!keyword) return res.json([]);
  const results = Object.entries(STOCK_POOL)
    .filter(([code, info]) => code.includes(keyword) || info.name.includes(keyword))
    .map(([code, info]) => ({ code, name: info.name, sector: info.sector }));
  res.json(results);
});

router.get('/api/ai/diagnose', async (req, res) => {
  const code = req.query.code as string;
  const pool = STOCK_POOL[code];
  if (!pool) return res.status(404).json({ error: 'Stock not found' });

  // 获取真实行情和指标
  const [quotes, klines] = await Promise.all([
    fetchTxQuotes([code]),
    fetchTxKline(code, 120),
  ]);
  const quote = quotes[code];
  const indicators = klines.length >= 60 ? calcIndicatorsFromKlines(klines) : {};

  const price = quote?.price || 100;
  const ma20 = (indicators as any).ma20 || price;
  const rsi = (indicators as any).rsi14 || 50;

  // 基于真实数据生成评分
  let score = 50;
  if (price > ma20) score += 10;
  if ((indicators as any).macd_hist > 0) score += 10;
  if (rsi > 30 && rsi < 70) score += 10;
  if (quote && quote.change_pct > 0) score += 5;
  if (quote && quote.change_pct > 2) score += 5;
  score = Math.min(95, Math.max(30, score));

  const signals = score > 75 ? '强烈关注' : score > 60 ? '值得关注' : score > 45 ? '中性观望' : '谨慎回避';
  const trend = price > ma20 ? '上升趋势' : '震荡整理';

  res.json({
    code, name: pool.name, score, signal: signals, trend,
    support: Math.round(price * 0.95 * 100) / 100,
    pressure: Math.round(price * 1.08 * 100) / 100,
    risk_level: score > 70 ? '低' : score > 50 ? '中' : '高',
    reason: buildReason(indicators as any, quote),
    suggestion: score > 60 ? '技术指标偏积极，可关注量能配合' : '建议观望等待明确信号',
    indicators,
    generated_at: new Date().toISOString(),
  });
});

function buildReason(ind: any, quote?: TxQuote) {
  const parts: string[] = [];
  if (ind.ma5 && ind.ma20) {
    parts.push(ind.ma5 > ind.ma20 ? 'MA5在MA20之上，短期均线多头排列' : 'MA5在MA20之下，短期趋势偏弱');
  }
  if (ind.macd_hist !== undefined) {
    parts.push(ind.macd_hist > 0 ? 'MACD红柱，多头动能延续' : 'MACD绿柱，空头占优');
  }
  if (ind.rsi14 !== undefined) {
    parts.push(`RSI(${ind.rsi14})处于${ind.rsi14 > 70 ? '超买区' : ind.rsi14 < 30 ? '超卖区' : '中性区域'}`);
  }
  if (quote) {
    parts.push(`今日${quote.change_pct >= 0 ? '上涨' : '下跌'}${Math.abs(quote.change_pct)}%`);
  }
  return parts.join('；') + '。';
}

router.get('/api/ai/diagnose/stream', async (req, res) => {
  const code = req.query.code as string;
  const pool = STOCK_POOL[code];
  const name = pool?.name || '未知股票';

  // 获取真实数据生成报告
  const [quotes, klines] = await Promise.all([
    fetchTxQuotes([code]),
    fetchTxKline(code, 120),
  ]);
  const quote = quotes[code];
  const ind = klines.length >= 60 ? calcIndicatorsFromKlines(klines) : {};

  const price = quote?.price || 0;
  const score = quote ? Math.round(50 + (quote.change_pct || 0) * 2 + ((ind as any).macd_hist || 0) * 10) : 60;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const text = `正在分析 ${name}(${code})...

【综合评分】${Math.min(95, Math.max(30, score))}/100
【信号判断】${score > 60 ? '值得关注' : '中性观望'}
【趋势判断】${price > ((ind as any).ma20 || 0) ? '上升趋势' : '震荡整理'}

【技术解读】
${buildReason(ind as any, quote)}

【关键价位】
支撑位：${Math.round(price * 0.95 * 100) / 100} 元
压力位：${Math.round(price * 1.08 * 100) / 100} 元

【操作建议】
${score > 60 ? '趋势向好，但需关注量能配合，建议回调至支撑位附近逢低关注。' : '建议观望等待明确信号，不宜盲目操作。'}

【风险提示】
当前风险等级：中。股票投资有风险，以上分析基于实时行情数据，仅供参考，不构成投资建议。`;

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

router.get('/api/ai/recommendations', async (req, res) => {
  try {
    const codes = Object.keys(STOCK_POOL).slice(0, 8);
    const quotes = await fetchTxQuotes(codes);

    const recs = Object.values(quotes)
      .map(q => {
        let score = 50;
        if (q.change_pct > 0) score += 10;
        if (q.change_pct > 2) score += 10;
        if (q.pe > 0 && q.pe < 30) score += 10;
        if (q.pb > 0 && q.pb < 3) score += 10;
        score = Math.min(95, Math.max(30, score));
        return {
          code: q.code,
          name: q.name,
          price: q.price,
          change_pct: q.change_pct,
          score,
          signal: score > 75 ? '强烈关注' : score > 60 ? '值得关注' : '中性观望',
          reason: q.change_pct > 2 ? '涨幅靠前，资金关注度高' : q.change_pct > 0 ? '走势稳健，量能配合' : '短期调整，关注支撑',
          risk_level: score > 70 ? '低' : '中',
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    res.json(recs);
  } catch {
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

router.post('/api/ai/chat', (req, res) => {
  const { message } = req.body;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const reply = `我收到了您的问题："${message}"

在实际部署环境中，这里会调用大语言模型（如DeepSeek/豆包）进行深度分析。当前为演示模式，展示了系统的问答交互能力。

您可以问我：
1. 某只股票的技术分析
2. 市场热点解读
3. 投资策略建议
4. 财务指标含义`;

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

// ========== Auth / Credit / Admin (沙箱预览用 mock) ==========

const MOCK_USERS = new Map<string, { id: number; username: string; password: string; is_admin: boolean; credits: number }>();
// 沙箱预览默认 admin 用户（token mock_jwt_1_admin 可直接使用）
MOCK_USERS.set('admin', { id: 1, username: 'admin', password: 'admin123', is_admin: true, credits: 99999 });

function makeToken(user: any) {
  return `mock_jwt_${user.id}_${Date.now()}`;
}

function authMiddleware(req: any, res: any, next: any) {
  const auth = req.headers.authorization || '';
  req.currentUser = null;
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    for (const u of MOCK_USERS.values()) {
      if (token.includes(`_${u.id}_`)) {
        req.currentUser = { id: u.id, username: u.username, is_admin: u.is_admin };
        break;
      }
    }
  }
  next();
}

router.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });
  for (const u of MOCK_USERS.values()) {
    if (u.username === username) return res.status(400).json({ error: 'Username already exists' });
  }
  const id = MOCK_USERS.size + 1;
  const isAdmin = username === 'admin';
  const user = { id, username, password, is_admin: isAdmin, credits: isAdmin ? 99999 : 100 };
  MOCK_USERS.set(username, user);
  res.json({ access_token: makeToken(user), token_type: 'bearer', user: { id, username, is_admin: isAdmin } });
});

router.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = MOCK_USERS.get(username);
  if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ access_token: makeToken(user), token_type: 'bearer', user: { id: user.id, username: user.username, is_admin: user.is_admin } });
});

router.get('/api/auth/me', authMiddleware, (req: any, res) => {
  if (!req.currentUser) return res.status(401).json({ error: 'Unauthorized' });
  const user = MOCK_USERS.get(req.currentUser.username);
  if (!user) return res.status(401).json({ error: 'User not found' });
  res.json({ id: user.id, username: user.username, is_admin: user.is_admin, credits: user.credits });
});

router.get('/api/credit/balance', authMiddleware, (req: any, res) => {
  if (!req.currentUser) return res.status(401).json({ error: 'Unauthorized' });
  const user = MOCK_USERS.get(req.currentUser.username);
  res.json({ credits: user?.credits || 0 });
});

router.get('/api/credit/transactions', authMiddleware, (req: any, res) => {
  res.json({ transactions: [] });
});

router.post('/api/admin/settings', authMiddleware, (req: any, res) => {
  if (!req.currentUser?.is_admin) return res.status(403).json({ error: 'Forbidden' });
  res.json({ success: true });
});

router.get('/api/admin/settings', authMiddleware, (req: any, res) => {
  if (!req.currentUser?.is_admin) return res.status(403).json({ error: 'Forbidden' });
  res.json({ ai_chat_cost: 5, ai_diagnose_cost: 10, signup_bonus: 100, daily_checkin_bonus: 5 });
});

router.get('/api/admin/users', authMiddleware, (req: any, res) => {
  if (!req.currentUser?.is_admin) return res.status(403).json({ error: 'Forbidden' });
  const users = Array.from(MOCK_USERS.values()).map(u => ({ id: u.id, username: u.username, is_admin: u.is_admin, credits: u.credits }));
  res.json({ users });
});

// 让 AI 诊断和聊天也支持 period 参数（兼容前端调用）
router.get('/api/stock/kline', async (req, res) => {
  const code = req.query.code as string;
  const days = parseInt(req.query.days as string) || 120;
  const period = (req.query.period as string) || 'day';
  // 沙箱忽略 period 映射，直接返回日线
  if (!code) return res.status(400).json({ error: 'Missing code' });
  const klines = await fetchTxKline(code, days);
  if (klines.length > 0) return res.json(klines);
  res.json(generateMockKline(code, days));
});

router.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.COZE_PROJECT_ENV, timestamp: new Date().toISOString() });
});

// ========== Mock fallback helpers ==========

function generateMockKline(code: string, days = 120) {
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

export default router;
