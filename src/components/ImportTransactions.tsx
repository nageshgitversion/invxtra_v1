import React, { useState } from 'react';
import { Upload, Check, AlertCircle, FileText, Sparkles, X } from 'lucide-react';
import { useFirebase } from '../lib/FirebaseProvider';
import { autoCategorizeTransactions } from '../services/geminiService';
import { addDoc, collection, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Modal from './Modal';
import { cn } from '../lib/utils';

interface ImportTransactionsProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportTransactions({ isOpen, onClose, onSuccess }: ImportTransactionsProps) {
  const { user } = useFirebase();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [step, setStep] = useState<'upload' | 'review'>('upload');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const processFile = async () => {
    if (!file || !user) return;
    setIsProcessing(true);

    try {
      const text = await file.text();
      // Basic CSV parsing: assuming Date, Description, Amount
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      
      const rawTransactions = lines.slice(1).map(line => {
        // Simple split, won't handle quotes well but good for MVP
        const parts = line.split(',');
        return {
          date: parts[0]?.trim() || new Date().toISOString().split('T')[0],
          description: parts[1]?.trim() || 'Unknown',
          amount: parseFloat(parts[2]?.trim() || '0')
        };
      }).filter(t => !isNaN(t.amount));

      // Send to Gemini
      const categorized = await autoCategorizeTransactions(rawTransactions);
      
      // Merge
      const merged = rawTransactions.map((raw, i) => ({
        ...raw,
        name: categorized[i]?.name || raw.description,
        category: categorized[i]?.category || 'Other',
        emoji: categorized[i]?.emoji || '💳',
        type: raw.amount > 0 ? 'income' : 'expense'
      }));

      setPreviewData(merged);
      setStep('review');
    } catch (error) {
      console.error("File processing error", error);
      alert("Error processing file. Please ensure it's a CSV with Date, Description, Amount.");
    } finally {
      setIsProcessing(false);
    }
  };

  const saveTransactions = async () => {
    if (!user) return;
    setIsProcessing(true);

    try {
      // Save all to firestore
      const promises = previewData.map(tx => {
        const amt = tx.type === 'income' ? Math.abs(tx.amount) : -Math.abs(tx.amount);
        return addDoc(collection(db, 'transactions'), {
          uid: user.uid,
          name: tx.name,
          amount: amt,
          type: tx.type,
          category: tx.category,
          date: tx.date,
          emoji: tx.emoji,
          isRecurring: false,
          recurrence: 'none',
          linkedAcc: 'wallet',
          createdAt: new Date().toISOString()
        });
      });

      await Promise.all(promises);

      // Update wallet balance and envelopes
      const walletRef = doc(db, 'wallets', user.uid);
      const walletSnap = await getDoc(walletRef);
      if (walletSnap.exists()) {
        const walletData = walletSnap.data();
        let totalChange = 0;
        const envUpdates: any = {};

        previewData.forEach(tx => {
          const amt = tx.type === 'income' ? Math.abs(tx.amount) : -Math.abs(tx.amount);
          totalChange += amt;

          if (tx.type === 'expense' && walletData.envelopes) {
            const envEntry = Object.entries(walletData.envelopes).find(([_, env]: [string, any]) => 
              env.cat.toLowerCase() === tx.category.toLowerCase() || 
              env.name.toLowerCase() === tx.category.toLowerCase()
            );
            if (envEntry) {
              const [envKey, envData] = envEntry;
              envUpdates[`envelopes.${envKey}.spent`] = increment(Math.abs(amt));
            }
          }
        });

        await updateDoc(walletRef, {
          balance: increment(totalChange),
          free: increment(totalChange),
          ...envUpdates
        });
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Saving error", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Smart CSV Import">
      {step === 'upload' ? (
        <div className="space-y-6">
          <div className="p-6 border-2 border-dashed border-indigo-200 rounded-2xl bg-indigo-50/30 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-indigo-500 mb-4">
              <Upload size={24} />
            </div>
            <h3 className="font-display font-bold text-lg">Upload Bank Statement</h3>
            <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
              Upload a CSV file with Date, Description, and Amount columns. Gemini AI will automatically categorize them.
            </p>
            
            <input 
              type="file" 
              accept=".csv"
              onChange={handleFileUpload}
              className="mt-6 block w-full text-sm text-slate-500
                file:mr-4 file:py-2.5 file:px-4
                file:rounded-xl file:border-0
                file:text-xs file:font-bold
                file:bg-indigo-600 file:text-white
                hover:file:bg-indigo-700 cursor-pointer"
            />
          </div>

          <button 
            onClick={processFile}
            disabled={!file || isProcessing}
            className="w-full bg-indigo-600 text-white font-display font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <span className="animate-pulse flex items-center gap-2"><Sparkles size={16}/> AI is categorizing...</span>
            ) : (
              <span className="flex items-center gap-2"><Sparkles size={16}/> Process with AI</span>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl flex items-center gap-2 text-sm font-bold">
            <Check size={16} /> AI categorized {previewData.length} transactions successfully.
          </div>
          
          <div className="max-h-60 overflow-y-auto space-y-2 no-scrollbar border border-slate-100 rounded-xl p-2 bg-slate-50">
            {previewData.map((tx, idx) => (
              <div key={idx} className="bg-white p-3 rounded-lg border border-slate-100 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-xl">
                    {tx.emoji}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900">{tx.name}</p>
                    <p className="text-[10px] text-slate-500">{tx.category} • {tx.date}</p>
                  </div>
                </div>
                <div className={cn("font-bold text-sm", tx.amount > 0 ? "text-emerald-600" : "text-slate-900")}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              onClick={() => { setStep('upload'); setFile(null); }}
              className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200"
            >
              Cancel
            </button>
            <button 
              onClick={saveTransactions}
              disabled={isProcessing}
              className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-md shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50"
            >
              {isProcessing ? "Saving..." : "Save to Ledger"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
