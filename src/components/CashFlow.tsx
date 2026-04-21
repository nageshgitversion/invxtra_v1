import React from 'react';
import { motion } from 'motion/react';
import { 
  ReceiptIndianRupee, 
  Zap, 
  FileText, 
  ChevronRight,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { Transaction } from '../types';

interface CashFlowProps {
  transactions: Transaction[];
  setActiveTab: (tab: string) => void;
}

export default function CashFlow({ transactions, setActiveTab }: CashFlowProps) {
  // Simple summary for the hub
  const now = new Date();
  const currentMonthStr = now.toISOString().slice(0, 7);
  const currentMonthTxs = transactions.filter(t => t.date.startsWith(currentMonthStr));
  
  const monthlySummary = currentMonthTxs.reduce((acc, t) => {
    if (t.type === 'income') acc.income += t.amount;
    else acc.expense += Math.abs(t.amount);
    return acc;
  }, { income: 0, expense: 0 });

  const cards = [
    {
      id: 'daily',
      title: 'Daily',
      desc: 'Track and manage your daily spends & earnings',
      icon: ReceiptIndianRupee,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      action: () => setActiveTab('transactions'),
      stats: `${transactions.length} total txns`
    },
    {
      id: 'autopilot',
      title: 'Autopilot',
      desc: 'Smart recurring transactions & auto-debits',
      icon: Zap,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      action: () => {}, // Placeholder for now
      isUnderDevelopment: true,
      stats: 'Coming Soon'
    },
    {
      id: 'reports',
      title: 'Reports',
      desc: 'Generate statements for any period',
      icon: FileText,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      action: () => setActiveTab('reports'),
      stats: 'Weekly / Monthly / Yearly'
    }
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="px-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Cash Management</p>
        <h2 className="font-display font-extrabold text-3xl tracking-tight text-slate-900 flex items-center gap-3">
          Cash Flow Hub
        </h2>
      </div>

      {/* Month Summary Card */}
      <div className="bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl shadow-slate-200">
        <div className="relative z-10 space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Monthly Net Flow</p>
              <h3 className="font-display font-extrabold text-4xl tracking-tight">
                {formatCurrency(monthlySummary.income - monthlySummary.expense)}
              </h3>
            </div>
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md">
              <TrendingUp className="text-emerald-400" size={24} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-50 flex items-center gap-1">
                <ArrowUpRight size={10} className="text-emerald-400" /> Income
              </p>
              <p className="font-display font-bold text-xl">{formatCurrency(monthlySummary.income)}</p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-50 flex items-center gap-1 justify-end">
                <ArrowDownRight size={10} className="text-red-400" /> Expenses
              </p>
              <p className="font-display font-bold text-xl">{formatCurrency(monthlySummary.expense)}</p>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -ml-16 -mb-16"></div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 px-1">
        {cards.map((card) => (
          <motion.button
            key={card.id}
            whileHover={{ y: -5 }}
            whileTap={{ scale: 0.98 }}
            onClick={card.action}
            className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all text-left flex flex-col items-start group relative overflow-hidden h-full"
          >
            <div className={cn(
              "w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-6 transition-transform group-hover:scale-110 duration-500",
              card.bgColor,
              card.color
            )}>
              <card.icon size={20} className="md:w-[26px] md:h-[26px]" strokeWidth={2.5} />
            </div>
            
            <div className="mb-2">
              <h3 className="font-display font-extrabold text-sm md:text-xl text-slate-800 flex flex-wrap items-center gap-1.5 leading-tight">
                {card.title}
                {card.isUnderDevelopment && (
                  <span className="text-[7px] md:text-[8px] font-black bg-amber-100 text-amber-600 px-1 py-0.5 rounded uppercase flex items-center gap-0.5">
                    <Sparkles size={8} /> Beta
                  </span>
                )}
              </h3>
            </div>
            <p className="text-[10px] md:text-xs text-slate-500 leading-tight md:leading-relaxed font-medium flex-1 mb-4 line-clamp-2 md:line-clamp-none">
              {card.desc}
            </p>
            
            <div className="w-full flex justify-between items-center pt-4 border-t border-slate-50 mt-auto">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{card.stats}</span>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center border transition-all",
                card.color,
                "border-slate-100 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900"
              )}>
                <ChevronRight size={14} />
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
