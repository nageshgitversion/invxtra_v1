import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Trash2, AlertTriangle, RefreshCcw, ShieldCheck, Database } from 'lucide-react';
import { useFirebase } from '../lib/FirebaseProvider';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc, writeBatch, addDoc, updateDoc } from 'firebase/firestore';

export default function Settings() {
  const { user, fines, familyGoals } = useFirebase();
  const [isResetting, setIsResetting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleResetEverything = async () => {
    if (!user) return;
    setIsResetting(true);
    
    try {
      const collections = [
        'transactions',
        'holdings',
        'accounts',
        'familyGoals',
        'familyMembers',
        'splits'
      ];

      const batch = writeBatch(db);

      // Delete documents in collections
      for (const collName of collections) {
        const q = query(collection(db, collName), where('uid', '==', user.uid));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach((d) => {
          batch.delete(d.ref);
        });
      }

      // Delete wallet document
      const walletRef = doc(db, 'wallets', user.uid);
      batch.delete(walletRef);

      await batch.commit();
      
      // Clear onboarding flag
      localStorage.removeItem(`wealthos_onboarding_${user.uid}`);
      
      setShowConfirm(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'multiple-collections');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="px-2 pt-2">
        <p className="text-slate-400 text-xs font-medium">System</p>
        <h2 className="font-display font-extrabold text-3xl text-slate-900">Settings</h2>
      </div>

      <div className="glass-card p-6 rounded-[32px] space-y-8">
        {/* Data Management Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-indigo-600">
            <Database size={20} />
            <h3 className="font-display font-bold text-lg">Data Management</h3>
          </div>
          
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 space-y-4">
            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-50 border border-emerald-100 text-emerald-700 p-4 rounded-xl text-sm font-bold text-center"
              >
                ✓ All data has been reset successfully.
              </motion.div>
            )}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-600 shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="font-display font-bold text-red-900">Reset Everything</h4>
                <p className="text-sm text-red-700 leading-relaxed">
                  This action will permanently delete all your transactions, accounts, holdings, and wallet configurations. This cannot be undone.
                </p>
              </div>
            </div>

            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="w-full bg-white border border-red-200 text-red-600 font-display font-bold py-3 rounded-xl hover:bg-red-50 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={18} />
                Reset All Data
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-black text-red-800 uppercase text-center tracking-widest">Are you absolutely sure?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 bg-white border border-slate-200 text-slate-600 font-display font-bold py-3 rounded-xl hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResetEverything}
                    disabled={isResetting}
                    className="flex-1 bg-red-600 text-white font-display font-bold py-3 rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isResetting ? (
                      <RefreshCcw size={18} className="animate-spin" />
                    ) : (
                      <Trash2 size={18} />
                    )}
                    Yes, Reset Everything
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Behavioral Fines Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-indigo-600">
            <AlertTriangle size={20} />
            <h3 className="font-display font-bold text-lg">Behavioral Spending Fines</h3>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6">
            <p className="text-sm text-slate-600 mb-6">
              Set limits on your bad spending habits. If you exceed the limit in a month, invxtra will automatically transfer the fine amount from your wallet to a savings goal.
            </p>
            <SpendingFinesSection user={user} fines={fines} familyGoals={familyGoals} />
          </div>
        </section>

        {/* Security Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-indigo-600">
            <ShieldCheck size={20} />
            <h3 className="font-display font-bold text-lg">Security & Privacy</h3>
          </div>
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
            <p className="text-sm text-slate-600">
              Your data is encrypted and stored securely in Google Cloud. We never share your financial information with third parties.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function SpendingFinesSection({ user, fines, familyGoals }: any) {
  const [category, setCategory] = useState('Dining');
  const [limit, setLimit] = useState('');
  const [fineAmount, setFineAmount] = useState('');
  const [targetGoalId, setTargetGoalId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddFine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !limit || !fineAmount || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'fines'), {
        uid: user.uid,
        category,
        limit: parseFloat(limit),
        fineAmount: parseFloat(fineAmount),
        targetGoalId,
        active: true
      });
      setLimit('');
      setFineAmount('');
      setCategory('Dining');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFine = async (id: string, active: boolean) => {
    await updateDoc(doc(db, 'fines', id), { active: !active });
  };

  const deleteFine = async (id: string) => {
    await deleteDoc(doc(db, 'fines', id));
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleAddFine} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end bg-white p-4 rounded-xl border border-indigo-50 shadow-sm">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400">Category</label>
          <input 
            type="text" 
            value={category} 
            onChange={e => setCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-indigo-500/20 text-sm"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400">Monthly Limit (₹)</label>
          <input 
            type="number" 
            value={limit} 
            onChange={e => setLimit(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-indigo-500/20 text-sm"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400">Fine Amount (₹)</label>
          <input 
            type="number" 
            value={fineAmount} 
            onChange={e => setFineAmount(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-indigo-500/20 text-sm"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400">Transfer To Goal</label>
          <select 
            value={targetGoalId} 
            onChange={e => setTargetGoalId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-indigo-500/20 text-sm"
          >
            <option value="">None (Just deduct from wallet)</option>
            {familyGoals.map((g: any) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <button 
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm shadow-md hover:bg-indigo-700 disabled:opacity-50"
        >
          Add Rule
        </button>
      </form>

      <div className="space-y-3">
        {fines.map((fine: any) => (
          <div key={fine.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
            <div>
              <p className="font-bold text-sm">If {fine.category} {'>'} ₹{fine.limit}</p>
              <p className="text-xs text-slate-500">Fine: ₹{fine.fineAmount} → {familyGoals.find((g:any) => g.id === fine.targetGoalId)?.name || 'Wallet deduction'}</p>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => toggleFine(fine.id, fine.active)}
                className={`w-10 h-5 rounded-full transition-all relative ${fine.active ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${fine.active ? 'right-1' : 'left-1'}`}></div>
              </button>
              <button onClick={() => deleteFine(fine.id)} className="text-slate-400 hover:text-red-500">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {fines.length === 0 && (
          <p className="text-center text-xs text-slate-400 font-medium py-4">No fine rules set up yet.</p>
        )}
      </div>
    </div>
  );
}
