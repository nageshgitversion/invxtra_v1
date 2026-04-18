import React, { useState, useMemo } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'motion/react';
import { Sparkles, TrendingUp, ArrowUpRight, ArrowDownRight, Wallet, Settings2, Activity, Zap, Bell, User, RefreshCw, ShieldCheck, PieChart, Info, Plus } from 'lucide-react';
import { Transaction, Holding, Account, Wallet as WalletType } from '../types';
import { formatCurrency, formatCompactNumber, cn } from '../lib/utils';
import { useFirebase } from '../lib/FirebaseProvider';
import Modal from './Modal';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import MoneyCalendar from './MoneyCalendar';

interface DashboardProps {
  transactions: Transaction[];
  holdings: Holding[];
  accounts: Account[];
  insights: string[];
  wallet: WalletType | null;
  onRefreshInsights?: () => void;
}

export default function Dashboard({ transactions, holdings, accounts, insights, wallet, onRefreshInsights }: DashboardProps) {
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
  const expenses = Math.abs(currentMonthTransactions.filter(t => t.type === 'expense' && !['Savings', 'Investment'].includes(t.category)).reduce((acc, t) => acc + t.amount, 0));
  
  const lastMonthExpenses = Math.abs(lastMonthTransactions.filter(t => t.type === 'expense' && !['Savings', 'Investment'].includes(t.category)).reduce((acc, t) => acc + t.amount, 0));
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
        t.type === 'expense' && 
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

  return (
    <div className="space-y-8 pb-10">
      {/* Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div>
          <p className="text-slate-400 text-xs font-medium tracking-wide uppercase">{getGreeting()},</p>
          <h2 className="font-display font-extrabold text-3xl text-slate-900 tracking-tight">
            {user?.displayName?.split(' ')[0] || 'User'} 👋
          </h2>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('setActiveTab', { detail: 'transactions' }))}
            className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Plus size={18} />
            </div>
            <span className="text-sm font-bold text-slate-700">Add Transaction</span>
          </button>
          
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

      {/* Hero Section: Net Worth & Financial Runway */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Net Worth Card */}
        {/* Net Worth Card (Spatial UI) */}
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

        {/* Financial Runway Card */}
        <section className="lg:col-span-4 glass-card rounded-[40px] p-8 flex flex-col justify-between relative overflow-hidden group">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-bold text-sm flex items-center gap-2 uppercase tracking-widest text-slate-400">
                <Zap size={16} className="text-amber-500" />
                Financial Runway
              </h3>
              <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                <Info size={14} />
              </div>
            </div>

            <div className="text-center mb-8">
              <h4 className="font-display font-black text-6xl text-slate-900 mb-1">{runway.months}</h4>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Months of Survival</p>
            </div>

            <div className="space-y-4">
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${runway.pct}%` }}
                  className={cn(
                    "h-full rounded-full transition-all duration-1000",
                    runway.pct > 80 ? "bg-emerald-500" : runway.pct > 40 ? "bg-amber-500" : "bg-red-500"
                  )}
                />
              </div>
              <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-tight">
                <span>0 Months</span>
                <span>Target: 6 Months</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium italic">
              "You can sustain your current lifestyle for {runway.months} months without any new income."
            </p>
          </div>
        </section>
      </div>

      {/* Gamification Row: Zero Spend & Budget Ninja */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Zero Spend Streak */}
        <div className="glass-card p-6 rounded-[32px] flex items-center justify-between relative overflow-hidden group">
          <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="text-[120px]">🔥</span>
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Zero-Spend Streak</h3>
            <div className="flex items-baseline gap-2">
              <span className="font-display font-black text-4xl text-orange-500">{zeroSpendStreak}</span>
              <span className="text-xs font-bold text-slate-500 uppercase">Days</span>
            </div>
            <p className="text-xs text-slate-500 mt-2 max-w-[200px] leading-relaxed">
              {zeroSpendStreak > 0 ? "You're on fire! Keep saving." : "Record a day without unbudgeted expenses to start a streak!"}
            </p>
          </div>
          <div className="w-16 h-16 rounded-3xl bg-orange-50 flex items-center justify-center text-3xl shadow-inner z-10">
            🔥
          </div>
        </div>

        {/* Budget Ninja Badge */}
        <div className={cn("glass-card p-6 rounded-[32px] flex items-center justify-between relative overflow-hidden group transition-all duration-500", isBudgetNinja ? "border-emerald-200 shadow-xl shadow-emerald-500/10 scale-[1.02]" : "")}>
          <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="text-[120px]">🥷</span>
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Status Badge</h3>
            <div className="flex items-center gap-2">
              <span className={cn("font-display font-black text-2xl", isBudgetNinja ? "text-emerald-500" : "text-slate-400")}>
                {isBudgetNinja ? "Budget Ninja" : "Spender"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2 max-w-[200px] leading-relaxed">
              {isBudgetNinja ? "All your active envelopes are safely in the green zone!" : "Keep your envelopes under 80% usage to unlock this badge."}
            </p>
          </div>
          <div className={cn("w-16 h-16 rounded-3xl flex items-center justify-center text-3xl shadow-inner transition-all duration-500 z-10", isBudgetNinja ? "bg-emerald-50 scale-110" : "bg-slate-50 grayscale opacity-50")}>
            🥷
          </div>
        </div>
      </div>

      {/* Unique Feature: The Freedom Engine */}
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

      {/* Stress Test Modal */}
      <Modal 
        isOpen={showStressTest} 
        onClose={() => setShowStressTest(false)} 
        title="Black Swan Stress Test"
      >
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Portfolio Resilience</p>
              <h3 className="text-3xl font-display font-black mb-4">{stressTestData.resilience} Resilience</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                We simulated a 40% market crash and a 12-month job loss scenario. Here is how your wealth would hold up.
              </p>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-3xl bg-red-50 border border-red-100">
              <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">40% Market Crash</p>
              <p className="text-xl font-display font-black text-red-900">{formatCurrency(stressTestData.marketCrash)}</p>
              <p className="text-[10px] text-red-600 font-bold mt-2">Remaining Portfolio Value</p>
            </div>
            <div className="p-5 rounded-3xl bg-amber-50 border border-amber-100">
              <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">1-Year Job Loss</p>
              <p className="text-xl font-display font-black text-amber-900">{formatCurrency(stressTestData.jobLoss)}</p>
              <p className="text-[10px] text-amber-600 font-bold mt-2">Total Survival Cost</p>
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Zap size={14} className="text-indigo-600" />
              Survival Strategy
            </h4>
            <ul className="space-y-3">
              <li className="flex gap-3 items-start">
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[10px] shadow-sm shrink-0">1</div>
                <p className="text-xs text-slate-600 font-medium">
                  Your liquid assets cover <span className="text-slate-900 font-bold">{freedomStats.years} years</span> of expenses. You are well-protected against short-term shocks.
                </p>
              </li>
              <li className="flex gap-3 items-start">
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[10px] shadow-sm shrink-0">2</div>
                <p className="text-xs text-slate-600 font-medium">
                  In a crash, your net worth would drop to <span className="text-slate-900 font-bold">{formatCompactNumber(stressTestData.marketCrash)}</span>. Ensure you have enough cash to avoid selling at the bottom.
                </p>
              </li>
            </ul>
          </div>

          <button 
            onClick={() => setShowStressTest(false)}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-display font-black text-sm shadow-xl shadow-slate-200 active:scale-95 transition-all"
          >
            UNDERSTOOD
          </button>
        </div>
      </Modal>

      {/* Asset Allocation & Upcoming Bills */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Asset Allocation */}
        <section className="lg:col-span-7 glass-card rounded-[40px] p-8">
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

        {/* Upcoming Bills */}
        <section className="lg:col-span-5 glass-card rounded-[40px] p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-display font-bold text-lg flex items-center gap-2">
              <Bell size={20} className="text-indigo-600" />
              Upcoming Bills
            </h3>
            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">Next 30 Days</span>
          </div>

          <div className="space-y-4">
            {upcomingBills.length > 0 ? upcomingBills.map((bill) => (
              <div key={bill.id} className="flex items-center gap-4 p-4 rounded-3xl bg-slate-50 border border-slate-100 hover:border-indigo-200 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform">
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
              <div className="text-center py-10">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-slate-200">
                  <ShieldCheck size={24} className="text-slate-200" />
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">All clear for now!</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Money Pulse & Health Score */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Money Pulse */}
        <section className="lg:col-span-8 glass-card p-8 rounded-[40px]">
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

        {/* Health Breakdown */}
        <section className="lg:col-span-4 glass-card p-8 rounded-[40px] relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-bold text-sm flex items-center gap-2 uppercase tracking-widest text-slate-400">
              <ShieldCheck size={16} className="text-indigo-500" />
              Financial Scoreboard
            </h3>
            <div className={cn(
              "px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-widest",
              healthScore.rankBg, healthScore.rankColor, healthScore.rankBorder
            )}>
              {healthScore.rank}
            </div>
          </div>

          <div className="h-64 w-full mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={healthScore.radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                <Radar
                  name="Score"
                  dataKey="A"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.3}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <ScoreItem label="Savings" score={Math.round(healthScore.breakdown.savingsScore * 4)} />
            <ScoreItem label="Emergency" score={Math.round(healthScore.breakdown.emergencyScore * 4)} />
            <ScoreItem label="Debt Health" score={Math.round(healthScore.breakdown.debtScore * 4)} />
            <ScoreItem label="Tax" score={Math.round(healthScore.breakdown.taxScore * 4)} />
          </div>
          
          <div className="p-5 bg-indigo-50 rounded-3xl border border-indigo-100">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles size={18} className="text-indigo-600" />
              <p className="text-xs font-black text-indigo-900 uppercase tracking-tight">AI Recommendation</p>
            </div>
            <p className="text-[11px] text-indigo-700 leading-relaxed font-medium">
              {healthScore.total > 80 
                ? `You've reached ${healthScore.rank} status! Your financial foundation is rock solid. Focus on optimizing tax and aggressive growth.`
                : `You are currently a ${healthScore.rank}. Focus on building your emergency fund to reach the next rank.`}
            </p>
          </div>
        </section>
      </div>

      {/* Money Weather Calendar */}
      <section>
        <MoneyCalendar transactions={transactions} wallet={wallet} />
      </section>

      {/* Quick Stats & AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Quick Stats Grid */}
        <section className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MiniStatCard 
            label="Wallet" 
            value={formatCurrency(walletBalance)} 
            change="Ready to use" 
            color="emerald" 
            icon="💰" 
            onClick={openWallet}
          />
          <MiniStatCard 
            label="Expenses" 
            value={formatCurrency(monthlyExpenses)} 
            change={
              <span className={cn(
                "flex items-center gap-1",
                expenseDiff > 0 ? "text-red-500" : "text-emerald-500"
              )}>
                {expenseDiff > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(expenseDiffPct)}% vs last month
              </span>
            } 
            color="red" 
            icon="💳" 
          />
          <MiniStatCard 
            label="Invested" 
            value={formatCurrency(totalInvested)} 
            change="Cost basis" 
            color="purple" 
            icon="📈" 
          />
          <MiniStatCard 
            label="Returns" 
            value={formatCurrency(netWorth - totalInvested)} 
            change={`${xirr}% overall`} 
            color="amber" 
            icon="⭐" 
          />
        </section>

        {/* Tax Progress */}
        <section className="lg:col-span-4 glass-card p-6 rounded-[32px] flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tax Progress (80C)</p>
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{tax80CPct}%</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-4">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${tax80CPct}%` }}
              className="h-full bg-emerald-500"
            />
          </div>
          <div className="flex justify-between items-end">
            <p className="text-sm font-display font-black text-slate-900">{formatCompactNumber(taxSavings80C)}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Target: {formatCompactNumber(tax80CLimit)}</p>
          </div>
        </section>
      </div>

      {/* AI Decision Hub */}
      <section className="bg-white border border-slate-100 rounded-[40px] p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-slate-900">AI Decision Hub</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Personalized Financial Advisor</p>
            </div>
          </div>
          {onRefreshInsights && (
            <button 
              onClick={onRefreshInsights}
              className="p-2 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-all"
            >
              <RefreshCw size={18} />
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {insights.length > 0 ? insights.map((insight, i) => (
            <div key={i} className="p-6 rounded-3xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-white hover:shadow-md transition-all group relative overflow-hidden">
              <div className="relative z-10">
                <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-sm mb-4 shadow-sm group-hover:scale-110 transition-transform">
                  {['💡', '🎯', '🚀', '🛡️', '💰'][i % 5]}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">{insight}</p>
              </div>
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-12 -mt-12 blur-2xl"></div>
            </div>
          )) : (
            [1, 2, 3].map(i => (
              <div key={i} className="h-32 shimmer rounded-[32px] w-full"></div>
            ))
          )}
        </div>
      </section>

      {/* Recent Activity */}
      <section>
        <div className="flex justify-between items-center mb-6 px-2">
          <h3 className="font-display font-bold text-xl">Recent Activity</h3>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('setActiveTab', { detail: 'transactions' }))}
            className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition-colors"
          >
            View All Transactions →
          </button>
        </div>
        <div className="glass-card rounded-[32px] overflow-hidden divide-y divide-slate-50">
          {transactions
            .filter(t => !t.isRecurring && new Date(t.date) <= new Date())
            .slice(0, 5)
            .map((tx) => (
            <div key={tx.id} className="flex items-center gap-4 p-5 hover:bg-slate-50 transition-colors group">
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform">
                {tx.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-900 truncate">{tx.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{tx.category}</span>
                  <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>
              </div>
              <div className="text-right">
                <p className={cn(
                  "font-display font-black text-base",
                  tx.amount > 0 ? "text-emerald-600" : "text-slate-900"
                )}>
                  {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                </p>
                {tx.linkedAcc && (
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">via {accounts.find(a => a.id === tx.linkedAcc)?.name || 'Account'}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="text-center">
      <p className="text-[9px] font-black uppercase tracking-wider opacity-60 mb-0.5">{label}</p>
      <p className="font-display font-extrabold text-sm">{value}</p>
    </div>
  );
}

function HealthMetric({ label, score, max }: { label: string, score: number, max: number }) {
  const pct = Math.round((score / max) * 100);
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
        <span className="text-[10px] font-bold text-slate-600">{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full rounded-full transition-all duration-1000",
            pct > 80 ? "bg-emerald-500" : pct > 50 ? "bg-amber-500" : "bg-red-500"
          )} 
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MiniStatCard({ label, value, change, color, icon, onClick }: { label: string, value: string, change: React.ReactNode, color: string, icon: string, onClick?: () => void }) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-600 bg-emerald-50",
    red: "text-red-600 bg-red-50",
    purple: "text-purple-600 bg-purple-50",
    amber: "text-amber-600 bg-amber-50",
  };

  return (
    <div 
      className={cn(
        "glass-card p-4 rounded-2xl transition-all",
        onClick && "cursor-pointer hover:scale-[1.02] hover:shadow-md active:scale-[0.98]"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-base">{icon}</div>
        <p className="text-[10px] font-bold text-slate-500 leading-tight">{label}</p>
      </div>
      <p className={cn("font-display font-extrabold text-xl mb-0.5", colors[color].split(' ')[0])}>{value}</p>
      <p className={cn("text-[9px] font-black uppercase tracking-tight", colors[color].split(' ')[0])}>{change}</p>
    </div>
  );
}

function PulseBar({ label, pct, color }: { label: string, pct: number, color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-slate-600 w-20">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }}></div>
      </div>
      <span className={cn("text-[10px] font-bold w-8 text-right", pct > 90 ? "text-red-500" : "text-slate-400")}>{pct}%</span>
    </div>
  );
}

function ScoreItem({ label, score }: { label: string, score: number }) {
  return (
    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-display font-black text-slate-900">{score}</span>
        <span className="text-[8px] font-bold text-slate-400">/100</span>
      </div>
    </div>
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
      className="lg:col-span-8 hero-gradient rounded-[40px] p-8 md:p-10 text-white shadow-2xl shadow-indigo-200/50 relative overflow-visible flex flex-col justify-between min-h-[320px] will-change-transform"
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
