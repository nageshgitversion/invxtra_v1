import React, { useState, useEffect } from 'react';
import { Search, Plus, Mic, Filter, MicOff, X, Trash2, Repeat, Camera, ChevronRight, ArrowLeft } from 'lucide-react';
import { Transaction, RecurrenceFrequency, Wallet as WalletType, TransactionType } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { useFirebase } from '../lib/FirebaseProvider';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, increment, deleteDoc } from 'firebase/firestore';
import Modal from './Modal';
import ImportTransactions from './ImportTransactions';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { processRecurringTransactions } from '../lib/recurrence';
import { scanReceipt } from '../services/geminiService';
import { FINANCIAL_CATEGORIES, CategoryName } from '../constants';

interface TransactionsProps {
  transactions: Transaction[];
  wallet: WalletType | null;
  onBack?: () => void;
}

export default function Transactions({ transactions, wallet, onBack }: TransactionsProps) {
  const { user, accounts, holdings, fines } = useFirebase();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    const handleOpenAddModal = () => setIsAddModalOpen(true);
    window.addEventListener('openAddTransactionModal', handleOpenAddModal);
    return () => window.removeEventListener('openAddTransactionModal', handleOpenAddModal);
  }, []);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState<CategoryName>('Expenses');
  const [subCategory, setSubCategory] = useState('Groceries');
  const [targetId, setTargetId] = useState<string>('none');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isTaxDeductible, setIsTaxDeductible] = useState(false);
  const [taxSection, setTaxSection] = useState('80C');
  const [isCapitalGain, setIsCapitalGain] = useState(false);
  const [gainType, setGainType] = useState<'LTCG' | 'STCG'>('LTCG');
  const [fundSource, setFundSource] = useState('wallet');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>('monthly');
  const [showImpulseWarning, setShowImpulseWarning] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { 
    isListening, 
    transcript, 
    startListening, 
    stopListening, 
    browserSupportsSpeechRecognition 
  } = useVoiceRecognition();

  const expenseSubCategories = React.useMemo(() => {
    if (wallet && wallet.envelopes) {
      const activeEnvs = Object.values(wallet.envelopes).filter((e: any) => e.budget > 0).map((e: any) => e.name);
      if (activeEnvs.length > 0) return activeEnvs;
    }
    return FINANCIAL_CATEGORIES['Expenses'];
  }, [wallet]);

  useEffect(() => {
    // If the currently selected category is Expenses and the subCategory is not in our dynamic list, reset it.
    if (category === 'Expenses' && !(expenseSubCategories as string[]).includes(subCategory)) {
      setSubCategory(expenseSubCategories[0] || 'Groceries');
    }
  }, [category, expenseSubCategories, subCategory]);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setIsAddModalOpen(true);
    
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        try {
          const extracted = await scanReceipt(base64String, file.type);
          if (extracted.name) setName(extracted.name);
          if (extracted.amount) setAmount(extracted.amount.toString());
          if (extracted.category) setCategory(extracted.category);
          if (extracted.date) setDate(extracted.date);
          setType('expense');
        } catch (err) {
          console.error(err);
          alert("Could not scan receipt. Please enter manually.");
        } finally {
          setIsScanning(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsScanning(false);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddTransaction = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!user || !name || !amount || isSubmitting) return;

    const finalAmount = type === 'income' ? parseFloat(amount) : -Math.abs(parseFloat(amount));

    if (type === 'expense' && Math.abs(finalAmount) >= 10000 && !showImpulseWarning) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200]);
      setShowImpulseWarning(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const emojiMap: Record<string, string> = {
        income: '💰',
        expense: '💳',
        debt: '📉',
        investment: '📈',
        savings: '🏦'
      };

      const txDateObj = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isFuture = txDateObj > today;
      const isSameMonth = txDateObj.getMonth() === today.getMonth() && txDateObj.getFullYear() === today.getFullYear();

      const txData: any = {
        uid: user.uid,
        name,
        amount: finalAmount,
        type,
        category,
        subCategory,
        date,
        emoji: emojiMap[type] || '💳',
        isRecurring,
        recurrence: isRecurring ? recurrence : 'none',
        isTaxDeductible,
        taxSection: isTaxDeductible ? taxSection : null,
        isCapitalGain,
        gainType: isCapitalGain ? gainType : null,
        linkedAcc: fundSource,
        status: isFuture ? 'scheduled' : 'completed',
        createdAt: new Date().toISOString()
      };

      if (targetId !== 'none') {
        txData.targetId = targetId;
      }

      if (isRecurring) {
        // For recurring transactions, we only create the template.
        // The background processor (recurrence.ts) will handle the first and subsequent executions.
        const recData = {
          ...txData,
          lastProcessed: null // Important: background worker will see this and process it
        };
        
        const recDocRef = await addDoc(collection(db, 'transactions'), recData);
        
        // Trigger immediate processing for the new template
        await processRecurringTransactions(user.uid, [{ id: recDocRef.id, ...recData } as any], accounts, wallet, holdings);
      } else {
        // Normal one-time transaction
        await addDoc(collection(db, 'transactions'), txData);

        // Update Source Balance (Only for one-time transactions)
        if (fundSource === 'wallet' && wallet) {
          const walletRef = doc(db, 'wallets', user.uid);
          
          const updates: any = {};

          if (!isFuture) {
            // Past or Present: Full debit
            updates.balance = increment(finalAmount);
            updates.free = increment(finalAmount);
          } else if (isSameMonth) {
            // Future of current month: Hold (Reserve)
            updates.free = increment(finalAmount);
            updates.committed = increment(Math.abs(finalAmount));
          }

          if (type === 'expense' || type === 'debt') {
            const envEntry = Object.entries(wallet.envelopes).find(([_, env]) => 
              env.cat.toLowerCase() === subCategory.toLowerCase() || 
              env.name.toLowerCase() === subCategory.toLowerCase()
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

        // --- NEW: Target Balance Update ---
        if (targetId !== 'none') {
          if (type === 'debt') {
            // EMI Payment: Reduces Loan Balance (debt amount is negative, so we subtract absolute or add original)
            // But Loan balance in DB is usually positive. If loan is 40L, EMI 35k should make it 39.65L.
            // finalAmount is -35000. 
            const accountRef = doc(db, 'accounts', targetId);
            await updateDoc(accountRef, {
              amt: increment(finalAmount) // Reduces loan principal (e.g. 4200000 + -35200)
            });
          } else if (type === 'investment' || type === 'savings') {
            // Investment/Savings: Increases target balance
            // finalAmount is -10000 (money leaving wallet). We want target to increase by 10000.
            const targetAcc = accounts.find(a => a.id === targetId);
            const targetHolding = holdings.find(h => h.id === targetId);
            
            if (targetAcc) {
              await updateDoc(doc(db, 'accounts', targetId), {
                amt: increment(Math.abs(finalAmount))
              });
            } else if (targetHolding) {
              await updateDoc(doc(db, 'holdings', targetId), {
                invested: increment(Math.abs(finalAmount)),
                current: increment(Math.abs(finalAmount))
              });
            }
          } else if (type === 'income' && (subCategory === 'Dividends' || subCategory === 'Deposit Interests')) {
            // Income from an asset often doesn't increase the asset principal unless reinvested
            // But user said "how much it returns". We can track it via transactions linked to targetId.
          }
        }

        // Evaluate Fines (Only for one-time expenses)
        if (type === 'expense') {
          const activeFines = fines?.filter(f => f.active && f.category.toLowerCase() === subCategory.toLowerCase()) || [];
          for (const fine of activeFines) {
            // Check if this transaction pushes them over the limit
            const currentMonth = date.slice(0, 7);
            const currentMonthTx = transactions.filter(t => !t.isRecurring && t.type === 'expense' && t.subCategory.toLowerCase() === subCategory.toLowerCase() && t.date.startsWith(currentMonth));
            const prevTotal = currentMonthTx.reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);
            const newTotal = prevTotal + Math.abs(finalAmount);

            // Apply fine if they just crossed the limit, OR if they are already over the limit (applies fine per transaction over limit)
            if (newTotal > fine.limit) {
              if (wallet && wallet.free >= fine.fineAmount) {
                // 1. Log Fine Transaction
                await addDoc(collection(db, 'transactions'), {
                  uid: user.uid,
                  name: `🚨 Spending Fine: Over limit on ${fine.category}`,
                  amount: -fine.fineAmount, // It's treated as a savings outflow from wallet
                  type: 'savings',
                  category: 'Savings',
                  subCategory: 'Behavioral Fine',
                  date,
                  emoji: '💸',
                  isRecurring: false,
                  recurrence: 'none',
                  linkedAcc: 'wallet',
                  createdAt: new Date().toISOString()
                });

                // 2. Deduct from wallet
                const walletRef = doc(db, 'wallets', user.uid);
                await updateDoc(walletRef, {
                  balance: increment(-fine.fineAmount),
                  free: increment(-fine.fineAmount)
                });

                // 3. Add to Goal
                if (fine.targetGoalId) {
                  const goalRef = doc(db, 'familyGoals', fine.targetGoalId);
                  await updateDoc(goalRef, {
                    saved: increment(fine.fineAmount)
                  });
                }
              }
            }
          }
        }
      }

      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([50]);
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
    setCategory('Expenses');
    setSubCategory('Groceries');
    setTargetId('none');
    setDate(new Date().toISOString().split('T')[0]);
    setIsTaxDeductible(false);
    setTaxSection('80C');
    setIsCapitalGain(false);
    setGainType('LTCG');
    setFundSource('wallet');
    setIsRecurring(false);
    setRecurrence('monthly');
    setShowImpulseWarning(false);
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
    <div className="space-y-4 md:space-y-6">
      {onBack && (
        <div className="flex items-center gap-4 px-1 sm:px-0">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Back to Hub</span>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 px-1 sm:px-0">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{currentMonthName}</p>
          <h2 className="font-display font-extrabold text-2xl">Transactions</h2>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-100 bg-white text-indigo-600 font-display font-bold text-xs shadow-sm disabled:opacity-50 whitespace-nowrap"
          >
            <Camera size={14} /> {isScanning ? "Scanning..." : "Scan"}
          </button>
          <button 
            onClick={() => { setIsAddModalOpen(true); startListening(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-100 bg-white text-indigo-600 font-display font-bold text-xs shadow-sm whitespace-nowrap"
          >
            <Mic size={14} /> Voice
          </button>
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-100 bg-white text-indigo-600 font-display font-bold text-xs shadow-sm whitespace-nowrap"
          >
            Import
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-display font-bold text-xs shadow-md shadow-indigo-100 whitespace-nowrap"
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
          <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto no-scrollbar">
            {(['expense', 'income', 'investment', 'savings', 'debt'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t);
                  const newCat = t === 'expense' ? 'Expenses' : t === 'income' ? 'Income' : t === 'investment' ? 'Investment' : t === 'savings' ? 'Savings' : 'Debt';
                  setCategory(newCat as CategoryName);
                  setSubCategory(newCat === 'Expenses' ? expenseSubCategories[0] : FINANCIAL_CATEGORIES[newCat as CategoryName][0]);
                  setTargetId('none');
                }}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
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
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Source (Deducted From)</label>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category</label>
              <select 
                value={category}
                onChange={(e) => {
                  const newCat = e.target.value as CategoryName;
                  setCategory(newCat);
                  setSubCategory(newCat === 'Expenses' ? expenseSubCategories[0] : FINANCIAL_CATEGORIES[newCat][0]);
                  // Sync type
                  const typeMap: Record<string, TransactionType> = {
                    Expenses: 'expense',
                    Income: 'income',
                    Investment: 'investment',
                    Savings: 'savings',
                    Debt: 'debt'
                  };
                  setType(typeMap[newCat]);
                }}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              >
                {Object.keys(FINANCIAL_CATEGORIES).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Sub-Category</label>
              <select 
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              >
                {(category === 'Expenses' ? expenseSubCategories : FINANCIAL_CATEGORIES[category]).map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          </div>

          {(type === 'investment' || type === 'debt' || type === 'savings') && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                  Target Asset/Liability (To be {type === 'debt' ? 'Reduced' : 'Increased'})
                </label>
                <button 
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    window.dispatchEvent(new CustomEvent('setActiveTab', { detail: 'savings' }));
                    // Small delay to let tab switch before opening modal
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('openAddAccountModal', { detail: { type: type === 'debt' ? 'loan' : type === 'investment' ? 'fd' : 'savings' } }));
                    }, 50);
                  }}
                  className="text-[9px] font-black text-indigo-600 underline uppercase tracking-tight"
                >
                  + Setup New {type === 'debt' ? 'Loan' : 'Account'}
                </button>
              </div>
              <select 
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold text-indigo-900"
              >
                <option value="none">No Linking (Just Entry)</option>
                {type === 'debt' && (
                  <optgroup label="Loans">
                    {accounts.filter(a => a.type === 'loan').map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} (Balance: ₹{acc.amt.toLocaleString('en-IN')})</option>
                    ))}
                  </optgroup>
                )}
                {type === 'investment' && (
                  <>
                    <optgroup label="Portfolios (Holdings)">
                      {holdings.map(h => (
                        <option key={h.id} value={h.id}>{h.name} (Value: ₹{h.current.toLocaleString('en-IN')})</option>
                      ))}
                    </optgroup>
                    <optgroup label="Investment Accounts">
                      {accounts.filter(a => ['fd', 'rd', 'ppf', 'nps', 'epf'].includes(a.type)).map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} (Balance: ₹{acc.amt.toLocaleString('en-IN')})</option>
                      ))}
                    </optgroup>
                  </>
                )}
                {type === 'savings' && (
                  <optgroup label="Savings Accounts">
                    {accounts.filter(a => a.type === 'savings').map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} (Balance: ₹{acc.amt.toLocaleString('en-IN')})</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}

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

          {showImpulseWarning ? (
            <div className="bg-red-50 border border-red-200 p-4 rounded-2xl animate-in zoom-in duration-300 mt-4">
              <h4 className="font-display font-black text-red-600 flex items-center gap-2 mb-2">
                Anti-Impulse Warning
              </h4>
              <p className="text-sm text-red-800 font-medium mb-4">
                You're about to spend ₹{Math.abs(parseFloat(amount)).toLocaleString('en-IN')}. This is a large expense that might impact your financial runway.
              </p>
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => setShowImpulseWarning(false)}
                  className="flex-1 py-3 bg-white border border-red-200 text-red-600 font-bold rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={(e) => handleAddTransaction(e)}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl text-sm shadow-md shadow-red-200"
                >
                  Yes, I'm sure
                </button>
              </div>
            </div>
          ) : (
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 text-white font-display font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 mt-4"
            >
              {isSubmitting ? "Saving..." : "Save Transaction"}
            </button>
          )}
        </form>
      </Modal>

      <ImportTransactions 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onSuccess={() => {}} 
      />

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 px-1 sm:px-0">
        <StatCard label="Total Spent" value={formatCurrency(totalSpent)} color="text-red-600" />
        <StatCard label="Transactions" value={filteredTransactions.length.toString()} color="text-indigo-600" />
        <StatCard label="Daily Avg" value={formatCurrency(Math.round(totalSpent / 30))} color="text-amber-600" />
        <StatCard label="Budget Left" value={formatCurrency(wallet ? wallet.free : 0)} color="text-emerald-600" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 px-1 sm:px-0">
        {['all', 'income', 'expense', 'investment', 'savings'].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={cn(
              "px-4 py-2 rounded-full text-[10px] font-display font-bold whitespace-nowrap transition-all border",
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
      <div className="flex gap-3 px-1 sm:px-0">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-indigo-50 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
          />
        </div>
        <button className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white border border-indigo-50 flex items-center justify-center text-slate-500">
          <Filter size={18} />
        </button>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden divide-y divide-slate-50 mx-1 sm:mx-0">
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 md:gap-4 p-3 md:p-4 hover:bg-slate-50 transition-colors group">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-100 flex items-center justify-center text-xl md:text-2xl shrink-0">
                {tx.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-xs md:text-sm truncate">{tx.name}</p>
                  {tx.isRecurring && (
                    <span className="p-0.5 rounded-md bg-indigo-50 text-indigo-600" title={`Recurring: ${tx.recurrence}`}>
                      <Repeat size={8} />
                    </span>
                  )}
                  {tx.isTaxDeductible && (
                    <span className="px-1 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[6px] md:text-[8px] font-black uppercase" title={`Tax Deductible: ${tx.taxSection}`}>
                      Tax
                    </span>
                  )}
                  {tx.targetId && (
                    <span className="px-1 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[6px] md:text-[8px] font-black uppercase">
                      Linked
                    </span>
                  )}
                </div>
                <p className="text-[9px] text-slate-400 font-medium">
                  {tx.category} / {tx.subCategory} · {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              </div>
              <div className={cn(
                "font-display font-extrabold text-xs md:text-sm text-right",
                tx.amount > 0 ? "text-emerald-600" : "text-slate-900"
              )}>
                {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
              </div>
              <ChevronRight size={16} className="text-slate-300 md:opacity-0 md:group-hover:opacity-100 transition-all shrink-0" />
              <button 
                onClick={(e) => { e.stopPropagation(); setTxToDelete(tx); }}
                className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all shrink-0"
                title="Delete & Reconcile"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        ) : (
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
