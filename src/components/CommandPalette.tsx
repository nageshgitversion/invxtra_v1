import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Calculator, Calendar, TrendingUp, Sparkles, ReceiptIndianRupee, X, Wallet, Settings } from 'lucide-react';
import { cn } from '../lib/utils';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen to custom event to open palette via UI button if needed
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('openCommandPalette', handleOpen);
    return () => window.removeEventListener('openCommandPalette', handleOpen);
  }, []);

  const commands = [
    { id: 'tx', label: 'Log New Expense', icon: ReceiptIndianRupee, action: () => { window.dispatchEvent(new CustomEvent('setActiveTab', { detail: 'transactions' })); } },
    { id: 'ai', label: 'Ask AI Assistant', icon: Sparkles, action: () => { window.dispatchEvent(new CustomEvent('setActiveTab', { detail: 'aichat' })); } },
    { id: 'tax', label: 'Tax Planner', icon: Calculator, action: () => { window.dispatchEvent(new CustomEvent('setActiveTab', { detail: 'taxplanner' })); } },
    { id: 'wallet', label: 'Manage Wallet', icon: Wallet, action: () => { window.dispatchEvent(new CustomEvent('openWalletModal')); } },
    { id: 'port', label: 'View Portfolio', icon: TrendingUp, action: () => { window.dispatchEvent(new CustomEvent('setActiveTab', { detail: 'portfolio' })); } },
    { id: 'plan', label: 'Financial Planner', icon: Calendar, action: () => { window.dispatchEvent(new CustomEvent('setActiveTab', { detail: 'planner' })); } },
    { id: 'settings', label: 'Settings', icon: Settings, action: () => { window.dispatchEvent(new CustomEvent('setActiveTab', { detail: 'settings' })); } },
  ];

  const filteredCommands = query 
    ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  const handleSelect = (action: () => void) => {
    action();
    setIsOpen(false);
    setQuery('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
          />
          <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[20vh] pointer-events-none px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden pointer-events-auto border border-indigo-50 flex flex-col max-h-[60vh]"
            >
              <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                <Search size={20} className="text-indigo-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="What do you want to do? (e.g., 'Log Expense')"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent border-none focus:outline-none text-slate-800 placeholder:text-slate-400 font-medium"
                />
                <div className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-500 tracking-widest uppercase">
                  ESC
                </div>
              </div>

              <div className="p-2 overflow-y-auto no-scrollbar flex-1">
                {filteredCommands.length > 0 ? (
                  <div className="space-y-1">
                    <p className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Quick Actions</p>
                    {filteredCommands.map((cmd) => (
                      <button
                        key={cmd.id}
                        onClick={() => handleSelect(cmd.action)}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-colors group text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                          <cmd.icon size={16} />
                        </div>
                        <span className="font-display font-bold text-sm text-slate-700 group-hover:text-indigo-700">{cmd.label}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-10 text-center">
                    <p className="text-slate-500 font-medium text-sm">No actions found for "{query}"</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
