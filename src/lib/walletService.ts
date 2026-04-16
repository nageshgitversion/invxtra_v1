import { Wallet, Account, Transaction } from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';
import { doc, updateDoc, addDoc, collection, increment } from 'firebase/firestore';
import { getMonthlyCommitment } from './utils';

export async function checkAndSweepWallet(
  uid: string,
  wallet: Wallet,
  accounts: Account[],
  transactions: Transaction[]
) {
  if (!wallet.active) return;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // If lastSweepMonth is missing, initialize it to current month (don't sweep on first run)
  if (!wallet.lastSweepMonth) {
    await updateDoc(doc(db, 'wallets', uid), {
      lastSweepMonth: currentMonth
    });
    return;
  }

  // If month has changed, perform sweep
  if (wallet.lastSweepMonth !== currentMonth) {
    const sweepAmount = wallet.free;
    
    if (sweepAmount > 0) {
      // Find a savings account to sweep into
      const savingsAcc = accounts.find(a => a.type === 'savings') || accounts[0];
      
      if (savingsAcc) {
        try {
          // 1. Create a transaction for the sweep
          await addDoc(collection(db, 'transactions'), {
            uid,
            name: 'Monthly Wallet Sweep',
            amount: -sweepAmount,
            type: 'expense',
            category: 'Savings',
            date: new Date().toISOString().split('T')[0],
            emoji: '🧹',
            isRecurring: false,
            recurrence: 'none',
            linkedAcc: savingsAcc.id,
            createdAt: new Date().toISOString()
          });

          // 2. Update the savings account balance
          await updateDoc(doc(db, 'accounts', savingsAcc.id), {
            amt: increment(sweepAmount)
          });

          // 3. Reset wallet for the new month
          // Recalculate full monthly commitment
          const recurringTransactions = transactions.filter(t => t.isRecurring && t.type !== 'income');
          
          // At the start of a new month, all recurring transactions are considered "unprocessed" 
          // for that month, so we include all of them.
          const newCommitted = Math.round(recurringTransactions.reduce((acc, t) => 
            acc + getMonthlyCommitment(t.amount, t.recurrence), 0));
          
          const newFree = wallet.balance - newCommitted;
          
          await updateDoc(doc(db, 'wallets', uid), {
            free: newFree,
            committed: newCommitted,
            topup: 0,
            lastSweepMonth: currentMonth,
            // Reset envelope spending for the new month
            envelopes: Object.fromEntries(
              Object.entries(wallet.envelopes).map(([key, env]) => [
                key,
                { ...env, spent: 0 }
              ])
            )
          });

          console.log(`Successfully swept ${sweepAmount} to ${savingsAcc.name}`);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, 'wallets');
        }
      }
    } else {
      // Even if nothing to sweep, update the month and reset envelopes
      const recurringTransactions = transactions.filter(t => t.isRecurring && t.type !== 'income');
      const newCommitted = Math.round(recurringTransactions.reduce((acc, t) => 
        acc + getMonthlyCommitment(t.amount, t.recurrence), 0));
      
      await updateDoc(doc(db, 'wallets', uid), {
        lastSweepMonth: currentMonth,
        committed: newCommitted,
        free: wallet.balance - newCommitted,
        topup: 0,
        envelopes: Object.fromEntries(
          Object.entries(wallet.envelopes).map(([key, env]) => [
            key,
            { ...env, spent: 0 }
          ])
        )
      });
    }
  }
}
