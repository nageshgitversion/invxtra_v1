import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  Info, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  TrendingDown, 
  ShieldCheck, 
  Zap,
  ArrowUpRight,
  HelpCircle,
  PieChart as PieChartIcon,
  BarChart3
} from 'lucide-react';
import { TaxProfile, TaxRegime } from '../types';
import { cn, formatCurrency, formatCompactNumber } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ReTooltip, 
  ResponsiveContainer, 
  Cell,
  Legend
} from 'recharts';

export default function TaxPlanner() {
  const [profile, setProfile] = useState<TaxProfile>({
    regime: 'new',
    annualIncome: 1200000,
    deductions80C: 150000,
    deductions80D: 25000,
    hra: 0,
    otherDeductions: 0,
    ltcg: 0,
    stcg: 0,
    age: 30,
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'optimize' | 'slabs'>('overview');

  const calculateTax = (income: number, regime: TaxRegime, deductions: number, age: number) => {
    let tax = 0;
    
    if (regime === 'new') {
      // New Regime FY 2024-25 (Budget 2024)
      const stdDed = 75000;
      const finalIncome = Math.max(0, income - stdDed);
      
      if (finalIncome <= 700000) return 0; // Rebate 87A

      // Slabs: 0-3L (0%), 3-7L (5%), 7-10L (10%), 10-12L (15%), 12-15L (20%), 15L+ (30%)
      if (finalIncome > 1500000) tax += (finalIncome - 1500000) * 0.30 + 140000;
      else if (finalIncome > 1200000) tax += (finalIncome - 1200000) * 0.20 + 80000;
      else if (finalIncome > 1000000) tax += (finalIncome - 1000000) * 0.15 + 50000;
      else if (finalIncome > 700000) tax += (finalIncome - 700000) * 0.10 + 20000;
      else if (finalIncome > 300000) tax += (finalIncome - 300000) * 0.05;
      
      return tax * 1.04; // 4% Cess
    } else {
      // Old Regime FY 2024-25
      const stdDed = 50000;
      const finalIncome = Math.max(0, income - stdDed - deductions);
      
      if (finalIncome <= 500000) return 0; // Rebate 87A

      // Slabs: 0-2.5L (0%), 2.5-5L (5%), 5-10L (20%), 10L+ (30%)
      // Note: Senior citizen slabs differ slightly (3L/5L exemption)
      const exemption = age >= 80 ? 500000 : age >= 60 ? 300000 : 250000;

      if (finalIncome > 1000000) tax += (finalIncome - 1000000) * 0.30 + 112500;
      else if (finalIncome > 500000) tax += (finalIncome - 500000) * 0.20 + 12500;
      else if (finalIncome > exemption) tax += (finalIncome - exemption) * 0.05;

      return tax * 1.04;
    }
  };

  const totalOldDeductions = profile.deductions80C + profile.deductions80D + profile.hra + profile.otherDeductions;
  const oldTax = calculateTax(profile.annualIncome, 'old', totalOldDeductions, profile.age);
  const newTax = calculateTax(profile.annualIncome, 'new', 0, profile.age);
  
  const ltcgTax = Math.max(0, profile.ltcg - 125000) * 0.125;
  const stcgTax = profile.stcg * 0.20;
  const totalCapitalGainsTax = (ltcgTax + stcgTax) * 1.04;

  const savings = Math.abs(oldTax - newTax);
  const recommended = oldTax < newTax ? 'old' : 'new';

  const chartData = [
    { name: 'Old Regime', tax: Math.round(oldTax), color: '#6366f1' },
    { name: 'New Regime', tax: Math.round(newTax), color: '#10b981' },
  ];

  // Optimization Logic: How much more do you need to save to make Old Regime better?
  const optimizationTips = useMemo(() => {
    const tips = [];
    if (profile.deductions80C < 150000) {
      tips.push({
        section: '80C',
        gap: 150000 - profile.deductions80C,
        label: 'ELSS, PPF, or LIC',
        impact: (150000 - profile.deductions80C) * 0.3 // Assuming 30% bracket
      });
    }
    if (profile.deductions80D < (profile.age >= 60 ? 50000 : 25000)) {
      const limit = profile.age >= 60 ? 50000 : 25000;
      tips.push({
        section: '80D',
        gap: limit - profile.deductions80D,
        label: 'Health Insurance',
        impact: (limit - profile.deductions80D) * 0.3
      });
    }
    return tips;
  }, [profile]);

  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-3xl font-display font-black text-slate-900 tracking-tight">Tax Command Center</h2>
            <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">FY 2024-25</span>
          </div>
          <p className="text-sm text-slate-500 font-medium">Advanced tax projection and optimization for Indian Citizens</p>
        </div>
        <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar max-w-full">
          {['overview', 'optimize', 'slabs'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={cn(
                "px-3 md:px-4 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                activeTab === tab ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'overview' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8"
        >
          {/* Main Analysis */}
          <div className="lg:col-span-8 space-y-8">
            {/* Recommendation Card */}
            <section className={cn(
              "relative overflow-hidden rounded-[48px] p-8 md:p-12 text-white shadow-2xl transition-all duration-500",
              recommended === 'new' 
                ? "bg-gradient-to-br from-emerald-600 to-teal-700" 
                : "bg-gradient-to-br from-indigo-600 to-violet-700"
            )}>
              <div className="relative z-10 flex flex-col md:flex-row justify-between gap-10">
                <div className="space-y-8 max-w-md">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-xl border border-white/20 shadow-inner">
                      <Zap size={24} className="text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70">invxtra Advisor</p>
                      <p className="text-xs font-bold">Smart Tax Strategy</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-4xl md:text-6xl font-display font-black leading-[0.9] tracking-tight">
                      Go with <span className="text-white/90">{recommended.toUpperCase()}</span>
                    </h3>
                    <p className="text-lg font-medium text-white/80">It's the most tax-efficient choice for your profile.</p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="bg-white/10 px-6 py-3 rounded-[24px] backdrop-blur-xl border border-white/10 shadow-lg">
                      <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Yearly Savings</p>
                      <p className="text-3xl font-display font-black text-white">{formatCurrency(savings)}</p>
                    </div>
                    <div className="bg-white/10 px-6 py-3 rounded-[24px] backdrop-blur-xl border border-white/10 shadow-lg">
                      <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Tax Rate</p>
                      <p className="text-3xl font-display font-black text-white">
                        {Math.round(((recommended === 'new' ? newTax : oldTax) / profile.annualIncome) * 100)}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-h-[250px] bg-black/10 rounded-[40px] p-6 backdrop-blur-md border border-white/5 shadow-inner relative group">
                  <div className="absolute top-4 left-6 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Live Projection</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 40, right: 20, left: 0, bottom: 0 }}>
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 800 }} 
                      />
                      <ReTooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-2xl">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{payload[0].payload.name}</p>
                                <p className="text-lg font-display font-black text-white">{formatCurrency(payload[0].value as number)}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="tax" radius={[12, 12, 0, 0]} barSize={50}>
                        {chartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.name.includes(recommended.charAt(0).toUpperCase() + recommended.slice(1)) ? '#fff' : 'rgba(255,255,255,0.2)'} 
                            className="transition-all duration-500"
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Abstract background shapes */}
              <div className="absolute -top-24 -left-24 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-black/10 rounded-full blur-3xl pointer-events-none"></div>
            </section>

            {/* Input Grid */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div className="bg-white border border-slate-100 p-6 md:p-10 rounded-[32px] md:rounded-[48px] space-y-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
                    <PieChartIcon size={24} />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-xl text-slate-900">Income Profile</h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Earnings</p>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Annual Gross Salary</label>
                    <div className="relative group">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xl group-focus-within:text-indigo-600 transition-colors">₹</span>
                      <input 
                        type="number" 
                        value={profile.annualIncome}
                        onChange={(e) => setProfile({...profile, annualIncome: Number(e.target.value)})}
                        className="w-full bg-slate-50 border-2 border-transparent rounded-[24px] pl-10 pr-6 py-4 md:py-5 font-display font-black text-xl md:text-2xl focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Age</label>
                      <input 
                        type="number" 
                        value={profile.age}
                        onChange={(e) => setProfile({...profile, age: Number(e.target.value)})}
                        className="w-full bg-slate-50 border-2 border-transparent rounded-[24px] px-6 py-4 md:py-5 font-display font-black text-xl md:text-2xl focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">HRA Exemption</label>
                      <input 
                        type="number" 
                        value={profile.hra}
                        onChange={(e) => setProfile({...profile, hra: Number(e.target.value)})}
                        className="w-full bg-slate-50 border-2 border-transparent rounded-[24px] px-6 py-4 md:py-5 font-display font-black text-xl md:text-2xl focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">LTCG (Equity)</label>
                      <input 
                        type="number" 
                        value={profile.ltcg}
                        onChange={(e) => setProfile({...profile, ltcg: Number(e.target.value)})}
                        className="w-full bg-amber-50/50 border-2 border-transparent rounded-[24px] px-6 py-4 md:py-5 font-display font-black text-xl md:text-2xl focus:bg-white focus:border-amber-100 focus:ring-4 focus:ring-amber-500/5 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">STCG (Equity)</label>
                      <input 
                        type="number" 
                        value={profile.stcg}
                        onChange={(e) => setProfile({...profile, stcg: Number(e.target.value)})}
                        className="w-full bg-amber-50/50 border-2 border-transparent rounded-[24px] px-6 py-4 md:py-5 font-display font-black text-xl md:text-2xl focus:bg-white focus:border-amber-100 focus:ring-4 focus:ring-amber-500/5 transition-all outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-100 p-6 md:p-10 rounded-[32px] md:rounded-[48px] space-y-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-xl text-slate-900">Deductions</h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Old Regime Benefits</p>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Section 80C</label>
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Limit: ₹1.5L</span>
                    </div>
                    <input 
                      type="number" 
                      value={profile.deductions80C}
                      max={150000}
                      onChange={(e) => setProfile({...profile, deductions80C: Math.min(150000, Number(e.target.value))})}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-[24px] px-6 py-4 md:py-5 font-display font-black text-xl md:text-2xl focus:bg-white focus:border-emerald-100 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Section 80D</label>
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Limit: {profile.age >= 60 ? '₹50k' : '₹25k'}</span>
                    </div>
                    <input 
                      type="number" 
                      value={profile.deductions80D}
                      onChange={(e) => setProfile({...profile, deductions80D: Number(e.target.value)})}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-[24px] px-6 py-4 md:py-5 font-display font-black text-xl md:text-2xl focus:bg-white focus:border-emerald-100 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">NPS (80CCD(1B))</label>
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Limit: ₹50k</span>
                    </div>
                    <input 
                      type="number" 
                      value={profile.otherDeductions}
                      onChange={(e) => setProfile({...profile, otherDeductions: Number(e.target.value)})}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-[24px] px-6 py-4 md:py-5 font-display font-black text-xl md:text-2xl focus:bg-white focus:border-emerald-100 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar Insights */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-slate-900 rounded-[48px] p-8 text-white shadow-2xl relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Optimization Hub</h4>
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-indigo-400">
                    <Zap size={16} />
                  </div>
                </div>
                
                <div className="space-y-6">
                  {optimizationTips.length > 0 ? optimizationTips.map((tip, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="p-6 rounded-[32px] bg-white/5 border border-white/10 space-y-4 hover:bg-white/10 transition-all cursor-pointer group/tip"
                    >
                      <div className="flex justify-between items-start">
                        <span className="bg-indigo-500/20 text-indigo-300 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-indigo-500/20">Section {tip.section}</span>
                        <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-black">
                          <ArrowUpRight size={12} />
                          SAVE {formatCompactNumber(tip.impact)}
                        </div>
                      </div>
                      <p className="text-sm font-medium text-slate-300 leading-relaxed">
                        Invest <span className="text-white font-bold">{formatCurrency(tip.gap)}</span> in {tip.label} to maximize savings.
                      </p>
                      <div className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest group-hover/tip:gap-3 transition-all">
                        View Products <ArrowRight size={12} />
                      </div>
                    </motion.div>
                  )) : (
                    <div className="text-center py-12 space-y-4">
                      <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-400 border border-emerald-500/20 shadow-inner">
                        <CheckCircle2 size={40} />
                      </div>
                      <div>
                        <p className="text-lg font-display font-black text-white">Fully Optimized!</p>
                        <p className="text-xs text-slate-500 mt-1">You're making the most of your tax benefits.</p>
                      </div>
                    </div>
                  )}

                  <div className="pt-8 border-t border-white/10">
                    <div className="flex items-center justify-between mb-6">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Capital Gains Liability</p>
                      <span className="text-amber-400 text-sm font-black">{formatCurrency(totalCapitalGainsTax)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-[24px] bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">LTCG (12.5%)</p>
                        <p className="text-sm font-black text-white">{formatCurrency(ltcgTax)}</p>
                      </div>
                      <div className="p-4 rounded-[24px] bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">STCG (20%)</p>
                        <p className="text-sm font-black text-white">{formatCurrency(stcgTax)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>
            </div>

            <div className="bg-white border border-slate-100 p-8 rounded-[48px] space-y-8 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <TrendingDown size={20} />
                </div>
                <h4 className="font-display font-bold text-lg text-slate-900">Tax Checklist</h4>
              </div>
              <div className="space-y-5">
                <TaxCheckItem label="ELSS Mutual Funds (80C)" checked={profile.deductions80C >= 100000} />
                <TaxCheckItem label="PPF / EPF (80C)" checked={profile.deductions80C >= 150000} />
                <TaxCheckItem label="NPS Tier 1 (Extra 50k)" checked={profile.otherDeductions >= 50000} />
                <TaxCheckItem label="Health Insurance (80D)" checked={profile.deductions80D > 0} />
                <TaxCheckItem label="Term Life Insurance" checked={profile.deductions80C > 50000} />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'optimize' && (
        <div className="bg-white border border-slate-100 p-6 md:p-10 rounded-[32px] md:rounded-[48px] space-y-10 shadow-sm">
          <div className="max-w-2xl">
            <h3 className="text-2xl md:text-3xl font-display font-black text-slate-900 mb-4">Deduction Optimizer</h3>
            <p className="text-sm md:text-base text-slate-500 leading-relaxed">
              Use the sliders below to see how increasing your investments in different sections impacts your total tax liability under the Old Regime.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-black text-slate-900 uppercase tracking-widest">Section 80C Investment</label>
                  <span className="text-lg font-display font-black text-indigo-600">{formatCurrency(profile.deductions80C)}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="150000" 
                  step="5000"
                  value={profile.deductions80C}
                  onChange={(e) => setProfile({...profile, deductions80C: Number(e.target.value)})}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-[10px] font-bold text-slate-400">
                  <span>₹0</span>
                  <span>₹1.5 Lakhs</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-black text-slate-900 uppercase tracking-widest">Section 80D (Health)</label>
                  <span className="text-lg font-display font-black text-emerald-600">{formatCurrency(profile.deductions80D)}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max={profile.age >= 60 ? 50000 : 25000} 
                  step="1000"
                  value={profile.deductions80D}
                  onChange={(e) => setProfile({...profile, deductions80D: Number(e.target.value)})}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <div className="flex justify-between text-[10px] font-bold text-slate-400">
                  <span>₹0</span>
                  <span>{profile.age >= 60 ? '₹50k' : '₹25k'}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-black text-slate-900 uppercase tracking-widest">NPS (80CCD(1B))</label>
                  <span className="text-lg font-display font-black text-amber-600">{formatCurrency(profile.otherDeductions)}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="50000" 
                  step="5000"
                  value={profile.otherDeductions}
                  onChange={(e) => setProfile({...profile, otherDeductions: Number(e.target.value)})}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-amber-600"
                />
                <div className="flex justify-between text-[10px] font-bold text-slate-400">
                  <span>₹0</span>
                  <span>₹50k (Extra)</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-[32px] md:rounded-[40px] p-8 md:p-10 text-white flex flex-col justify-center items-center text-center space-y-6 relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">Current Old Regime Tax</p>
                <h3 className="text-4xl md:text-6xl font-display font-black text-white tracking-tighter mb-4">
                  {formatCurrency(oldTax)}
                </h3>
                <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-2xl border border-emerald-500/20">
                  <TrendingDown size={16} />
                  <span className="text-xs md:text-sm font-black tracking-tight">
                    {formatCurrency(calculateTax(profile.annualIncome, 'old', 0, profile.age) - oldTax)} Saved so far
                  </span>
                </div>
              </div>
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-600/10 to-transparent pointer-events-none"></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'slabs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="glass-card p-8 rounded-[40px] space-y-6">
            <h4 className="font-display font-bold text-lg">New Regime Slabs (FY 24-25)</h4>
            <div className="space-y-3">
              <SlabItem range="₹0 - ₹3 Lakhs" rate="0%" current={profile.annualIncome > 0} />
              <SlabItem range="₹3 - ₹7 Lakhs" rate="5%" current={profile.annualIncome > 300000} />
              <SlabItem range="₹7 - ₹10 Lakhs" rate="10%" current={profile.annualIncome > 700000} />
              <SlabItem range="₹10 - ₹12 Lakhs" rate="15%" current={profile.annualIncome > 1000000} />
              <SlabItem range="₹12 - ₹15 Lakhs" rate="20%" current={profile.annualIncome > 1200000} />
              <SlabItem range="₹15 Lakhs+" rate="30%" current={profile.annualIncome > 1500000} />
            </div>
            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
              <p className="text-[10px] text-indigo-600 font-bold leading-relaxed">
                * Standard Deduction of ₹75,000 is applicable for salaried individuals in the New Regime.
              </p>
            </div>
          </div>

          <div className="glass-card p-8 rounded-[40px] space-y-6">
            <h4 className="font-display font-bold text-lg">Old Regime Slabs (FY 24-25)</h4>
            <div className="space-y-3">
              <SlabItem range="₹0 - ₹2.5 Lakhs" rate="0%" current={profile.annualIncome > 0} />
              <SlabItem range="₹2.5 - ₹5 Lakhs" rate="5%" current={profile.annualIncome > 250000} />
              <SlabItem range="₹5 - ₹10 Lakhs" rate="20%" current={profile.annualIncome > 500000} />
              <SlabItem range="₹10 Lakhs+" rate="30%" current={profile.annualIncome > 1000000} />
            </div>
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
              <p className="text-[10px] text-amber-600 font-bold leading-relaxed">
                * Standard Deduction of ₹50,000 is applicable. Rebate u/s 87A is available up to ₹5 Lakhs taxable income.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaxCheckItem({ label, checked }: { label: string, checked: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        "w-6 h-6 rounded-xl flex items-center justify-center transition-all shadow-sm",
        checked ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-300"
      )}>
        <CheckCircle2 size={14} />
      </div>
      <span className={cn(
        "text-xs font-bold tracking-tight",
        checked ? "text-slate-900" : "text-slate-400"
      )}>{label}</span>
    </div>
  );
}

function SlabItem({ range, rate, current }: { range: string, rate: string, current: boolean }) {
  return (
    <div className={cn(
      "flex justify-between items-center p-4 rounded-2xl border transition-all",
      current ? "bg-white border-indigo-200 shadow-sm" : "bg-slate-50 border-transparent opacity-50"
    )}>
      <span className="text-xs font-bold text-slate-700">{range}</span>
      <span className={cn(
        "text-xs font-black",
        current ? "text-indigo-600" : "text-slate-400"
      )}>{rate}</span>
    </div>
  );
}
