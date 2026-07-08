import { ReactNode } from 'react';
import BottomNav from './BottomNav';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-full flex-col bg-bg-primary">
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
