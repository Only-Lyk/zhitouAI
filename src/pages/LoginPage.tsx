import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '操作失败');
        setLoading(false);
        return;
      }
      login(data.access_token, data.user);
      navigate('/');
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-accent-gold">智投AI</h1>
          <p className="mt-1 text-sm text-text-secondary">智能量化分析系统</p>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-6">
          <div className="mb-6 flex border-b border-border-default">
            <button
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 pb-3 text-sm font-medium transition-colors ${isLogin ? 'border-b-2 border-accent-gold text-accent-gold' : 'text-text-tertiary'}`}
            >
              登录
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 pb-3 text-sm font-medium transition-colors ${!isLogin ? 'border-b-2 border-accent-gold text-accent-gold' : 'text-text-tertiary'}`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-accent-gold"
                placeholder="请输入用户名"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">密码</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 pr-10 text-sm text-text-primary outline-none transition-colors focus:border-accent-gold"
                  placeholder="请输入密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-down-bg px-3 py-2 text-xs text-down">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-gold px-4 py-2.5 text-sm font-semibold text-bg-primary transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? '处理中...' : isLogin ? (
                <><LogIn size={16} /> 登录</>
              ) : (
                <><UserPlus size={16} /> 注册</>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-text-tertiary">
          注册即送100积分，AI分析每次消耗积分
        </p>
      </div>
    </div>
  );
}
