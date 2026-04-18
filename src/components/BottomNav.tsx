import React from 'react';
import { 
  LayoutDashboard, 
  ReceiptIndianRupee, 
  PiggyBank, 
  TrendingUp, 
  BarChart3, 
  MessageSquare,
  Calendar,
  Users,
  Zap,
  Calculator,
  User,
  Home
} from 'lucide-react';
import { cn } from '../lib/utils';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const navItems: { id: string; label: string; icon: any; badge?: number }[] = [
    { id: 'home', label: 'Home', icon: LayoutDashboard },
    { id: 'transactions', label: 'Expenses', icon: ReceiptIndianRupee },
    { id: 'savings', label: 'Savings', icon: PiggyBank },
    { id: 'portfolio', label: 'Portfolio', icon: TrendingUp },
    { id: 'split', label: 'Split', icon: Users },
    { id: 'household', label: 'Household', icon: Home },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'taxplanner', label: 'Tax', icon: Calculator },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-100 px-2 py-3 pb-6 flex justify-between items-center z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.04)] overflow-x-auto no-scrollbar">
      <div className="flex justify-around w-full min-w-max gap-2 px-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex flex-col items-center gap-1.5 transition-all duration-300 relative px-3 py-1 rounded-2xl",
              activeTab === item.id ? "text-slate-900" : "text-slate-400"
            )}
          >
            <div className={cn(
              "w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300",
              activeTab === item.id ? "bg-slate-900 text-white shadow-lg shadow-slate-200" : "bg-transparent"
            )}>
              <item.icon size={22} className={cn(
                "transition-transform duration-300",
                activeTab === item.id ? "scale-110" : "scale-100"
              )} />
            </div>
            <span className={cn(
              "text-[10px] font-display font-black tracking-tighter uppercase",
              activeTab === item.id ? "opacity-100" : "opacity-60"
            )}>{item.label}</span>
            {item.badge && (
              <span className="absolute top-1 right-2 w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[9px] font-black border-2 border-white shadow-sm">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
