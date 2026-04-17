import React, { useMemo, useState } from 'react';
import { Transaction } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { Mail, RefreshCw, CheckCircle, Copy, Check } from 'lucide-react';
import { generateNegotiationEmail } from '../services/geminiService';
import Modal from './Modal';

interface SubscriptionManagerProps {
  transactions: Transaction[];
}

export default function SubscriptionManager({ transactions }: SubscriptionManagerProps) {
  const [selectedSub, setSelectedSub] = useState<Transaction | null>(null);
  const [emailDraft, setEmailDraft] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const subscriptions = useMemo(() => {
    // A subscription is a recurring expense
    return transactions.filter(t => t.isRecurring && t.type === 'expense');
  }, [transactions]);

  const handleNegotiate = async (sub: Transaction) => {
    setSelectedSub(sub);
    setIsGenerating(true);
    const draft = await generateNegotiationEmail(sub.name, Math.abs(sub.amount));
    setEmailDraft(draft);
    setIsGenerating(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(emailDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (subscriptions.length === 0) return null;

  return (
    <div className="glass-card p-6 rounded-[32px]">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <Mail size={20} />
        </div>
        <div>
          <h3 className="font-display font-bold text-lg">Subscription Negotiator</h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Bill Reducer</p>
        </div>
      </div>

      <div className="space-y-3">
        {subscriptions.map(sub => (
          <div key={sub.id} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 hover:border-indigo-100 transition-all shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xl">
                {sub.emoji}
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900">{sub.name}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                  {formatCurrency(Math.abs(sub.amount))} / {sub.recurrence}
                </p>
              </div>
            </div>
            <button 
              onClick={() => handleNegotiate(sub)}
              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold transition-colors"
            >
              Negotiate
            </button>
          </div>
        ))}
      </div>

      <Modal isOpen={!!selectedSub} onClose={() => setSelectedSub(null)} title="Negotiation Email">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 font-medium">
            Send this AI-generated email to <span className="font-bold">{selectedSub?.name}</span> customer support to request a lower rate.
          </p>

          <div className="relative">
            {isGenerating ? (
              <div className="p-8 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-indigo-600">
                <RefreshCw size={24} className="animate-spin mb-2" />
                <p className="text-xs font-bold uppercase tracking-widest animate-pulse">Drafting Email...</p>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                {emailDraft}
              </div>
            )}
            
            {!isGenerating && emailDraft && (
              <button 
                onClick={copyToClipboard}
                className="absolute top-3 right-3 p-2 bg-white rounded-lg shadow-sm text-slate-500 hover:text-indigo-600 transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
              </button>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              onClick={() => setSelectedSub(null)}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all"
            >
              Close
            </button>
            <button 
              onClick={() => {
                const subject = `Account Inquiry: Rate Adjustment Request`;
                window.open(`mailto:support@example.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailDraft)}`);
              }}
              disabled={isGenerating}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Mail size={16} /> Open in Mail App
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
