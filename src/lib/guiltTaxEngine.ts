import { Transaction, GuiltTaxRule, Account, Wallet } from '../types';
import { db } from './firebase';
import { addDoc, collection, doc, updateDoc, increment } from 'firebase/firestore';

/**
 * Guilt Tax Engine: Intercepts new transactions and applies behavioral penalty rules.
 * Automatically moves money from Wallet to a designated Savings Account.
 */
export class GuiltTaxEngine {
  static async processTransaction(
    uid: string,
    transaction: Transaction,
    rules: GuiltTaxRule[],
    wallet: Wallet,
    accounts: Account[]
  ) {
    // Only process expense transactions
    if (transaction.type !== 'expense' && transaction.type !== 'debt') return null;

    // Find applicable rules for this category
    const applicableRules = rules.filter(r => r.active && r.category === transaction.category);

    for (const rule of applicableRules) {
      // Check if limit is exceeded
      // Note: In a real app, we would sum up the month's spending, 
      // but for this engine piece, let's assume the transaction itself is being checked against the limit
      // or we check the current envelope spend.
      
      const categorySpent = wallet.envelopes[transaction.category]?.spent || 0;
      const amount = Math.abs(transaction.amount);
      
      // If we are already over limit or this transaction pushes us over
      if (categorySpent + amount > rule.limit) {
        // Calculate the "overage" part of this transaction
        const previousSpent = categorySpent;
        const currentSpent = categorySpent + amount;
        
        let overage = 0;
        if (previousSpent >= rule.limit) {
          overage = amount;
        } else {
          overage = currentSpent - rule.limit;
        }

        if (overage > 0) {
          const penalty = Math.round(overage * rule.taxRate);
          
          if (penalty > 0) {
            // Find target account
            const targetAcc = accounts.find(a => a.id === rule.targetAccountId);
            if (!targetAcc) continue;

            // 1. Create the penalty "Transfer" transaction
            const penaltyTx = {
              uid,
              name: `Guilt Tax: ${transaction.category} limit error`,
              amount: -penalty,
              type: 'savings',
              category: 'Savings',
              subCategory: 'Guilt Tax',
              emoji: '⚖️',
              date: new Date().toISOString().split('T')[0],
              isGuiltTax: true,
              linkedAcc: targetAcc.id,
              note: `Penalty for exceeding ${transaction.category} limit of ₹${rule.limit}`,
              createdAt: new Date().toISOString()
            };

            await addDoc(collection(db, 'transactions'), penaltyTx);

            // 2. Update the target account balance
            await updateDoc(doc(db, 'accounts', targetAcc.id), {
              amt: increment(penalty)
            });

            // 3. Update the wallet balance (penalty comes out of wallet)
            await updateDoc(doc(db, 'wallets', uid), {
              balance: increment(-penalty),
              free: increment(-penalty)
            });

            // 4. Record the total taxed in the rule
            await updateDoc(doc(db, 'guiltTaxRules', rule.id), {
              totalTaxed: increment(penalty)
            });

            return {
              penalty,
              targetAccount: targetAcc.name
            };
          }
        }
      }
    }
    
    return null;
  }
}
