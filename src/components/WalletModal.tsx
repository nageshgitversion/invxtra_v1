import React, { useState, useEffect } from 'react';
import { Wallet as WalletType, WalletEnvelope, Account, Transaction } from '../types';
import { useFirebase } from '../lib/FirebaseProvider';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { formatCurrency, cn, getMonthlyCommitment } from '../lib/utils';
import { Save, X, Calendar, Briefcase, Mail, Utensils, ShoppingCart, Car, ShoppingBag, Film, Box, Trash2, PlusCircle } from 'lucide-react';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: WalletType | null;
}

export default function WalletModal({ isOpen, onClose, wallet }: WalletModalProps) {
  const { user, transactions, accounts, holdings } = useFirebase();
  const [walletBalance, setWalletBalance] = useState<string>('');
  const [allocations, setAllocations] = useState<Record<string, { budget: number, spent: number, name: string, icon: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingEnvelope, setIsAddingEnvelope] = useState(false);
  const [newEnvName, setNewEnvName] = useState('');
  const [newEnvIcon, setNewEnvIcon] = useState('📦');
  const [newEnvBudget, setNewEnvBudget] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (wallet) {
        setWalletBalance(wallet.balance.toString());
        const initialAllocations: Record<string, { budget: number, spent: number, name: string, icon: string }> = {};
        Object.entries(wallet.envelopes).forEach(([key, env]) => {
          initialAllocations[key] = { 
            budget: env.budget, 
            spent: env.spent,
            name: env.name,
            icon: env.icon
          };
        });
        setAllocations(initialAllocations);
      } else {
        setWalletBalance('');
        setAllocations({
          'food': { name: 'Food', icon: '🍕', budget: 0, spent: 0 },
          'groceries': { name: 'Groceries', icon: '🛒', budget: 0, spent: 0 },
          'transport': { name: 'Transport', icon: '🚗', budget: 0, spent: 0 },
          'shopping': { name: 'Shopping', icon: '🛍️', budget: 0, spent: 0 },
          'entertainment': { name: 'Entertainment', icon: '🎬', budget: 0, spent: 0 },
          'others': { name: 'Others', icon: '📦', budget: 0, spent: 0 },
        });
      }
    }
  }, [wallet, isOpen]);

  if (!user) return null;

  const newBalance = Math.round(parseFloat(walletBalance) || 0);
  
  const recurringTransactions = transactions.filter(t => t.isRecurring && t.type !== 'income');
  const recurringTotal = Math.round(recurringTransactions.reduce((acc, t) => 
    acc + getMonthlyCommitment(t.amount, t.recurrence), 0));

  const envelopeTotal = Math.round(Object.values(allocations).reduce((acc, val) => acc + val.budget, 0));
  const newCommitted = recurringTotal;
  const newFree = newBalance - newCommitted;

  const handleAllocationChange = (key: string, value: number) => {
    setAllocations(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        budget: Math.max(0, value)
      }
    }));
  };

  const handleDeleteEnvelope = (key: string) => {
    const newAllocations = { ...allocations };
    delete newAllocations[key];
    setAllocations(newAllocations);
  };

  const handleAddEnvelope = () => {
    if (!newEnvName) return;
    const key = newEnvName.toLowerCase().replace(/\s+/g, '_');
    setAllocations(prev => ({
      ...prev,
      [key]: {
        name: newEnvName,
        icon: newEnvIcon,
        budget: parseFloat(newEnvBudget) || 0,
        spent: 0
      }
    }));
    setNewEnvName('');
    setNewEnvIcon('📦');
    setNewEnvBudget('');
    setIsAddingEnvelope(false);
  };

  const handleSave = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const walletRef = doc(db, 'wallets', user.uid);
      
      const updates: any = {
        active: true,
        balance: newBalance,
        free: newFree,
        committed: newCommitted,
        envelopes: {}
      };

      Object.entries(allocations).forEach(([key, data]) => {
        updates.envelopes[key] = {
          ...data,
          cat: data.name
        };
      });

      await setDoc(walletRef, updates, { merge: true });
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'wallets');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTargetName = (tx: Transaction) => {
    if (tx.linkedAcc) {
      const acc = accounts.find(a => a.id === tx.linkedAcc);
      if (acc) return acc.name;
    }
    // Check holdings if linkedAcc is not in accounts
    const holding = holdings.find(h => h.id === tx.linkedAcc);
    if (holding) return holding.name;
    
    return tx.category;
  };

  const getDaySuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1:  return "st";
      case 2:  return "nd";
      case 3:  return "rd";
      default: return "th";
    }
  };

  const now = new Date();
  const monthName = now.toLocaleString('default', { month: 'long' });
  const year = now.getFullYear();

  return (
    <div className="space-y-6 max-h-[85vh] overflow-y-auto no-scrollbar pr-1 -mr-1">
      {/* Wallet Balance */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
          <Briefcase size={14} className="text-slate-400" />
          Wallet Balance (₹)
        </label>
        <div className="relative">
          <input 
            type="number" 
            value={walletBalance}
            onChange={(e) => setWalletBalance(e.target.value)}
            placeholder="e.g. 115000"
            className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-lg font-bold placeholder:text-slate-300"
          />
        </div>
        <p className="text-[10px] text-slate-400 font-medium ml-1">Your current total cash available in wallet</p>
      </div>

      {/* For Month */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
          <Calendar size={14} className="text-slate-400" />
          For Month
        </label>
        <div className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 flex justify-between items-center">
          <span className="font-bold text-slate-700">{monthName} {year}</span>
          <Calendar size={18} className="text-slate-400" />
        </div>
      </div>

      {/* Budget Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
          <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-1">Total Balance</p>
          <p className="font-display font-extrabold text-lg text-indigo-900">{formatCurrency(newBalance)}</p>
        </div>
        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-1">Free to Spend</p>
          <p className="font-display font-extrabold text-lg text-emerald-900">{formatCurrency(newFree)}</p>
        </div>
      </div>

      {/* Auto-Committed */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50/50 border-bottom border-slate-100 flex items-center gap-2">
          <Box size={14} className="text-slate-400" />
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Auto-Committed This Month</span>
        </div>
        
        <div className="divide-y divide-slate-50">
          {recurringTransactions.length > 0 ? (
            recurringTransactions.map((tx) => {
              const day = new Date(tx.date).getDate();
              const target = getTargetName(tx);
              const isInvestment = tx.category === 'Investment' || tx.category === 'Savings';
              
              return (
                <div key={tx.id} className="p-4 flex justify-between items-center hover:bg-slate-50/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xl">
                      {tx.emoji}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{tx.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {day}{getDaySuffix(day)} of every month → {target}
                      </p>
                    </div>
                  </div>
                  <p className={cn(
                    "font-display font-black text-sm",
                    isInvestment ? "text-indigo-600" : "text-red-500"
                  )}>
                    {formatCurrency(Math.abs(tx.amount))}
                  </p>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center">
              <p className="text-xs text-slate-400 font-medium italic">No recurring commitments found.</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50/30 border-t border-slate-50 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-500">Total committed:</span>
          <span className="font-display font-black text-red-500">{formatCurrency(recurringTotal)}</span>
        </div>
      </div>

      {/* Spending Envelopes */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Mail size={14} className="text-slate-400" />
          <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Spending Envelopes (Optional)</label>
        </div>
        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
          Divide your free amount into categories. Expenses auto-deduct from matching envelope.
        </p>

        <div className="grid grid-cols-2 gap-4 pt-2">
          {Object.entries(allocations).map(([key, env]) => (
            <div key={key} className="space-y-1.5 relative group">
              <button 
                onClick={() => handleDeleteEnvelope(key)}
                className="absolute -top-1 -right-1 p-1 bg-white rounded-full shadow-sm border border-slate-100 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 z-10"
              >
                <Trash2 size={10} />
              </button>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                <span className="text-base grayscale-0">{env.icon}</span>
                {env.name}
              </label>
              <input 
                type="number" 
                value={env.budget || ''}
                onChange={(e) => handleAllocationChange(key, parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-bold"
              />
            </div>
          ))}

          {isAddingEnvelope ? (
            <div className="col-span-2 p-4 rounded-2xl border-2 border-dashed border-indigo-100 bg-indigo-50/30 space-y-4">
              <div className="flex gap-3">
                <input 
                  type="text" 
                  value={newEnvIcon}
                  onChange={(e) => setNewEnvIcon(e.target.value)}
                  className="w-12 h-12 rounded-xl bg-white border border-indigo-100 flex items-center justify-center text-2xl text-center focus:outline-none"
                  placeholder="Icon"
                />
                <div className="flex-1 space-y-3">
                  <input 
                    type="text" 
                    value={newEnvName}
                    onChange={(e) => setNewEnvName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-indigo-100 focus:outline-none text-sm font-bold"
                    placeholder="Envelope Name (e.g. Rent)"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Budget:</label>
                    <input 
                      type="number" 
                      value={newEnvBudget}
                      onChange={(e) => setNewEnvBudget(e.target.value)}
                      className="flex-1 px-3 py-1 rounded-lg bg-white border border-indigo-100 focus:outline-none text-sm font-bold"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsAddingEnvelope(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddEnvelope}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all"
                >
                  Add Envelope
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setIsAddingEnvelope(true)}
              className="col-span-2 py-4 rounded-2xl border-2 border-dashed border-slate-100 text-slate-400 hover:border-indigo-200 hover:text-indigo-500 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
            >
              <PlusCircle size={14} /> Add New Envelope
            </button>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-6 border-t border-slate-50">
        <button 
          onClick={onClose}
          className="flex-1 py-4 rounded-2xl border border-slate-100 text-slate-500 font-display font-bold hover:bg-slate-50 transition-all text-sm"
        >
          Cancel
        </button>
        <button 
          onClick={handleSave}
          disabled={isSubmitting || newFree < 0}
          className="flex-[2] bg-indigo-600 text-white font-display font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 flex flex-col items-center justify-center gap-0.5 text-sm"
        >
          <div className="flex items-center gap-2">
            <Save size={18} />
            {isSubmitting ? "Activating..." : "Activate Wallet"}
          </div>
          {newFree < 0 && (
            <span className="text-[9px] font-black uppercase opacity-80">Insufficient Balance</span>
          )}
        </button>
      </div>
    </div>
  );
}
