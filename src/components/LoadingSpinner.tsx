import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  text?: string;
  size?: number;
}

export default function LoadingSpinner({ text = '加载中…', size = 28 }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-text-tertiary">
      <Loader2 size={size} className="animate-spin text-accent-gold" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
