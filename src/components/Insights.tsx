import React from 'react';
import { BarChart3, Calculator, Zap, ArrowRight, TrendingUp, Lightbulb, PieChart } from 'lucide-react';
import { useFirebase } from '../lib/FirebaseProvider';
import { formatCurrency, formatCompactNumber } from '../lib/utils';
import { motion } from 'motion/react';

interface InsightsProps {
  setActiveTab: (tab: string) => void;
}

export default function Insights({ setActiveTab }: InsightsProps) {
  const { transactions, holdings } = useFirebase();

  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthTransactions = transactions.filter(t => !t.isRecurring && t.date.startsWith(currentMonth));

  const totalSpent = currentMonthTransactions
    .filter(t => t.type === 'expense' || t.type === 'investment' || t.type === 'debt')
    .reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);
  
  const savingsRate = React.useMemo(() => {
    const income = currentMonthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    if (income === 0) return 0;
    const items = currentMonthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Math.abs(t.amount), 0);
    return Math.round(((income - items) / income) * 100);
  }, [currentMonthTransactions]);

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4">
        <div>
          <h2 className="text-3xl font-display font-black tracking-tight text-slate-900">Your Insights</h2>
          <p className="text-slate-500 font-medium mt-1">Deep dives into your spending, taxes, and future scenarios.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-4">
        {/* Analytics Card */}
        <motion.div 
          onClick={() => setActiveTab('analytics')}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.3, delay: 0.0 }}
          className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-3 md:mb-6">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
              <PieChart size={20} className="md:w-6 md:h-6" />
            </div>
            <div className="p-1.5 md:p-2 bg-slate-50 rounded-lg md:rounded-xl group-hover:bg-indigo-50 transition-colors">
              <ArrowRight size={12} className="text-slate-400 group-hover:text-indigo-600 md:w-4 md:h-4" />
            </div>
          </div>
          <div>
            <p className="text-[9px] md:text-xs font-black uppercase tracking-widest text-slate-400 mb-0.5 md:mb-1 text-slate-400">Analytics</p>
            <h3 className="font-display font-black text-lg md:text-2xl text-slate-900 mb-1 md:mb-2 leading-tight">
              Patterns
            </h3>
            <p className="text-[10px] md:text-sm font-medium text-slate-500 truncate">
              {savingsRate}% savings
            </p>
          </div>
        </motion.div>

        {/* Tax Planner Card */}
        <motion.div 
          onClick={() => setActiveTab('taxplanner')}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-3 md:mb-6">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
              <Calculator size={20} className="md:w-6 md:h-6" />
            </div>
            <div className="p-1.5 md:p-2 bg-slate-50 rounded-lg md:rounded-xl group-hover:bg-amber-50 transition-colors">
              <ArrowRight size={12} className="text-slate-400 group-hover:text-amber-600 md:w-4 md:h-4" />
            </div>
          </div>
          <div>
            <p className="text-[9px] md:text-xs font-black uppercase tracking-widest text-slate-400 mb-0.5 md:mb-1 text-slate-400">Tax Optimizer</p>
            <h3 className="font-display font-black text-lg md:text-2xl text-slate-900 mb-1 md:mb-2 leading-tight">
              Tax Savings
            </h3>
            <p className="text-[10px] md:text-sm font-medium text-slate-500 truncate">
              Plan investments
            </p>
          </div>
        </motion.div>

        {/* What-If Simulator Card */}
        <motion.div 
          onClick={() => setActiveTab('simulator')}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-3 md:mb-6">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-cyan-50 flex items-center justify-center text-cyan-600 group-hover:scale-110 transition-transform">
              <Zap size={20} className="md:w-6 md:h-6" />
            </div>
            <div className="p-1.5 md:p-2 bg-slate-50 rounded-lg md:rounded-xl group-hover:bg-cyan-50 transition-colors">
              <ArrowRight size={12} className="text-slate-400 group-hover:text-cyan-600 md:w-4 md:h-4" />
            </div>
          </div>
          <div>
            <p className="text-[9px] md:text-xs font-black uppercase tracking-widest text-slate-400 mb-0.5 md:mb-1 text-slate-400">Simulator</p>
            <h3 className="font-display font-black text-lg md:text-2xl text-slate-900 mb-1 md:mb-2 leading-tight">
              Future
            </h3>
            <p className="text-[10px] md:text-sm font-medium text-slate-500 truncate">
              What-if analysis
            </p>
          </div>
        </motion.div>

        {/* AI Insights Card */}
        <motion.div 
          onClick={() => setActiveTab('aichat')}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.3, delay: 0.3 }}
          className="bg-slate-900 p-6 rounded-[32px] shadow-sm text-white overflow-hidden relative group cursor-pointer"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-purple-400 mb-4">
              <Lightbulb size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest">Smart Assistant</span>
            </div>
            <h3 className="font-display font-black text-xl mb-1">Tailored Financial Tips</h3>
            <p className="text-slate-400 text-sm max-w-xs mb-4">Get personalized advice based on your real spending and savings data.</p>
            <div className="flex items-center gap-2 text-xs font-bold text-white group-hover:translate-x-2 transition-transform">
              Ask AI Assistant <ArrowRight size={14} />
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none group-hover:scale-110 transition-transform">
            <TrendingUp size={160} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
