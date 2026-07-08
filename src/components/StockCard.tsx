import { useNavigate } from 'react-router-dom';
import { Sparkles, Star } from 'lucide-react';

interface StockCardProps {
  code: string;
  name: string;
  price: number;
  change_pct: number;
  score?: number;
  signal?: string;
  reason?: string;
  showAI?: boolean;
  onAdd?: () => void;
  added?: boolean;
}

export default function StockCard({
  code, name, price, change_pct, score, signal, reason, showAI, onAdd, added,
}: StockCardProps) {
  const navigate = useNavigate();
  const isUp = change_pct >= 0;

  return (
    <div className="glass-card p-4 transition-all hover:border-border-hover">
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => navigate(`/stock/${code}`)} className="flex-1 text-left">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">{name}</div>
              <div className="text-xs text-text-tertiary font-mono">{code}</div>
            </div>
            <div className="text-right">
              <div className="text-base font-semibold font-mono">{price.toFixed(2)}</div>
              <div className={`text-xs font-medium ${isUp ? 'text-up' : 'text-down'}`}>
                {isUp ? '+' : ''}{change_pct.toFixed(2)}%
              </div>
            </div>
          </div>

          {showAI && score !== undefined && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-md bg-gradient-gold px-2 py-0.5">
                <Sparkles size={10} className="text-accent-gold" />
                <span className="text-xs font-semibold text-accent-gold">{score}分</span>
              </div>
              {signal && (
                <span className="text-xs text-text-secondary">{signal}</span>
              )}
            </div>
          )}

          {showAI && reason && (
            <p className="mt-1.5 text-xs leading-relaxed text-text-tertiary line-clamp-2">
              {reason}
            </p>
          )}
        </button>

        {onAdd && (
          <button
            onClick={onAdd}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-bg-tertiary transition-colors hover:text-accent-gold"
            title={added ? '已加入自选' : '加入自选'}
          >
            <Star size={18} className={added ? 'fill-accent-gold text-accent-gold' : 'text-text-tertiary'} />
          </button>
        )}
      </div>
    </div>
  );
}
