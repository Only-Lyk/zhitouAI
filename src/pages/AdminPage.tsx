import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Settings, Users, Coins, Save, Plus, Trash2, Crown,
  RefreshCw, Search, X, ChevronLeft
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || '';

interface CreditRules {
  register_gift_credits: number;
  daily_checkin_credits: number;
  credit_exchange_rate: number;
  profit_ratio: number;
}

interface ModelConfig {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  peak_price_per_1k: number;
  valley_price_per_1k: number;
  peak_start: string;
  peak_end: string;
  default: boolean;
}

interface UserItem {
  id: number;
  username: string;
  email?: string;
  is_admin: number;
  credits: number;
  total_consumed: number;
  total_recharged: number;
  default_model?: string;
  created_at: string;
}

const emptyModel = (): ModelConfig => ({
  id: '',
  name: '',
  base_url: 'https://api.deepseek.com',
  api_key: '',
  peak_price_per_1k: 0.01,
  valley_price_per_1k: 0.005,
  peak_start: '09:00',
  peak_end: '23:00',
  default: false,
});

export default function AdminPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [rules, setRules] = useState<CreditRules>({
    register_gift_credits: 100,
    daily_checkin_credits: 10,
    credit_exchange_rate: 100,
    profit_ratio: 1.3,
  });
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [userTotal, setUserTotal] = useState(0);

  const [savingRules, setSavingRules] = useState(false);
  const [savingModels, setSavingModels] = useState(false);
  const [msgRules, setMsgRules] = useState('');
  const [msgModels, setMsgModels] = useState('');

  const [rechargeUser, setRechargeUser] = useState<UserItem | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState<number>(100);
  const [recharging, setRecharging] = useState(false);
  const [rechargeMsg, setRechargeMsg] = useState('');

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/');
      return;
    }
    fetchSettings();
    fetchUsers();
  }, [user]);

  const authHeaders = () => ({
    Authorization: `Bearer ${token || ''}`,
    'Content-Type': 'application/json',
  });

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/settings`, {
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setRules({
        register_gift_credits: Number(data.register_gift_credits ?? 100),
        daily_checkin_credits: Number(data.daily_checkin_credits ?? 10),
        credit_exchange_rate: Number(data.credit_exchange_rate ?? 100),
        profit_ratio: Number(data.profit_ratio ?? 1.3),
      });
      try {
        const cfg = JSON.parse(data.llm_models_config || '{"models":[]}');
        setModels(cfg.models || []);
      } catch {
        setModels([]);
      }
    } catch {
      // ignore
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data.users || []);
      setUserTotal(data.total || 0);
    } catch {
      // ignore
    }
  };

  const saveRules = async () => {
    setSavingRules(true);
    setMsgRules('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/settings`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ settings: rules }),
      });
      setMsgRules(res.ok ? '保存成功' : '保存失败');
    } catch {
      setMsgRules('网络错误');
    } finally {
      setSavingRules(false);
    }
  };

  const saveModels = async () => {
    // 基础校验
    for (const m of models) {
      if (!m.id || !m.name || !m.base_url) {
        setMsgModels('请填写完整的模型 ID、名称和 Base URL');
        return;
      }
    }
    if (models.filter((m) => m.default).length !== 1) {
      setMsgModels('必须且只能设置一个默认模型');
      return;
    }

    setSavingModels(true);
    setMsgModels('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/settings`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ settings: { llm_models_config: { models } } }),
      });
      setMsgModels(res.ok ? '保存成功' : '保存失败');
      if (res.ok) fetchSettings();
    } catch {
      setMsgModels('网络错误');
    } finally {
      setSavingModels(false);
    }
  };

  const addModel = () => {
    setModels((prev) => {
      const next = [...prev, emptyModel()];
      if (next.length === 1) next[0].default = true;
      return next;
    });
  };

  const removeModel = (idx: number) => {
    setModels((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length > 0 && !next.some((m) => m.default)) {
        next[0].default = true;
      }
      return next;
    });
  };

  const updateModel = (idx: number, patch: Partial<ModelConfig>) => {
    setModels((prev) =>
      prev.map((m, i) => {
        if (i !== idx) return m;
        return { ...m, ...patch };
      })
    );
  };

  const setDefaultModel = (idx: number) => {
    setModels((prev) =>
      prev.map((m, i) => ({ ...m, default: i === idx }))
    );
  };

  const doRecharge = async () => {
    if (!rechargeUser || rechargeAmount <= 0) return;
    setRecharging(true);
    setRechargeMsg('');
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/recharge?user_id=${rechargeUser.id}&amount=${rechargeAmount}&description=管理员充值`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token || ''}` },
        }
      );
      if (res.ok) {
        setRechargeMsg(`已为 ${rechargeUser.username} 充值 ${rechargeAmount} 积分`);
        fetchUsers();
        setTimeout(() => setRechargeUser(null), 1200);
      } else {
        setRechargeMsg('充值失败');
      }
    } catch {
      setRechargeMsg('网络错误');
    } finally {
      setRecharging(false);
    }
  };

  if (!user?.is_admin) return null;

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-4 pb-24">
      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="text-text-tertiary hover:text-text-primary">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-text-primary">管理后台</h1>
      </div>

      {/* 积分与充值规则 */}
      <div className="mb-6 rounded-xl border border-border-default bg-bg-secondary p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-accent-gold">
          <Coins size={16} />
          积分与充值规则
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: '注册赠送积分', key: 'register_gift_credits' as const },
            { label: '每日签到积分', key: 'daily_checkin_credits' as const },
            { label: '1元兑换积分', key: 'credit_exchange_rate' as const },
            { label: '利润系数', key: 'profit_ratio' as const, step: 0.1 },
          ].map((item) => (
            <div key={item.key}>
              <label className="mb-1 block text-xs text-text-secondary">{item.label}</label>
              <input
                type="number"
                step={item.step}
                value={rules[item.key]}
                onChange={(e) =>
                  setRules((prev) => ({ ...prev, [item.key]: Number(e.target.value) }))
                }
                className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold"
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-text-tertiary">
          利润系数 1.3 表示用户实际 token 消耗按 1.3 倍结算，相当于 30% 平台手续费。
        </p>
        {msgRules && (
          <div className={`mt-2 text-xs ${msgRules.includes('成功') ? 'text-up' : 'text-down'}`}>{msgRules}</div>
        )}
        <button
          onClick={saveRules}
          disabled={savingRules}
          className="mt-3 flex items-center gap-1.5 rounded-lg bg-accent-gold px-4 py-2 text-xs font-semibold text-bg-primary transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Save size={14} /> {savingRules ? '保存中...' : '保存规则'}
        </button>
      </div>

      {/* 多模型配置 */}
      <div className="mb-6 rounded-xl border border-border-default bg-bg-secondary p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-accent-gold">
            <Settings size={16} />
            LLM 模型配置
          </div>
          <button
            onClick={addModel}
            className="flex items-center gap-1 rounded-md bg-accent-gold/10 px-2 py-1 text-xs text-accent-gold"
          >
            <Plus size={12} /> 添加模型
          </button>
        </div>

        {models.length === 0 && (
          <div className="mb-3 text-xs text-text-tertiary">暂无模型配置，点击右上角添加。</div>
        )}

        <div className="space-y-4">
          {models.map((m, idx) => (
            <div key={idx} className="rounded-lg border border-border-default bg-bg-tertiary p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="default_model"
                    checked={m.default}
                    onChange={() => setDefaultModel(idx)}
                    className="accent-accent-gold"
                    title="设为默认"
                  />
                  <span className="text-xs font-medium text-text-primary">{m.name || `模型 ${idx + 1}`}</span>
                  {m.default && (
                    <span className="flex items-center gap-0.5 rounded bg-accent-gold/20 px-1.5 py-0.5 text-[10px] text-accent-gold">
                      <Crown size={10} /> 默认
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeModel(idx)}
                  className="text-text-tertiary transition-colors hover:text-down"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] text-text-secondary">模型 ID</label>
                  <input
                    type="text"
                    value={m.id}
                    onChange={(e) => updateModel(idx, { id: e.target.value })}
                    placeholder="deepseek-chat"
                    className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent-gold"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-text-secondary">显示名称</label>
                  <input
                    type="text"
                    value={m.name}
                    onChange={(e) => updateModel(idx, { name: e.target.value })}
                    placeholder="DeepSeek Chat"
                    className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent-gold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[10px] text-text-secondary">Base URL</label>
                  <input
                    type="text"
                    value={m.base_url}
                    onChange={(e) => updateModel(idx, { base_url: e.target.value })}
                    placeholder="https://api.deepseek.com"
                    className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent-gold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[10px] text-text-secondary">API Key</label>
                  <input
                    type="password"
                    value={m.api_key}
                    onChange={(e) => updateModel(idx, { api_key: e.target.value })}
                    placeholder="sk-..."
                    className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent-gold"
                  />
                  <p className="mt-1 text-[9px] text-text-tertiary">已保存的 Key 显示为掩码，直接输入完整 Key 可覆盖。</p>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-text-secondary">峰时价格（元/1k tokens）</label>
                  <input
                    type="number"
                    step={0.001}
                    value={m.peak_price_per_1k}
                    onChange={(e) => updateModel(idx, { peak_price_per_1k: Number(e.target.value) })}
                    className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent-gold"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-text-secondary">谷时价格（元/1k tokens）</label>
                  <input
                    type="number"
                    step={0.001}
                    value={m.valley_price_per_1k}
                    onChange={(e) => updateModel(idx, { valley_price_per_1k: Number(e.target.value) })}
                    className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent-gold"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-text-secondary">峰时开始</label>
                  <input
                    type="time"
                    value={m.peak_start}
                    onChange={(e) => updateModel(idx, { peak_start: e.target.value })}
                    className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent-gold"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-text-secondary">峰时结束</label>
                  <input
                    type="time"
                    value={m.peak_end}
                    onChange={(e) => updateModel(idx, { peak_end: e.target.value })}
                    className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent-gold"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {msgModels && (
          <div className={`mt-3 text-xs ${msgModels.includes('成功') ? 'text-up' : 'text-down'}`}>{msgModels}</div>
        )}
        <button
          onClick={saveModels}
          disabled={savingModels}
          className="mt-3 flex items-center gap-1.5 rounded-lg bg-accent-gold px-4 py-2 text-xs font-semibold text-bg-primary transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Save size={14} /> {savingModels ? '保存中...' : '保存模型配置'}
        </button>
      </div>

      {/* 用户列表 */}
      <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-accent-gold">
            <Users size={16} />
            用户列表
          </div>
          <button
            onClick={fetchUsers}
            className="text-text-tertiary transition-colors hover:text-text-primary"
            title="刷新"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="mb-2 text-xs text-text-tertiary">共 {userTotal} 位用户</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-default text-text-secondary">
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">用户名</th>
                <th className="py-2 pr-3">角色</th>
                <th className="py-2 pr-3">积分</th>
                <th className="py-2 pr-3">累计消耗</th>
                <th className="py-2 pr-3">默认模型</th>
                <th className="py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border-default text-text-primary">
                  <td className="py-2 pr-3">{u.id}</td>
                  <td className="py-2 pr-3">{u.username}</td>
                  <td className="py-2 pr-3">
                    {u.is_admin ? (
                      <span className="rounded bg-accent-gold/20 px-1.5 py-0.5 text-accent-gold">管理员</span>
                    ) : (
                      <span className="text-text-secondary">用户</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-accent-gold">{u.credits}</td>
                  <td className="py-2 pr-3 text-down">{u.total_consumed}</td>
                  <td className="py-2 pr-3 text-text-secondary">{u.default_model || '-'}</td>
                  <td className="py-2">
                    <button
                      onClick={() => {
                        setRechargeUser(u);
                        setRechargeAmount(100);
                        setRechargeMsg('');
                      }}
                      className="flex items-center gap-1 rounded bg-up-bg px-2 py-1 text-[10px] text-up"
                    >
                      <Coins size={10} /> 充值
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-text-tertiary">暂无用户</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 充值弹窗 */}
      {rechargeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-xl border border-border-default bg-bg-secondary p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">给用户充值</h3>
              <button onClick={() => setRechargeUser(null)} className="text-text-tertiary hover:text-text-primary">
                <X size={16} />
              </button>
            </div>
            <div className="mb-3 text-xs text-text-secondary">
              用户：<span className="text-text-primary">{rechargeUser.username}</span>
            </div>
            <div className="mb-3">
              <label className="mb-1 block text-xs text-text-secondary">充值积分数量</label>
              <input
                type="number"
                min={1}
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(Number(e.target.value))}
                className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold"
              />
            </div>
            {rechargeMsg && (
              <div className={`mb-3 text-xs ${rechargeMsg.includes('已') ? 'text-up' : 'text-down'}`}>{rechargeMsg}</div>
            )}
            <button
              onClick={doRecharge}
              disabled={recharging || rechargeAmount <= 0}
              className="w-full rounded-lg bg-accent-gold py-2 text-xs font-semibold text-bg-primary transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {recharging ? '充值中...' : `确认充值 ${rechargeAmount} 积分`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
