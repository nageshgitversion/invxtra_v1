import { Transaction, RecurrenceFrequency, Account, Wallet } from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, addDoc, doc, updateDoc, increment, getDoc } from 'firebase/firestore';

export async function processRecurringTransactions(
  uid: string,
  transactions: Transaction[],
  accounts: Account[],
  wallet: Wallet | null,
  holdings: any[] = []
) {
  const now = new Date();
  
  // 1. Process Scheduled One-Time Transactions
  const oneTimeScheduled = transactions.filter(t => !t.isRecurring && t.status === 'scheduled');
  for (const tx of oneTimeScheduled) {
    const txDate = new Date(tx.date);
    txDate.setHours(0, 0, 0, 0);
    
    if (txDate <= now) {
      try {
        const amount = tx.amount || 0;
        
        // Update Wallet Balance
        if (tx.linkedAcc === 'wallet' && wallet) {
          const walletRef = doc(db, 'wallets', uid);
          await updateDoc(walletRef, {
            balance: increment(amount),
            committed: increment(-Math.abs(amount))
          });
        } else if (tx.linkedAcc && tx.linkedAcc !== 'external') {
           // For non-wallet accounts, we already debited 'amt' when creating the scheduled record?
           // Actually, currently Transactions.tsx only has Hold logic for WALLET.
           // For other accounts, it's a direct debit (simpler for now).
        }

        // Mark as completed
        await updateDoc(doc(db, 'transactions', tx.id), {
          status: 'completed'
        });
        
        console.log(`Processed scheduled one-time transaction: ${tx.name}`);
      } catch (err) {
        console.error(`Error processing scheduled transaction ${tx.id}:`, err);
      }
    }
  }

  // 2. Process Recurring Templates
  const templateMap = new Map<string, Transaction>();
  transactions.filter(t => t.isRecurring).forEach(t => {
    if (t.id) templateMap.set(t.id, t);
  });
  const recurringTemplates = Array.from(templateMap.values());

  for (const template of recurringTemplates) {
    // Use lastProcessed to find the next date, or start with the template's initial date
    let nextDate = template.lastProcessed 
      ? getNextOccurrence(new Date(template.lastProcessed), template.recurrence)
      : new Date(template.date);
    
    nextDate.setHours(0, 0, 0, 0);

    // Process all occurrences up to today
    while (nextDate <= now) {
      try {
        const finalAmount = template.amount || 0;
        const dateStr = nextDate.toISOString().split('T')[0];

        // 1. Create the actual transaction record
        await addDoc(collection(db, 'transactions'), {
          uid,
          name: template.name,
          amount: finalAmount,
          type: template.type,
          category: template.category,
          subCategory: template.subCategory || (template.type === 'expense' ? 'Housing' : template.type === 'income' ? 'Income' : 'Other'),
          targetId: template.targetId || null,
          date: dateStr,
          emoji: template.emoji,
          isRecurring: false,
          recurrence: 'none',
          linkedAcc: template.linkedAcc || null,
          createdAt: new Date().toISOString()
        });

        // 2. Drawdown from Wallet/Savings
        const sourceAccId = template.linkedAcc || 'wallet';
        if (sourceAccId === 'wallet' && wallet) {
          const walletRef = doc(db, 'wallets', uid);
          const walletUpdates: any = {
            balance: increment(finalAmount)
          };
          
          if (template.type === 'income') {
            walletUpdates.free = increment(finalAmount);
          } else {
            // Expenses/Debt: Decreases the assigned commitment
            walletUpdates.committed = increment(-Math.abs(finalAmount));
          }
          
          await updateDoc(walletRef, walletUpdates);
        } else if (sourceAccId !== 'external' && sourceAccId !== 'wallet') {
          const account = accounts.find(a => a.id === sourceAccId);
          if (account) {
            const accountRef = doc(db, 'accounts', account.id);
            await updateDoc(accountRef, {
              amt: increment(finalAmount)
            });
          }
        }

        // 3. Update Target Account/Holding (The "Impact" target)
        if (template.targetId) {
          const targetId = template.targetId;
          const targetAcc = accounts.find(a => a.id === targetId);
          const targetHolding = holdings.find(h => h.id === targetId);

          if (template.type === 'debt' && targetAcc) {
            // Debt reduction: EMI reduces Loan principal
            await updateDoc(doc(db, 'accounts', targetId), {
              amt: increment(finalAmount) // Reducing principal (e.g. 42L - 35k)
            });
          } else if (template.type === 'investment' || template.type === 'savings') {
            // Investment/Savings: Increase target balance
            const impactAmount = Math.abs(finalAmount);
            if (targetAcc) {
              await updateDoc(doc(db, 'accounts', targetId), {
                amt: increment(impactAmount)
              });
            } else if (targetHolding) {
              await updateDoc(doc(db, 'holdings', targetId), {
                invested: increment(impactAmount),
                current: increment(impactAmount)
              });
            }
          }
        }

        console.log(`Processed recurring transaction: ${template.name} for ${dateStr}`);
        
        // Move to next occurrence
        const prevDate = new Date(nextDate);
        nextDate = getNextOccurrence(prevDate, template.recurrence);

        // 4. Update the template's lastProcessed and date in ONE call
        await updateDoc(doc(db, 'transactions', template.id), {
          lastProcessed: dateStr,
          date: nextDate.toISOString().split('T')[0]
        });
      } catch (err) {
        console.error(`Error processing recurring transaction ${template.id}:`, err);
        break;
      }
    }
  }

  // Handle Interest Payouts from Accounts
  for (const account of accounts) {
    if (account.payoutFrequency && account.payoutFrequency !== 'at-maturity' && account.rate > 0 && account.amt > 0) {
      let lastPayout = account.lastPayoutDate ? new Date(account.lastPayoutDate) : new Date(account.start);
      let nextPayout = getNextOccurrence(lastPayout, account.payoutFrequency as any);
      nextPayout.setHours(0, 0, 0, 0);

      while (nextPayout <= now) {
        try {
          const frequencyMonths: Record<string, number> = {
            'monthly': 1,
            'quarterly': 3,
            'half-yearly': 6,
            'yearly': 12
          };
          const months = frequencyMonths[account.payoutFrequency] || 0;
          const interestAmount = Math.round((account.amt * account.rate * months) / 1200);
          const dateStr = nextPayout.toISOString().split('T')[0];

          if (interestAmount > 0) {
            // 1. Create Income Transaction
            await addDoc(collection(db, 'transactions'), {
              uid,
              name: `Interest Payout: ${account.name}`,
              amount: interestAmount,
              type: 'income',
              category: 'Investment',
              date: dateStr,
              emoji: '💰',
              isRecurring: false,
              recurrence: 'none',
              linkedAcc: account.id,
              createdAt: new Date().toISOString()
            });

            // 2. Update Wallet Balance
            if (wallet) {
              const walletRef = doc(db, 'wallets', uid);
              await updateDoc(walletRef, {
                balance: increment(interestAmount),
                free: increment(interestAmount)
              });
            }
            
            // 3. Update Account's lastPayoutDate
            await updateDoc(doc(db, 'accounts', account.id), {
              lastPayoutDate: dateStr,
              interestEarned: increment(interestAmount)
            });
          }

          lastPayout = nextPayout;
          nextPayout = getNextOccurrence(lastPayout, account.payoutFrequency as any);
        } catch (err) {
          console.error(`Error processing interest payout for account ${account.id}:`, err);
          break;
        }
      }
    }
  }
}

export function getNextOccurrence(lastDate: Date, frequency: RecurrenceFrequency): Date {
  const next = new Date(lastDate);
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'half-yearly':
      next.setMonth(next.getMonth() + 6);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}