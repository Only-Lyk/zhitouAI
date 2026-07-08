import { Sparkles } from 'lucide-react';

interface AIScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function AIScoreBadge({ score, size = 'md' }: AIScoreBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5',
    lg: 'px-4 py-1.5 text-base gap-2',
  };

  let colorClass = 'text-accent-gold bg-accent-gold-glow';
  if (score >= 80) colorClass = 'text-up bg-up-bg';
  else if (score >= 60) colorClass = 'text-accent-gold bg-accent-gold-glow';
  else if (score >= 40) colorClass = 'text-text-secondary bg-bg-tertiary';
  else colorClass = 'text-down bg-down-bg';

  return (
    <div className={`inline-flex items-center rounded-lg font-semibold ${sizeClasses[size]} ${colorClass}`}>
      <Sparkles size={size === 'lg' ? 18 : size === 'md' ? 14 : 12} />
      <span>AI评分 {score}</span>
    </div>
  );
}
