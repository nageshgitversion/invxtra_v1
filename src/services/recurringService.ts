import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { Transaction, RecurrenceFrequency, Wallet } from '../types';

/**
 * Processes recurring transactions for a user.
 * Checks if any recurring templates are due for a new instance and creates them.
 */
export async function processRecurringTransactions(userId: string, transactions: Transaction[]) {
  // Only process transactions marked as recurring templates
  const recurringTemplates = transactions.filter(t => t.isRecurring && t.recurrence && t.recurrence !== 'none');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get current wallet to update balances
  const walletRef = doc(db, 'wallets', userId);
  const walletSnap = await getDoc(walletRef);
  let walletData = walletSnap.exists() ? walletSnap.data() as Wallet : null;

  for (const template of recurringTemplates) {
    // Use lastProcessed if available, otherwise fallback to the original transaction date
    let lastDate = template.lastProcessed ? new Date(template.lastProcessed) : new Date(template.date);
    lastDate.setHours(0, 0, 0, 0);

    let nextDate = getNextOccurrence(lastDate, template.recurrence!);
    
    const newTransactions = [];
    let currentProcessingDate = new Date(nextDate);
    
    // Generate all instances that are due up to today
    while (currentProcessingDate <= today) {
      const dateStr = currentProcessingDate.toISOString().split('T')[0];
      
      const newTx = {
        uid: userId,
        name: template.name,
        amount: template.amount,
        type: template.type,
        category: template.category,
        date: dateStr,
        emoji: template.emoji,
        isRecurring: false, // Generated instances are not recurring templates themselves
        createdAt: new Date().toISOString()
      };
      
      newTransactions.push(newTx);
      
      // Move to the next occurrence
      const prevDate = new Date(currentProcessingDate);
      currentProcessingDate = getNextOccurrence(prevDate, template.recurrence!);
    }

    if (newTransactions.length > 0) {
      try {
        // Add all due transactions to Firestore
        for (const tx of newTransactions) {
          await addDoc(collection(db, 'transactions'), tx);
        }
        
        // Update the template's lastProcessed date to the date of the last generated instance
        const lastGeneratedDate = newTransactions[newTransactions.length - 1].date;
        await updateDoc(doc(db, 'transactions', template.id), {
          lastProcessed: lastGeneratedDate
        });

        // Update Wallet if available
        if (walletData) {
          let totalChange = newTransactions.reduce((acc, tx) => acc + tx.amount, 0);
          walletData.balance += totalChange;
          walletData.free += totalChange;

          const updates: any = {
            balance: walletData.balance,
            free: walletData.free
          };

          // Update envelopes for expenses
          const categoryToEnvelope: Record<string, string> = {
            'Food & Dining': 'food',
            'Groceries': 'groceries',
            'Transport': 'transport',
            'Shopping': 'shopping'
          };

          for (const tx of newTransactions) {
            if (tx.type === 'expense') {
              const envKey = categoryToEnvelope[tx.category];
              if (envKey && walletData.envelopes[envKey]) {
                walletData.envelopes[envKey].spent += Math.abs(tx.amount);
                updates[`envelopes.${envKey}.spent`] = walletData.envelopes[envKey].spent;
              }
            }
          }

          await updateDoc(walletRef, updates);
        }
        
        console.log(`Processed ${newTransactions.length} recurring instances for: ${template.name}`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'transactions');
      }
    }
  }
}

/**
 * Calculates the next occurrence date based on frequency.
 */
function getNextOccurrence(date: Date, frequency: RecurrenceFrequency): Date {
  const next = new Date(date);
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
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      break;
  }
  return next;
}
