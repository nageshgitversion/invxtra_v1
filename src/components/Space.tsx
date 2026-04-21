import React from 'react';
import { Home, Users, ArrowRight, ShieldCheck, Receipt } from 'lucide-react';
import { useFirebase } from '../lib/FirebaseProvider';
import { formatCurrency, formatCompactNumber } from '../lib/utils';
import { motion } from 'motion/react';

interface SpaceProps {
  setActiveTab: (tab: string) => void;
}

export default function Space({ setActiveTab }: SpaceProps) {
  const { user, familyMembers, familyGoals, splits } = useFirebase();

  // Smart Split calculations
  const totalIOwe = React.useMemo(() => {
    if (!user || !splits) return 0;
    return splits
      .filter(s => s.status === 'pending' && s.payerUid !== user.uid && s.participants?.[user.uid])
      .reduce((acc, s) => acc + (s.participants?.[user.uid] || 0), 0);
  }, [splits, user]);

  const totalOwedToMe = React.useMemo(() => {
    if (!user || !splits) return 0;
    return splits
      .filter(s => s.status === 'pending' && s.payerUid === user.uid)
      .reduce((acc, s) => {
        const othersShare = Object.entries(s.participants || {})
          .filter(([uid]) => uid !== user.uid)
          .reduce((sum, [, share]) => sum + share, 0);
        return acc + othersShare;
      }, 0);
  }, [splits, user]);

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4">
        <div>
          <h2 className="text-3xl font-display font-black tracking-tight text-slate-900">Your Space</h2>
          <p className="text-slate-500 font-medium mt-1">Manage shared finances, family goals, and group expenses.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-4">
        {/* Household Card */}
        <motion.div 
          onClick={() => setActiveTab('household')}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.3, delay: 0.0 }}
          className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-3 md:mb-6">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
              <Home size={20} className="md:w-6 md:h-6" />
            </div>
            <div className="p-1.5 md:p-2 bg-slate-50 rounded-lg md:rounded-xl group-hover:bg-indigo-50 transition-colors">
              <ArrowRight size={12} className="text-slate-400 group-hover:text-indigo-600 md:w-4 md:h-4" />
            </div>
          </div>
          <div>
            <p className="text-[9px] md:text-xs font-black uppercase tracking-widest text-slate-400 mb-0.5 md:mb-1">Household</p>
            <h3 className="font-display font-black text-lg md:text-2xl text-slate-900 mb-1 md:mb-2 leading-tight">
              Family & Goals
            </h3>
            <p className="text-[10px] md:text-sm font-medium text-slate-500 line-clamp-1">
              {familyMembers.length} Members
            </p>
          </div>
        </motion.div>

        {/* Smart Split Card */}
        <motion.div 
          onClick={() => setActiveTab('split')}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-3 md:mb-6">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <Receipt size={20} className="md:w-6 md:h-6" />
            </div>
            <div className="p-1.5 md:p-2 bg-slate-50 rounded-lg md:rounded-xl group-hover:bg-emerald-50 transition-colors">
              <ArrowRight size={12} className="text-slate-400 group-hover:text-emerald-600 md:w-4 md:h-4" />
            </div>
          </div>
          <div>
            <p className="text-[9px] md:text-xs font-black uppercase tracking-widest text-slate-400 mb-0.5 md:mb-1">Smart Split</p>
            <h3 className="font-display font-black text-lg md:text-2xl text-slate-900 mb-1 md:mb-2 leading-tight">
              {totalOwedToMe > totalIOwe ? (
                <span className="text-emerald-600">+ ₹{formatCompactNumber(totalOwedToMe - totalIOwe)}</span>
              ) : totalIOwe > totalOwedToMe ? (
                <span className="text-red-600">- ₹{formatCompactNumber(totalIOwe - totalOwedToMe)}</span>
              ) : (
                <small className="text-slate-900 text-sm">Settled Up</small>
              )}
            </h3>
            <p className="text-[10px] md:text-sm font-medium text-slate-500">
              {splits.filter(s => s.status === 'pending').length} Bills
            </p>
          </div>
        </motion.div>

        {/* Info Card - Shared Security */}
        <motion.div 
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-slate-900 p-5 md:p-6 rounded-[24px] md:rounded-[32px] shadow-sm col-span-2 md:col-span-2 text-white overflow-hidden relative"
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-indigo-400 mb-2">
                <ShieldCheck size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">Secure Space</span>
              </div>
              <h3 className="font-display font-black text-xl mb-1">Shared Financial Privacy</h3>
              <p className="text-slate-400 text-sm max-w-md">Household members can see shared goals but cannot access your private accounts or wallet unless explicitly shared.</p>
            </div>
            <button 
              onClick={() => setActiveTab('household')}
              className="px-6 py-3 bg-white text-slate-900 rounded-2xl font-display font-black text-xs hover:bg-indigo-50 transition-all self-start md:self-center"
            >
              Manage Access
            </button>
          </div>
          <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
            <Users size={160} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
