import React, { useState } from 'react';
import { PiggyBank, Plus, Calendar, ArrowRight, X, Edit, Trash2, Repeat } from 'lucide-react';
import { Account, Wallet, WalletEnvelope, Transaction, RecurrenceFrequency, PayoutFrequency, FamilyGoal, FamilyMember } from '../types';
import { formatCurrency, formatCompactNumber, cn, getMonthlyCommitment } from '../lib/utils';
import { useFirebase } from '../lib/FirebaseProvider';
import { processRecurringTransactions } from '../lib/recurrence';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, doc, setDoc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import Modal from './Modal';
import ConfirmModal from './ConfirmModal';
import { motion } from 'motion/react';
import { Users, Target, Coins, Trash } from 'lucide-react';

interface SavingsProps {
  accounts: Account[];
  transactions: Transaction[];
}

export default function Savings({ accounts, transactions }: SavingsProps) {
  const { user, wallet, familyGoals } = useFirebase();
  const [activeTab, setActiveTab] = useState<'wallet' | 'accounts' | 'recurring'>('wallet');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  
  // Form state
  const [name, setName] = useState('');
  const [amt, setAmt] = useState('');
  const [category, setCategory] = useState<'savings' | 'investment' | 'loan'>('savings');
  const [type, setType] = useState<'savings' | 'fd' | 'rd' | 'loan' | 'ppf' | 'nps' | 'epf'>('savings');
  const [bank, setBank] = useState('');
  const [rate, setRate] = useState('');
  const [goal, setGoal] = useState('');
  const [maturity, setMaturity] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [interestEarned, setInterestEarned] = useState('');
  const [emi, setEmi] = useState('');
  const [emiday, setEmiday] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [payoutFrequency, setPayoutFrequency] = useState<PayoutFrequency>('at-maturity');
  const [linkedGoalId, setLinkedGoalId] = useState('');
  const [fundSource, setFundSource] = useState<string>('external');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirmation Modals
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'account' | 'recurring' | 'goal' | 'member', id: string } | null>(null);

  // Recurring form state
  const [isAddRecurringModalOpen, setIsAddRecurringModalOpen] = useState(false);
  const [recName, setRecName] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recType, setRecType] = useState<'expense' | 'income' | 'investment' | 'savings'>('expense');
  const [recCategory, setRecCategory] = useState('Food & Dining');
  const [recDate, setRecDate] = useState(new Date().toISOString().split('T')[0]);
  const [recFrequency, setRecFrequency] = useState<RecurrenceFrequency>('monthly');
  const [recLinkedAcc, setRecLinkedAcc] = useState('');

  const recurringTransactions = transactions.filter(t => t.isRecurring);
  const committedTotal = recurringTransactions.reduce((acc, t) => acc + Math.abs(t.amount), 0);

  // Auto-calculate Maturity for RD/FD
  React.useEffect(() => {
    const isRD = type === 'rd';
    const isFD = type === 'fd';
    const r = parseFloat(rate);
    const start = new Date(startDate);
    const end = new Date(maturityDate);
    
    if ((isRD || isFD) && !isNaN(r) && start.getTime() && end.getTime() && end > start) {
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const years = diffTime / (1000 * 60 * 60 * 24 * 365.25);

      if (isFD && amt) {
        const p = parseFloat(amt);
        if (!isNaN(p) && p > 0) {
          // Compound Interest (Quarterly)
          const m = p * Math.pow((1 + (r / 400)), (4 * years));
          setMaturity(Math.round(m).toString());
        }
      } else if (isRD && emi) {
        const monthlyP = parseFloat(emi);
        if (!isNaN(monthlyP) && monthlyP > 0) {
          const nQuarters = years * 4;
          const iQuarterly = r / 400;
          // Standard Indian Bank RD Formula (Quarterly Compounding)
          // M = R * ( (1+i)^n - 1 ) / ( 1 - (1+i)^(-1/3) )
          const m = monthlyP * (Math.pow(1 + iQuarterly, nQuarters) - 1) / (1 - Math.pow(1 + iQuarterly, -1/3));
          setMaturity(Math.round(m).toString());
        }
      }
    }
  }, [amt, rate, startDate, maturityDate, type, emi]);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name || !amt || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const amount = Math.round(parseFloat(amt));
      let lastProcessedDate: string | null = null;

      // 1. Validate Balance BEFORE creating account
      if (!editingAccount) {
        if (fundSource === 'wallet' && wallet && wallet.active) {
          if (amount > wallet.free) {
            setError("Insufficient free balance in wallet for initial deposit!");
            setIsSubmitting(false);
            return;
          }
        } else if (fundSource !== 'external' && fundSource !== 'wallet') {
          const sourceAcc = accounts.find(a => a.id === fundSource);
          if (sourceAcc && amount > sourceAcc.amt) {
            setError(`Insufficient balance in ${sourceAcc.name}!`);
            setIsSubmitting(false);
            return;
          }
        }
      }

      const accountData: any = {
        uid: user.uid,
        name,
        amt: amount,
        category,
        type,
        bank,
        rate: parseFloat(rate) || 0,
        goal: goal ? Math.round(parseFloat(goal)) : null,
        maturity: maturity ? Math.round(parseFloat(maturity)) : null,
        maturityDate: maturityDate || null,
        interestEarned: interestEarned ? Math.round(parseFloat(interestEarned)) : null,
        emi: emi ? Math.round(parseFloat(emi)) : null,
        emiday: emiday ? parseInt(emiday) : null,
        start: startDate,
        payoutFrequency,
        linkedGoalId: linkedGoalId || null,
        createdAt: new Date().toISOString()
      };

      let accountId = editingAccount?.id;
      if (editingAccount) {
        await updateDoc(doc(db, 'accounts', editingAccount.id), accountData);
      } else {
        const docRef = await addDoc(collection(db, 'accounts'), accountData);
        accountId = docRef.id;
      }

      // 2. Perform Debits and Log Transactions
      if (!editingAccount && fundSource === 'wallet' && wallet && wallet.active) {
        if (amount > 0) {
          const walletRef = doc(db, 'wallets', user.uid);
          await updateDoc(walletRef, {
            balance: increment(-amount),
            free: increment(-amount)
          });

          await addDoc(collection(db, 'transactions'), {
            uid: user.uid,
            name: `Initial Deposit: ${name}`,
            amount: -amount,
            type: 'expense',
            category: 'Savings',
            emoji: '🏦',
            date: new Date().toISOString().split('T')[0],
            linkedAcc: accountId,
            createdAt: new Date().toISOString()
          });
        }
      } else if (!editingAccount && fundSource !== 'external' && fundSource !== 'wallet') {
        const sourceAcc = accounts.find(a => a.id === fundSource);
        if (sourceAcc && amount > 0) {
          await updateDoc(doc(db, 'accounts', sourceAcc.id), {
            amt: increment(-amount)
          });

          await addDoc(collection(db, 'transactions'), {
            uid: user.uid,
            name: `Transfer: ${sourceAcc.name} ➔ ${name}`,
            amount: -amount,
            type: 'expense',
            category: 'Savings',
            emoji: '🔄',
            date: new Date().toISOString().split('T')[0],
            linkedAcc: sourceAcc.id,
            createdAt: new Date().toISOString()
          });
        }
      } else if (!editingAccount && fundSource === 'external') {
        if (amount > 0) {
          await addDoc(collection(db, 'transactions'), {
            uid: user.uid,
            name: `Initial Deposit (Cash): ${name}`,
            amount: amount,
            type: 'income',
            category: 'Savings',
            emoji: '💵',
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
          });
        }
      }

      // If it's a loan, RD, or PF account with EMI/Contribution, add/update a recurring transaction to "block" the amount
      if ((type === 'loan' || type === 'rd' || ['ppf', 'nps', 'epf'].includes(type)) && emi && emiday) {
        const amount = Math.round(parseFloat(emi));
        const day = parseInt(emiday);
        
        // Use the provided start date as the base
        const start = new Date(startDate);
        const nextDate = new Date(start);
        nextDate.setDate(day);
        
        // If the calculated day is before the start date, move to next month
        if (nextDate < start) {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }

        // SMART HANDLING: If the EMI date for the current month has already passed, 
        // and we are creating a new account, assume it's already paid outside the app.
        lastProcessedDate = null;
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        if (!editingAccount && nextDate < now) {
          lastProcessedDate = nextDate.toISOString().split('T')[0];
          nextDate.setMonth(nextDate.getMonth() + 1);
        }

        // Find existing recurring transaction for this account if editing
        const existingRec = transactions.find(t => t.isRecurring && t.linkedAcc === accountId);

        const recData: any = {
          uid: user.uid,
          name: type === 'loan' ? `Loan EMI: ${name}` : 
                type === 'rd' ? `RD Installment: ${name}` : 
                `PF Contribution: ${name}`,
          amount: -Math.abs(amount),
          type: 'expense',
          category: type === 'loan' ? 'EMI/Loan' : 
                    type === 'rd' ? 'Savings' : 'Investment',
          date: nextDate.toISOString().split('T')[0],
          emoji: type === 'loan' ? '🏠' : 
                 type === 'rd' ? '🏦' : '🛡️',
          isRecurring: true,
          recurrence: 'monthly',
          linkedAcc: accountId,
          lastProcessed: lastProcessedDate, 
          isTaxDeductible: ['ppf', 'nps', 'epf'].includes(type),
          taxSection: type === 'ppf' ? '80C' : type === 'nps' ? '80CCD' : type === 'epf' ? '80C' : null,
          createdAt: new Date().toISOString()
        };

        if (existingRec) {
          await updateDoc(doc(db, 'transactions', existingRec.id), recData);
          // Trigger immediate processing
          const updatedRec = { ...existingRec, ...recData };
          await processRecurringTransactions(user.uid, transactions.map(t => t.id === existingRec.id ? updatedRec : t), accounts, wallet);
        } else {
          const recDocRef = await addDoc(collection(db, 'transactions'), recData);
          // Trigger immediate processing
          const newRec = { id: recDocRef.id, ...recData };
          await processRecurringTransactions(user.uid, [...transactions, newRec], accounts, wallet);
        }
      } else if (editingAccount) {
        // If it's no longer a recurring account (EMI removed), delete the template
        const existingRec = transactions.find(t => t.isRecurring && t.linkedAcc === editingAccount.id);
        if (existingRec) {
          await deleteDoc(doc(db, 'transactions', existingRec.id));
        }
      }

        // Update Wallet Committed Amount
        if (wallet && wallet.active) {
          const now = new Date();
          const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

          const otherRecTotal = transactions
            .filter(t => {
              if (!t.isRecurring || t.type === 'income' || t.linkedAcc === accountId) return false;
              // Only include if NOT processed this month
              if (t.lastProcessed && t.lastProcessed.startsWith(currentMonth)) return false;
              return true;
            })
            .reduce((acc, t) => acc + getMonthlyCommitment(t.amount, t.recurrence), 0);
          
          // Check if the current account's EMI was already processed (Smart Handled)
          const isAlreadyProcessed = lastProcessedDate && lastProcessedDate.startsWith(currentMonth);
          
          const currentRecAmount = !isAlreadyProcessed && (type === 'loan' || type === 'rd' || ['ppf', 'nps', 'epf'].includes(type)) && emi 
            ? getMonthlyCommitment(parseFloat(emi), 'monthly') 
            : 0;
          
          const newCommitted = Math.round(otherRecTotal + currentRecAmount);
          const diff = newCommitted - wallet.committed;
          const newFree = wallet.free - diff;

          await updateDoc(doc(db, 'wallets', user.uid), {
            committed: newCommitted,
            free: newFree
          });
        }

      setIsAddModalOpen(false);
      setEditingAccount(null);
      resetForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'accounts');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'accounts', id));
      
      // Also delete associated recurring transaction
      const recTx = transactions.find(t => t.isRecurring && t.linkedAcc === id);
      if (recTx) {
        await deleteDoc(doc(db, 'transactions', recTx.id));
        
        // Update wallet committed amount
        if (wallet && wallet.active) {
          const newRecurringTotal = transactions
            .filter(t => t.isRecurring && t.type !== 'income' && t.id !== recTx.id)
            .reduce((acc, t) => acc + getMonthlyCommitment(t.amount, t.recurrence), 0);
          
          const newCommitted = newRecurringTotal;
          const diff = newCommitted - wallet.committed;
          const newFree = wallet.free - diff;

          await updateDoc(doc(db, 'wallets', user.uid), {
            committed: newCommitted,
            free: newFree
          });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'accounts');
    }
  };

  const handleEditAccount = (acc: Account) => {
    setEditingAccount(acc);
    setName(acc.name);
    setAmt(acc.amt.toString());
    setCategory(acc.category || (acc.type === 'loan' ? 'loan' : ['ppf', 'nps', 'epf'].includes(acc.type) ? 'investment' : 'savings'));
    setType(acc.type);
    setBank(acc.bank);
    setRate(acc.rate.toString());
    setGoal(acc.goal?.toString() || '');
    setMaturity(acc.maturity?.toString() || '');
    setMaturityDate(acc.maturityDate || '');
    setInterestEarned(acc.interestEarned?.toString() || '');
    setEmi(acc.emi?.toString() || '');
    setEmiday(acc.emiday?.toString() || '');
    setStartDate(acc.start || new Date().toISOString().split('T')[0]);
    setPayoutFrequency(acc.payoutFrequency || 'at-maturity');
    setLinkedGoalId(acc.linkedGoalId || '');
    setFundSource('external'); // Default for editing
    setError(null);
    setIsAddModalOpen(true);
  };

  const handleAddRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !recName || !recAmount || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const finalAmount = recType === 'income' ? parseFloat(recAmount) : -Math.abs(parseFloat(recAmount));
      const emojiMap: Record<string, string> = {
        income: '💰',
        expense: '💳',
        investment: '📈',
        savings: '🏦'
      };

      const recData = {
        uid: user.uid,
        name: recName,
        amount: finalAmount,
        type: recType,
        category: recCategory,
        date: recDate,
        emoji: emojiMap[recType] || '💳',
        isRecurring: true,
        recurrence: recFrequency,
        linkedAcc: recLinkedAcc || null,
        createdAt: new Date().toISOString(),
        lastProcessed: null
      };

      // For recurring transactions, we only create the template.
      const recDocRef = await addDoc(collection(db, 'transactions'), recData);
      const newRec = { id: recDocRef.id, ...recData };
      
      // Trigger immediate processing for the new template only
      await processRecurringTransactions(user.uid, [newRec], accounts, wallet);

      // Update Wallet Committed Amount
      if (wallet && wallet.active && recType !== 'income') {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const currentCommitted = transactions
          .filter(t => {
            if (!t.isRecurring || t.type === 'income') return false;
            // Only include if NOT processed this month
            if (t.lastProcessed && t.lastProcessed.startsWith(currentMonth)) return false;
            return true;
          })
          .reduce((acc, t) => acc + getMonthlyCommitment(t.amount, t.recurrence), 0);
        
        // Check if the new recurring transaction was just processed
        const isNewProcessed = recDate < new Date().toISOString().split('T')[0];
        const newAmount = !isNewProcessed ? getMonthlyCommitment(finalAmount, recFrequency) : 0;
        
        const newRecurringTotal = Math.round(currentCommitted + newAmount);
        
        await updateDoc(doc(db, 'wallets', user.uid), {
          committed: newRecurringTotal,
          free: wallet.free - (newRecurringTotal - wallet.committed)
        });
      }

      setIsAddRecurringModalOpen(false);
      resetRecForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'transactions');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRecurring = async (id: string) => {
    try {
      const tx = transactions.find(t => t.id === id);
      if (!tx) return;

      await deleteDoc(doc(db, 'transactions', id));
      
      // Update wallet committed amount
      if (wallet && wallet.active && tx.type !== 'income') {
        const newRecurringTotal = transactions
          .filter(t => t.isRecurring && t.type !== 'income' && t.id !== id)
          .reduce((acc, t) => acc + getMonthlyCommitment(t.amount, t.recurrence), 0);
        
        const newCommitted = newRecurringTotal;
        const diff = newCommitted - wallet.committed;
        const newFree = wallet.free - diff;

        await updateDoc(doc(db, 'wallets', user.uid), {
          committed: newCommitted,
          free: newFree
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'transactions');
    }
  };

  const resetRecForm = () => {
    setRecName('');
    setRecAmount('');
    setRecType('expense');
    setRecCategory('Food & Dining');
    setRecDate(new Date().toISOString().split('T')[0]);
    setRecFrequency('monthly');
    setRecLinkedAcc('');
  };

  const resetForm = () => {
    setName('');
    setAmt('');
    setCategory('savings');
    setType('savings');
    setBank('');
    setRate('');
    setGoal('');
    setMaturity('');
    setMaturityDate('');
    setInterestEarned('');
    setEmi('');
    setEmiday('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setPayoutFrequency('at-maturity');
    setLinkedGoalId('');
    setFundSource('external');
    setError(null);
  };


  const savingsTotal = accounts.filter(a => a.type === 'savings').reduce((acc, a) => acc + a.amt, 0);
  const fdTotal = accounts.filter(a => a.type === 'fd').reduce((acc, a) => acc + a.amt, 0);
  const rdTotal = accounts.filter(a => a.type === 'rd').reduce((acc, a) => acc + a.amt, 0);
  const taxSavingTotal = accounts.filter(a => ['ppf', 'nps', 'epf'].includes(a.type)).reduce((acc, a) => acc + a.amt, 0);
  const loanTotal = accounts.filter(a => a.type === 'loan').reduce((acc, a) => acc + a.amt, 0);

  return (
    <div className="space-y-6">
      <ConfirmModal 
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          if (confirmDelete.type === 'account') handleDeleteAccount(confirmDelete.id);
          if (confirmDelete.type === 'recurring') handleDeleteRecurring(confirmDelete.id);
        }}
        title="Confirm Deletion"
        message={`Are you sure you want to delete this ${confirmDelete?.type}? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
      />

      {/* Tabs */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-indigo-50 shadow-sm sticky top-0 z-10 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('wallet')}
          className={cn(
            "flex-1 py-2.5 px-4 rounded-xl font-display font-bold text-sm transition-all whitespace-nowrap",
            activeTab === 'wallet' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
          )}
        >
          👛 Wallet
        </button>
        <button 
          onClick={() => setActiveTab('accounts')}
          className={cn(
            "flex-1 py-2.5 px-4 rounded-xl font-display font-bold text-sm transition-all whitespace-nowrap",
            activeTab === 'accounts' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
          )}
        >
          🏦 Accounts
        </button>
        <button 
          onClick={() => setActiveTab('recurring')}
          className={cn(
            "flex-1 py-2.5 px-4 rounded-xl font-display font-bold text-sm transition-all whitespace-nowrap",
            activeTab === 'recurring' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
          )}
        >
          🔄 Recurring
        </button>
      </div>

      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => { setIsAddModalOpen(false); setError(null); }} 
        title={editingAccount ? "Edit Account" : "Add Account"}
      >
        <form onSubmit={handleAddAccount} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl text-xs font-bold">
              ⚠️ {error}
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category</label>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {(['savings', 'investment', 'loan'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategory(cat);
                    if (cat === 'savings') setType('savings');
                    else if (cat === 'investment') setType('ppf');
                    else if (cat === 'loan') setType('loan');
                  }}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                    category === cat ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Account Type</label>
            <select 
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
            >
              {category === 'savings' && (
                <>
                  <option value="savings">Savings Account</option>
                  <option value="fd">Fixed Deposit (FD)</option>
                  <option value="rd">Recurring Deposit (RD)</option>
                </>
              )}
              {category === 'investment' && (
                <>
                  <option value="ppf">Public Provident Fund (PPF)</option>
                  <option value="nps">National Pension System (NPS)</option>
                  <option value="epf">Employees' Provident Fund (EPF)</option>
                </>
              )}
              {category === 'loan' && (
                <option value="loan">Loan / EMI</option>
              )}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Account Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Emergency Fund"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                {type === 'loan' ? 'Loan Amount (₹)' : 'Balance (₹)'}
              </label>
              <input 
                type="number" 
                value={amt}
                onChange={(e) => setAmt(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Interest Rate (%)</label>
              <input 
                type="number" 
                step="0.1"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="0.0"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Bank Name</label>
            <input 
              type="text" 
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              placeholder="e.g. HDFC Bank"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
            />
          </div>

          {(type === 'fd' || type === 'rd' || type === 'loan') && (
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                {type === 'loan' ? 'Loan Start Date' : 'Investment Start Date'}
              </label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              />
            </div>
          )}

          {(type === 'fd' || type === 'rd') && (
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Interest Payout Frequency</label>
              <select 
                value={payoutFrequency}
                onChange={(e) => setPayoutFrequency(e.target.value as any)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              >
                <option value="at-maturity">At Maturity</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="half-yearly">Half Yearly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          )}

          {(type === 'fd' || type === 'rd' || type === 'loan') && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  {type === 'loan' ? 'Due Date (Maturity)' : 'Maturity Date'}
                </label>
                <input 
                  type="date" 
                  value={maturityDate}
                  onChange={(e) => setMaturityDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  {type === 'loan' ? 'Total Repayable' : 'Maturity Amt (₹)'}
                </label>
                <input 
                  type="number" 
                  value={maturity}
                  onChange={(e) => setMaturity(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                />
              </div>
            </div>
          )}

          {(type === 'rd' || type === 'loan' || ['ppf', 'nps', 'epf'].includes(type)) && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  {type === 'loan' ? 'EMI Amount (₹)' : 
                   type === 'rd' ? 'Monthly Installment (₹)' : 
                   'Monthly Contribution (₹)'}
                </label>
                <input 
                  type="number" 
                  value={emi}
                  onChange={(e) => setEmi(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  {type === 'loan' ? 'EMI Date (Day)' : 
                   type === 'rd' ? 'Installment Day' : 
                   'Contribution Day'}
                </label>
                <input 
                  type="number" 
                  value={emiday}
                  onChange={(e) => setEmiday(e.target.value)}
                  placeholder="1-31"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                />
              </div>
            </div>
          )}

          {['ppf', 'nps', 'epf'].includes(type) && emi && (
            <p className="text-[10px] text-indigo-600 font-bold mt-1 bg-indigo-50 p-2 rounded-lg border border-indigo-100">
              ✨ Scheduled contribution of {formatCurrency(parseFloat(emi) || 0)} will be auto-debited from your wallet monthly.
            </p>
          )}

          {type === 'savings' && (
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Goal Amount (₹)</label>
              <input 
                type="number" 
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Optional"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Source of Funds</label>
            <select 
              value={fundSource}
              onChange={(e) => setFundSource(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold"
            >
              <option value="external">External / Cash (No Debit)</option>
              {wallet && wallet.active && <option value="wallet">invxtra Wallet (₹{wallet.free.toLocaleString('en-IN')})</option>}
              <optgroup label="Savings Accounts">
                {accounts.filter(a => a.type === 'savings' && (!editingAccount || a.id !== editingAccount.id)).map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.bank} - {acc.name} (₹{acc.amt.toLocaleString('en-IN')})</option>
                ))}
              </optgroup>
            </select>
            {fundSource === 'wallet' && (
              <p className="text-[9px] text-indigo-600 font-bold mt-1 px-1">
                ₹{amt || 0} will be debited from your wallet immediately.
              </p>
            )}
            {fundSource !== 'external' && fundSource !== 'wallet' && (
              <p className="text-[9px] text-indigo-600 font-bold mt-1 px-1">
                ₹{amt || 0} will be transferred from {accounts.find(a => a.id === fundSource)?.name}.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Link to Family Goal</label>
            <select 
              value={linkedGoalId}
              onChange={(e) => setLinkedGoalId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
            >
              <option value="">No Goal Linked</option>
              {familyGoals.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 text-white font-display font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 mt-4"
          >
            {isSubmitting ? "Saving..." : editingAccount ? "Update Account" : "Save Account"}
          </button>
        </form>
      </Modal>

      <Modal 
        isOpen={isAddRecurringModalOpen} 
        onClose={() => setIsAddRecurringModalOpen(false)} 
        title="Add Recurring Payment"
      >
        <form onSubmit={handleAddRecurring} className="space-y-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['expense', 'income', 'investment', 'savings'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setRecType(t)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                  recType === t ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Description</label>
            <input 
              type="text" 
              value={recName}
              onChange={(e) => setRecName(e.target.value)}
              placeholder="e.g. Netflix Subscription"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Amount (₹)</label>
              <input 
                type="number" 
                value={recAmount}
                onChange={(e) => setRecAmount(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Start Date</label>
              <input 
                type="date" 
                value={recDate}
                onChange={(e) => setRecDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                required
              />
              {new Date(recDate) <= new Date() && (
                <p className="text-[9px] text-amber-600 font-bold mt-1 px-1">
                  ⚠️ Note: Since the start date is today or in the past, the first payment will be processed immediately.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Frequency</label>
            <div className="flex gap-2">
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRecFrequency(r)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all border",
                    recFrequency === r 
                      ? "bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm" 
                      : "bg-white border-slate-100 text-slate-400"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category</label>
            <select 
              value={recCategory}
              onChange={(e) => setRecCategory(e.target.value)}
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

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Linked Account (Drawdown)</label>
            <select 
              value={recLinkedAcc}
              onChange={(e) => setRecLinkedAcc(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
            >
              <option value="">No linked account (e.g. Rent, Netflix)</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.bank} - {acc.name} ({acc.type})</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">Amount will be deducted from wallet and added to this account (or reduced if loan).</p>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 text-white font-display font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 mt-4"
          >
            {isSubmitting ? "Saving..." : "🚀 Enable Recurrence"}
          </button>
        </form>
      </Modal>

      {activeTab === 'wallet' ? (
        <div className="space-y-6">
          {!wallet || !wallet.active ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[32px] border-2 border-dashed border-indigo-100 text-center space-y-6">
              <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center text-5xl">
                👛
              </div>
              <div className="space-y-2">
                <h3 className="font-display font-extrabold text-2xl text-slate-800">No Wallet Yet</h3>
                <p className="text-slate-500 max-w-xs mx-auto text-sm leading-relaxed">
                  Set up your monthly wallet to track spending by envelope and see scheduled auto-deductions.
                </p>
              </div>
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('openWalletModal'))}
                className="bg-indigo-600 text-white font-display font-bold px-8 py-4 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
              >
                🚀 Setup Wallet
              </button>
            </div>
          ) : (
            <>
              <div className="px-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Budget Controller</p>
                <h2 className="font-display font-extrabold text-2xl">My Wallet</h2>
              </div>

              <div className="hero-gradient rounded-3xl p-6 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Wallet Balance</p>
                      <h3 className="font-display font-extrabold text-3xl tracking-tight">{formatCurrency(wallet.balance)}</h3>
                    </div>
                    <button 
                      onClick={() => window.dispatchEvent(new CustomEvent('openWalletModal'))}
                      className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-white/30 transition-colors"
                    >
                      ⚙️ Edit
                    </button>
                  </div>
                  {(() => {
                    const usedPercent = (wallet.balance && wallet.balance > 0) ? Math.round((wallet.committed / wallet.balance) * 100) : 0;
                    const barColor = usedPercent >= 100 ? "bg-red-400" : (usedPercent === 0 ? "bg-white/10" : (usedPercent > 80 ? "bg-amber-400" : "bg-emerald-400"));
                    
                    return (
                      <>
                        <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-2">
                          <div 
                            className={cn("h-full rounded-full transition-all duration-500", barColor)}
                            style={{ width: `${Math.min(100, usedPercent)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold opacity-70">
                          <span>{usedPercent}% used</span>
                          <button className="hover:underline">+ Record Spend</button>
                        </div>
                      </>
                    );
                  })()}
                  <div className="grid grid-cols-3 gap-2 mt-6 bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                    <div className="text-center border-r border-white/10">
                      <p className="text-[8px] font-black uppercase opacity-60">Balance</p>
                      <p className="text-xs font-bold">{formatCompactNumber(wallet.balance)}</p>
                    </div>
                    <div className="text-center border-r border-white/10">
                      <p className="text-[8px] font-black uppercase opacity-60">Committed</p>
                      <p className="text-xs font-bold text-red-300">{formatCompactNumber(wallet.committed)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-black uppercase opacity-60">Free</p>
                      <p className="text-xs font-bold text-emerald-300">{formatCompactNumber(wallet.free)}</p>
                    </div>
                  </div>
                </div>
              </div>

                  <section>
                <h3 className="font-display font-bold text-lg mb-4 px-2">✉️ Spending Envelopes</h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.values(wallet.envelopes).map((env: any, idx) => {
                    const isOverBudget = env.spent > env.budget;
                    const isNearLimit = env.spent > env.budget * 0.8;
                    const hasNoBudget = !env.budget || env.budget === 0;
                    
                    let statusColor = "emerald";
                    if (hasNoBudget || env.spent === 0) statusColor = "slate";
                    else if (isOverBudget) statusColor = "red";
                    else if (isNearLimit) statusColor = "amber";

                    return (
                      <EnvelopeCard 
                        key={idx}
                        icon={env.icon} 
                        name={env.name} 
                        spent={env.spent} 
                        budget={env.budget} 
                        color={statusColor} 
                      />
                    );
                  })}
                </div>
              </section>


            </>
          )}
        </div>
      ) : activeTab === 'accounts' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center px-2">
            <h2 className="font-display font-extrabold text-xl">Virtual Accounts</h2>
            <button 
              onClick={() => { setEditingAccount(null); resetForm(); setError(null); setIsAddModalOpen(true); }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-display font-bold shadow-md shadow-indigo-100 flex items-center gap-2"
            >
              <Plus size={14} /> Add Account
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <AccountStat label="Savings" value={formatCurrency(savingsTotal)} color="text-emerald-600" />
            <AccountStat label="FD Corpus" value={formatCurrency(fdTotal)} color="text-amber-600" />
            <AccountStat label="RD Corpus" value={formatCurrency(rdTotal)} color="text-purple-600" />
            <AccountStat label="Tax Savings" value={formatCurrency(taxSavingTotal)} color="text-indigo-600" />
            <AccountStat label="Outstanding" value={formatCurrency(loanTotal)} color="text-red-600" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {accounts.map(acc => (
              <AccountCard 
                key={acc.id} 
                account={acc} 
                onEdit={() => handleEditAccount(acc)}
                onDelete={() => setConfirmDelete({ type: 'account', id: acc.id })}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center px-2">
            <h2 className="font-display font-extrabold text-xl">Recurring Payments</h2>
            <button 
              onClick={() => setIsAddRecurringModalOpen(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-display font-bold shadow-md shadow-indigo-100 flex items-center gap-2"
            >
              <Plus size={14} /> Add Recurring
            </button>
          </div>

          <div className="glass-card rounded-2xl p-4 divide-y divide-slate-50">
            {transactions.filter(t => t.isRecurring).length > 0 ? (
              transactions.filter(t => t.isRecurring).map((tx) => (
                <ScheduledItem 
                  key={tx.id}
                  day={new Date(tx.date).getDate()} 
                  month={new Date(tx.date).toLocaleString('default', { month: 'short' })} 
                  name={tx.name} 
                  amount={Math.abs(tx.amount)} 
                  status={new Date(tx.date) < new Date() ? 'paid' : 'upcoming'} 
                  lastProcessed={tx.lastProcessed}
                  linkedAccountName={accounts.find(a => a.id === tx.linkedAcc)?.name}
                  onDelete={() => setConfirmDelete({ type: 'recurring', id: tx.id })}
                />
              ))
            ) : (
              <div className="p-10 text-center text-slate-400 text-sm font-medium">
                No recurring payments set up
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EnvelopeCard({ icon, name, spent, budget, color }: { icon: string, name: string, spent: number, budget: number, color: string }) {
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const colors: Record<string, string> = {
    emerald: "bg-emerald-500",
    red: "bg-red-500",
    amber: "bg-amber-500",
    slate: "bg-slate-400",
  };

  return (
    <div className="glass-card p-4 rounded-2xl relative overflow-hidden">
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-[10px] font-bold text-slate-500 mb-2">{name}</p>
      <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden mb-2">
        <div className={cn("h-full rounded-full", colors[color])} style={{ width: `${pct}%` }}></div>
      </div>
      <p className="font-display font-extrabold text-base">{formatCurrency(budget - spent)}</p>
      <p className="text-[9px] font-medium text-slate-400">Spent {formatCurrency(spent)} / {formatCurrency(budget)}</p>
      {pct > 90 && <div className="absolute inset-0 border-2 border-red-500/20 rounded-2xl pointer-events-none"></div>}
    </div>
  );
}

function ScheduledItem({ day, month, name, amount, status, lastProcessed, linkedAccountName, onDelete }: { 
  day: number, 
  month: string, 
  name: string, 
  amount: number, 
  status: 'paid' | 'due' | 'upcoming', 
  lastProcessed?: string,
  linkedAccountName?: string,
  onDelete?: () => void
}) {
  return (
    <div className="flex items-center gap-4 py-3 first:pt-0 last:pb-0 group">
      <div className={cn(
        "w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0",
        "bg-indigo-50 text-indigo-600"
      )}>
        <span className="font-display font-extrabold text-lg leading-none">{day}</span>
        <span className="text-[8px] font-black uppercase">{month}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{name}</p>
        <div className="flex flex-col">
          <p className="text-[10px] text-slate-400 font-medium">
            Next: {linkedAccountName ? `Drawdown to ${linkedAccountName}` : 'Scheduled Deduction'}
          </p>
          {lastProcessed && (
            <p className="text-[8px] text-emerald-600 font-bold uppercase mt-0.5">
              ✓ Last Paid: {new Date(lastProcessed).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </p>
          )}
        </div>
      </div>
      <div className="text-right flex items-center gap-3">
        <div>
          <p className="font-display font-extrabold text-sm">{formatCurrency(amount)}</p>
          <span className={cn(
            "text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
            "bg-amber-50 text-amber-600"
          )}>
            Upcoming
          </span>
        </div>
        {onDelete && (
          <button 
            onClick={onDelete}
            className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function AccountStat({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="glass-card p-4 rounded-2xl">
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className={cn("font-display font-extrabold text-lg", color)}>{value}</p>
    </div>
  );
}

function AccountCard({ account, onEdit, onDelete }: { account: Account, onEdit: () => void, onDelete: () => void }) {
  const { type, name, amt, bank, rate, goal, maturity, interestEarned, maturityDate, emi, emiday } = account;
  
  const typeLabels: Record<string, string> = {
    savings: 'SAVINGS',
    fd: 'FIXED DEPOSIT',
    rd: 'RECURRING DEPOSIT',
    ppf: 'PPF (80C)',
    nps: 'NPS (80CCD)',
    epf: 'EPF (80C)',
    loan: 'LOAN / EMI'
  };

  const typeColors: Record<string, string> = {
    savings: 'bg-emerald-50 text-emerald-600',
    fd: 'bg-amber-50 text-amber-600',
    rd: 'bg-purple-50 text-purple-600',
    ppf: 'bg-indigo-50 text-indigo-600',
    nps: 'bg-indigo-50 text-indigo-600',
    epf: 'bg-indigo-50 text-indigo-600',
    loan: 'bg-red-50 text-red-600'
  };

  const amountColors: Record<string, string> = {
    savings: 'text-emerald-600',
    fd: 'text-amber-600',
    rd: 'text-purple-600',
    ppf: 'text-indigo-600',
    nps: 'text-indigo-600',
    epf: 'text-indigo-600',
    loan: 'text-red-600'
  };

  const barColors: Record<string, string> = {
    savings: 'bg-emerald-500',
    fd: 'bg-amber-500',
    rd: 'bg-purple-500',
    ppf: 'bg-indigo-500',
    nps: 'bg-indigo-500',
    epf: 'bg-indigo-500',
    loan: 'bg-red-500'
  };

  const pct = goal ? Math.min(100, (amt / goal) * 100) : 0;

  return (
    <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-100 border border-slate-50 flex flex-col h-full">
      <div className="mb-4">
        <span className={cn("text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider", typeColors[type])}>
          {typeLabels[type]}
        </span>
      </div>

      <div className="flex-1">
        <h3 className="font-display font-extrabold text-xl text-slate-800 mb-1">{name}</h3>
        <p className={cn("font-display font-black text-3xl mb-2", amountColors[type])}>{formatCurrency(amt)}</p>
        <p className="text-xs font-medium text-slate-400 mb-4">
          {bank} · {rate}% p.a. {maturityDate && `· ${new Date(maturityDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}`}
        </p>

        {type === 'savings' && goal && (
          <div className="space-y-2 mb-6">
            <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-500", barColors[type])} style={{ width: `${pct}%` }}></div>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{Math.round(pct)}% of goal</p>
          </div>
        )}

        {(type === 'fd' || type === 'rd' || type === 'loan') && maturity && (
          <div className="space-y-2 mb-6">
            <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-500", barColors[type])} style={{ width: `${Math.min(100, (amt / maturity) * 100)}%` }}></div>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
              {type === 'loan' ? `${Math.round(Math.min(100, (amt / maturity) * 100))}% outstanding` : `${Math.round(Math.min(100, (amt / maturity) * 100))}% of maturity`}
            </p>
          </div>
        )}

        {(type === 'fd' || type === 'rd' || type === 'loan') && (
          <div className="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-slate-50">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                {type === 'rd' ? 'Monthly:' : type === 'loan' ? 'EMI:' : 'Interest:'}
              </p>
              <p className={cn("text-sm font-black", (type === 'rd' || type === 'loan') ? "text-slate-600" : "text-emerald-600")}>
                {(type === 'rd' || type === 'loan') ? `${formatCurrency(emi || 0)} · ${emiday}th` : `+ ${formatCurrency(interestEarned || 0)}`}
              </p>
            </div>
            <div>
              <p className={cn("text-[10px] font-black uppercase tracking-wider mb-1", type === 'loan' ? "text-red-600" : "text-amber-600")}>
                {type === 'loan' ? 'Repayable:' : 'Matures:'}
              </p>
              <p className={cn("text-sm font-black", type === 'loan' ? "text-red-600" : "text-amber-600")}>
                {formatCurrency(maturity || 0)}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-auto">
        <button 
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-slate-100 text-slate-600 font-display font-bold text-sm hover:bg-slate-50 transition-all"
        >
          <Edit size={16} className="text-amber-500" /> Edit
        </button>
        <button 
          onClick={onDelete}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-slate-100 text-slate-600 font-display font-bold text-sm hover:bg-slate-50 transition-all"
        >
          <Trash2 size={16} className="text-slate-400" /> Del
        </button>
      </div>
    </div>
  );
}


