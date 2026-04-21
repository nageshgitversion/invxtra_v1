import React, { useEffect, useState } from 'react';
import { BarChart3, Calculator, Zap, ArrowRight, TrendingUp, Lightbulb, PieChart, ShieldAlert, Target } from 'lucide-react';
import { useFirebase } from '../lib/FirebaseProvider';
import { formatCurrency, formatCompactNumber, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { getVarianceAnalysis } from '../services/geminiService';

interface InsightsProps {
  setActiveTab: (tab: string) => void;
}

export default function Insights({ setActiveTab }: InsightsProps) {
  const { transactions, holdings, wallet } = useFirebase();
  const [varianceInsights, setVarianceInsights] = useState<any[]>([]);
  const [isLoadingVariance, setIsLoadingVariance] = useState(false);

  useEffect(() => {
    async function loadVariance() {
      setIsLoadingVariance(true);
      const data = {
        transactions: transactions.slice(0, 50), // Send recent for context
        envelopes: wallet.envelopes,
        savingsRate
      };
      const insights = await getVarianceAnalysis(data);
      if (insights) setVarianceInsights(insights);
      setIsLoadingVariance(false);
    }
    loadVariance();
  }, [transactions, wallet]);

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
    <div className="space-y-8">
      <div className="flex items-center justify-between pb-2">
        <div>
          <h2 className="text-4xl font-display font-black tracking-tight text-slate-900 leading-tight">Financial Engine</h2>
          <p className="text-slate-500 font-medium mt-1">Deep dives into your spending, taxes, and behavioral patterns.</p>
        </div>
      </div>

      {/* AI Variance Prompts (NEW FEATURE) */}
      <AnimatePresence>
        {varianceInsights.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {varianceInsights.map((insight) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-indigo-600 p-6 rounded-[32px] text-white shadow-xl shadow-indigo-100 flex items-start gap-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h4 className="font-display font-black text-lg mb-1">{insight.title}</h4>
                  <p className="text-indigo-100 text-xs leading-relaxed mb-4">{insight.description}</p>
                  <button 
                    onClick={() => setActiveTab('portfolio')}
                    className="bg-white text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center gap-2"
                  >
                    <Target size={14} /> Tap to Invest Surplus
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {/* Money Flow Analytics Card (NEW) */}
        <motion.div 
          onClick={() => setActiveTab('moneyflow')}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="col-span-2 md:col-span-2 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
              <TrendingUp size={24} />
            </div>
            <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-slate-100 transition-colors">
              <ArrowRight size={16} className="text-slate-400 group-hover:text-slate-900" />
            </div>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Money Flow</p>
            <h3 className="font-display font-black text-2xl text-slate-900 leading-tight">Timeline</h3>
            <p className="text-sm font-medium text-slate-500 mt-1">Platform analysis</p>
          </div>
        </motion.div>

        {/* Existing Cards restyled and grid-adapted */}
        <InsightsSmallCard 
          title="Tax Optimizer" 
          sub="Plan ₹80C" 
          icon={<Calculator size={20} />} 
          color="amber" 
          onClick={() => setActiveTab('taxplanner')} 
        />
        <InsightsSmallCard 
          title="Simulator" 
          sub="What-if" 
          icon={<Zap size={20} />} 
          color="cyan" 
          onClick={() => setActiveTab('simulator')} 
        />
        <InsightsSmallCard 
          title="Analytics" 
          sub={`${savingsRate}% savings`} 
          icon={<PieChart size={20} />} 
          color="indigo" 
          onClick={() => setActiveTab('analytics')} 
        />
      </div>

      <motion.div 
        onClick={() => setActiveTab('aichat')}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="bg-slate-900 p-8 rounded-[40px] shadow-sm text-white overflow-hidden relative group cursor-pointer"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-purple-400 mb-4">
            <Lightbulb size={24} />
            <span className="text-[10px] font-black uppercase tracking-widest">Smart Assistant</span>
          </div>
          <h3 className="font-display font-black text-2xl mb-2">Tailored Financial Tips</h3>
          <p className="text-slate-400 text-sm max-w-sm mb-6">Get personalized advice based on your real spending and savings data.</p>
          <div className="flex items-center gap-2 text-xs font-bold text-white group-hover:translate-x-2 transition-transform">
            Ask AI Assistant <ArrowRight size={14} />
          </div>
        </div>
        <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none group-hover:scale-110 transition-transform">
          <TrendingUp size={200} />
        </div>
      </motion.div>
    </div>
  );
}

function InsightsSmallCard({ title, sub, icon, color, onClick }: any) {
  const colors: any = {
    amber: "bg-amber-50 text-amber-600",
    cyan: "bg-cyan-50 text-cyan-600",
    indigo: "bg-indigo-50 text-indigo-600"
  };

  return (
    <motion.div 
      onClick={onClick}
      className="md:col-span-1 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform", colors[color])}>
        {icon}
      </div>
      <div>
        <h3 className="font-display font-black text-sm text-slate-900 leading-tight">{title}</h3>
        <p className="text-[10px] font-medium text-slate-500 mt-0.5">{sub}</p>
      </div>
    </motion.div>
  );
}
