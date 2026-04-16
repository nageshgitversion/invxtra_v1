import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Calculator, TrendingUp, ArrowRight, Zap, Info, RefreshCw, Landmark } from 'lucide-react';
import { formatCurrency, formatCompactNumber, cn } from '../lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function ScenarioSimulator() {
  const [sip, setSip] = useState(10000);
  const [extraSip, setExtraSip] = useState(5000);
  const [years, setYears] = useState(10);
  const [expectedReturn, setExpectedReturn] = useState(12);
  const [currentCorpus, setCurrentCorpus] = useState(500000);

  const data = useMemo(() => {
    const chartData = [];
    let balanceNormal = currentCorpus;
    let balanceExtra = currentCorpus;
    const monthlyRate = expectedReturn / 12 / 100;

    for (let i = 0; i <= years; i++) {
      chartData.push({
        year: `Year ${i}`,
        normal: Math.round(balanceNormal),
        extra: Math.round(balanceExtra),
      });

      // Compound for 12 months
      for (let m = 0; m < 12; m++) {
        balanceNormal = (balanceNormal + sip) * (1 + monthlyRate);
        balanceExtra = (balanceExtra + sip + extraSip) * (1 + monthlyRate);
      }
    }
    return chartData;
  }, [sip, extraSip, years, expectedReturn, currentCorpus]);

  const finalNormal = data[data.length - 1].normal;
  const finalExtra = data[data.length - 1].extra;
  const difference = finalExtra - finalNormal;

  return (
    <div className="space-y-6">
      <div className="px-2 pt-2">
        <h2 className="font-display font-extrabold text-3xl text-slate-900 flex items-center gap-2">
          What-If Simulator 🚀
        </h2>
        <p className="text-slate-500 text-sm mt-1">Simulate your financial future with different investment scenarios.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6 rounded-[32px] space-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Settings2 size={14} />
                Parameters
              </h3>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Current Savings (₹)</label>
                <input 
                  type="number" 
                  value={currentCorpus} 
                  onChange={(e) => setCurrentCorpus(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Current Monthly SIP (₹)</label>
                <input 
                  type="number" 
                  value={sip} 
                  onChange={(e) => setSip(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Extra Monthly Contribution (₹)</label>
                <input 
                  type="number" 
                  value={extraSip} 
                  onChange={(e) => setExtraSip(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-100 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Years</label>
                  <input 
                    type="number" 
                    value={years} 
                    onChange={(e) => setYears(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Return (%)</label>
                  <input 
                    type="number" 
                    value={expectedReturn} 
                    onChange={(e) => setExpectedReturn(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-600 rounded-[32px] p-6 text-white shadow-xl shadow-indigo-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Zap size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Impact of Extra SIP</p>
                <h4 className="font-display font-bold text-lg">Wealth Multiplier</h4>
              </div>
            </div>
            <p className="text-3xl font-display font-black mb-1">+{formatCurrency(difference)}</p>
            <p className="text-xs opacity-70">Extra wealth created in {years} years</p>
          </div>
        </div>

        {/* Chart & Analysis */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 rounded-[32px] h-[400px]">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <TrendingUp size={14} />
              Growth Projection
            </h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} tickFormatter={(value) => formatCompactNumber(value)} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', paddingBottom: '20px' }} />
                <Line type="monotone" dataKey="normal" name="Current Plan" stroke="#94a3b8" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="extra" name="With Extra SIP" stroke="#6366f1" strokeWidth={4} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Landmark size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Final Corpus</p>
                <p className="text-xl font-display font-black text-slate-900">{formatCurrency(finalExtra)}</p>
              </div>
            </div>
            <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <RefreshCw size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Growth %</p>
                <p className="text-xl font-display font-black text-slate-900">
                  {Math.round(((finalExtra - (currentCorpus + (sip + extraSip) * 12 * years)) / (currentCorpus + (sip + extraSip) * 12 * years)) * 100)}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-3">
            <Info className="text-amber-500 shrink-0 mt-0.5" size={18} />
            <p className="text-xs text-amber-900 leading-relaxed">
              <span className="font-bold">CFA Insight:</span> Compounding works best with time. By adding just <span className="font-bold">{formatCurrency(extraSip)}</span> more every month, you are creating an additional <span className="font-bold">{formatCurrency(difference)}</span>. This is the power of disciplined investing in the Indian market context.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Settings2 } from 'lucide-react';
