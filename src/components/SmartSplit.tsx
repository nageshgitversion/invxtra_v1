import React, { useState } from 'react';
import { formatCurrency, formatCompactNumber, cn, triggerConfetti } from '../lib/utils';
import { Plus, Share2, ArrowUpRight, ArrowDownLeft, Receipt, History, Trash2, Send, ArrowLeft } from 'lucide-react';
import Modal from './Modal';
import { Split, FamilyMember } from '../types';
import { useFirebase } from '../lib/FirebaseProvider';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

export default function SmartSplit({ onBack }: { onBack?: () => void }) {
  const { user, familyMembers, splits } = useFirebase();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billPayerId, setBillPayerId] = useState('');
  const [billParticipants, setBillParticipants] = useState<string[]>([]);
  const [billInvited, setBillInvited] = useState('');

  const perPerson = (billAmount && billParticipants.length > 0) 
    ? Math.round(parseFloat(billAmount) / billParticipants.length) 
    : 0;

  // Calculations for Net Balances
  const settlementMatrix = React.useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {};
    const allUsers = [user?.uid, ...familyMembers.map(m => m.id)].filter(Boolean) as string[];
    allUsers.forEach(u => matrix[u] = {});

    splits?.filter(s => s.status === 'pending').forEach(split => {
      const payer = split.payerUid;
      Object.entries(split.participants || {}).forEach(([participant, share]) => {
        if (participant === payer) return;
        matrix[participant][payer] = (matrix[participant][payer] || 0) + share;
      });
    });

    return matrix;
  }, [splits, familyMembers, user]);

  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !billName || !billAmount || !billPayerId || billParticipants.length === 0) return;

    try {
      const total = parseFloat(billAmount);
      const share = total / billParticipants.length;
      const participantShares: Record<string, number> = {};
      billParticipants.forEach(p => participantShares[p] = share);

      const invitedUids = Array.from(new Set([
        user.uid,
        ...billParticipants,
        ...billInvited.split(',').map(id => id.trim()).filter(id => id.length > 0)
      ]));

      await addDoc(collection(db, 'splits'), {
        uid: user.uid,
        allowedUids: invitedUids,
        name: billName,
        date: new Date().toISOString().split('T')[0],
        totalAmount: total,
        payerUid: billPayerId,
        participants: participantShares,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      setIsModalOpen(false);
      setBillName('');
      setBillAmount('');
      setBillPayerId('');
      setBillParticipants([]);
      setBillInvited('');
      triggerConfetti();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'splits');
    }
  };

  const handleSettle = async (fromId: string, toId: string, amount: number) => {
    if (!user || !confirm(`Mark ₹${amount} as settled between players?`)) return;

    try {
      const relevantSplits = splits.filter(s => 
        s.status === 'pending' && 
        s.payerUid === toId && 
        s.participants?.[fromId] > 0
      );

      const batch = writeBatch(db);
      relevantSplits.forEach(s => {
        batch.update(doc(db, 'splits', s.id), { status: 'settled' });
      });
      await batch.commit();
      triggerConfetti();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'splits');
    }
  };

  const handleShareWhatsApp = (bill: Split) => {
    const text = `Hey! Let's split this bill: *${bill.name}*\nTotal: ₹${bill.totalAmount}\nYour share: *₹${bill.participants[user?.uid || ''] || (bill.totalAmount/Object.keys(bill.participants).length)}*\n\nTracked on *Invxtra Finance* 🚀`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const netBalance = splits.reduce((acc, s) => {
    if (s.status === 'settled') return acc;
    const isPayer = s.payerUid === user?.uid;
    const myShare = s.participants?.[user?.uid || ''] || 0;
    
    if (isPayer) {
      return acc + (s.totalAmount - myShare);
    } else if (myShare > 0) {
      return acc - myShare;
    }
    return acc;
  }, 0);

  return (
    <div className="space-y-4 md:space-y-6">
      {onBack && (
        <div className="flex items-center gap-4 px-2">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Back to Space</span>
        </div>
      )}
      <div className="px-1 sm:px-0 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Group Budgeting</p>
          <h2 className="font-display font-extrabold text-2xl">Smart Split</h2>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
        >
          <Plus size={16} /> New Bill
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Net Balance & Settlements */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-card p-6 rounded-3xl bg-slate-900 text-white space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <History size={16} className="text-orange-400" />
              <h4 className="font-bold text-xs uppercase tracking-[0.2em] text-slate-400">Net Balances</h4>
            </div>
            
            <div className="space-y-3">
              {Object.entries(settlementMatrix).map(([ower, debts]) => (
                Object.entries(debts).map(([receiver, amount]) => {
                  if (amount <= 0) return null;
                  const isIwe = ower === user?.uid;
                  const isIRecieve = receiver === user?.uid;
                  if (!isIwe && !isIRecieve) return null; // Only show MY debts in this summary

                  const owerName = isIwe ? "You" : (familyMembers.find(m => m.id === ower)?.name || "Partner");
                  const receiverName = isIRecieve ? "You" : (familyMembers.find(m => m.id === receiver)?.name || "Partner");
                  
                  return (
                    <div key={`${ower}-${receiver}`} className="flex justify-between items-center p-3 rounded-2xl bg-white/5 border border-white/10 group">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400">{owerName} owe {receiverName}</p>
                        <p className="text-lg font-display font-black text-orange-400">{formatCurrency(amount)}</p>
                      </div>
                      <button 
                        onClick={() => handleSettle(ower, receiver, amount)}
                        className="opacity-0 group-hover:opacity-100 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Settle
                      </button>
                    </div>
                  );
                })
              ))}
              {Object.values(settlementMatrix).every(d => Object.values(d).every(a => a <= 0)) && (
                <p className="text-xs text-slate-500 italic py-4">All square! Everything settled.</p>
              )}
            </div>

            <div className={cn(
              "mt-4 p-4 rounded-2xl border flex items-center justify-between",
              netBalance >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"
            )}>
              <div className="flex items-center gap-2">
                {netBalance >= 0 ? <ArrowUpRight size={14} className="text-emerald-400" /> : <ArrowDownLeft size={14} className="text-red-400" />}
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Total Net</p>
              </div>
              <p className={cn("font-display font-black text-lg", netBalance >= 0 ? "text-emerald-400" : "text-red-400")}>
                {netBalance >= 0 ? '+' : ''}{formatCurrency(netBalance)}
              </p>
            </div>
          </div>
        </div>

        {/* Pending Bills List */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="font-display font-bold text-sm text-slate-500 uppercase tracking-widest">Pending Bills</h3>
          </div>
          
          <div className="space-y-3">
            {splits?.filter(s => s.status === 'pending').map(bill => {
              const isPayer = bill.payerUid === user?.uid;
              const myShare = bill.participants?.[user?.uid || ''] || 0;
              const displayAmount = isPayer ? (bill.totalAmount - myShare) : myShare;

              return (
                <div key={bill.id} className="glass-card p-4 rounded-3xl flex justify-between items-center group hover:border-indigo-200 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
                      <Receipt size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">{bill.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Total {formatCurrency(bill.totalAmount)} • {bill.date}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={cn("text-xs font-black", isPayer ? "text-emerald-600" : "text-red-600")}>
                        {isPayer ? "Recieve" : "Pay"} {formatCurrency(displayAmount)}
                      </p>
                      <button 
                        onClick={() => handleShareWhatsApp(bill)}
                        className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 mt-1 ml-auto hover:underline"
                      >
                        <Send size={10} /> WhatsApp
                      </button>
                    </div>
                    <button 
                      onClick={async () => { if(confirm("Delete this bill?")) await deleteDoc(doc(db, 'splits', bill.id)); }}
                      className="p-2 text-slate-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
            {(!splits || splits.filter(s => s.status === 'pending').length === 0) && (
              <div className="p-12 text-center glass-card rounded-[40px] border-dashed">
                <p className="text-sm font-bold text-slate-400">All bills are settled! 🍀</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bill Splitting Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Shared Bill">
        <form onSubmit={handleAddBill} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">What was it for?</label>
            <input 
              type="text" 
              value={billName}
              onChange={(e) => setBillName(e.target.value)}
              placeholder="e.g. Electricity Bill"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-sm font-bold"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Total Amount (₹)</label>
            <input 
              type="number" 
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value)}
              placeholder="3000"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-sm font-black"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Paid By</label>
            <select 
              value={billPayerId}
              onChange={(e) => setBillPayerId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold"
              required
            >
              <option value="">Select payer...</option>
              <option value={user?.uid}>You</option>
              {familyMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Split With (Participants)</label>
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <label className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={billParticipants.includes(user?.uid || '')}
                  onChange={(e) => {
                    if (e.target.checked) setBillParticipants([...billParticipants, user?.uid || '']);
                    else setBillParticipants(billParticipants.filter(p => p !== user?.uid));
                  }}
                  className="rounded text-orange-500"
                />
                <span className="text-xs font-bold">You</span>
              </label>
              {familyMembers.map(m => (
                <label key={m.id} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={billParticipants.includes(m.id)}
                    onChange={(e) => {
                      if (e.target.checked) setBillParticipants([...billParticipants, m.id]);
                      else setBillParticipants(billParticipants.filter(p => p !== m.id));
                    }}
                    className="rounded text-orange-500"
                  />
                  <span className="text-xs font-bold">{m.name}</span>
                </label>
              ))}
            </div>
            {perPerson > 0 && <p className="text-[10px] text-orange-600 mt-2 font-black uppercase tracking-tight">₹{perPerson} per person</p>}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Partner IDs (External Invite)</label>
            <input 
              type="text" 
              value={billInvited}
              onChange={(e) => setBillInvited(e.target.value)}
              placeholder="Comma separated Invxtra IDs"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-mono"
            />
          </div>

          <button type="submit" className="w-full bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg mt-2 uppercase tracking-widest text-xs">
            Split this Bill
          </button>
        </form>
      </Modal>
    </div>
  );
}
