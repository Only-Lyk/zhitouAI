import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Star, Sparkles, MessageCircle, BarChart3 } from 'lucide-react';

const tabs = [
  { path: '/', icon: Home, label: '首页' },
  { path: '/stocks', icon: BarChart3, label: '行情' },
  { path: '/watchlist', icon: Star, label: '自选' },
  { path: '/ai', icon: Sparkles, label: 'AI推荐' },
  { path: '/chat', icon: MessageCircle, label: 'AI助手' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-default bg-bg-secondary/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-2">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                isActive ? 'text-accent-gold' : 'text-text-tertiary'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
