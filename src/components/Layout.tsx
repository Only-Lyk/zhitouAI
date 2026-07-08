import { ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BottomNav from './BottomNav';
import { LogOut, User, Shield, Coins, LogIn, Settings } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // 刷新用户信息以同步积分
  }, [location.pathname]);

  return (
    <div className="flex h-full flex-col bg-bg-primary">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border-default bg-bg-secondary/90 px-4 py-3 backdrop-blur-lg">
        <div className="flex items-center gap-2">
          <h1
            className="text-base font-bold text-accent-gold"
            onClick={() => navigate('/')}
            style={{ cursor: 'pointer' }}
          >
            智投AI
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {user.is_admin && (
                <button
                  onClick={() => navigate('/admin')}
                  className="flex items-center gap-1 rounded-md bg-accent-gold/10 px-2 py-1 text-xs font-medium text-accent-gold"
                >
                  <Shield size={12} /> 管理
                </button>
              )}
              <button
                onClick={() => navigate('/settings')}
                className="flex items-center gap-1 rounded-md bg-bg-tertiary px-2 py-1 text-xs text-text-secondary transition-colors hover:text-text-primary"
                title="设置"
              >
                <Settings size={12} />
              </button>
              <div className="flex items-center gap-1 rounded-md bg-bg-tertiary px-2 py-1 text-xs text-text-secondary">
                <Coins size={12} className="text-accent-gold" />
                <span className="text-text-primary">{user.credits ?? 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-gold/20 text-accent-gold">
                  <User size={14} />
                </div>
                <span className="max-w-[80px] truncate text-xs text-text-secondary">{user.username}</span>
              </div>
              <button
                onClick={logout}
                className="text-text-tertiary transition-colors hover:text-down"
                title="退出登录"
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-1 rounded-lg bg-accent-gold px-3 py-1.5 text-xs font-semibold text-bg-primary shadow-[0_0_12px_rgba(212,168,83,0.35)] transition-all hover:shadow-[0_0_16px_rgba(212,168,83,0.5)] active:scale-95"
            >
              <LogIn size={14} />
              登录
            </button>
          )}
        </div>
      </header>
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
