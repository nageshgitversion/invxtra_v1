import React, { useState } from 'react';
import { formatCurrency, cn } from '../lib/utils';
import { CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { Wallet, FamilyGoal, Transaction } from '../types';

interface PlannerProps {
  wallet: Wallet | null;
  familyGoals: FamilyGoal[];
  transactions: Transaction[];
}

export default function Planner({ wallet, familyGoals, transactions }: PlannerProps) {
  const [regime, setRegime] = useState<'old' | 'new'>('new');

  const monthlyIncome = transactions
    .filter(t => !t.isRecurring && t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);
  const annualIncome = monthlyIncome * 12;

  // Simple tax calculation for demo purposes (India FY 2025-26 New Regime)
  const calculateTax = (income: number, type: 'old' | 'new') => {
    if (income <= 0) return 0;
    if (type === 'new') {
      // Very simplified new regime logic
      if (income <= 1200000) return 0; // Standard deduction + rebate
      return Math.round((income - 1200000) * 0.15); // Rough estimate
    } else {
      // Very simplified old regime logic
      if (income <= 500000) return 0;
      return Math.round((income - 500000) * 0.20); // Rough estimate
    }
  };

  const taxData = {
    old: { payable: calculateTax(annualIncome, 'old'), label: 'OLD REGIME' },
    new: { payable: calculateTax(annualIncome, 'new'), label: 'NEW REGIME' }
  };

  const savingsPotential = Math.max(0, taxData.old.payable - taxData.new.payable);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="px-1 sm:px-0 flex justify-between items-end gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">FY 2025-26</p>
          <h2 className="font-display font-extrabold text-2xl">Planner</h2>
        </div>
        <div className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
          Tax Planner
        </div>
      </div>

      <div className="glass-card p-6 rounded-2xl space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => setRegime('old')}
            className={cn(
              "p-4 rounded-2xl border-2 transition-all text-center",
              regime === 'old' ? "border-indigo-500 bg-indigo-50" : "border-slate-100 bg-slate-50"
            )}
          >
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">OLD REGIME</p>
            <p className={cn("font-display font-extrabold text-lg", regime === 'old' ? "text-indigo-900" : "text-slate-400")}>
              {formatCurrency(taxData.old.payable)}
            </p>
            <p className="text-[9px] font-bold text-slate-400 mt-1">Tax payable</p>
          </button>
          <button 
            onClick={() => setRegime('new')}
            className={cn(
              "p-4 rounded-2xl border-2 transition-all text-center relative overflow-hidden",
              regime === 'new' ? "border-indigo-500 bg-indigo-50" : "border-slate-100 bg-slate-50"
            )}
          >
            {regime === 'new' && taxData.new.payable <= taxData.old.payable && (
              <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] font-black px-2 py-0.5 rounded-bl-lg uppercase">
                Best
              </div>
            )}
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">NEW REGIME</p>
            <p className={cn("font-display font-extrabold text-lg", regime === 'new' ? "text-indigo-900" : "text-slate-400")}>
              {formatCurrency(taxData.new.payable)}
            </p>
            {savingsPotential > 0 && (
              <p className="text-[9px] font-bold text-emerald-600 mt-1">Save {formatCurrency(savingsPotential)} more</p>
            )}
          </button>
        </div>

        <div className="space-y-3 pt-4 border-t border-slate-100">
          <Row label="Annual Salary (Est.)" value={formatCurrency(annualIncome)} />
          <Row label="Standard Deduction" value={regime === 'new' ? "-₹75,000" : "-₹50,000"} color="text-emerald-600" />
          <Row label="Taxable Income" value={formatCurrency(Math.max(0, annualIncome - (regime === 'new' ? 75000 : 50000)))} isBold />
        </div>
      </div>

      <div className="glass-card p-6 rounded-2xl space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-display font-bold text-sm">80C Tracker</h3>
          <span className="bg-amber-100 text-amber-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
            ₹1,50,000 limit
          </span>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-bold text-slate-400">
            <span>Used: ₹0</span>
            <span>Limit: ₹1,50,000</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: '0%' }}></div>
          </div>
        </div>

        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
          <Zap className="text-amber-500 shrink-0" size={18} />
          <p className="text-xs font-medium text-amber-900 leading-relaxed">
            Invest in ELSS, PPF or NPS to reduce your taxable income under the Old Regime.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="px-2 flex justify-between items-center">
          <h3 className="font-display font-bold text-lg">🎯 Family Goals</h3>
        </div>
        
        <div className="space-y-3">
          {familyGoals.length > 0 ? familyGoals.map(goal => (
            <GoalItem 
              key={goal.id}
              icon="🎯" 
              name={goal.name} 
              saved={goal.saved} 
              target={goal.target} 
              eta={goal.eta} 
              color="bg-indigo-500" 
            />
          )) : (
            <div className="glass-card p-8 rounded-2xl text-center">
              <p className="text-slate-400 text-sm font-medium">No family goals set up yet.</p>
              <p className="text-[10px] text-slate-400 mt-1">Add them in the Savings tab.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, color, isBold }: { label: string, value: string, color?: string, isBold?: boolean }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-slate-500 font-medium">{label}</span>
      <span className={cn("font-display font-bold", color, isBold ? "text-sm" : "text-xs")}>{value}</span>
    </div>
  );
}

function GoalItem({ icon, name, saved, target, eta, color }: { icon: string, name: string, saved: number, target: number, eta: string, color: string }) {
  const pct = Math.round((saved / target) * 100);
  return (
    <div className="glass-card p-4 rounded-2xl flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-2xl shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-display font-bold text-sm truncate">{name}</h4>
          <span className="text-[10px] font-bold text-slate-400">{pct}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
          <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }}></div>
        </div>
        <div className="flex justify-between text-[10px] font-bold">
          <span className="text-slate-400">{formatCurrency(saved)} / {formatCurrency(target)}</span>
          <span className="text-indigo-600">ETA {eta}</span>
        </div>
      </div>
    </div>
  );
}
