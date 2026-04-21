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
  Grid2X2,
  Lightbulb,
  Zap,
  Calculator,
  User,
  Home,
  Landmark
} from 'lucide-react';
import { cn } from '../lib/utils';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const navItems: { id: string; label: string; icon: any; badge?: number }[] = [
    { id: 'home', label: 'Home', icon: LayoutDashboard },
    { id: 'vault', label: 'Vault', icon: Landmark },
    { id: 'cashflow', label: 'Cash Flow', icon: ReceiptIndianRupee },
    { id: 'space', label: 'Space', icon: Grid2X2 },
    { id: 'insights', label: 'Insights', icon: Lightbulb },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 px-1 py-2 pb-5 flex justify-between items-center z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.06)]">
      <div className="flex justify-around w-full px-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id || 
            (item.id === 'vault' && ['savings', 'portfolio', 'savings_view', 'deposits_view', 'loans_view', 'investments_view'].includes(activeTab)) ||
            (item.id === 'cashflow' && ['transactions', 'reports'].includes(activeTab)) ||
            (item.id === 'space' && ['household', 'split'].includes(activeTab)) ||
            (item.id === 'insights' && ['analytics', 'taxplanner', 'simulator'].includes(activeTab));
          return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className="flex flex-col items-center gap-1 transition-all duration-300 relative flex-1"
          >
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
              isActive ? "bg-slate-900 text-white shadow-md" : "bg-transparent text-slate-400"
            )}>
              <item.icon size={20} />
            </div>
            <span className={cn(
              "text-[9px] font-black tracking-tight uppercase transition-opacity duration-300",
              isActive ? "opacity-100 text-slate-900" : "opacity-40 text-slate-400"
            )}>{item.label}</span>
            {item.badge && (
              <span className="absolute top-1 right-2 w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[9px] font-black border-2 border-white shadow-sm">
                {item.badge}
              </span>
            )}
          </button>
        )})}
      </div>
    </nav>
  );
}
