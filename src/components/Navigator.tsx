import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Compass, 
  ArrowRight, 
  Target, 
  ShieldAlert, 
  Zap, 
  TrendingUp, 
  Bell, 
  Info,
  Calendar,
  Wallet,
  PiggyBank,
  CheckCircle2,
  X
} from 'lucide-react';
import { Transaction, Holding, Account, Wallet as WalletType, SmartNudge } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { CategoryName } from '../constants';

interface NavigatorProps {
  transactions: Transaction[];
  holdings: Holding[];
  accounts: Account[];
  wallet: WalletType | null;
  onAction?: (tab: string, payload?: any) => void;
}

export default function Navigator({ transactions, holdings, accounts, wallet, onAction }: NavigatorProps) {
  const nudges = useMemo(() => {
    const list: SmartNudge[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const fyStart = now.getMonth() >= 3 ? new Date(currentYear, 3, 1) : new Date(currentYear - 1, 3, 1);
    
    // 1. Tax Savings Hint (80C)
    const tax80CLimit = 150000;
    const txTax = transactions
      .filter(t => {
        const tDate = new Date(t.date);
        return t.isTaxDeductible && t.taxSection === '80C' && tDate >= fyStart;
      })
      .reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);

    const accTax = accounts
      .filter(a => {
        const startDate = new Date(a.start);
        return (a.type === 'ppf' || a.type === 'epf' || a.isTaxExempt) && startDate >= fyStart;
      })
      .reduce((acc, a) => acc + a.amt, 0);

    const total80C = txTax + accTax;
    if (total80C < tax80CLimit) {
      list.push({
        id: 'tax-80c',
        type: 'opportunity',
        title: 'Optimize your Taxes',
        description: `You have ₹${formatCurrency(tax80CLimit - total80C)} left to save under Section 80C to maximize your tax benefit this FY.`,
        icon: '⚖️',
        actionLabel: 'Plan Taxes',
        actionTab: 'taxplanner',
        priority: 'high',
        dismissible: false
      });
    }

    // 2. Liquid Surplus (Lazy Money)
    if (wallet && wallet.free > 50000) {
      list.push({
        id: 'surplus-cash',
        type: 'opportunity',
        title: 'Deployment Opportunity',
        description: `You have ₹${formatCurrency(wallet.free)} sitting idle. Consider moving some to a Liquid FD or Short-term Debt Fund for 6-7% returns.`,
        icon: '💰',
        actionLabel: 'Invest Now',
        actionTab: 'savings',
        priority: 'medium',
        dismissible: true
      });
    }

    // 3. Upcoming Maturity
    accounts.forEach(acc => {
      if ((acc.type === 'fd' || acc.type === 'rd') && acc.end) {
        const endDate = new Date(acc.end);
        const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 0 && diffDays <= 7) {
          list.push({
            id: `maturity-${acc.id}`,
            type: 'alert',
            title: 'Maturity Alert',
            description: `Your ${acc.bank} ${acc.name} is maturing in ${diffDays} days (${formatCurrency(acc.maturity || acc.amt)}).`,
            icon: '🔔',
            actionLabel: 'View Account',
            actionTab: 'savings',
            priority: 'high',
            dismissible: false
          });
        }
      }
    });

    // 4. Low Emergency Fund
    const monthlyExpenses = Math.abs(transactions
      .filter(t => !t.isRecurring && t.type === 'expense' && t.date.startsWith(now.toISOString().slice(0, 7)))
      .reduce((acc, t) => acc + (t.amount || 0), 0)) || 50000; // Default if no tx yet
    
    const liquidAssets = accounts.filter(a => ['savings', 'fd', 'rd'].includes(a.type)).reduce((acc, a) => acc + a.amt, 0) + (wallet?.balance || 0);
    const targetEF = monthlyExpenses * 3; // Minimum 3 months for nudge
    if (liquidAssets < targetEF) {
        list.push({
          id: 'low-ef',
          type: 'alert',
          title: 'Safety Net Warning',
          description: `Your emergency fund covers less than 3 months of expenses. Focus on building ₹${formatCurrency(targetEF - liquidAssets)} more in liquidity.`,
          icon: '🛡️',
          actionLabel: 'Set Goal',
          actionTab: 'planner',
          priority: 'high',
          dismissible: false
        });
    }

    // 5. High Debt Interest
    const highInterestLoans = accounts.filter(a => a.type === 'loan' && a.rate > 10);
    if (highInterestLoans.length > 0) {
      list.push({
        id: 'high-debt',
        type: 'alert',
        title: 'High Interest Debt',
        description: `You have debt with >10% interest rate. Prioritize pre-paying these to save thousands in future interest.`,
        icon: '⚠️',
        actionLabel: 'Manage Loans',
        actionTab: 'savings',
        priority: 'high',
        dismissible: true
      });
    }

    // 6. Portfolio Zero-Growth (No Stocks/MF)
    const hasEquity = holdings.some(h => h.type.includes('MF') || h.type.includes('Stock'));
    if (!hasEquity && liquidAssets > 100000) {
      list.push({
        id: 'inflation-risk',
        type: 'insight',
        title: 'Beat Inflation',
        description: `Your wealth is strictly in debt/cash. To beat inflation long-term, consider starting a small SIP in Index Funds.`,
        icon: '📈',
        actionLabel: 'Check Portfolio',
        actionTab: 'portfolio',
        priority: 'medium',
        dismissible: true
      });
    }

    return list.sort((a, b) => {
      const priorityWeights = { high: 0, medium: 1, low: 2 };
      return priorityWeights[a.priority as keyof typeof priorityWeights] - priorityWeights[b.priority as keyof typeof priorityWeights];
    });
  }, [transactions, holdings, accounts, wallet]);

  if (nudges.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h3 className="font-display font-black text-xs uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
          <Compass size={14} className="text-indigo-600 animate-pulse" />
          Financial Navigator
        </h3>
        <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full uppercase">
          {nudges.length} Insights
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {nudges.map((nudge, idx) => (
            <motion.div
              key={nudge.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: idx * 0.1 }}
              className={cn(
                "group relative p-5 rounded-[28px] border bg-white overflow-hidden transition-all hover:shadow-xl hover:shadow-indigo-500/5",
                nudge.priority === 'high' ? "border-red-100 shadow-sm" : "border-slate-100 shadow-sm"
              )}
            >
              {/* Background Accent */}
              <div className={cn(
                "absolute -top-10 -right-10 w-24 h-24 blur-3xl opacity-10 transition-opacity group-hover:opacity-20",
                nudge.type === 'alert' ? "bg-red-500" : nudge.type === 'opportunity' ? "bg-emerald-500" : "bg-indigo-500"
              )} />

              <div className="flex items-start gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner shrink-0",
                  nudge.type === 'alert' ? "bg-red-50" : nudge.type === 'opportunity' ? "bg-emerald-50" : "bg-indigo-50"
                )}>
                  {nudge.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest",
                      nudge.type === 'alert' ? "text-red-500" : nudge.type === 'opportunity' ? "text-emerald-500" : "text-indigo-500"
                    )}>
                      {nudge.type}
                    </span>
                    {nudge.priority === 'high' && (
                        <div className="flex items-center gap-1 border border-red-200 bg-red-50 px-1.5 py-0.5 rounded-full">
                            <Zap size={8} className="text-red-500 fill-red-500" />
                            <span className="text-[8px] font-black text-red-600 uppercase tracking-tighter">Urgent</span>
                        </div>
                    )}
                  </div>
                  
                  <h4 className="font-display font-bold text-sm text-slate-900 mt-1">{nudge.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1 line-clamp-2">
                    {nudge.description}
                  </p>

                  <div className="flex items-center gap-3 mt-4">
                    {nudge.actionLabel && (
                      <button
                        onClick={() => onAction?.(nudge.actionTab || 'home')}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                          nudge.type === 'alert' ? "bg-red-900 text-white hover:bg-black" : 
                          nudge.type === 'opportunity' ? "bg-emerald-600 text-white hover:bg-emerald-700" : 
                          "bg-indigo-600 text-white hover:bg-indigo-700"
                        )}
                      >
                        {nudge.actionLabel}
                        <ArrowRight size={12} />
                      </button>
                    )}
                    {nudge.dismissible && (
                      <button className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest px-2 py-1.5">
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
