import React, { useState } from 'react';
import { Users, Plus, Target, ShieldCheck, Heart, Trash2, Link, Copy, Check, WalletCards, Coins, Landmark, ArrowLeft } from 'lucide-react';
import { useFirebase } from '../lib/FirebaseProvider';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, increment, writeBatch } from 'firebase/firestore';
import { FamilyMember, FamilyGoal } from '../types';
import { formatCurrency, formatCompactNumber, triggerConfetti, cn } from '../lib/utils';
import { motion } from 'motion/react';
import Modal from './Modal';

export default function Household({ onBack }: { onBack?: () => void }) {
  const { user, userProfile, familyMembers, familyGoals, sharedEnvelopes, wallet } = useFirebase();
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
  const [isContributeOpen, setIsContributeOpen] = useState<{goalId: string} | null>(null);
  
  const [isCopied, setIsCopied] = useState(false);
  
  // Form states
  const [memberName, setMemberName] = useState('');
  const [memberUid, setMemberUid] = useState(''); // Added for inviting by ID
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalEta, setGoalEta] = useState(''); // Manual ETA
  const [goalIsShared, setGoalIsShared] = useState(true); // Toggle for shared vs personal
  const [contribAmount, setContribAmount] = useState('');
  const [contribMemberId, setContribMemberId] = useState('');
  const [goalInvited, setGoalInvited] = useState('');

  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Shared Envelopes states
  const [isAddEnvelopeOpen, setIsAddEnvelopeOpen] = useState(false);
  const [isFundEnvelopeOpen, setIsFundEnvelopeOpen] = useState<{envelopeId: string} | null>(null);
  const [isSpendEnvelopeOpen, setIsSpendEnvelopeOpen] = useState<{envelopeId: string} | null>(null);

  const [envelopeName, setEnvelopeName] = useState('');
  const [envelopeBudget, setEnvelopeBudget] = useState('');
  const [envelopeIcon, setEnvelopeIcon] = useState('🛒');
  const [spendAmount, setSpendAmount] = useState('');
  const [fundAmount, setFundAmount] = useState('');
  const [envelopeInvited, setEnvelopeInvited] = useState('');

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !memberName) return;

    try {
      await addDoc(collection(db, 'familyMembers'), {
        uid: userProfile?.householdId || user.uid, // legacy
        ownerUid: user.uid,
        invitedUid: memberUid || null, // Link to a real UID if provided
        name: memberName,
        role: familyMembers.length === 0 ? 'Primary' : 'Partner',
        contribution: 0,
        color: ['bg-indigo-500', 'bg-pink-500', 'bg-emerald-500', 'bg-amber-500'][familyMembers.length % 4],
        initial: memberName.charAt(0).toUpperCase()
      });
      setIsAddMemberOpen(false);
      setMemberName('');
      setMemberUid('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'familyMembers');
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !goalName || !goalTarget) return;

    try {
      const allowed = goalIsShared ? Array.from(new Set([
        user.uid,
        ...goalInvited.split(',').map(id => id.trim()).filter(id => id.length > 0)
      ])) : [user.uid];

      await addDoc(collection(db, 'familyGoals'), {
        uid: userProfile?.householdId || user.uid, // legacy
        ownerUid: user.uid,
        allowedUids: allowed,
        isShared: goalIsShared,
        name: goalName,
        target: parseFloat(goalTarget),
        saved: 0,
        startDate: new Date().toISOString().split('T')[0],
        eta: goalEta || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year default if not set
        contributions: {}
      });
      setIsAddGoalOpen(false);
      setGoalName('');
      setGoalTarget('');
      setGoalEta('');
      setGoalInvited('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'familyGoals');
    }
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isContributeOpen || !contribAmount || !contribMemberId) return;

    try {
      const amount = parseFloat(contribAmount);
      const goalRef = doc(db, 'familyGoals', isContributeOpen.goalId);
      const goal = familyGoals.find(g => g.id === isContributeOpen.goalId);
      
      if (!goal) return;

      const currentContrib = goal.contributions?.[contribMemberId] || 0;
      
      await updateDoc(goalRef, {
        saved: increment(amount),
        [`contributions.${contribMemberId}`]: currentContrib + amount
      });

      setIsContributeOpen(null);
      setContribAmount('');
      setContribMemberId('');
      triggerConfetti();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'familyGoals');
    }
  };

  const handleAddEnvelope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !envelopeName || !envelopeBudget) return;

    try {
      const allowed = Array.from(new Set([
        user.uid,
        ...envelopeInvited.split(',').map(id => id.trim()).filter(id => id.length > 0)
      ]));

      await addDoc(collection(db, 'sharedEnvelopes'), {
        uid: userProfile?.householdId || user.uid, // legacy
        ownerUid: user.uid,
        allowedUids: allowed,
        isShared: true,
        name: envelopeName,
        budget: parseFloat(envelopeBudget),
        spent: 0,
        icon: envelopeIcon,
        color: ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500'][(sharedEnvelopes?.length || 0) % 4],
        contributions: {}
      });
      setIsAddEnvelopeOpen(false);
      setEnvelopeName('');
      setEnvelopeBudget('');
      setEnvelopeInvited('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'sharedEnvelopes');
    }
  };

  const handleFundEnvelope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isFundEnvelopeOpen || !fundAmount || !wallet) return;

    const amount = parseFloat(fundAmount);
    if (amount > wallet.free) {
      alert("Insufficient free balance in your personal wallet!");
      return;
    }

    try {
      const envelopeRef = doc(db, 'sharedEnvelopes', isFundEnvelopeOpen.envelopeId);
      const envelope = sharedEnvelopes.find(e => e.id === isFundEnvelopeOpen.envelopeId);
      if (!envelope) return;

      const currentContrib = envelope.contributions?.[user.uid] || 0;
      
      await updateDoc(envelopeRef, {
        [`contributions.${user.uid}`]: currentContrib + amount
      });

      // Deduct from personal wallet
      const walletRef = doc(db, 'wallets', user.uid);
      await updateDoc(walletRef, {
        balance: increment(-amount),
        free: increment(-amount)
      });

      // Add a transaction for the funding
      await addDoc(collection(db, 'transactions'), {
        uid: user.uid,
        name: `Funded Shared Envelope: ${envelope.name}`,
        amount: -amount,
        type: 'expense',
        category: 'Shared',
        emoji: '💸',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      });

      setIsFundEnvelopeOpen(null);
      setFundAmount('');
      triggerConfetti();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'sharedEnvelopes');
    }
  };

  const handleSpendEnvelope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isSpendEnvelopeOpen || !spendAmount) return;

    try {
      const amount = parseFloat(spendAmount);
      const envelopeRef = doc(db, 'sharedEnvelopes', isSpendEnvelopeOpen.envelopeId);
      
      await updateDoc(envelopeRef, {
        spent: increment(amount)
      });

      setIsSpendEnvelopeOpen(null);
      setSpendAmount('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'sharedEnvelopes');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {onBack && (
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Back to Space</span>
        </div>
      )}
      <div className="flex justify-between items-end">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Multi-Player Finance</p>
          <h2 className="font-display font-extrabold text-2xl">Household View</h2>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsAddMemberOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-100 bg-white text-indigo-600 font-display font-bold text-xs shadow-sm"
          >
            <Users size={14} /> Add Player
          </button>
          <button 
            onClick={() => setIsAddGoalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-display font-bold text-xs shadow-md shadow-indigo-100"
          >
            <Plus size={14} /> New Goal
          </button>
        </div>
      </div>

      <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100/50 flex gap-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h3 className="font-display font-bold text-sm text-indigo-900 mb-1">Privacy-First Multi-Player</h3>
          <p className="text-xs text-indigo-700/70 leading-relaxed">
            Welcome to the Shared Household view. Here, you and your partner can track shared goals like "House Downpayment" or "Vacation". 
            <strong> Your individual expenses, accounts, and net worth remain 100% private.</strong> Only contributions specifically allocated to shared goals are visible here.
          </p>
        </div>
      </div>



      {/* Network Connection Section */}
      <div className="grid grid-cols-1 gap-6">
        <div className="glass-card p-6 rounded-3xl bg-indigo-900 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="font-display font-black text-xl mb-2 italic">Connect & Play</h3>
            <p className="text-sm text-indigo-200/80 mb-6 leading-relaxed">
              Multi-Player finance works by sharing your **Invxtra ID**. When you "Add a Player" using their ID, 
              you can collaborate on shared Envelopes and Goals. Your personal data stays hidden—only specific shared items are synced.
            </p>
            <div className="flex gap-2 max-w-xl">
              <input 
                type="text" 
                readOnly 
                value={user?.uid || ''} 
                className="flex-1 bg-white/10 rounded-xl px-4 py-3 text-sm font-mono text-indigo-100 focus:outline-none border border-white/10"
              />
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(user?.uid || '');
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                className="px-4 py-3 bg-white text-indigo-600 rounded-xl hover:bg-indigo-50 transition-colors font-bold text-xs"
              >
                {isCopied ? "COPIED!" : "COPY ID"}
              </button>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none"></div>
        </div>
      </div>

      {/* Players Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="font-display font-bold text-lg">Household Players</h3>
          <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded uppercase">Partners</span>
        </div>
        <div className="flex flex-wrap gap-4">
          {familyMembers.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No partners linked. Link a real player by their Invxtra ID to start co-saving!</p>
          ) : (
            familyMembers.map(member => (
              <div key={member.id} className="glass-card p-4 rounded-2xl flex items-center gap-4 min-w-[220px] hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-full ${member.color || 'bg-indigo-500'} text-white font-black flex items-center justify-center text-sm shadow-inner`}>
                  {member.initial}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-sm text-slate-900">{member.name}</p>
                    {member.uid === user?.uid && <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-1 py-0.5 rounded">YOU</span>}
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{member.role}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Goals Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Shared Goals Section */}
        <div className="space-y-4">
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            <Target size={20} className="text-indigo-600" /> Shared Household Goals
          </h3>
          
          <div className="space-y-4">
            {familyGoals.filter(g => g.isShared).length === 0 ? (
              <div className="p-10 text-center glass-card rounded-3xl border-dashed">
                <Heart size={32} className="mx-auto text-indigo-300 mb-4" />
                <p className="font-bold text-slate-700">No shared goals</p>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-tighter">Teamwork makes the dream work.</p>
              </div>
            ) : (
              familyGoals.filter(g => g.isShared).map(goal => {
                const progress = Math.min(100, Math.round((goal.saved / goal.target) * 100));
                const daysTotal = Math.ceil((new Date(goal.eta).getTime() - new Date(goal.startDate).getTime()) / (1000 * 60 * 60 * 24));
                const daysPassed = Math.ceil((new Date().getTime() - new Date(goal.startDate).getTime()) / (1000 * 60 * 60 * 24));
                const timePct = Math.min(100, Math.max(0, Math.round((daysPassed / (daysTotal || 1)) * 100)));

                return (
                  <div key={goal.id} className="glass-card p-6 rounded-3xl space-y-6 relative overflow-hidden group">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-display font-extrabold text-lg">{goal.name}</h4>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                          {formatCurrency(goal.saved)} / {formatCurrency(goal.target)}
                        </p>
                      </div>
                      <button 
                        onClick={() => setIsContributeOpen({ goalId: goal.id })}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        Contribute
                      </button>
                    </div>

                    {/* Timeline & Progress */}
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[9px] font-black uppercase text-indigo-500 tracking-[0.2em]">Funding Status</span>
                          <span className="text-xs font-bold text-slate-900">{progress}%</span>
                        </div>
                        <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                          {familyMembers.map(member => {
                            const memberContrib = goal.contributions?.[member.id] || 0;
                            const pct = goal.target > 0 ? (memberContrib / goal.target) * 100 : 0;
                            if (pct <= 0) return null;
                            return (
                              <div 
                                key={member.id} 
                                className={`h-full ${member.color || 'bg-indigo-500'} transition-all`} 
                                style={{ width: `${pct}%` }}
                                title={`${member.name}: ${formatCurrency(memberContrib)}`}
                              ></div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Time Timeline */}
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">Goal Timeline</span>
                          <span className="text-[10px] font-bold text-slate-500">ETA: {new Date(goal.eta).toLocaleDateString()}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full relative">
                          <div 
                            className="absolute inset-y-0 left-0 bg-slate-400 rounded-full" 
                            style={{ width: `${timePct}%` }}
                          ></div>
                          {/* Indicator point for current progress vs time */}
                          <div 
                            className={cn(
                              "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm ring-2 ring-transparent transition-all",
                              progress >= timePct ? "bg-emerald-500" : "bg-red-500 ring-red-100"
                            )}
                            style={{ left: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Delete Button */}
                    <button 
                      onClick={async () => {
                        if (confirm("Delete this shared goal?")) {
                          await deleteDoc(doc(db, 'familyGoals', goal.id));
                        }
                      }}
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all bg-white rounded-full shadow-sm"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Individual Goals Section */}
        <div className="space-y-4">
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            <Coins size={20} className="text-amber-500" /> Individual Missions
          </h3>
          
          <div className="space-y-4">
            {familyGoals.filter(g => !g.isShared).length === 0 ? (
              <div className="p-10 text-center glass-card rounded-3xl border-dashed">
                <Landmark size={32} className="mx-auto text-amber-300 mb-4" />
                <p className="font-bold text-slate-700">No personal goals</p>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-tighter">Your private financial adventures.</p>
              </div>
            ) : (
              familyGoals.filter(g => !g.isShared).map(goal => {
                const progress = Math.min(100, Math.round((goal.saved / goal.target) * 100));
                const daysTotal = Math.ceil((new Date(goal.eta).getTime() - new Date(goal.startDate).getTime()) / (1000 * 60 * 60 * 24));
                const daysPassed = Math.ceil((new Date().getTime() - new Date(goal.startDate).getTime()) / (1000 * 60 * 60 * 24));
                const timePct = Math.min(100, Math.max(0, Math.round((daysPassed / (daysTotal || 1)) * 100)));

                return (
                  <div key={goal.id} className="glass-card p-6 rounded-3xl border-l-4 border-l-amber-500 space-y-4 relative group">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-display font-extrabold text-lg">{goal.name}</h4>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                          PRIVATE MISSION • {formatCurrency(goal.saved)} / {formatCurrency(goal.target)}
                        </p>
                      </div>
                      <button 
                        onClick={() => setIsContributeOpen({ goalId: goal.id })}
                        className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors"
                      >
                        Add Funds
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          className="h-full bg-amber-500"
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-500">{progress}% complete</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ETA: {new Date(goal.eta).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Mini Timeline UI */}
                    <div className="pt-2 border-t border-slate-50 flex items-center gap-2">
                       <div className="w-full h-1 bg-slate-100 rounded-full relative">
                          <div className="absolute inset-y-0 left-0 bg-slate-200 rounded-full" style={{ width: `${timePct}%` }}></div>
                          <div className={cn(
                            "absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full",
                            progress >= timePct ? "bg-emerald-500 shadow-sm shadow-emerald-500/20" : "bg-red-400"
                          )} style={{ left: `${progress}%` }}></div>
                       </div>
                       <p className="text-[8px] font-black text-slate-400 uppercase whitespace-nowrap">Pace</p>
                    </div>

                    {/* Delete Button */}
                    <button 
                      onClick={async () => {
                        if (confirm("Delete this mission?")) {
                          await deleteDoc(doc(db, 'familyGoals', goal.id));
                        }
                      }}
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Shared Envelopes Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            <WalletCards size={20} className="text-emerald-500" /> Shared Household Envelopes
          </h3>
          <button 
            onClick={() => setIsAddEnvelopeOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-600 font-display font-bold text-xs hover:bg-emerald-100 transition-colors"
          >
            <Plus size={14} /> New Envelope
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(!sharedEnvelopes || sharedEnvelopes.filter(e => e.isShared).length === 0) ? (
            <div className="col-span-full p-12 text-center glass-card rounded-3xl border-dashed">
              <Landmark size={32} className="mx-auto text-emerald-300 mb-4" />
              <p className="font-bold text-slate-700">No shared envelopes</p>
              <p className="text-sm text-slate-500 mt-1">Pool your money together for Groceries, Rent, or Subscriptions.</p>
            </div>
          ) : (
            sharedEnvelopes.filter(e => e.isShared).map(env => {
              const totalFunded = Object.values(env.contributions || {}).reduce((a, b) => a + b, 0);
              const remaining = totalFunded - env.spent;
              const progressPct = Math.min(100, Math.round((env.spent / (totalFunded || 1)) * 100));
              const isOverspent = env.spent > totalFunded;
              
              const now = new Date();
              const dayOfMonth = now.getDate();
              const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
              const monthPassedPct = Math.round((dayOfMonth / daysInMonth) * 100);

              return (
                <div key={env.id} className="glass-card p-6 rounded-3xl flex flex-col gap-4 group relative">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3 items-center">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${env.color}`}>
                        {env.icon}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800">{env.name}</h4>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Shared Pool</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-500">Spent {formatCompactNumber(env.spent)}</span>
                      <span className={cn(isOverspent ? 'text-red-500' : 'text-emerald-600')}>
                        {remaining > 0 ? `${formatCompactNumber(remaining)} left` : "0 left"}
                      </span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex relative shadow-inner">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPct}%` }}
                        className={`h-full ${isOverspent ? 'bg-red-500' : 'bg-emerald-500'}`}
                      />
                      <div 
                        className="absolute border-r border-slate-900/10 h-full w-px" 
                        style={{ left: `${monthPassedPct}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tighter">
                      <span className={cn(progressPct > monthPassedPct ? "text-amber-500" : "text-emerald-500")}>
                         {progressPct > monthPassedPct ? "Burning Fast" : "On Track"}
                      </span>
                      <span className="text-slate-400">Month Pace: {monthPassedPct}%</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button 
                      onClick={() => setIsFundEnvelopeOpen({ envelopeId: env.id })}
                      className="flex-1 py-2.5 rounded-xl bg-slate-50 text-slate-700 font-bold text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-colors flex items-center justify-center gap-1 border border-slate-100"
                    >
                      <Plus size={14} /> Fund
                    </button>
                    <button 
                      onClick={() => setIsSpendEnvelopeOpen({ envelopeId: env.id })}
                      disabled={remaining <= 0}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1 shadow-md shadow-emerald-100"
                    >
                      <Coins size={14} /> Spend
                    </button>
                  </div>

                  <button 
                    onClick={async () => {
                      if (confirm("Delete shared envelope?")) {
                        await deleteDoc(doc(db, 'sharedEnvelopes', env.id));
                      }
                    }}
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all bg-white rounded-full shadow-sm"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
      <Modal isOpen={isAddMemberOpen} onClose={() => setIsAddMemberOpen(false)} title="Link a Partner">
        <form onSubmit={handleAddMember} className="space-y-4">
          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
            <p className="text-xs text-indigo-700 leading-relaxed">
              <span className="font-bold underline">How it works:</span> Link a partner by entering their **unique Invxtra ID** (found in their Household view). Once linked, they'll appear as a player in your household, and you can invite them to shared goals.
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Player Display Name</label>
            <input 
              type="text" 
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="e.g. Sarah"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Invxtra Security ID (Optional)</label>
            <input 
              type="text" 
              value={memberUid}
              onChange={(e) => setMemberUid(e.target.value)}
              placeholder="Paste ID here to sync accounts"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-mono"
            />
            <p className="text-[9px] text-slate-400 italic px-1">Linking an ID allows them to see shared data on their own device.</p>
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg mt-2">
            Link Player
          </button>
        </form>
      </Modal>

      <Modal isOpen={isAddGoalOpen} onClose={() => setIsAddGoalOpen(false)} title="Set a New Goal">
        <form onSubmit={handleAddGoal} className="space-y-4">
          <div className="flex p-1 bg-slate-100 rounded-xl mb-2">
            <button 
              type="button"
              onClick={() => setGoalIsShared(true)}
              className={cn("flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", goalIsShared ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500")}
            >
              Household Goal
            </button>
            <button 
              type="button"
              onClick={() => setGoalIsShared(false)}
              className={cn("flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", !goalIsShared ? "bg-white text-amber-600 shadow-sm" : "text-slate-500")}
            >
              Personal Mission
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Goal Name</label>
            <input 
              type="text" 
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder="e.g. Hawaii Vacation"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Target Amount (₹)</label>
              <input 
                type="number" 
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                placeholder="500000"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Target Date (Timeline)</label>
              <input 
                type="date" 
                value={goalEta}
                onChange={(e) => setGoalEta(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold"
                required
              />
            </div>
          </div>
          
          {goalIsShared && (
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Collaborators (Invxtra IDs, comma separated)</label>
              <input 
                type="text" 
                value={goalInvited}
                onChange={(e) => setGoalInvited(e.target.value)}
                placeholder="e.g. user_id_1, user_id_2"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-mono"
              />
              <p className="text-[9px] text-slate-400 italic px-1">Leave blank to just track locally for your partners.</p>
            </div>
          )}

          <button type="submit" className={cn("w-full text-white font-bold py-4 rounded-2xl shadow-lg mt-2 transition-all", goalIsShared ? "bg-indigo-600 shadow-indigo-200" : "bg-amber-600 shadow-amber-200")}>
            Set {goalIsShared ? 'Household' : 'Personal'} Goal
          </button>
        </form>
      </Modal>

      <Modal isOpen={!!isContributeOpen} onClose={() => setIsContributeOpen(null)} title="Contribute to Goal">
        <form onSubmit={handleContribute} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Who is contributing?</label>
            <select 
              value={contribMemberId}
              onChange={(e) => setContribMemberId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
              required
            >
              <option value="">Select a player...</option>
              {familyMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Amount (₹)</label>
            <input 
              type="number" 
              value={contribAmount}
              onChange={(e) => setContribAmount(e.target.value)}
              placeholder="5000"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold"
              required
            />
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg mt-2">
            Add Contribution
          </button>
        </form>
      </Modal>

      {/* Add Shared Envelope Modal */}
      <Modal isOpen={isAddEnvelopeOpen} onClose={() => setIsAddEnvelopeOpen(false)} title="New Shared Envelope">
        <form onSubmit={handleAddEnvelope} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Name</label>
            <input 
              type="text" 
              value={envelopeName}
              onChange={(e) => setEnvelopeName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
              placeholder="e.g., Groceries"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Monthly Budget (₹)</label>
            <input 
              type="number" 
              value={envelopeBudget}
              onChange={(e) => setEnvelopeBudget(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Invited Members (IDs, comma separated)</label>
            <input 
              type="text" 
              value={envelopeInvited}
              onChange={(e) => setEnvelopeInvited(e.target.value)}
              placeholder="e.g. user_id_1, user_id_2"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Icon (Emoji)</label>
            <input 
              type="text" 
              value={envelopeIcon}
              onChange={(e) => setEnvelopeIcon(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold text-xl text-center"
              required
              maxLength={2}
            />
          </div>
          <button type="submit" className="w-full py-4 text-white font-display font-bold rounded-xl shadow-lg bg-emerald-500 shadow-emerald-200 hover:bg-emerald-600 transition-all">
            Create Shared Envelope
          </button>
        </form>
      </Modal>

      {/* Fund Envelope Modal */}
      <Modal isOpen={!!isFundEnvelopeOpen} onClose={() => setIsFundEnvelopeOpen(null)} title="Fund Envelope">
        <form onSubmit={handleFundEnvelope} className="space-y-4">
          <div className="bg-emerald-50 p-4 rounded-xl mb-4">
            <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-1">Your Free Balance</p>
            <p className="text-xl font-display font-black text-emerald-700">{formatCurrency(wallet?.free || 0)}</p>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Amount to Transfer (₹)</label>
            <input 
              type="number" 
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
              required
              max={wallet?.free || 0}
            />
          </div>
          <button type="submit" className="w-full py-4 bg-emerald-500 text-white font-display font-bold rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all flex justify-center gap-2 items-center">
            <Plus size={16} /> Transfer from Wallet
          </button>
        </form>
      </Modal>

      {/* Spend from Envelope Modal */}
      <Modal isOpen={!!isSpendEnvelopeOpen} onClose={() => setIsSpendEnvelopeOpen(null)} title="Record Expense">
        <form onSubmit={handleSpendEnvelope} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Amount Spent (₹)</label>
            <input 
              type="number" 
              value={spendAmount}
              onChange={(e) => setSpendAmount(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-bold text-red-600"
              required
            />
          </div>
          <button type="submit" className="w-full py-4 bg-red-500 text-white font-display font-bold rounded-xl shadow-lg shadow-red-200 hover:bg-red-600 transition-all flex justify-center gap-2 items-center">
            <Coins size={16} /> Deduct from Envelope
          </button>
        </form>
      </Modal>
    </div>
  );
}
