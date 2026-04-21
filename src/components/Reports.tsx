import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Search, 
  Calendar, 
  Filter,
  ArrowLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  ReceiptIndianRupee
} from 'lucide-react';
import { Transaction } from '../types';
import { formatCurrency, cn } from '../lib/utils';

interface ReportsProps {
  transactions: Transaction[];
  onBack: () => void;
}

type Period = 'week' | 'month' | 'year' | 'last30' | 'custom';

export default function Reports({ transactions, onBack }: ReportsProps) {
  const [period, setPeriod] = useState<Period>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (period === 'week') {
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
    } else if (period === 'last30') {
      start.setDate(now.getDate() - 30);
    } else if (period === 'custom' && customStart && customEnd) {
      start = new Date(customStart);
      end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
    }

    return transactions.filter(t => {
      const d = new Date(t.date);
      if (period === 'custom') {
        return d >= start && d <= end;
      }
      return d >= start;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, period, customStart, customEnd]);

  const summary = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      if (t.type === 'income') acc.income += t.amount;
      else acc.expense += Math.abs(t.amount);
      return acc;
    }, { income: 0, expense: 0 });
  }, [filteredTransactions]);

  const handleDownload = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="font-display font-extrabold text-2xl tracking-tight text-slate-900 flex items-center gap-3">
            <FileText className="text-indigo-600" />
            Financial Reports
          </h2>
        </div>
        <button 
          onClick={handleDownload}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-display font-bold shadow-md shadow-indigo-100 flex items-center gap-2 hover:bg-indigo-700 transition-all"
        >
          <Download size={14} /> Download PDF
        </button>
      </div>

      {/* Period Selector */}
      <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-100 border border-slate-50">
        <div className="flex flex-wrap gap-2 mb-6">
          {(['week', 'month', 'year', 'last30', 'custom'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                period === p 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              )}
            >
              {p === 'last30' ? 'Last 30 Days' : p}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="grid grid-cols-2 gap-4 mb-6 animate-in slide-in-from-top-2 duration-300">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Start Date</label>
              <input 
                type="date" 
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">End Date</label>
              <input 
                type="date" 
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Income</p>
            <p className="font-display font-extrabold text-lg text-emerald-600">{formatCurrency(summary.income)}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Expenses</p>
            <p className="font-display font-extrabold text-lg text-red-600">{formatCurrency(summary.expense)}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Net Flow</p>
            <p className={cn(
              "font-display font-extrabold text-lg",
              summary.income - summary.expense >= 0 ? "text-emerald-600" : "text-red-600"
            )}>
              {formatCurrency(summary.income - summary.expense)}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Count</p>
            <p className="font-display font-extrabold text-lg text-slate-900">{filteredTransactions.length}</p>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-[32px] overflow-hidden shadow-xl shadow-slate-100 border border-slate-50 print:shadow-none print:border-none">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
          <h3 className="font-display font-bold text-sm text-slate-700">Detailed Statement</h3>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {period === 'custom' ? `${customStart} to ${customEnd}` : `Period: ${period.toUpperCase()}`}
          </span>
        </div>
        
        <div className="divide-y divide-slate-50">
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-4 p-4 hover:bg-slate-50/50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xl shrink-0">
                  {tx.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-900 truncate">{tx.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                    {tx.category} · {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "font-display font-black text-sm",
                    tx.amount > 0 ? "text-emerald-600" : "text-slate-900"
                  )}>
                    {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                  </p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase">{tx.type}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl text-slate-300">
                📭
              </div>
              <p className="text-sm font-bold text-slate-400 italic font-display">No transactions found for this period.</p>
            </div>
          )}
        </div>

        {filteredTransactions.length > 0 && (
          <div className="px-6 py-6 bg-slate-50 flex justify-between items-center">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">End of Statement</div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Net Balance</p>
              <p className={cn(
                "font-display font-black text-xl",
                summary.income - summary.expense >= 0 ? "text-emerald-600" : "text-red-600"
              )}>
                {formatCurrency(summary.income - summary.expense)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
