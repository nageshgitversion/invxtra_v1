import React, { useState, useMemo } from 'react';
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from 'motion/react';
import { Sparkles, TrendingUp, Wallet, Activity, Zap, Bell, ShieldCheck, PieChart, Info, Plus, Clock, ArrowRight } from 'lucide-react';
import { Transaction, Holding, Account, Wallet as WalletType } from '../types';
import { formatCurrency, formatCompactNumber, cn } from '../lib/utils';
import { useFirebase } from '../lib/FirebaseProvider';
import Modal from './Modal';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import MoneyCalendar from './MoneyCalendar';
import Navigator from './Navigator';

interface DashboardProps {
  transactions: Transaction[];
  holdings: Holding[];
  accounts: Account[];
  insights: string[];
  wallet: WalletType | null;
  onRefreshInsights?: () => void;
  onTabChange?: (tab: string, payload?: any) => void;
}

export default function Dashboard({ transactions, holdings, accounts, insights, wallet, onRefreshInsights, onTabChange }: DashboardProps) {
  const { user } = useFirebase();
  
  // Handle opening wallet modal via App.tsx event
  const openWallet = () => {
    window.dispatchEvent(new CustomEvent('openWalletModal'));
  };

  const walletBalance = wallet?.balance || 0;
  const assets = holdings.reduce((acc, h) => acc + h.current, 0) + accounts.filter(a => a.type !== 'loan').reduce((acc, a) => acc + a.amt, 0) + walletBalance;
  const liabilities = Math.abs(accounts.filter(a => a.type === 'loan').reduce((acc, a) => acc + a.amt, 0));
  const netWorth = assets - liabilities;
  
  const totalInvested = holdings.reduce((acc, h) => acc + h.invested, 0);

  // Calculate Tax Savings (80C) for the current financial year (April to March)
  const taxSavings80C = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const fyStart = now.getMonth() >= 3 ? new Date(currentYear, 3, 1) : new Date(currentYear - 1, 3, 1);
    
    // 1. From Transactions
    const txTax = transactions
      .filter(t => {
        const tDate = new Date(t.date);
        return t.isTaxDeductible && t.taxSection === '80C' && tDate >= fyStart;
      })
      .reduce((acc, t) => acc + Math.abs(t.amount), 0);

    // 2. From Accounts (PPF, EPF, etc. started this FY)
    const accTax = accounts
      .filter(a => {
        const startDate = new Date(a.start);
        return (a.type === 'ppf' || a.type === 'epf' || a.isTaxExempt) && startDate >= fyStart;
      })
      .reduce((acc, a) => acc + a.amt, 0);
    
    return txTax + accTax;
  }, [transactions, accounts]);

  const tax80CLimit = 150000;
  const tax80CPct = tax80CLimit > 0 ? Math.min(100, Math.round((taxSavings80C / tax80CLimit) * 100)) : 0;
  
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);

  const currentMonthTransactions = transactions.filter(t => !t.isRecurring && t.date.startsWith(currentMonth));
  const lastMonthTransactions = transactions.filter(t => !t.isRecurring && t.date.startsWith(lastMonth));

  const income = currentMonthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const expenses = Math.abs(currentMonthTransactions.filter(t => (t.type === 'expense' || t.type === 'debt') && !['Savings', 'Investment'].includes(t.category)).reduce((acc, t) => acc + (t.amount || 0), 0));
  
  const lastMonthExpenses = Math.abs(lastMonthTransactions.filter(t => (t.type === 'expense' || t.type === 'debt') && !['Savings', 'Investment'].includes(t.category)).reduce((acc, t) => acc + (t.amount || 0), 0));
  const expenseDiff = expenses - lastMonthExpenses;
  const expenseDiffPct = lastMonthExpenses > 0 ? Math.round((expenseDiff / lastMonthExpenses) * 100) : 0;

  const savingsRate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;
  
  const monthlyExpenses = expenses; // Use current month expenses for EF target
  const budgetLeft = wallet ? wallet.free : 0; 
  const xirr = totalInvested > 0 ? Math.round(((netWorth - totalInvested) / totalInvested) * 100) : 0;

  // Portfolio Performance Calculation
  const portfolioPerformance = useMemo(() => {
    const totalCurrent = holdings.reduce((acc, h) => acc + h.current, 0);
    const totalInv = holdings.reduce((acc, h) => acc + h.invested, 0);
    if (totalInv === 0) return null;
    return ((totalCurrent - totalInv) / totalInv) * 100;
  }, [holdings]);

  // --- Advanced Calculations ---
  
  // 1. Asset Allocation
  const assetAllocation = useMemo(() => {
    const cash = walletBalance + accounts.filter(a => a.type === 'savings').reduce((acc, a) => acc + a.amt, 0);
    const equity = holdings.filter(h => h.type.toLowerCase().includes('equity') || h.type.toLowerCase().includes('stock')).reduce((acc, h) => acc + h.current, 0);
    const debt = accounts.filter(a => ['fd', 'rd', 'ppf', 'nps', 'epf'].includes(a.type)).reduce((acc, a) => acc + a.amt, 0) + 
                 holdings.filter(h => (h.type.toLowerCase().includes('debt') || h.type.toLowerCase().includes('bond')) && !h.type.toLowerCase().includes('gold')).reduce((acc, h) => acc + h.current, 0);
    const gold = holdings.filter(h => h.type.toLowerCase().includes('gold') || h.type.toLowerCase().includes('sgb')).reduce((acc, h) => acc + h.current, 0);
    
    // Calculate others to ensure total matches assets
    const categorizedTotal = cash + equity + debt + gold;
    const others = Math.max(0, assets - categorizedTotal);
    
    const data = [
      { name: 'Cash', value: cash, color: '#10b981' },
      { name: 'Equity', value: equity, color: '#8b5cf6' },
      { name: 'Debt', value: debt, color: '#3b82f6' },
      { name: 'Gold', value: gold, color: '#f59e0b' },
    ];

    if (others > 0) {
      data.push({ name: 'Others', value: others, color: '#94a3b8' });
    }
    
    return data.filter(item => item.value > 0);
  }, [walletBalance, accounts, holdings, assets]);

  // 2. Financial Health Score
  const healthScore = useMemo(() => {
    const income = currentMonthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const monthlyIncome = income || 1; // Avoid division by zero
    
    // Savings Rate Score (0-25)
    const sRate = (savingsRate / 30) * 25;
    const savingsScore = Math.min(25, Math.max(0, sRate));
    
    // Emergency Fund Score (0-25)
    // Target: 6 months of expenses
    // Include Savings, FD, and RD as they are relatively liquid
    const currentSavings = accounts.filter(a => ['savings', 'fd', 'rd'].includes(a.type)).reduce((acc, a) => acc + a.amt, 0);
    const targetEF = Math.max(1, monthlyExpenses * 6);
    const efScore = (currentSavings / targetEF) * 25;
    const emergencyScore = Math.min(25, Math.max(0, efScore));
    
    // Debt-to-Income Score (0-25)
    // Target: EMI < 35% of income
    const totalEMI = accounts.filter(a => a.type === 'loan').reduce((acc, a) => acc + (a.emi || 0), 0);
    const emiRatio = totalEMI / monthlyIncome;
    const dtiScore = (1 - (emiRatio / 0.35)) * 25;
    const debtScore = Math.min(25, Math.max(0, dtiScore));
    
    // Tax Efficiency Score (0-25)
    const taxScore = (tax80CPct / 100) * 25;
    
    const total = Math.round(savingsScore + emergencyScore + debtScore + taxScore);

    // Rank System
    let rank = "Apprentice";
    let rankColor = "text-slate-500";
    let rankBg = "bg-slate-50";
    let rankBorder = "border-slate-100";
    let rankIcon = "🌱";

    if (total > 95) {
      rank = "Wealth Master";
      rankColor = "text-indigo-600";
      rankBg = "bg-indigo-50";
      rankBorder = "border-indigo-200";
      rankIcon = "💎";
    } else if (total > 80) {
      rank = "Elite";
      rankColor = "text-purple-600";
      rankBg = "bg-purple-50";
      rankBorder = "border-purple-200";
      rankIcon = "🏆";
    } else if (total > 60) {
      rank = "Strategist";
      rankColor = "text-amber-600";
      rankBg = "bg-amber-50";
      rankBorder = "border-amber-200";
      rankIcon = "🎯";
    } else if (total > 40) {
      rank = "Builder";
      rankColor = "text-blue-600";
      rankBg = "bg-blue-50";
      rankBorder = "border-blue-200";
      rankIcon = "🏗️";
    }

    const radarData = [
      { subject: 'Savings', A: Math.round(savingsScore * 4), fullMark: 100 },
      { subject: 'Emergency', A: Math.round(emergencyScore * 4), fullMark: 100 },
      { subject: 'Debt Health', A: Math.round(debtScore * 4), fullMark: 100 },
      { subject: 'Tax', A: Math.round(taxScore * 4), fullMark: 100 },
    ];

    return {
      total,
      rank,
      rankColor,
      rankBg,
      rankBorder,
      rankIcon,
      radarData,
      breakdown: { savingsScore, emergencyScore, debtScore, taxScore }
    };
  }, [transactions, savingsRate, accounts, walletBalance, monthlyExpenses, tax80CPct]);

  // Gamified Wins
  const zeroSpendStreak = useMemo(() => {
    let streak = 0;
    const currentDate = new Date();
    currentDate.setHours(0,0,0,0);
    
    // Check backwards day by day for up to 365 days
    for (let i = 0; i < 365; i++) {
      const checkDateStr = new Date(currentDate.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const hasExpenseThatDay = transactions.some(t => 
        t.date === checkDateStr && 
        (t.type === 'expense' || t.type === 'debt') && 
        !['Savings', 'Investment', 'Debt'].includes(t.category)
      );
      
      if (!hasExpenseThatDay) {
        streak++;
      } else {
        // If it's today and we have an expense, we don't break immediately, streak is just 0.
        // If it's a past day, the streak is broken.
        if (i === 0) continue; 
        break;
      }
    }
    return streak;
  }, [transactions]);

  const isBudgetNinja = useMemo(() => {
    if (!wallet || !wallet.envelopes || Object.keys(wallet.envelopes).length === 0) return false;
    return Object.values(wallet.envelopes).every(env => env.budget > 0 && env.spent <= env.budget * 0.8);
  }, [wallet]);

  // 3. Emergency Fund Tracker
  const efStatus = useMemo(() => {
    const current = accounts.filter(a => ['savings', 'fd', 'rd'].includes(a.type)).reduce((acc, a) => acc + a.amt, 0);
    const target = monthlyExpenses * 6;
    const monthsCovered = monthlyExpenses > 0 ? (current / monthlyExpenses).toFixed(1) : '∞';
    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100;
    
    return { current, target, monthsCovered, pct };
  }, [accounts, walletBalance, monthlyExpenses]);

  // 3. Emergency Fund & Runway Tracker
  const runway = useMemo(() => {
    const liquidAssets = accounts.filter(a => ['savings', 'fd', 'rd'].includes(a.type)).reduce((acc, a) => acc + a.amt, 0) + walletBalance;
    const avgExpenses = Math.max(1, monthlyExpenses);
    const months = (liquidAssets / avgExpenses).toFixed(1);
    const target = avgExpenses * 6;
    const pct = Math.min(100, Math.round((liquidAssets / target) * 100));
    
    return { liquidAssets, months, pct, target };
  }, [accounts, walletBalance, monthlyExpenses]);

  // 4. Upcoming Bills
  const upcomingBills = useMemo(() => {
    const now = new Date();
    return transactions
      .filter(t => t.isRecurring && t.type !== 'income')
      .map(t => {
        const nextDate = new Date(t.date);
        const daysLeft = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { ...t, daysLeft };
      })
      .filter(t => t.daysLeft >= 0)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 4);
  }, [transactions]);

  // 4.1 Critical Smart Alerts (Nudges)
  const criticalAlerts = useMemo(() => {
    const now = new Date();
    now.setHours(0,0,0,0);
    
    const alerts: any[] = [];
    const targetDays = [0, 1, 3, 7];
    
    // Recurring Bills / EMIs from transactions
    transactions.filter(t => t.isRecurring && t.type !== 'income').forEach(t => {
      const nextDate = new Date(t.date);
      nextDate.setHours(0,0,0,0);
      const daysLeft = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (targetDays.includes(daysLeft)) {
        alerts.push({
          id: `bill_${t.id}_${daysLeft}`,
          type: 'bill',
          title: daysLeft === 0 ? `${t.name} is due today` : `${t.name} due in ${daysLeft} days`,
          amount: Math.abs(t.amount),
          icon: t.emoji || '💸',
          daysLeft,
          severity: daysLeft <= 1 ? 'critical' : 'warning'
        });
      }
    });

    // Account Maturity (FD/RD)
    accounts.filter(a => (a.type === 'fd' || a.type === 'rd') && a.maturityDate).forEach(a => {
      const maturityDate = new Date(a.maturityDate!);
      maturityDate.setHours(0,0,0,0);
      const daysLeft = Math.ceil((maturityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (targetDays.includes(daysLeft)) {
        alerts.push({
          id: `maturity_${a.id}_${daysLeft}`,
          type: 'maturity',
          title: daysLeft === 0 ? `${a.name} matures today!` : `${a.name} matures in ${daysLeft} days`,
          amount: a.amt,
          icon: '💎',
          daysLeft,
          severity: 'info'
        });
      }
    });

    return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [transactions, accounts]);

  // 5. Wallet Pulse
  const envelopes = wallet ? Object.values(wallet.envelopes).filter(e => e.budget > 0 || e.spent > 0) : [];
  const totalBudget = envelopes.reduce((acc, e) => acc + e.budget, 0);
  const totalSpent = envelopes.reduce((acc, e) => acc + e.spent, 0);
  const overallUsedPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : (totalSpent > 0 ? 100 : 0);

  // 5. Unique Feature: The Freedom Clock & Wealth Velocity
  const freedomStats = useMemo(() => {
    const dailyCost = Math.max(1, monthlyExpenses / 30);
    const freedomDays = Math.floor(netWorth / dailyCost);
    const years = Math.floor(freedomDays / 365);
    const days = freedomDays % 365;
    
    // Velocity: How many days of freedom did you "buy" or "sell" this month?
    // Formula: (Income - Expenses) / Daily Cost
    const monthlyNet = income - expenses;
    const daysGained = Math.round(monthlyNet / dailyCost);
    
    // Life Price: How many hours of work does your average expense cost?
    // Assuming 160 working hours per month
    const hourlyRate = Math.max(1, income / 160);
    const topExpenseLifePrice = Math.round(expenses / hourlyRate);

    return { years, days, daysGained, topExpenseLifePrice, dailyCost };
  }, [netWorth, monthlyExpenses, income, expenses]);

  const [showStressTest, setShowStressTest] = useState(false);

  // 6. Black Swan Stress Test Logic
  const stressTestData = useMemo(() => {
    const marketCrash = assets * 0.6; // 40% drop
    const jobLoss = expenses * 12; // 1 year of expenses
    const resilience = netWorth > jobLoss ? "High" : netWorth > (jobLoss / 2) ? "Medium" : "Low";
    
    return { marketCrash, jobLoss, resilience };
  }, [assets, expenses, netWorth]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const showWalletSetupPopup = !wallet?.active || walletBalance === 0;

  return (
    <>
      {showWalletSetupPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div className="relative bg-[#f4f7fc] p-10 py-12 rounded-[32px] max-w-[480px] w-full text-center shadow-2xl border-4 border-indigo-200/50" style={{ borderStyle: 'dashed' }}>
             <div className="text-5xl mb-4 drop-shadow-md">👛</div>
             <h2 className="text-2xl font-display font-black text-indigo-600 mb-4 tracking-tight">
               Setup Your Monthly Wallet
             </h2>
             <p className="text-slate-500 font-medium text-sm leading-relaxed mb-8 px-4">
               Tell us your monthly income. We will show exactly how much is free to spend after your EMIs, SIPs, and RDs are committed.
             </p>
             <button 
               onClick={openWallet}
               className="bg-[#5651f5] hover:bg-[#4338ca] text-white font-bold py-3 px-8 rounded-full shadow-lg shadow-indigo-500/30 transition-all font-display text-base inline-flex items-center justify-center gap-2"
             >
               🚀 Setup Wallet Now
             </button>
          </div>
        </div>
      )}

      <div className={cn("space-y-8 pb-10", showWalletSetupPopup && "h-screen overflow-hidden pointer-events-none opacity-40 blur-sm")}>
        {/* Proactive Critical Alerts */}
        <AnimatePresence>
          {criticalAlerts.length > 0 && (
            <section className="px-2">
              <div className="flex flex-col gap-3">
                {criticalAlerts.map((alert) => (
                  <motion.div 
                    key={alert.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className={cn(
                      "flex items-center gap-4 p-5 rounded-3xl border shadow-sm",
                      alert.severity === 'critical' ? "bg-red-50 border-red-100" : 
                      alert.severity === 'warning' ? "bg-amber-50 border-amber-100" : "bg-indigo-50 border-indigo-100"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm",
                      alert.severity === 'critical' ? "bg-white text-red-600" : 
                      alert.severity === 'warning' ? "bg-white text-amber-600" : "bg-white text-indigo-600"
                    )}>
                      {alert.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className={cn(
                          "font-display font-black text-sm",
                          alert.severity === 'critical' ? "text-red-900" : 
                          alert.severity === 'warning' ? "text-amber-900" : "text-indigo-900"
                        )}>{alert.title}</h4>
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          alert.severity === 'critical' ? "text-red-500" : 
                          alert.severity === 'warning' ? "text-amber-500" : "text-indigo-500"
                        )}>
                          {alert.daysLeft === 0 ? 'Today' : `${alert.daysLeft}d left`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className={cn(
                          "text-xs font-bold",
                          alert.severity === 'critical' ? "text-red-700/60" : 
                          alert.severity === 'warning' ? "text-amber-700/60" : "text-indigo-700/60"
                        )}>{formatCurrency(alert.amount)}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => onTabChange?.(alert.type === 'bill' ? 'cashflow' : 'vault')}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:scale-105 transition-all text-white",
                        alert.severity === 'critical' ? "bg-red-600" : 
                        alert.severity === 'warning' ? "bg-amber-600" : "bg-indigo-600"
                      )}
                    >
                      Process
                    </button>
                  </motion.div>
                ))}
              </div>
            </section>
          )}
        </AnimatePresence>

        {/* Header & Quick Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div>
          <p className="text-slate-400 text-xs font-medium tracking-wide uppercase">{getGreeting()},</p>
          <h2 className="font-display font-extrabold text-3xl text-slate-900 tracking-tight">
            {user?.displayName?.split(' ')[0] || 'User'} 👋
          </h2>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-lg relative z-10",
              healthScore.total > 80 ? "bg-emerald-50 text-emerald-600" : 
              healthScore.total > 60 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
            )}>
              {healthScore.total}
              {/* Pulse Animation */}
              <div className={cn(
                "absolute inset-0 rounded-xl animate-ping opacity-20",
                healthScore.total > 80 ? "bg-emerald-400" : 
                healthScore.total > 60 ? "bg-amber-400" : "bg-red-400"
              )}></div>
            </div>
            <div className="hidden sm:block relative z-10">
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Wealth Rank</p>
              <p className={cn("text-[10px] font-bold", healthScore.rankColor)}>
                {healthScore.rankIcon} {healthScore.rank}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Financial State Sections */}
      
      {/* Yesterday's Recap Card (NEW) */}
      <section className="px-2">
        <motion.div 
          onClick={() => onTabChange?.('moneyflow', { range: 'Yesterday' })}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 md:p-8 rounded-[40px] shadow-xl text-white cursor-pointer relative overflow-hidden group"
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-[24px] bg-white/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                <Clock size={32} />
              </div>
              <div>
                <h3 className="font-display font-black text-2xl leading-tight">Yesterday's Pulse</h3>
                <p className="text-slate-400 text-sm mt-1 max-w-xs">Curious how your money flows? Analyze your platform burn from yesterday.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-400 group-hover:translate-x-2 transition-transform bg-white/5 px-6 py-3 rounded-2xl">
              Check Recap <ArrowRight size={16} />
            </div>
          </div>
          <div className="absolute -right-20 -top-20 opacity-10 pointer-events-none group-hover:scale-120 transition-transform">
            <Activity size={240} />
          </div>
        </motion.div>
      </section>

      {/* 1. Total Networth Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <SpatialNetWorthCard 
          netWorth={netWorth}
          portfolioPerformance={portfolioPerformance}
          assets={assets}
          liabilities={liabilities}
          income={income}
          expenses={expenses}
          wallet={wallet}
          openWallet={openWallet}
        />
      </div>

      {/* Dynamic Budget Warnings */}
      {wallet?.envelopes && Object.values(wallet.envelopes).some((env: any) => env.budget > 0 && (env.spent / env.budget) >= 0.8) && (
        <section className="bg-orange-50 border border-orange-200 rounded-3xl p-6 shadow-sm flex items-start gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-orange-500 shadow-sm shrink-0 border border-orange-100">
             <Bell size={24} />
          </div>
          <div>
            <h3 className="font-display font-black text-orange-900 text-lg flex items-center gap-2">
              Budget Alert 🚨
            </h3>
            <p className="text-sm text-orange-800 font-medium mt-1 leading-relaxed">
               Careful! You've used up 80% or more of your budget for the following envelopes: 
               <strong>
                 {Object.values(wallet.envelopes)
                   .filter((env: any) => env.budget > 0 && (env.spent / env.budget) >= 0.8)
                   .map((env: any) => ` ${env.icon} ${env.name}`)
                   .join(', ')}
               </strong>. Consider holding back on these expenses until next month.
            </p>
          </div>
        </section>
      )}

      {/* 2. Upcoming Bills */}
      <section className="glass-card rounded-[40px] p-8">
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            <Bell size={20} className="text-indigo-600" />
            Upcoming Bills
          </h3>
          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">Next 30 Days</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {upcomingBills.length > 0 ? upcomingBills.map((bill) => (
            <div key={bill.id} className="flex items-center gap-4 p-4 rounded-3xl bg-slate-50 border border-slate-100 hover:border-indigo-200 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform text-white">
                {bill.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-900 truncate">{bill.name}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Due in {bill.daysLeft} days</p>
              </div>
              <div className="text-right">
                <p className="font-display font-black text-sm text-slate-900">{formatCurrency(Math.abs(bill.amount))}</p>
                <p className="text-[10px] font-bold text-indigo-600 uppercase">{new Date(bill.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
              </div>
            </div>
          )) : (
            <div className="col-span-full text-center py-10">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-slate-200">
                <ShieldCheck size={24} className="text-slate-200" />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">All clear for now!</p>
            </div>
          )}
        </div>
      </section>

      {/* 3. Monthly Spending (Money Pulse) */}
      <section className="glass-card p-8 rounded-[40px]">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="font-display font-bold text-xl flex items-center gap-2">
              <Activity className="text-indigo-600" size={24} />
              Monthly Spending Pulse
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time Budget Tracking</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Sync</span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-12 items-center">
          <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="80" cy="80" r="72" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
              <circle 
                cx="80" 
                cy="80" 
                r="72" 
                stroke="currentColor" 
                strokeWidth="12" 
                fill="transparent" 
                strokeDasharray={452} 
                strokeDashoffset={452 * (1 - overallUsedPct/100)} 
                strokeLinecap="round" 
                className={cn(
                  "transition-all duration-1000",
                  overallUsedPct > 90 ? "text-red-500" : overallUsedPct > 70 ? "text-amber-500" : "text-emerald-500"
                )} 
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display font-black text-3xl text-slate-900">{overallUsedPct}%</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Budget Used</span>
            </div>
          </div>
          
          <div className="flex-1 w-full space-y-5">
            {envelopes.length > 0 ? envelopes.slice(0, 4).map((env, idx) => {
              const pct = env.budget > 0 ? Math.round((env.spent / env.budget) * 100) : (env.spent > 0 ? 100 : 0);
              return (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{env.icon}</span>
                      <span className="text-xs font-bold text-slate-700">{env.name}</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase">
                      {formatCurrency(env.spent)} / {formatCompactNumber(env.budget)}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      className={cn(
                        "h-full rounded-full",
                        pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-indigo-500"
                      )}
                    />
                  </div>
                </div>
              );
            }) : (
              <div className="text-center py-6 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No budget envelopes active</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Wealth Allocation */}
      <section className="glass-card rounded-[40px] p-8">
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            <PieChart size={20} className="text-indigo-600" />
            Wealth Allocation
          </h3>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full">Diversification</span>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-10">
          <div className="relative w-48 h-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={assetAllocation}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={90}
                  paddingAngle={6}
                  dataKey="value"
                  stroke="none"
                >
                  {assetAllocation.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[10px] font-black text-slate-400 uppercase">Assets</p>
              <p className="text-lg font-display font-black text-slate-900">{formatCompactNumber(assets)}</p>
            </div>
          </div>

          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
            {assetAllocation.map((item) => (
              <div key={item.name} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 group hover:bg-white hover:shadow-sm transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{item.name}</p>
                    <p className="text-sm font-display font-bold text-slate-900">{formatCompactNumber(item.value)}</p>
                  </div>
                </div>
                <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                  {Math.round((item.value / assets) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Money Weather (Calendar) */}
      <section>
        <MoneyCalendar transactions={transactions} wallet={wallet} />
      </section>

      {/* 6. The Freedom Engine */}
      <section className="relative overflow-hidden bg-slate-900 rounded-[40px] p-8 md:p-10 text-white shadow-2xl">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Activity size={20} />
              </div>
              <div>
                <h3 className="font-display font-black text-xl tracking-tight">The Freedom Engine</h3>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">invxtra Exclusive</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-slate-400 text-sm font-medium">If you stopped working today, you could live for:</p>
              <div className="flex items-baseline gap-3">
                <span className="font-display font-black text-6xl md:text-7xl tracking-tighter text-white">
                  {freedomStats.years}
                </span>
                <span className="text-2xl font-display font-bold text-slate-500 uppercase tracking-widest">Years</span>
                <span className="font-display font-black text-6xl md:text-7xl tracking-tighter text-white">
                  {freedomStats.days}
                </span>
                <span className="text-2xl font-display font-bold text-slate-500 uppercase tracking-widest">Days</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div className="bg-white/5 border border-white/10 p-5 rounded-3xl backdrop-blur-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <TrendingUp size={16} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wealth Velocity</p>
                </div>
                <p className="text-sm font-medium leading-relaxed">
                  This month, your savings "bought" you <span className="text-emerald-400 font-black">{freedomStats.daysGained} days</span> of future freedom.
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 p-5 rounded-3xl backdrop-blur-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                    <Activity size={16} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Life Price</p>
                </div>
                <p className="text-sm font-medium leading-relaxed">
                  Your monthly expenses cost you <span className="text-amber-400 font-black">{freedomStats.topExpenseLifePrice} hours</span> of your working life.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-64 h-64">
              {/* Animated Freedom Rings */}
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="128" cy="128" r="110" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5" />
                <motion.circle 
                  cx="128" cy="128" r="110" 
                  stroke="currentColor" strokeWidth="8" fill="transparent" 
                  strokeDasharray={691} 
                  strokeDashoffset={691 * (1 - Math.min(1, freedomStats.years / 10))} 
                  strokeLinecap="round" 
                  className="text-indigo-500"
                  initial={{ strokeDashoffset: 691 }}
                  animate={{ strokeDashoffset: 691 * (1 - Math.min(1, freedomStats.years / 10)) }}
                  transition={{ duration: 2, ease: "easeOut" }}
                />
                
                <circle cx="128" cy="128" r="90" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5" />
                <motion.circle 
                  cx="128" cy="128" r="90" 
                  stroke="currentColor" strokeWidth="8" fill="transparent" 
                  strokeDasharray={565} 
                  strokeDashoffset={565 * (1 - freedomStats.days / 365)} 
                  strokeLinecap="round" 
                  className="text-emerald-500"
                  initial={{ strokeDashoffset: 565 }}
                  animate={{ strokeDashoffset: 565 * (1 - freedomStats.days / 365) }}
                  transition={{ duration: 2, delay: 0.5, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Status</p>
                <p className="text-xl font-display font-black text-white">
                  {freedomStats.years >= 25 ? "FIRE Ready" : 
                   freedomStats.years >= 10 ? "Secure" : 
                   freedomStats.years >= 2 ? "Stable" : "Building"}
                </p>
                <div className="mt-2 flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                  <span className="text-[8px] font-black uppercase tracking-widest">Engine Active</span>
                </div>
                <button 
                  onClick={() => setShowStressTest(true)}
                  className="mt-4 text-[10px] font-black text-indigo-400 hover:text-white transition-colors flex items-center gap-1 group"
                >
                  <ShieldCheck size={12} className="group-hover:scale-110 transition-transform" />
                  STRESS TEST
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-600/20 to-transparent pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-600/20 rounded-full blur-[100px] pointer-events-none"></div>
      </section>
    </div>
    </>
  );
}

function SpatialNetWorthCard({ netWorth, portfolioPerformance, assets, liabilities, income, expenses, wallet, openWallet }: any) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 20 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["5deg", "-5deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-5deg", "5deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.section 
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className="lg:col-span-12 hero-gradient rounded-[40px] p-8 md:p-10 text-white shadow-2xl shadow-indigo-200/50 relative overflow-visible flex flex-col justify-between min-h-[320px] will-change-transform"
    >
      <div className="relative z-10" style={{ transform: "translateZ(30px)" }}>
        <div className="flex justify-between items-start mb-2">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-80">TOTAL NET WORTH</p>
          <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-sm">
            <ShieldCheck size={12} />
            SECURED
          </div>
        </div>
        
        <h2 className="font-display font-extrabold text-5xl md:text-6xl tracking-tighter mb-6 drop-shadow-lg">
          {formatCurrency(netWorth)}
        </h2>

        <div className="flex flex-wrap gap-4 mb-10">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
            <div className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              portfolioPerformance === null ? "bg-indigo-400" : 
              portfolioPerformance >= 0 ? "bg-emerald-400" : "bg-red-400"
            )}></div>
            <span className="text-xs font-bold tracking-tight">
              {portfolioPerformance === null 
                ? "Portfolio ready for growth" 
                : `Portfolio ${portfolioPerformance >= 0 ? 'up' : 'down'} ${Math.abs(portfolioPerformance).toFixed(1)}% overall`}
            </span>
          </div>
          <button 
            onClick={openWallet}
            className="flex items-center gap-2 bg-white text-indigo-600 px-4 py-2 rounded-2xl text-xs font-black shadow-xl hover:bg-indigo-50 transition-all active:scale-95"
            style={{ transform: "translateZ(10px)" }}
          >
            <Wallet size={16} />
            {wallet?.active ? "MANAGE WALLET" : "SETUP WALLET"}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ transform: "translateZ(20px)" }}>
          <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-sm border border-white/5 hover:bg-white/20 transition-colors cursor-default">
            <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">ASSETS</p>
            <p className="font-display font-extrabold text-lg">{formatCompactNumber(assets)}</p>
          </div>
          <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-sm border border-white/5 hover:bg-white/20 transition-colors cursor-default">
            <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">LIABILITIES</p>
            <p className="font-display font-extrabold text-lg text-red-200">{formatCompactNumber(liabilities)}</p>
          </div>
          <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-sm border border-white/5 hover:bg-white/20 transition-colors cursor-default">
            <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">CASH FLOW</p>
            <p className="font-display font-extrabold text-lg text-emerald-200">+{formatCompactNumber(income - expenses)}</p>
          </div>
          <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-sm border border-white/5 hover:bg-white/20 transition-colors cursor-default">
            <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">FREE CASH</p>
            <p className="font-display font-extrabold text-lg text-amber-200">{formatCompactNumber(wallet?.free || 0)}</p>
          </div>
        </div>
      </div>
      
      {/* Decorative Elements */}
      <motion.div 
        style={{ x: useTransform(x, [-0.5, 0.5], [20, -20]), y: useTransform(y, [-0.5, 0.5], [20, -20]) }}
        className="absolute -bottom-20 -right-20 w-80 h-80 bg-indigo-400/30 rounded-full blur-[100px] pointer-events-none" 
      />
      <motion.div 
        style={{ x: useTransform(x, [-0.5, 0.5], [-20, 20]), y: useTransform(y, [-0.5, 0.5], [-20, 20]) }}
        className="absolute -top-20 -left-20 w-60 h-60 bg-purple-400/30 rounded-full blur-[80px] pointer-events-none" 
      />
    </motion.section>
  );
}
