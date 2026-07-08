import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Settings, Bot, Save, ChevronLeft } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || '';

interface ModelOption {
  id: string;
  name: string;
  default: boolean;
  peak_price_per_1k: number;
  valley_price_per_1k: number;
  peak_start: string;
  peak_end: string;
}

export default function SettingsPage() {
  const { user, token, updateUser } = useAuth();
  const navigate = useNavigate();
  const [models, setModels] = useState<ModelOption[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchModels();
  }, [user]);

  const fetchModels = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ai/models`, {
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      if (res.ok) {
        const data = await res.json();
        const list: ModelOption[] = data.models || [];
        setModels(list);
        const current = user?.default_model || list.find((m) => m.default)?.id || '';
        setDefaultModel(current);
      }
    } catch {
      // ignore
    }
  };

  const saveDefaultModel = async () => {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/default-model`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ model_id: defaultModel }),
      });
      if (res.ok) {
        updateUser({ default_model: defaultModel });
        setMsg('保存成功');
      } else {
        setMsg('保存失败');
      }
    } catch {
      setMsg('网络错误');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-4">
      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="text-text-tertiary hover:text-text-primary">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-text-primary">用户设置</h1>
      </div>

      <div className="mb-6 rounded-xl border border-border-default bg-bg-secondary p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-accent-gold">
          <Bot size={16} />
          默认 AI 模型
        </div>
        <p className="mb-3 text-xs text-text-secondary">
          选择 AI 诊断、AI 问答时默认使用的模型。管理员配置更多模型后，可在此切换。
        </p>
        <div className="space-y-2">
          {models.length === 0 && (
            <div className="text-xs text-text-tertiary">暂无可用模型，请联系管理员配置。</div>
          )}
          {models.map((m) => (
            <label
              key={m.id}
              className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
                defaultModel === m.id
                  ? 'border-accent-gold bg-accent-gold/10'
                  : 'border-border-default bg-bg-tertiary hover:border-text-secondary'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="default_model"
                  value={m.id}
                  checked={defaultModel === m.id}
                  onChange={() => setDefaultModel(m.id)}
                  className="accent-accent-gold"
                />
                <span className="text-sm text-text-primary">{m.name}</span>
                {m.default && (
                  <span className="rounded bg-accent-gold/20 px-1.5 py-0.5 text-[10px] text-accent-gold">
                    默认
                  </span>
                )}
              </div>
              <div className="text-right text-[10px] text-text-tertiary">
                <div>峰 {m.peak_price_per_1k}元/1k tokens</div>
                <div>谷 {m.valley_price_per_1k}元/1k tokens</div>
              </div>
            </label>
          ))}
        </div>

        {msg && (
          <div className={`mt-3 text-xs ${msg.includes('成功') ? 'text-up' : 'text-down'}`}>{msg}</div>
        )}
        <button
          onClick={saveDefaultModel}
          disabled={saving}
          className="mt-3 flex items-center gap-1.5 rounded-lg bg-accent-gold px-4 py-2 text-xs font-semibold text-bg-primary transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Save size={14} /> {saving ? '保存中...' : '保存设置'}
        </button>
      </div>

      <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-accent-gold">
          <Settings size={16} />
          账户信息
        </div>
        <div className="space-y-2 text-xs text-text-secondary">
          <div className="flex justify-between">
            <span>用户名</span>
            <span className="text-text-primary">{user.username}</span>
          </div>
          <div className="flex justify-between">
            <span>当前积分</span>
            <span className="text-text-primary">{user.credits ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span>角色</span>
            <span className="text-text-primary">{user.is_admin ? '管理员' : '普通用户'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
