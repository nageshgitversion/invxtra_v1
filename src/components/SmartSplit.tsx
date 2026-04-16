import React, { useState } from 'react';
import { formatCurrency, cn } from '../lib/utils';
import { Users, Plus, MessageSquare, Share2, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Split } from '../types';

interface SmartSplitProps {
  splits: Split[];
}

export default function SmartSplit({ splits }: SmartSplitProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [splitN, setSplitN] = useState(3);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const perPerson = amount ? Math.round(parseFloat(amount) / splitN) : 0;

  const netBalance = splits.reduce((acc, s) => acc + (s.type === 'owe_you' ? s.amount : -s.amount), 0);

  return (
    <div className="space-y-6">
      <div className="px-2 flex justify-between items-end">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Bill Splitting</p>
          <h2 className="font-display font-extrabold text-2xl">Smart Split</h2>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-indigo-200 flex items-center gap-2"
        >
          <Plus size={16} /> Split a Bill
        </button>
      </div>

      <div className="glass-card p-6 rounded-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-display font-bold text-sm">Recent Activity</h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Who owes whom</span>
        </div>

        <div className="space-y-4">
          {splits.length > 0 ? splits.map((split) => (
            <div key={split.id} className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-sm", split.color)}>
                {split.initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{split.name}</p>
                <p className="text-[10px] text-slate-400 font-medium">{split.desc} · {split.date}</p>
              </div>
              <div className="text-right">
                <p className={cn("font-display font-extrabold text-sm", split.type === 'owe_you' ? "text-emerald-600" : "text-red-600")}>
                  {split.type === 'owe_you' ? '+' : '-'}{formatCurrency(split.amount)}
                </p>
                <span className={cn(
                  "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                  split.type === 'owe_you' ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                )}>
                  {split.type === 'owe_you' ? 'Owes you' : 'You owe'}
                </span>
              </div>
            </div>
          )) : (
            <div className="p-10 text-center text-slate-400 text-sm font-medium">
              No recent split activity
            </div>
          )}
        </div>

        <div className={cn(
          "mt-6 p-4 rounded-2xl border flex items-center justify-between",
          netBalance >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center text-white",
              netBalance >= 0 ? "bg-emerald-500" : "bg-red-500"
            )}>
              {netBalance >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
            </div>
            <p className={cn("text-xs font-bold", netBalance >= 0 ? "text-emerald-900" : "text-red-900")}>Net Balance</p>
          </div>
          <p className={cn("font-display font-black text-lg", netBalance >= 0 ? "text-emerald-600" : "text-red-600")}>
            {netBalance >= 0 ? '+' : ''}{formatCurrency(netBalance)}
          </p>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-6 animate-in slide-in-from-bottom-full duration-300">
            <div className="flex justify-between items-center">
              <h3 className="font-display font-extrabold text-xl">Split a Bill</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">What was it for?</label>
                <input 
                  type="text" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Dinner at Barbeque Nation..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Total Amount (₹)</label>
                <input 
                  type="number" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Split between (people)</label>
                <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <button 
                    onClick={() => setSplitN(Math.max(2, splitN - 1))}
                    className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-600 font-bold"
                  >
                    -
                  </button>
                  <div className="flex-1 text-center font-display font-black text-xl">
                    {splitN}
                  </div>
                  <button 
                    onClick={() => setSplitN(splitN + 1)}
                    className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-600 font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              {amount && (
                <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 text-center space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Each person pays</p>
                  <p className="font-display font-black text-4xl text-indigo-600">{formatCurrency(perPerson)}</p>
                  <p className="text-[10px] font-bold text-indigo-400">Total {formatCurrency(parseFloat(amount))} ÷ {splitN} people</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-6 py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  alert(`Share on WhatsApp: ₹${perPerson} each for ${description}`);
                }}
                className="flex-[2] px-6 py-4 rounded-2xl bg-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
              >
                <Share2 size={18} /> Share via WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
