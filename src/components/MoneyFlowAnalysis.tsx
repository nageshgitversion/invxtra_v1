import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import { 
  Calendar, TrendingUp, ShoppingBag, ArrowUpRight, ArrowDownRight, 
  Zap, Clock, Filter, Trophy, ExternalLink, ShieldCheck, AlertTriangle,
  Plus, Trash2, Play, Pause, Save, X, Info
} from 'lucide-react';
import { Transaction, VarianceInsight, GuiltTaxRule, Account } from '../types';
import { cn, formatCurrency, formatCompactNumber } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useFirebase } from '../lib/FirebaseProvider';
import { db } from '../lib/firebase';
import { doc, setDoc, deleteDoc, collection } from 'firebase/firestore';

interface MoneyFlowProps {
  transactions: Transaction[];
  onBack?: () => void;
  initialTimeRange?: TimeRange;
}

type TimeRange = 'Yesterday' | 'This Week' | 'This Month' | 'Year to Date';

export default function MoneyFlowAnalysis({ transactions, onBack, initialTimeRange }: MoneyFlowProps) {
  const { user, guiltTaxRules, accounts } = useFirebase();
  const [timeRange, setTimeRange] = useState<TimeRange>(initialTimeRange || 'This Month');
  const [activeTab, setActiveTab] = useState<'timeline' | 'leaderboards' | 'rules'>('timeline');
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [newRule, setNewRule] = useState<Partial<GuiltTaxRule>>({
    category: 'Dining',
    limit: 5000,
    taxRate: 0.1,
    active: true
  });

  const savingsAccounts = accounts.filter(a => ['savings', 'fd', 'rd', 'ppf'].includes(a.type));

  const handleSaveRule = async () => {
    if (!user || !newRule.category || !newRule.limit || !newRule.targetAccountId) return;
    
    const ruleId = `rule_${Date.now()}`;
    const ruleRef = doc(db, 'guiltTaxRules', ruleId);
    await setDoc(ruleRef, {
      ...newRule,
      id: ruleId,
      uid: user.uid,
      totalTaxed: 0
    });
    setIsAddingRule(false);
  };

  const toggleRule = async (rule: GuiltTaxRule) => {
    const ruleRef = doc(db, 'guiltTaxRules', rule.id);
    await setDoc(ruleRef, { ...rule, active: !rule.active }, { merge: true });
  };

  const deleteRule = async (ruleId: string) => {
    const ruleRef = doc(db, 'guiltTaxRules', ruleId);
    await deleteDoc(ruleRef);
  };

  // 1. TIME-SLICE DASHBOARD LOGIC
  const filteredData = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return transactions.filter(t => {
      const txDate = new Date(t.date);
      switch(timeRange) {
        case 'Yesterday':
          const yesterday = new Date(startOfToday);
          yesterday.setDate(yesterday.getDate() - 1);
          return txDate.toDateString() === yesterday.toDateString();
        case 'This Week':
          const weekStart = new Date(startOfToday);
          weekStart.setDate(weekStart.getDate() - now.getDay());
          return txDate >= weekStart;
        case 'This Month':
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          return txDate >= monthStart;
        case 'Year to Date':
          const yearStart = new Date(now.getFullYear(), 0, 1);
          return txDate >= yearStart;
        default: return true;
      }
    });
  }, [transactions, timeRange]);

  const stats = useMemo(() => {
    const spent = filteredData.filter(t => t.type === 'expense' || t.type === 'debt').reduce((acc, t) => acc + Math.abs(t.amount), 0);
    const income = filteredData.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    
    const categories = filteredData.reduce((acc, t) => {
      if (t.type === 'expense' || t.type === 'debt') {
        acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
      }
      return acc;
    }, {} as Record<string, number>);

    const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0] || ['None', 0];

    return { spent, income, topCategory };
  }, [filteredData]);

  const historyChartData = useMemo(() => {
    // Group filteredData by date for line chart
    const groups = filteredData.reduce((acc, t) => {
      const date = t.date;
      acc[date] = (acc[date] || 0) + (t.type === 'expense' || t.type === 'debt' ? Math.abs(t.amount) : 0);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(groups)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredData]);

  // 2. MERCHANT / PLATFORM LEADERBOARDS
  const platformLeaderboard = useMemo(() => {
    const merchants = filteredData.reduce((acc, t) => {
      if (t.type === 'expense' || t.type === 'debt') {
        const key = t.merchant || t.name.split(' ')[0] || 'Unknown';
        acc[key] = (acc[key] || 0) + Math.abs(t.amount);
      }
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(merchants)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [filteredData]);

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-black text-slate-900 tracking-tight">Active Financial Engine</h2>
          <p className="text-sm text-slate-500 font-medium">Real-time money flow and behavioral analysis</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
          {['timeline', 'leaderboards', 'rules'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                activeTab === tab ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'timeline' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          {/* Time Range Selector */}
          <div className="flex bg-slate-100 p-1.5 rounded-[24px] w-fit">
            {['Yesterday', 'This Week', 'This Month', 'Year to Date'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range as TimeRange)}
                className={cn(
                  "px-4 py-2.5 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all",
                  timeRange === range ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-500"
                )}
              >
                {range}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard 
              label="Total Burn Rate" 
              value={formatCurrency(stats.spent)} 
              icon={<ArrowDownRight className="text-red-500" />}
              subLabel={`Across ${filteredData.length} items`}
            />
            <StatCard 
              label="Top Hemorrhage" 
              value={stats.topCategory[0]} 
              icon={<ShieldCheck className="text-indigo-500" />}
              subLabel={formatCurrency(stats.topCategory[1] as number)}
              highlight={true}
            />
            <StatCard 
              label="Active Income" 
              value={formatCurrency(stats.income)} 
              icon={<ArrowUpRight className="text-emerald-500" />}
              subLabel="Inflow detected"
            />
          </div>

          {/* Cash Burn Line Chart */}
          <div className="bg-white border border-slate-100 p-8 rounded-[40px] shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="font-display font-bold text-xl text-slate-900">Burn Analytics</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Spending velocity over time</p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 text-slate-400">
                <TrendingUp size={20} />
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyChartData}>
                  <defs>
                    <linearGradient id="burnGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                    tickFormatter={(str) => {
                      const d = new Date(str);
                      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                    }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                    tickFormatter={(val) => `₹${val}`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                    formatter={(val: number) => [formatCurrency(val), 'Spent']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#6366f1" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#burnGradient)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'leaderboards' && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Merchant Leaderboard */}
          <div className="bg-white border border-slate-100 p-8 rounded-[40px] shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500">
                <Trophy size={20} />
              </div>
              <div>
                <h3 className="font-display font-bold text-xl text-slate-900">Platform Leaderboard</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Where your money flows most</p>
              </div>
            </div>
            
            <div className="space-y-6">
              {platformLeaderboard.map(([merchant, amount], index) => (
                <div key={merchant} className="flex items-center gap-4 group">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center font-display font-black text-xs",
                    index === 0 ? "bg-amber-100 text-amber-600" : 
                    index === 1 ? "bg-slate-100 text-slate-600" :
                    index === 2 ? "bg-orange-100 text-orange-600" : "bg-slate-50 text-slate-400"
                  )}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-end mb-1">
                      <span className="font-display font-bold text-slate-900">{merchant}</span>
                      <span className="font-display font-black text-slate-900">{formatCurrency(amount)}</span>
                    </div>
                    <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(amount / platformLeaderboard[0][1]) * 100}%` }}
                        className={cn(
                          "h-full rounded-full transition-all duration-1000",
                          index === 0 ? "bg-amber-500" : "bg-indigo-500"
                        )}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Simple Sankey Approximation using Flex/Bars */}
          <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-xl">
             <div className="flex items-center gap-3 mb-12">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-indigo-400">
                <Filter size={20} />
              </div>
              <div>
                <h3 className="font-display font-bold text-xl text-white">Flow Visualization</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Income → Category → Merchant</p>
              </div>
            </div>

            <div className="flex justify-between h-[300px]">
              {/* Income Column */}
              <div className="flex flex-col justify-center gap-2 w-24">
                <p className="text-[8px] font-black uppercase text-slate-500 mb-2 text-center">Inflow</p>
                <div className="bg-emerald-500/20 border border-emerald-500/30 p-3 rounded-2xl text-center">
                  <p className="text-[10px] font-black text-emerald-400">INCOME</p>
                </div>
              </div>
              
              <div className="flex-1 flex items-center">
                <div className="w-full h-px bg-gradient-to-r from-emerald-500/20 via-indigo-500/20 to-amber-500/20"></div>
              </div>

              {/* Categories Column */}
              <div className="flex flex-col justify-center gap-4 w-32">
                <p className="text-[8px] font-black uppercase text-slate-500 mb-2 text-center">Categories</p>
                {stats.spent > 0 ? Object.entries(
                  filteredData.reduce((acc, t) => {
                    if (t.type === 'expense' || t.type === 'debt') {
                      acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
                    }
                    return acc;
                  }, {} as Record<string, number>)
                ).sort((a,b) => b[1]-a[1]).slice(0, 3).map(([cat, amt]) => (
                  <div key={cat} className="bg-indigo-500/10 border border-indigo-500/20 p-2 rounded-xl text-center">
                    <p className="text-[9px] font-bold text-indigo-300 truncate">{cat}</p>
                  </div>
                )) : (
                  <p className="text-[10px] text-slate-600 text-center italic">No data</p>
                )}
              </div>

              <div className="flex-1 flex items-center">
                <div className="w-full h-px bg-gradient-to-r from-indigo-500/20 to-amber-500/20"></div>
              </div>

              {/* Merchants Column */}
              <div className="flex flex-col justify-center gap-3 w-28">
                <p className="text-[8px] font-black uppercase text-slate-500 mb-2 text-center">Platforms</p>
                {platformLeaderboard.slice(0, 4).map(([m]) => (
                   <div key={m} className="bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl text-center">
                    <p className="text-[9px] font-bold text-amber-300 truncate">{m}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-display font-black text-slate-900">Guilt Tax Engine</h3>
              <p className="text-slate-500 font-medium mt-1">Behavioral rules that penalize overspending into savings.</p>
            </div>
            <button 
              onClick={() => setIsAddingRule(true)}
              className="bg-indigo-600 text-white font-display font-bold px-6 py-3 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
            >
              <Plus size={18} /> New Rule
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence>
              {isAddingRule && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white border-2 border-indigo-200 p-8 rounded-[40px] shadow-xl relative"
                >
                  <button onClick={() => setIsAddingRule(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600">
                    <X size={20} />
                  </button>
                  <h4 className="font-display font-black text-lg mb-6">Create New Rule</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block">Category</label>
                      <select 
                        value={newRule.category}
                        onChange={(e) => setNewRule({...newRule, category: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 p-3.5 rounded-2xl text-sm font-bold"
                      >
                        {['Dining', 'Shopping', 'Travel', 'Entertainment', 'Groceries', 'Personal'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block">Monthly Limit (₹)</label>
                      <input 
                        type="number" 
                        value={newRule.limit}
                        onChange={(e) => setNewRule({...newRule, limit: Number(e.target.value)})}
                        className="w-full bg-slate-50 border border-slate-100 p-3.5 rounded-2xl text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block">Guilt Tax Rate (%)</label>
                      <input 
                        type="number" 
                        value={(newRule.taxRate || 0) * 100}
                        onChange={(e) => setNewRule({...newRule, taxRate: Number(e.target.value) / 100})}
                        className="w-full bg-slate-50 border border-slate-100 p-3.5 rounded-2xl text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block">Target Savings Account</label>
                      <select 
                        value={newRule.targetAccountId}
                        onChange={(e) => setNewRule({...newRule, targetAccountId: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 p-3.5 rounded-2xl text-sm font-bold"
                      >
                        <option value="">Select Account</option>
                        {savingsAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.bank})</option>)}
                      </select>
                    </div>
                    <button 
                      onClick={handleSaveRule}
                      className="w-full bg-indigo-600 text-white font-display font-bold py-4 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 mt-4 flex items-center justify-center gap-2"
                    >
                      <Save size={18} /> Enable Guilt Tax
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {guiltTaxRules.map((rule) => {
              const targetAcc = accounts.find(a => a.id === rule.targetAccountId);
              return (
                <motion.div 
                  key={rule.id}
                  className={cn(
                    "p-8 rounded-[40px] border transition-all",
                    rule.active ? "bg-white border-slate-100 shadow-sm" : "bg-slate-50 border-slate-100 grayscale opacity-60"
                  )}
                >
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <ShieldCheck size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{rule.category}</p>
                        <h4 className="font-display font-black text-lg">₹{formatCompactNumber(rule.limit)} limit</h4>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <button 
                        onClick={() => toggleRule(rule)}
                        className={cn("p-2.5 rounded-xl transition-all", rule.active ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600")}
                      >
                        {rule.active ? <Pause size={18} /> : <Play size={18} />}
                      </button>
                      <button 
                        onClick={() => deleteRule(rule.id)}
                        className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Tax Rate</span>
                      <span className="font-black text-slate-900">{rule.taxRate * 100}%</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Auto-Transfer to</span>
                      <span className="font-black text-indigo-600">{targetAcc?.name || 'Unknown'}</span>
                    </div>
                    <div className="pt-4 border-t border-slate-50">
                      <div className="flex justify-between items-end">
                        <p className="text-[10px] font-black uppercase text-slate-400">Total Taxed Saved</p>
                        <p className="font-display font-black text-emerald-600 text-xl">{formatCurrency(rule.totalTaxed || 0)}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {guiltTaxRules.length === 0 && !isAddingRule && (
              <div className="col-span-full p-20 text-center bg-slate-50 rounded-[48px] border-2 border-dashed border-slate-200">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-200 mx-auto mb-6">
                  <Info size={32} />
                </div>
                <h4 className="font-display font-black text-xl text-slate-400">No active behavioral rules</h4>
                <p className="text-slate-400 text-sm mt-1">PENALIZE OVERSPENDING, FUEL YOUR SAVINGS.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, subLabel, highlight }: { label: string, value: string, icon: React.ReactNode, subLabel: string, highlight?: boolean }) {
  return (
    <div className={cn(
      "p-8 rounded-[40px] border transition-all",
      highlight ? "bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-100" : "bg-white border-slate-100 text-slate-900 shadow-sm"
    )}>
      <div className="flex items-center justify-between mb-8">
        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</p>
        <div className={cn("p-2.5 rounded-2xl", highlight ? "bg-white/20" : "bg-slate-50")}>
          {icon}
        </div>
      </div>
      <h4 className="text-3xl font-display font-black mb-1">{value}</h4>
      <p className="text-xs font-bold opacity-60">{subLabel}</p>
    </div>
  );
}
