import React, { useState, useEffect } from 'react';
import { Search, Plus, Mic, Filter, MicOff, X, Trash2, Repeat } from 'lucide-react';
import { Transaction, RecurrenceFrequency, Wallet as WalletType } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { useFirebase } from '../lib/FirebaseProvider';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, increment, deleteDoc } from 'firebase/firestore';
import Modal from './Modal';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { processRecurringTransactions } from '../lib/recurrence';

interface TransactionsProps {
  transactions: Transaction[];
  wallet: WalletType | null;
}

export default function Transactions({ transactions, wallet }: TransactionsProps) {
  const { user, accounts, holdings } = useFirebase();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense' | 'investment' | 'savings'>('expense');
  const [category, setCategory] = useState('Food & Dining');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isTaxDeductible, setIsTaxDeductible] = useState(false);
  const [taxSection, setTaxSection] = useState('80C');
  const [isCapitalGain, setIsCapitalGain] = useState(false);
  const [gainType, setGainType] = useState<'LTCG' | 'STCG'>('LTCG');
  const [fundSource, setFundSource] = useState('wallet');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>('monthly');

  const { 
    isListening, 
    transcript, 
    startListening, 
    stopListening, 
    browserSupportsSpeechRecognition 
  } = useVoiceRecognition();

  useEffect(() => {
    if (transcript && isAddModalOpen) {
      // Simple parsing logic for voice entry
      const lowerTranscript = transcript.toLowerCase();
      const amountMatch = lowerTranscript.match(/\d+/);
      if (amountMatch) {
        setAmount(amountMatch[0]);
      }
      setName(transcript);
    }
  }, [transcript, isAddModalOpen]);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name || !amount || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const finalAmount = type === 'income' ? parseFloat(amount) : -Math.abs(parseFloat(amount));
      const emojiMap: Record<string, string> = {
        income: '💰',
        expense: '💳',
        investment: '📈',
        savings: '🏦'
      };

      if (isRecurring) {
        // For recurring transactions, we only create the template.
        // The background processor (recurrence.ts) will handle the first and subsequent executions.
        const recData = {
          uid: user.uid,
          name,
          amount: finalAmount,
          type,
          category,
          date,
          emoji: emojiMap[type] || '💳',
          isRecurring: true,
          recurrence,
          isTaxDeductible,
          taxSection: isTaxDeductible ? taxSection : null,
          isCapitalGain,
          gainType: isCapitalGain ? gainType : null,
          linkedAcc: fundSource,
          createdAt: new Date().toISOString(),
          lastProcessed: null // Important: background worker will see this and process it
        };
        
        const recDocRef = await addDoc(collection(db, 'transactions'), recData);
        
        // Trigger immediate processing for the new template
        await processRecurringTransactions(user.uid, [{ id: recDocRef.id, ...recData }], accounts, wallet);
      } else {
        // Normal one-time transaction
        await addDoc(collection(db, 'transactions'), {
          uid: user.uid,
          name,
          amount: finalAmount,
          type,
          category,
          date,
          emoji: emojiMap[type] || '💳',
          isRecurring: false,
          recurrence: 'none',
          isTaxDeductible,
          taxSection: isTaxDeductible ? taxSection : null,
          isCapitalGain,
          gainType: isCapitalGain ? gainType : null,
          linkedAcc: fundSource,
          createdAt: new Date().toISOString()
        });

        // Update Source Balance (Only for one-time transactions)
        if (fundSource === 'wallet' && wallet) {
          const walletRef = doc(db, 'wallets', user.uid);
          
          const updates: any = {
            balance: increment(finalAmount),
            free: increment(finalAmount)
          };

          if (type === 'expense') {
            const envEntry = Object.entries(wallet.envelopes).find(([_, env]) => 
              env.cat.toLowerCase() === category.toLowerCase() || 
              env.name.toLowerCase() === category.toLowerCase()
            );
            
            if (envEntry) {
              const [envKey, envData] = envEntry;
              updates[`envelopes.${envKey}.spent`] = envData.spent + Math.abs(finalAmount);
            }
          }

          await updateDoc(walletRef, updates);
        } else if (fundSource !== 'external' && fundSource !== 'wallet') {
          const sourceAcc = accounts.find(a => a.id === fundSource);
          if (sourceAcc) {
            const accountRef = doc(db, 'accounts', sourceAcc.id);
            await updateDoc(accountRef, {
              amt: increment(finalAmount)
            });
          }
        }
      }

      setIsAddModalOpen(false);
      resetForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'transactions');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setAmount('');
    setType('expense');
    setCategory('Food & Dining');
    setDate(new Date().toISOString().split('T')[0]);
    setIsTaxDeductible(false);
    setTaxSection('80C');
    setIsCapitalGain(false);
    setGainType('LTCG');
    setFundSource('wallet');
    setIsRecurring(false);
    setRecurrence('monthly');
  };

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  const filteredTransactions = transactions.filter(tx => {
    if (tx.isRecurring) return false; // Hide recurring from main list
    if (filter !== 'all' && tx.type !== filter) return false;
    if (search && !tx.name.toLowerCase().includes(search.toLowerCase()) && !tx.category.toLowerCase().includes(search.toLowerCase())) return false;
    // Only show current month transactions and hide future ones
    if (!tx.date.startsWith(currentMonth) || new Date(tx.date) > new Date()) return false;
    return true;
  });

  const totalSpent = Math.abs(transactions
    .filter(t => !t.isRecurring && t.type === 'expense' && t.date.startsWith(currentMonth))
    .reduce((acc, t) => acc + t.amount, 0));

  const handleDeleteTransaction = async (tx: Transaction) => {
    if (!user) return;
    setIsDeleting(true);

    try {
      // 1. Reconcile Wallet if it was a wallet transaction
      // Backward compatibility: if linkedAcc is missing, assume it was a wallet transaction
      if (wallet && (tx.linkedAcc === 'wallet' || !tx.linkedAcc)) {
        const walletRef = doc(db, 'wallets', user.uid);
        const reverseAmount = -tx.amount;
        
        const updates: any = {
          balance: increment(reverseAmount),
          free: increment(reverseAmount)
        };

        // Reverse envelope spending if it was an expense
        if (tx.type === 'expense') {
          const envEntry = Object.entries(wallet.envelopes).find(([_, env]) => 
            env.cat.toLowerCase() === tx.category.toLowerCase() || 
            env.name.toLowerCase() === tx.category.toLowerCase()
          );
          
          if (envEntry) {
            const [envKey, envData] = envEntry;
            updates[`envelopes.${envKey}.spent`] = Math.max(0, envData.spent - Math.abs(tx.amount));
          }
        }

        await updateDoc(walletRef, updates);
      }

      // 2. Reconcile Linked Account if exists and not wallet/external
      if (tx.linkedAcc && tx.linkedAcc !== 'wallet' && tx.linkedAcc !== 'external') {
        const account = accounts.find(a => a.id === tx.linkedAcc);
        if (account) {
          const accountRef = doc(db, 'accounts', account.id);
          // Reverse the amount on the account
          await updateDoc(accountRef, {
            amt: increment(-tx.amount)
          });
        }
      }

      // 3. Delete the transaction
      await deleteDoc(doc(db, 'transactions', tx.id));
      setTxToDelete(null);

    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'transactions');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{currentMonthName}</p>
          <h2 className="font-display font-extrabold text-2xl">Transactions</h2>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => { setIsAddModalOpen(true); startListening(); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-100 bg-white text-indigo-600 font-display font-bold text-xs shadow-sm"
          >
            <Mic size={14} /> Voice
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-display font-bold text-xs shadow-md shadow-indigo-100"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => { setIsAddModalOpen(false); stopListening(); }} 
        title="Add Transaction"
      >
        <form onSubmit={handleAddTransaction} className="space-y-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['expense', 'income', 'investment', 'savings'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                  type === t ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Description</label>
            <div className="relative">
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Zomato dinner"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                required
              />
              {isListening && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                  <span className="text-[8px] font-black text-red-500 uppercase">Listening</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Amount (₹)</label>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Date</label>
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Source / Destination</label>
            <select 
              value={fundSource}
              onChange={(e) => setFundSource(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold"
            >
              <option value="external">External / Cash (No Balance Update)</option>
              {wallet && wallet.active && <option value="wallet">invxtra Wallet (₹{wallet.balance.toLocaleString('en-IN')})</option>}
              <optgroup label="Savings Accounts">
                {accounts.filter(a => a.type === 'savings').map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.bank} - {acc.name} (₹{acc.amt.toLocaleString('en-IN')})</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category</label>
            <select 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
            >
              <option>Food & Dining</option>
              <option>Groceries</option>
              <option>Transport</option>
              <option>Shopping</option>
              <option>Entertainment</option>
              <option>EMI/Loan</option>
              <option>Investment</option>
              <option>Income</option>
              <option>Housing</option>
              <option>Healthcare</option>
              <option>Bills & Utilities</option>
              <option>Education</option>
              <option>Savings</option>
              <option>Other</option>
            </select>
          </div>

          <div className="bg-indigo-50/30 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat size={16} className="text-indigo-600" />
                <span className="text-xs font-bold text-slate-900">Recurring Transaction</span>
              </div>
              <button 
                type="button"
                onClick={() => setIsRecurring(!isRecurring)}
                className={cn(
                  "w-10 h-5 rounded-full transition-all relative",
                  isRecurring ? "bg-indigo-600" : "bg-slate-300"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                  isRecurring ? "right-1" : "left-1"
                )}></div>
              </button>
            </div>
            
            {isRecurring && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <select 
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as RecurrenceFrequency)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs font-bold"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
                <p className="text-[10px] text-indigo-600 mt-2 font-medium">
                  Template will be created. First transaction will be processed automatically based on the date.
                </p>
                {new Date(date) <= new Date() && (
                  <p className="text-[9px] text-amber-600 font-bold mt-1 px-1">
                    ⚠️ Note: Since the start date is today or in the past, the first payment will be processed immediately.
                  </p>
                )}
              </div>
            )}
          </div>

          {(type === 'expense' || type === 'investment') && (
            <div className="bg-indigo-50/50 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Tax Deductible / Capital Gain</label>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-bold text-slate-500 uppercase">Tax</span>
                    <button 
                      type="button"
                      onClick={() => setIsTaxDeductible(!isTaxDeductible)}
                      className={cn(
                        "w-8 h-4 rounded-full transition-all relative",
                        isTaxDeductible ? "bg-indigo-600" : "bg-slate-300"
                      )}
                    >
                      <div className={cn(
                        "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                        isTaxDeductible ? "right-0.5" : "left-0.5"
                      )}></div>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-bold text-slate-500 uppercase">Gain</span>
                    <button 
                      type="button"
                      onClick={() => setIsCapitalGain(!isCapitalGain)}
                      className={cn(
                        "w-8 h-4 rounded-full transition-all relative",
                        isCapitalGain ? "bg-amber-600" : "bg-slate-300"
                      )}
                    >
                      <div className={cn(
                        "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                        isCapitalGain ? "right-0.5" : "left-0.5"
                      )}></div>
                    </button>
                  </div>
                </div>
              </div>
              
              {isTaxDeductible && (
                <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">IT Section</label>
                  <select 
                    value={taxSection}
                    onChange={(e) => setTaxSection(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-bold"
                  >
                    <option value="80C">Section 80C (PPF, ELSS, Insurance)</option>
                    <option value="80D">Section 80D (Health Insurance)</option>
                    <option value="80G">Section 80G (Donations)</option>
                    <option value="80E">Section 80E (Education Loan)</option>
                    <option value="24B">Section 24(b) (Home Loan Interest)</option>
                    <option value="Other">Other Deductions</option>
                  </select>
                </div>
              )}

              {isCapitalGain && (
                <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Gain Type</label>
                  <select 
                    value={gainType}
                    onChange={(e) => setGainType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-xs font-bold"
                  >
                    <option value="LTCG">LTCG (Long Term Capital Gain)</option>
                    <option value="STCG">STCG (Short Term Capital Gain)</option>
                  </select>
                </div>
              )}
            </div>
          )}

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 text-white font-display font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 mt-4"
          >
            {isSubmitting ? "Saving..." : "Save Transaction"}
          </button>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!txToDelete}
        onClose={() => !isDeleting && setTxToDelete(null)}
        title="Delete Transaction"
      >
        <div className="space-y-6 py-2">
          <div className="bg-red-50 p-4 rounded-2xl flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
              <Trash2 size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Confirm Deletion</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-slate-900">"{txToDelete?.name}"</span>?
                This will automatically reverse the balance of ₹{Math.abs(txToDelete?.amount || 0).toLocaleString('en-IN')} in your {txToDelete?.linkedAcc === 'wallet' || !txToDelete?.linkedAcc ? 'wallet' : 'linked account'}.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setTxToDelete(null)}
              disabled={isDeleting}
              className="flex-1 py-3.5 rounded-2xl border border-slate-200 text-slate-600 font-display font-bold text-sm hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => txToDelete && handleDeleteTransaction(txToDelete)}
              disabled={isDeleting}
              className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white font-display font-bold text-sm shadow-lg shadow-red-100 hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDeleting ? "Reconciling..." : "Delete & Reconcile"}
            </button>
          </div>
        </div>
      </Modal>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Spent" value={formatCurrency(totalSpent)} color="text-red-600" />
        <StatCard label="Transactions" value={filteredTransactions.length.toString()} color="text-indigo-600" />
        <StatCard label="Daily Avg" value={formatCurrency(Math.round(totalSpent / 30))} color="text-amber-600" />
        <StatCard label="Budget Left" value={formatCurrency(wallet ? wallet.free : 0)} color="text-emerald-600" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {['all', 'income', 'expense', 'investment', 'savings'].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={cn(
              "px-5 py-2.5 rounded-full text-xs font-display font-bold whitespace-nowrap transition-all border",
              filter === t 
                ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100" 
                : "bg-white text-slate-500 border-indigo-50 hover:border-indigo-200"
            )}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search transactions..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-indigo-50 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
          />
        </div>
        <button className="w-12 h-12 rounded-xl bg-white border border-indigo-50 flex items-center justify-center text-slate-500">
          <Filter size={18} />
        </button>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden divide-y divide-slate-50">
        {filteredTransactions.length > 0 ? filteredTransactions.map((tx) => (
          <div key={tx.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl">
              {tx.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-sm truncate">{tx.name}</p>
                {tx.isRecurring && (
                  <span className="p-1 rounded-md bg-indigo-50 text-indigo-600" title={`Recurring: ${tx.recurrence}`}>
                    <Repeat size={10} />
                  </span>
                )}
                {tx.isTaxDeductible && (
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase" title={`Tax Deductible: ${tx.taxSection}`}>
                    Tax: {tx.taxSection}
                  </span>
                )}
                {tx.isCapitalGain && (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 text-[8px] font-black uppercase" title={`Capital Gain: ${tx.gainType}`}>
                    {tx.gainType}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                {tx.category} · {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </p>
            </div>
            <div className={cn(
              "font-display font-extrabold text-sm text-right",
              tx.amount > 0 ? "text-emerald-600" : "text-slate-900"
            )}>
              {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setTxToDelete(tx); }}
              className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all"
              title="Delete & Reconcile"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )) : (
          <div className="p-10 text-center text-slate-400 text-sm font-medium">
            No transactions found
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="glass-card p-4 rounded-2xl">
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className={cn("font-display font-extrabold text-lg", color)}>{value}</p>
    </div>
  );
}
