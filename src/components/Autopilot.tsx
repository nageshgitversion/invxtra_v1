import React, { useState, useMemo } from 'react';
import { Repeat, Zap, ArrowRight, ArrowLeft, Plus, CheckCircle2, AlertCircle, TrendingUp, Wallet, Home, PiggyBank, Search, Settings2, X } from 'lucide-react';
import { Transaction, Account, Holding, RecurrenceFrequency } from '../types';
import { formatCurrency, formatCompactNumber, cn, getMonthlyCommitment } from '../lib/utils';
import { useFirebase } from '../lib/FirebaseProvider';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import Modal from './Modal';

interface AutopilotProps {
  transactions: Transaction[];
  accounts: Account[];
  holdings: Holding[];
  onBack?: () => void;
}

export default function Autopilot({ transactions, accounts, holdings, onBack }: AutopilotProps) {
  const { user, wallet } = useFirebase();
  const [isDiscoverModalOpen, setIsDiscoverModalOpen] = useState(false);
  const [isMarkModalOpen, setIsMarkModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ id: string, type: 'account' | 'holding' | 'expense', name: string, amount: number } | null>(null);
  const [markDate, setMarkDate] = useState('5');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recurringTransactions = useMemo(() => 
    transactions.filter(t => t.isRecurring),
    [transactions]
  );

  const committedTotal = useMemo(() => 
    recurringTransactions.reduce((acc, t) => acc + getMonthlyCommitment(Math.abs(t.amount), t.recurrence), 0),
    [recurringTransactions]
  );

  const savingsRate = useMemo(() => {
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const monthTxs = transactions.filter(t => t.date.startsWith(currentMonth));
    
    const income = monthTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expenses = monthTxs.filter(t => t.type === 'expense' || t.type === 'debt').reduce((acc, t) => acc + Math.abs(t.amount), 0);
    
    if (income === 0) return 0;
    const rate = ((income - expenses) / income) * 100;
    return Math.max(0, Math.round(rate));
  }, [transactions]);

  // Analyze transactions for potential recurring ones
  const suggestions = useMemo(() => {
    // Find non-recurring transactions that appear multiple times with similar names/amounts
    const nonRecurring = transactions.filter(t => !t.isRecurring && t.type === 'expense');
    const counts: Record<string, { count: number, total: number, emoji: string, cat: string }> = {};
    
    nonRecurring.forEach(t => {
      const key = `${t.name.toLowerCase()}-${Math.round(t.amount)}`;
      if (!counts[key]) {
        counts[key] = { count: 0, total: 0, emoji: t.emoji, cat: t.category };
      }
      counts[key].count++;
      counts[key].total += t.amount;
    });

    return Object.entries(counts)
      .filter(([_, data]) => data.count >= 2)
      .map(([key, data]) => {
        const [name] = key.split('-');
        return {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          amount: Math.abs(data.total / data.count),
          count: data.count,
          emoji: data.emoji,
          category: data.cat
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [transactions]);

  const handleMarkRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedItem || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const day = parseInt(markDate);
      const now = new Date();
      const nextDate = new Date(now.getFullYear(), now.getMonth(), day);
      if (nextDate < now) {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }

      const recData: any = {
        uid: user.uid,
        name: selectedItem.type === 'holding' ? `SIP: ${selectedItem.name}` : 
              selectedItem.type === 'account' ? `Payment: ${selectedItem.name}` : 
              selectedItem.name,
        amount: -Math.abs(selectedItem.amount),
        type: selectedItem.type === 'holding' ? 'investment' : 
              selectedItem.type === 'account' ? (accounts.find(a => a.id === selectedItem.id)?.category === 'loan' ? 'debt' : 'savings') : 
              'expense',
        category: selectedItem.type === 'holding' ? 'Investment' : 'Recurring',
        date: nextDate.toISOString().split('T')[0],
        emoji: selectedItem.type === 'holding' ? '📈' : 
               selectedItem.type === 'account' ? '🏦' : '🔄',
        isRecurring: true,
        recurrence: 'monthly',
        targetId: selectedItem.id,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'transactions'), recData);
      
      setIsMarkModalOpen(false);
      setSelectedItem(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'transactions');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStopRecurring = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'transactions');
    }
  };

  return (
    <div className="space-y-6">
      {onBack && (
        <div className="flex items-center gap-4 px-2">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Back to Hub</span>
        </div>
      )}

      {/* Header */}
      <div className="px-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
            <Zap size={20} />
          </div>
          <h2 className="text-3xl font-display font-black tracking-tight text-slate-900 leading-tight">Autopilot</h2>
        </div>
        <p className="text-slate-500 font-medium">Smart automation for your recurring commitments.</p>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 p-6 rounded-[32px] text-white overflow-hidden relative"
        >
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Monthly Commitment</p>
            <h3 className="text-4xl font-display font-black mb-1">₹{formatCompactNumber(committedTotal)}</h3>
            <p className="text-slate-400 text-sm font-medium">Across {recurringTransactions.length} automated payments</p>
          </div>
          <div className="absolute -right-8 -bottom-8 opacity-10">
            <Repeat size={160} />
          </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 leading-tight">Savings Rate</p>
              <h4 className="text-xl font-display font-black">{savingsRate}%</h4>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between group cursor-pointer hover:border-indigo-100 hover:shadow-md transition-all"
            onClick={() => setIsDiscoverModalOpen(true)}
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 mb-4 group-hover:scale-110 transition-transform">
              <Search size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 leading-tight">Analyze</p>
              <h4 className="text-xl font-display font-black text-purple-600 flex items-center gap-1">
                Findings <ArrowRight size={14} />
              </h4>
            </div>
          </div>
        </div>
      </div>

      {/* Main List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-lg font-display font-black text-slate-900">Active Automations</h3>
          <button 
             onClick={() => setIsMarkModalOpen(true)}
             className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <Plus size={14} /> Mark Existing
          </button>
        </div>

        <div className="space-y-3">
          {recurringTransactions.length === 0 ? (
            <div className="bg-white p-8 rounded-[32px] border border-dashed border-slate-200 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 mx-auto mb-4">
                <Repeat size={32} />
              </div>
              <p className="text-slate-500 font-medium">No active automations yet.</p>
              <p className="text-slate-400 text-xs mt-1">Add recurring payments from Wallet or Accounts.</p>
            </div>
          ) : (
            recurringTransactions.map(t => (
              <motion.div 
                layout
                key={t.id}
                className="bg-white p-4 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 text-xl shadow-sm">
                    {t.emoji}
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-slate-900 mb-0.5">{t.name}</h4>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.category}</span>
                       <span className="w-1 h-1 rounded-full bg-slate-200" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Day {new Date(t.date).getDate()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                   <div className="text-right">
                      <p className="font-display font-black text-lg text-slate-900">₹{formatCurrency(Math.abs(t.amount))}</p>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase">Scheduled</p>
                   </div>
                   <button 
                     onClick={() => handleStopRecurring(t.id)}
                     className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
                   >
                     <X size={18} />
                   </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Discovery Modal */}
      <Modal 
        isOpen={isDiscoverModalOpen} 
        onClose={() => setIsDiscoverModalOpen(false)} 
        title="Smart Discovery"
      >
        <div className="space-y-6 py-2">
          <div className="bg-indigo-600 p-6 rounded-[24px] text-white">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={20} className="text-indigo-200" />
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">AI Analysis</p>
            </div>
            <h3 className="font-display font-black text-xl mb-1 line-clamp-2">Potential Recurring Payments Found</h3>
            <p className="text-indigo-100 text-sm opacity-80">We've identified payments that happen regularly. Automating them helps in better budget planning.</p>
          </div>

          <div className="space-y-3">
            {suggestions.length === 0 ? (
               <p className="text-center py-4 text-slate-400 text-sm italic">No recurring patterns found yet. Keep tracking!</p>
            ) : (
              suggestions.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-xl shadow-sm">
                      {s.emoji}
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-slate-900 text-sm leading-none">{s.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{s.category} · Seen {s.count}x</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-display font-black text-slate-900">₹{formatCompactNumber(s.amount)}</p>
                    <button 
                      onClick={() => {
                        setSelectedItem({ id: '', type: 'expense', name: s.name, amount: s.amount });
                        setIsDiscoverModalOpen(false);
                        setIsMarkModalOpen(true);
                      }}
                      className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-slate-900 transition-all"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Mark Existing Modal */}
      <Modal 
        isOpen={isMarkModalOpen} 
        onClose={() => { setIsMarkModalOpen(false); setSelectedItem(null); }} 
        title="Mark as Recurring"
      >
        <form onSubmit={handleMarkRecurring} className="space-y-6 py-2">
          {!selectedItem ? (
            <div className="space-y-4">
              <p className="text-xs font-bold text-slate-500 px-1">Select an existing item to automate:</p>
              
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Rds & Loans</label>
                <div className="space-y-2">
                  {accounts.filter(a => ['rd', 'loan'].includes(a.type)).map(acc => {
                    const isAlready = recurringTransactions.some(t => t.targetId === acc.id);
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        disabled={isAlready}
                        onClick={() => setSelectedItem({ id: acc.id, type: 'account', name: acc.name, amount: acc.emi || 0 })}
                        className={cn(
                          "w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                          isAlready ? "bg-slate-50 border-slate-100 opacity-60 grayscale" : "bg-white border-slate-100 hover:border-indigo-600 hover:bg-indigo-50/30"
                        )}
                      >
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                             {acc.type === 'loan' ? <Home size={18} /> : <PiggyBank size={18} />}
                           </div>
                           <div>
                             <h4 className="font-display font-bold text-slate-900 text-sm leading-none">{acc.name}</h4>
                             <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{acc.bank} {isAlready && '· Already Recurring'}</p>
                           </div>
                        </div>
                        <p className="font-display font-black text-slate-900">₹{formatCompactNumber(acc.emi || 0)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">SIP / Portfolio</label>
                <div className="space-y-2">
                  {holdings.map(h => {
                    const isAlready = recurringTransactions.some(t => t.targetId === h.id);
                    return (
                      <button
                        key={h.id}
                        type="button"
                        disabled={isAlready}
                        onClick={() => setSelectedItem({ id: h.id, type: 'holding', name: h.name, amount: h.sip })}
                        className={cn(
                          "w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                          isAlready ? "bg-slate-50 border-slate-100 opacity-60 grayscale" : "bg-white border-slate-100 hover:border-indigo-600 hover:bg-indigo-50/30"
                        )}
                      >
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                             <TrendingUp size={18} />
                           </div>
                           <div>
                             <h4 className="font-display font-bold text-slate-900 text-sm leading-none">{h.name}</h4>
                             <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{h.type} {isAlready && '· Already Recurring'}</p>
                           </div>
                        </div>
                        <p className="font-display font-black text-slate-900">₹{formatCompactNumber(h.sip)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
               <div className="flex items-center gap-4 p-4 bg-indigo-600 rounded-[24px] text-white">
                 <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl">
                    {selectedItem.type === 'holding' ? '📈' : '🏦'}
                 </div>
                 <div>
                    <h4 className="font-display font-black text-xl leading-none mb-1">{selectedItem.name}</h4>
                    <p className="text-white/60 text-xs font-bold uppercase tracking-widest">₹{formatCurrency(selectedItem.amount)} Monthly SIP/EMI</p>
                 </div>
               </div>

               <div className="space-y-4">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Payment Date (Day of Month)</label>
                   <input 
                     type="number" 
                     value={markDate}
                     onChange={(e) => setMarkDate(e.target.value)}
                     placeholder="1-31"
                     className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold"
                     required
                   />
                 </div>

                 <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex gap-3 text-amber-700">
                   <AlertCircle size={18} className="shrink-0 mt-0.5" />
                   <p className="text-xs font-medium">This will create a monthly recurring transaction template. Autopilot will handle the debits automatically on the selected date.</p>
                 </div>
               </div>

               <div className="flex gap-3">
                 <button 
                   type="button" 
                   onClick={() => setSelectedItem(null)}
                   className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-display font-black text-sm hover:bg-slate-200 transition-all"
                 >
                   Back
                 </button>
                 <button 
                   type="submit" 
                   disabled={isSubmitting}
                   className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-display font-black text-sm hover:bg-slate-900 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
                 >
                   {isSubmitting ? 'Processing...' : 'Confirm Automation'}
                 </button>
               </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
