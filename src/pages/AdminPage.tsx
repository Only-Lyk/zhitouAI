import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Settings, Users, Coins, Save } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || '';

interface AdminSettings {
  ai_chat_cost: number;
  ai_diagnose_cost: number;
  signup_bonus: number;
  daily_checkin_bonus: number;
}

interface UserItem {
  id: number;
  username: string;
  is_admin: boolean;
  credits: number;
}

export default function AdminPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AdminSettings>({
    ai_chat_cost: 5,
    ai_diagnose_cost: 10,
    signup_bonus: 100,
    daily_checkin_bonus: 5,
  });
  const [users, setUsers] = useState<UserItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/');
      return;
    }
    fetchSettings();
    fetchUsers();
  }, [user]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/settings`, {
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSettings({
          ai_chat_cost: data.ai_chat_cost ?? 5,
          ai_diagnose_cost: data.ai_diagnose_cost ?? 10,
          signup_bonus: data.signup_bonus ?? 100,
          daily_checkin_bonus: data.daily_checkin_bonus ?? 5,
        });
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
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch {
      // ignore
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
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

  if (!user?.is_admin) return null;

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-4">
      <h1 className="mb-4 text-lg font-bold text-text-primary">管理后台</h1>

      <div className="mb-6 rounded-xl border border-border-default bg-bg-secondary p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-accent-gold">
          <Settings size={16} />
          积分规则配置
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'AI聊天消耗', key: 'ai_chat_cost' as const },
            { label: 'AI诊断消耗', key: 'ai_diagnose_cost' as const },
            { label: '注册奖励', key: 'signup_bonus' as const },
            { label: '每日签到奖励', key: 'daily_checkin_bonus' as const },
          ].map((item) => (
            <div key={item.key}>
              <label className="mb-1 block text-xs text-text-secondary">{item.label}</label>
              <input
                type="number"
                value={settings[item.key]}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, [item.key]: Number(e.target.value) }))
                }
                className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold"
              />
            </div>
          ))}
        </div>
        {msg && (
          <div className={`mt-3 text-xs ${msg.includes('成功') ? 'text-up' : 'text-down'}`}>{msg}</div>
        )}
        <button
          onClick={saveSettings}
          disabled={saving}
          className="mt-3 flex items-center gap-1.5 rounded-lg bg-accent-gold px-4 py-2 text-xs font-semibold text-bg-primary transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Save size={14} /> {saving ? '保存中...' : '保存设置'}
        </button>
      </div>

      <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-accent-gold">
          <Users size={16} />
          用户列表
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-default text-text-secondary">
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">用户名</th>
                <th className="py-2 pr-4">角色</th>
                <th className="py-2">积分</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border-default text-text-primary">
                  <td className="py-2 pr-4">{u.id}</td>
                  <td className="py-2 pr-4">{u.username}</td>
                  <td className="py-2 pr-4">
                    {u.is_admin ? (
                      <span className="rounded bg-accent-gold/20 px-1.5 py-0.5 text-accent-gold">管理员</span>
                    ) : (
                      <span className="text-text-secondary">用户</span>
                    )}
                  </td>
                  <td className="flex items-center gap-1 py-2 text-accent-gold">
                    <Coins size={12} /> {u.credits}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-text-tertiary">暂无用户</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
