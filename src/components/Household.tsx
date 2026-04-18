import React, { useState } from 'react';
import { Users, Plus, Target, ShieldCheck, Heart, Trash2, Link, Copy, Check, WalletCards, Coins, Landmark } from 'lucide-react';
import { useFirebase } from '../lib/FirebaseProvider';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, increment, writeBatch } from 'firebase/firestore';
import { FamilyMember, FamilyGoal } from '../types';
import { formatCurrency, formatCompactNumber, triggerConfetti } from '../lib/utils';
import Modal from './Modal';

export default function Household() {
  const { user, userProfile, familyMembers, familyGoals, sharedEnvelopes, wallet } = useFirebase();
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
  const [isContributeOpen, setIsContributeOpen] = useState<{goalId: string} | null>(null);
  
  const [isCopied, setIsCopied] = useState(false);
  
  // Form states
  const [memberName, setMemberName] = useState('');
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
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
        name: memberName,
        role: familyMembers.length === 0 ? 'Primary' : 'Partner',
        contribution: 0,
        color: ['bg-indigo-500', 'bg-pink-500', 'bg-emerald-500', 'bg-amber-500'][familyMembers.length % 4],
        initial: memberName.charAt(0).toUpperCase()
      });
      setIsAddMemberOpen(false);
      setMemberName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'familyMembers');
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !goalName || !goalTarget) return;

    try {
      const allowed = Array.from(new Set([
        user.uid,
        ...goalInvited.split(',').map(id => id.trim()).filter(id => id.length > 0)
      ]));

      await addDoc(collection(db, 'familyGoals'), {
        uid: userProfile?.householdId || user.uid, // legacy
        ownerUid: user.uid,
        allowedUids: allowed,
        name: goalName,
        target: parseFloat(goalTarget),
        saved: 0,
        eta: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year default
        contributions: {}
      });
      setIsAddGoalOpen(false);
      setGoalName('');
      setGoalTarget('');
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
        <div className="glass-card p-6 rounded-3xl">
          <h3 className="font-display font-bold text-lg mb-2">Your Invxtra ID</h3>
          <p className="text-sm text-slate-500 mb-4">Share this secure ID with your partners so they can add you to shared envelopes and goals.</p>
          <div className="flex gap-2 max-w-xl">
            <input 
              type="text" 
              readOnly 
              value={user?.uid || ''} 
              className="flex-1 bg-slate-50 rounded-xl px-4 py-3 text-sm font-mono text-slate-600 focus:outline-none border border-slate-100"
            />
            <button 
              onClick={() => {
                navigator.clipboard.writeText(user?.uid || '');
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
              }}
              className="px-4 py-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
            >
              {isCopied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Players Section */}
      <div className="space-y-4">
        <h3 className="font-display font-bold text-lg">Household Players</h3>
        <div className="flex flex-wrap gap-4">
          {familyMembers.length === 0 ? (
            <p className="text-sm text-slate-500">No players added yet. Add a partner to start saving together!</p>
          ) : (
            familyMembers.map(member => (
              <div key={member.id} className="glass-card p-4 rounded-2xl flex items-center gap-4 min-w-[200px]">
                <div className={`w-10 h-10 rounded-full ${member.color || 'bg-indigo-500'} text-white font-black flex items-center justify-center text-sm`}>
                  {member.initial}
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900">{member.name}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{member.role}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Shared Goals Section */}
      <div className="space-y-4">
        <h3 className="font-display font-bold text-lg flex items-center gap-2">
          <Target size={20} className="text-pink-500" /> Shared Goals
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {familyGoals.length === 0 ? (
            <div className="col-span-full p-10 text-center glass-card rounded-3xl">
              <Heart size={32} className="mx-auto text-pink-300 mb-4" />
              <p className="font-bold text-slate-700">No shared goals yet</p>
              <p className="text-sm text-slate-500 mt-1">Start collaborating on your financial future.</p>
            </div>
          ) : (
            familyGoals.map(goal => {
              const progress = Math.min(100, Math.round((goal.saved / goal.target) * 100));
              
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
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
                    >
                      Contribute
                    </button>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      {familyMembers.map(member => {
                        const memberContrib = goal.contributions?.[member.id] || 0;
                        const pct = goal.target > 0 ? (memberContrib / goal.target) * 100 : 0;
                        if (pct <= 0) return null;
                        return (
                          <div 
                            key={member.id} 
                            className={`h-full ${member.color || 'bg-indigo-500'}`} 
                            style={{ width: `${pct}%` }}
                            title={`${member.name}: ${formatCurrency(memberContrib)}`}
                          ></div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-2">
                      <p className="text-xs font-bold text-slate-600">{progress}% Funded</p>
                      <div className="flex -space-x-2">
                        {familyMembers.filter(m => (goal.contributions?.[m.id] || 0) > 0).map(member => (
                          <div 
                            key={member.id} 
                            className={`w-5 h-5 rounded-full ${member.color || 'bg-indigo-500'} text-white text-[8px] font-black flex items-center justify-center ring-2 ring-white`}
                            title={member.name}
                          >
                            {member.initial}
                          </div>
                        ))}
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

      {/* Shared Envelopes Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            <WalletCards size={20} className="text-emerald-500" /> Shared Envelopes
          </h3>
          <button 
            onClick={() => setIsAddEnvelopeOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-600 font-display font-bold text-xs hover:bg-emerald-100 transition-colors"
          >
            <Plus size={14} /> Add Envelope
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {(!sharedEnvelopes || sharedEnvelopes.length === 0) ? (
            <div className="col-span-full p-8 text-center glass-card rounded-3xl border-dashed">
              <Landmark size={32} className="mx-auto text-emerald-300 mb-3" />
              <p className="font-bold text-slate-700">No shared envelopes</p>
              <p className="text-xs text-slate-500 mt-1">Pool your money together for Groceries or Rent.</p>
            </div>
          ) : (
            sharedEnvelopes.map(env => {
              const totalFunded = Object.values(env.contributions || {}).reduce((a, b) => a + b, 0);
              const remaining = totalFunded - env.spent;
              const progressPct = Math.min(100, Math.round((env.spent / (totalFunded || 1)) * 100));
              const isOverspent = env.spent > totalFunded;

              return (
                <div key={env.id} className="glass-card p-5 rounded-3xl flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3 items-center">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-inner ${env.color}`}>
                        {env.icon}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800">{env.name}</h4>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Budget: {formatCompactNumber(env.budget)}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-slate-500">Spent {formatCompactNumber(env.spent)}</span>
                      <span className={isOverspent ? 'text-red-500' : (env.spent === 0 ? 'text-slate-400' : 'text-emerald-600')}>
                        {isOverspent ? 'Over budget!' : (env.spent === 0 ? 'No activity yet' : `${formatCompactNumber(remaining)} left`)}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${isOverspent ? 'bg-red-500' : (env.spent === 0 ? 'bg-slate-200' : 'bg-emerald-500')}`} 
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 mt-auto pt-2">
                    <button 
                      onClick={() => setIsFundEnvelopeOpen({ envelopeId: env.id })}
                      className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus size={12} /> Fund
                    </button>
                    <button 
                      onClick={() => setIsSpendEnvelopeOpen({ envelopeId: env.id })}
                      disabled={remaining <= 0}
                      className="flex-1 py-2 rounded-xl bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <Coins size={12} /> Spend
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Shared Envelopes Section */}

      {/* Modals */}

      {/* Modals */}
      <Modal isOpen={isAddMemberOpen} onClose={() => setIsAddMemberOpen(false)} title="Add Player">
        <form onSubmit={handleAddMember} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Player Name</label>
            <input 
              type="text" 
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="e.g. Sarah"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
              required
            />
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg mt-2">
            Add Player
          </button>
        </form>
      </Modal>

      <Modal isOpen={isAddGoalOpen} onClose={() => setIsAddGoalOpen(false)} title="Create Shared Goal">
        <form onSubmit={handleAddGoal} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Goal Name</label>
            <input 
              type="text" 
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder="e.g. Hawaii Vacation"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
              required
            />
          </div>
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
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Invited Members (Invxtra IDs, comma separated)</label>
            <input 
              type="text" 
              value={goalInvited}
              onChange={(e) => setGoalInvited(e.target.value)}
              placeholder="e.g. user_id_1, user_id_2"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-mono"
            />
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg mt-2">
            Create Goal
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
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Envelope Name</label>
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
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Invited Members (Invxtra IDs, comma separated)</label>
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
          <button type="submit" className="w-full py-4 bg-emerald-500 text-white font-display font-bold rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all">
            Create Envelope
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
