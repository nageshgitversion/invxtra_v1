import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  Wallet, 
  Plus, 
  ArrowRight, 
  CheckCircle2, 
  PiggyBank, 
  ReceiptIndianRupee,
  Sparkles,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useFirebase } from '../lib/FirebaseProvider';
import { db } from '../lib/firebase';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';

import Logo from './Logo';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { user } = useFirebase();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps = [
    {
      title: "Welcome to invxtra",
      description: "Let's get your financial life organized in 3 simple steps.",
      icon: Sparkles,
      logo: true,
      color: "text-purple-600",
      bg: "bg-purple-50"
    },
    {
      title: "Setup Your Wallet",
      description: "Your digital wallet helps you track daily cash flow and automated savings.",
      icon: Wallet,
      logo: false,
      color: "text-indigo-600",
      bg: "bg-indigo-50"
    }
  ];

  const handleNext = async () => {
    if (step < steps.length) {
      setStep(step + 1);
    } else {
      setIsSubmitting(true);
      try {
        if (user) {
          // 1. Initialize Wallet
          await setDoc(doc(db, 'wallets', user.uid), {
            active: true,
            balance: 0,
            topup: 5000,
            committed: 0,
            free: 0,
            envelopes: {
              'housing': { name: 'Housing', icon: '🏠', budget: 0, spent: 0, cat: 'Housing' },
              'food': { name: 'Food & Dining', icon: '🍱', budget: 0, spent: 0, cat: 'Food & Dining' },
              'transport': { name: 'Transport', icon: '🚗', budget: 0, spent: 0, cat: 'Transport' },
              'groceries': { name: 'Groceries', icon: '🛒', budget: 0, spent: 0, cat: 'Groceries' },
              'healthcare': { name: 'Healthcare', icon: '🏥', budget: 0, spent: 0, cat: 'Healthcare' },
              'entertainment': { name: 'Entertainment', icon: '🎬', budget: 0, spent: 0, cat: 'Entertainment' },
              'shopping': { name: 'Shopping', icon: '🛍️', budget: 0, spent: 0, cat: 'Shopping' },
              'utilities': { name: 'Bills & Utilities', icon: '⚡', budget: 0, spent: 0, cat: 'Bills & Utilities' },
              'education': { name: 'Education', icon: '🎓', budget: 0, spent: 0, cat: 'Education' }
            }
          });
        }
        onComplete();
      } catch (error) {
        console.error("Onboarding error:", error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[40px] shadow-2xl overflow-hidden relative"
      >
        <button 
          onClick={onComplete}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all z-10"
        >
          <X size={20} />
        </button>

        <div className="p-8 space-y-8">
          {/* Progress Bar */}
          <div className="flex gap-2">
            {steps.map((_, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all duration-500",
                  idx + 1 <= step ? "bg-indigo-600" : "bg-slate-100"
                )}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 text-center"
            >
              <div className={cn(
                "w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-lg",
                steps[step-1].bg,
                steps[step-1].color
              )}>
                {steps[step-1].logo ? (
                  <Logo variant="appicon" size={48} />
                ) : (
                  React.createElement(steps[step-1].icon, { size: 40 })
                )}
              </div>

              <div className="space-y-2">
                <h2 className="font-display font-black text-2xl text-slate-900">
                  {steps[step-1].title}
                </h2>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {steps[step-1].description}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          <button
            onClick={handleNext}
            disabled={isSubmitting}
            className="w-full bg-indigo-600 text-white font-display font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                {step === steps.length ? "Finish Setup" : "Continue"}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>

        <div className="bg-slate-50 p-6 flex justify-center gap-8 border-t border-slate-100">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <CheckCircle2 size={14} className="text-emerald-500" />
            Secure
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <CheckCircle2 size={14} className="text-emerald-500" />
            Private
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <CheckCircle2 size={14} className="text-emerald-500" />
            AI-Powered
          </div>
        </div>
      </motion.div>
    </div>
  );
}
