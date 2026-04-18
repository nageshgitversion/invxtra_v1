import React, { useState, useRef, useEffect } from 'react';
import { Mic, MessageSquare, TrendingUp, Bell, LogOut, User, Settings, ChevronDown } from 'lucide-react';
import { useFirebase } from '../lib/FirebaseProvider';
import { logout } from '../lib/firebase';
import { cn } from '../lib/utils';
import Logo from './Logo';

interface TopbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Topbar({ activeTab, setActiveTab }: TopbarProps) {
  const { user, transactions, familyGoals } = useFirebase();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  // Load and generate notifications
  useEffect(() => {
    const baseNotifs = [
      { id: 'welcome', title: 'Welcome to invxtra', message: 'Start by adding your first transaction!', time: 'Just now', icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50', read: false },
      ...(familyGoals.length > 0 ? [{ id: 'goal-progress', title: 'Goal Progress', message: `You are making great progress on ${familyGoals[0].name}!`, time: '2h ago', icon: Bell, color: 'text-emerald-600', bg: 'bg-emerald-50', read: false }] : []),
      ...(transactions.length > 5 ? [{ id: 'spending-alert', title: 'Spending Alert', message: 'Your food expenses are 15% higher this week.', time: '5h ago', icon: Bell, color: 'text-amber-600', bg: 'bg-amber-50', read: false }] : []),
    ];

    const savedReadStatus = JSON.parse(localStorage.getItem(`wealthos_notifs_read_${user?.uid}`) || '{}');
    const processedNotifs = baseNotifs.map(n => ({
      ...n,
      read: savedReadStatus[n.id] || false
    }));

    setNotifs(processedNotifs);
    setUnreadCount(processedNotifs.filter(n => !n.read).length);
  }, [user, transactions, familyGoals]);

  const markAllAsRead = () => {
    const status = { ...JSON.parse(localStorage.getItem(`wealthos_notifs_read_${user?.uid}`) || '{}') };
    notifs.forEach(n => status[n.id] = true);
    localStorage.setItem(`wealthos_notifs_read_${user?.uid}`, JSON.stringify(status));
    setNotifs(notifs.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const clearAll = () => {
    setNotifs([]);
    setUnreadCount(0);
    // In a real app, we'd delete from DB. Here we just clear local state.
  };

  const markAsRead = (id: string) => {
    const status = { ...JSON.parse(localStorage.getItem(`wealthos_notifs_read_${user?.uid}`) || '{}') };
    status[id] = true;
    localStorage.setItem(`wealthos_notifs_read_${user?.uid}`, JSON.stringify(status));
    setNotifs(notifs.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  return (
    <header className="sticky top-0 z-40 bg-bg-main/80 backdrop-blur-md border-b border-indigo-50/50 px-4 py-4 md:px-6 flex justify-between items-center gap-4">
      <div className="flex items-center min-w-0 flex-shrink-0">
        <Logo variant="horizontal" className="h-7 md:h-8 w-auto text-indigo-600" />
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className={cn(
              "w-10 h-10 rounded-xl bg-white border border-indigo-100 flex items-center justify-center text-slate-400 shadow-sm hover:bg-indigo-50 transition-colors relative",
              isNotifOpen && "bg-indigo-50 text-indigo-600 border-indigo-200"
            )}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-3 w-[calc(100vw-32px)] sm:w-80 bg-white rounded-[24px] shadow-2xl border border-indigo-50 py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
              <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center">
                <h3 className="font-display font-bold text-sm">Notifications</h3>
                <div className="flex gap-2">
                  {notifs.length > 0 && (
                    <button 
                      onClick={clearAll}
                      className="text-[10px] font-black text-slate-400 hover:text-red-500 uppercase transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">
                    {unreadCount} New
                  </span>
                </div>
              </div>
              
              <div className="max-h-[320px] overflow-y-auto no-scrollbar">
                {notifs.length > 0 ? notifs.map((n) => (
                  <div 
                    key={n.id} 
                    onClick={() => markAsRead(n.id)}
                    className={cn(
                      "px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50 last:border-0 group relative",
                      !n.read && "bg-indigo-50/30"
                    )}
                  >
                    {!n.read && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600"></div>
                    )}
                    <div className="flex gap-4">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", n.bg, n.color)}>
                        <n.icon size={18} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{n.title}</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed">{n.message}</p>
                        <p className="text-[9px] font-medium text-slate-400">{n.time}</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="py-12 text-center space-y-2">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                      <Bell size={24} />
                    </div>
                    <p className="text-xs font-bold text-slate-400">No new notifications</p>
                  </div>
                )}
              </div>
              
              <div className="p-3 bg-slate-50/50">
                <button 
                  onClick={markAllAsRead}
                  className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Mark all as read
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Profile Avatar - Direct Link */}
        <button 
          onClick={() => setActiveTab('profile')}
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center text-white font-display font-black text-xs shadow-md transition-all",
            activeTab === 'profile' 
              ? "bg-indigo-700 ring-4 ring-indigo-100" 
              : "bg-indigo-600 shadow-indigo-100 hover:scale-105"
          )}
        >
          {user?.displayName?.charAt(0) || 'A'}
        </button>
      </div>
    </header>
  );
}
