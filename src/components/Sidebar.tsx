import React from 'react';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  ReceiptIndianRupee, 
  PiggyBank, 
  TrendingUp, 
  BarChart3, 
  Sparkles,
  LogOut,
  User,
  Calendar,
  Users,
  Settings,
  Calculator,
  Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useFirebase } from '../lib/FirebaseProvider';
import { logout } from '../lib/firebase';

import Logo from './Logo';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const { user } = useFirebase();
  const currentMonth = new Date().getMonth();
  const isTaxSeason = currentMonth >= 0 && currentMonth <= 2; // Jan, Feb, Mar

  const navItems = [
    { id: 'home', label: 'Home', icon: LayoutDashboard },
    { id: 'transactions', label: 'Expenses', icon: ReceiptIndianRupee },
    { id: 'savings', label: 'Savings', icon: PiggyBank },
    { id: 'portfolio', label: 'Portfolio', icon: TrendingUp },
    { id: 'split', label: 'Split', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    ...(isTaxSeason ? [{ id: 'taxplanner', label: 'Tax', icon: Calculator }] : []),
    { id: 'simulator', label: 'WHAT-IF', icon: Zap },
    { id: 'planner', label: 'Planner', icon: Calendar },
    { id: 'aichat', label: 'AI Chat', icon: Sparkles, badge: 1 },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="hidden md:flex w-72 flex-col bg-white border-r border-slate-100 p-8 sticky top-0 h-screen">
      <div className="flex items-center mb-12 px-1">
        <Logo variant="horizontal" className="h-10 w-auto text-slate-900" />
      </div>

      <div className="flex flex-col gap-1.5 overflow-y-auto no-scrollbar flex-1 -mx-2 px-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all duration-300 font-display font-bold text-[13px] relative group",
              activeTab === item.id 
                ? "bg-slate-900 text-white shadow-xl shadow-slate-200" 
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <item.icon size={18} className={cn(
              "transition-transform duration-300 group-hover:scale-110",
              activeTab === item.id ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-900"
            )} />
            {item.label}
            {item.badge && (
              <span className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black",
                activeTab === item.id ? "bg-indigo-500 text-white" : "bg-indigo-600 text-white"
              )}>
                {item.badge}
              </span>
            )}
            {activeTab === item.id && (
              <motion.div 
                layoutId="activeTab"
                className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full"
              />
            )}
          </button>
        ))}
      </div>

      <div className="mt-8 pt-8 border-t border-slate-100">
        <div className="bg-slate-50 p-4 rounded-3xl flex items-center gap-3 border border-slate-100 group cursor-pointer hover:bg-white hover:shadow-md transition-all">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-display font-black shadow-lg shadow-indigo-100 group-hover:rotate-6 transition-transform">
            {user?.displayName?.charAt(0) || 'U'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-black text-slate-900 truncate">{user?.displayName || 'User'}</span>
            <span className="text-[10px] text-slate-500 font-bold truncate tracking-tight">{user?.email}</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
