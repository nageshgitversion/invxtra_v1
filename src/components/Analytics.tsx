import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { Transaction, Holding } from '../types';
import { formatCurrency, formatCompactNumber, cn } from '../lib/utils';
import { Heart, Coffee, Fingerprint, Zap, TrendingUp, ShieldCheck, Wallet, Activity } from 'lucide-react';
import SubscriptionManager from './SubscriptionManager';

interface AnalyticsProps {
  transactions: Transaction[];
  holdings: Holding[];
}

export default function Analytics({ transactions, holdings }: AnalyticsProps) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthTransactions = transactions.filter(t => !t.isRecurring && t.date.startsWith(currentMonth));

  const totalSpent = currentMonthTransactions
    .filter(t => t.type === 'expense' || t.type === 'investment')
    .reduce((acc, t) => acc + Math.abs(t.amount), 0);
  const totalIncome = currentMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  // Group transactions by category for Pie Chart
  const categoryMap: Record<string, number> = {};
  transactions
    .filter(t => !t.isRecurring && (t.type === 'expense' || t.type === 'investment'))
    .forEach(t => {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + Math.abs(t.amount);
    });
  const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

  // Group transactions by month for Bar Chart (last 6 months)
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return d.toLocaleString('default', { month: 'short' });
  }).reverse();

  const barData = last6Months.map(month => {
    const monthTxs = transactions.filter(t => 
      !t.isRecurring && 
      new Date(t.date).toLocaleString('default', { month: 'short' }) === month
    );
    const income = monthTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = Math.abs(monthTxs.filter(t => t.type === 'expense' || t.type === 'investment').reduce((acc, t) => acc + t.amount, 0));
    return { name: month, income, expense, savings: Math.max(0, income - expense) };
  });

  const COLORS = ['#4F46E5', '#EF4444', '#F59E0B', '#10B981', '#0EA5E9', '#8B5CF6', '#EC4899'];

  // Portfolio data from holdings
  const portfolioData = holdings.map(h => ({ name: h.name, value: h.current }));

  // Wealth Health Score (Simplified)
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalSpent) / totalIncome) * 100) : 0;
  const healthScore = Math.min(100, Math.max(0, savingsRate + (holdings.length > 0 ? 30 : 0) + (transactions.length > 10 ? 20 : 0)));

  return (
    <div className="space-y-6">
      <div className="px-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">6-month overview</p>
        <h2 className="font-display font-extrabold text-2xl">Analytics</h2>
      </div>

      {/* Portfolio Readiness Score */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="text-indigo-600" size={18} />
          <h3 className="font-display font-bold text-sm">Portfolio Readiness</h3>
        </div>
        
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-slate-100" />
              <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="10" fill="transparent" strokeDasharray={364} strokeDashoffset={364 * (1 - healthScore/100)} strokeLinecap="round" className="text-indigo-600" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display font-black text-3xl text-indigo-900">{healthScore}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">/ 100</span>
            </div>
          </div>
          <p className="mt-4 text-xs font-bold text-slate-600">
            Status: <span className={cn(healthScore > 70 ? "text-emerald-600" : healthScore > 40 ? "text-amber-600" : "text-red-600")}>
              {healthScore > 70 ? "Ready" : healthScore > 40 ? "Building" : "Starting Out"}
            </span>
          </p>
        </div>

        <div className="space-y-4">
          <HealthMetric label="Savings Rate" score={savingsRate} color="bg-emerald-500" />
          <HealthMetric label="Investment Mix" score={holdings.length > 0 ? 80 : 0} color="bg-amber-500" />
          <HealthMetric label="Data Consistency" score={Math.min(100, transactions.length * 5)} color="bg-indigo-500" />
        </div>
      </div>

      {/* Chai Meter */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-6">
          <Coffee className="text-amber-600" size={18} />
          <h3 className="font-display font-bold text-sm">Chai Meter</h3>
        </div>
        
        <p className="text-xs font-medium text-slate-600 mb-6">
          This month you spent <span className="font-bold text-slate-900">{formatCurrency(totalSpent)}</span> — which is the same as:
        </p>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          <ChaiItem emoji="☕" value={Math.round(totalSpent / 15)} label="Cups of Chai" />
          <ChaiItem emoji="🥟" value={Math.round(totalSpent / 20)} label="Vada Pavs" />
          <ChaiItem emoji="🛺" value={Math.round(totalSpent / 60)} label="Auto Rides" />
          <ChaiItem emoji="🍕" value={Math.round(totalSpent / 350)} label="Swiggy Orders" />
          <ChaiItem emoji="🎬" value={Math.round(totalSpent / 400)} label="Movie Tickets" />
          <ChaiItem emoji="📺" value={Math.round(totalSpent / 199)} label="Netflix Subs" />
          <ChaiItem emoji="📈" value={(totalSpent / 5000).toFixed(1)} label="SIP Months" color="bg-emerald-50 border-emerald-100 text-emerald-600" />
          <ChaiItem emoji="⛽" value={Math.round(totalSpent / 105)} label="Litres Petrol" color="bg-purple-50 border-purple-100 text-purple-600" />
        </div>
      </div>

      <div className="glass-card p-6 rounded-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-display font-bold text-sm">Income vs Expense vs Savings</h3>
          <div className="flex gap-3 text-[10px] font-bold">
            <span className="flex items-center gap-1 text-emerald-600"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Income</span>
            <span className="flex items-center gap-1 text-red-600"><div className="w-2 h-2 rounded-full bg-red-500"></div> Expense</span>
            <span className="flex items-center gap-1 text-purple-600"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Savings</span>
          </div>
        </div>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }}
                tickFormatter={(v) => `₹${v/1000}k`}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                cursor={{ fill: '#f8fafc' }}
              />
              <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} barSize={12} />
              <Bar dataKey="expense" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={12} />
              <Bar dataKey="savings" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatItem label="Total Income" value={formatCurrency(totalIncome)} color="text-emerald-600" />
        <StatItem label="Total Spend" value={formatCurrency(totalSpent)} color="text-red-600" />
        <StatItem label="Total Savings" value={formatCurrency(Math.max(0, totalIncome - totalSpent))} color="text-purple-600" />
        <StatItem label="Savings Rate" value={`${savingsRate}%`} color="text-amber-600" />
      </div>

      <SubscriptionManager transactions={transactions} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-2xl">
          <h3 className="font-display font-bold text-sm mb-6">Spending by Category</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData.length > 0 ? categoryData : [{ name: 'No Data', value: 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.length > 0 ? categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  )) : <Cell fill="#f1f5f9" />}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl">
          <h3 className="font-display font-bold text-sm mb-6">Portfolio Allocation</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={portfolioData.length > 0 ? portfolioData : [{ name: 'No Data', value: 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {portfolioData.length > 0 ? portfolioData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  )) : <Cell fill="#f1f5f9" />}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="glass-card p-4 rounded-2xl">
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className={cn("font-display font-extrabold text-lg", color)}>{value}</p>
    </div>
  );
}

function HealthMetric({ label, score, color }: { label: string, score: number, color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-bold">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-900">{score}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${score}%` }}></div>
      </div>
    </div>
  );
}

function ChaiItem({ emoji, value, label, color }: { emoji: string, value: string | number, label: string, color?: string }) {
  return (
    <div className={cn("p-3 rounded-2xl border text-center", color || "bg-amber-50 border-amber-100 text-amber-600")}>
      <div className="text-xl mb-1">{emoji}</div>
      <div className="font-display font-black text-sm">{value}</div>
      <div className="text-[8px] font-bold text-slate-500 uppercase tracking-tight leading-none mt-1">{label}</div>
    </div>
  );
}
