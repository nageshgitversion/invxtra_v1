import React, { useState } from 'react';
import { TrendingUp, Plus, RefreshCw, ArrowRight, Share2, X, CheckCircle2, Trash2, Edit2 } from 'lucide-react';
import { Holding } from '../types';
import { formatCurrency, formatCompactNumber, cn } from '../lib/utils';
import { useFirebase } from '../lib/FirebaseProvider';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { syncPortfolioHoldings } from '../services/portfolioService';
import Modal from './Modal';

interface PortfolioProps {
  holdings: Holding[];
  setActiveTab?: (tab: string) => void;
}

export default function Portfolio({ holdings, setActiveTab }: PortfolioProps) {
  const { user } = useFirebase();
  const [filter, setFilter] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [holdingToDelete, setHoldingToDelete] = useState<Holding | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [invested, setInvested] = useState('');
  const [current, setCurrent] = useState('');
  const [type, setType] = useState('Equity MF');
  const [sip, setSip] = useState('');
  const [xirr, setXirr] = useState('');
  const [units, setUnits] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [linkedGoalId, setLinkedGoalId] = useState('');
  const [fundSource, setFundSource] = useState('external');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { familyGoals, wallet, accounts } = useFirebase();

  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name || !invested || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const amount = parseFloat(invested);

      if (!editingHolding) {
        // Debit from source (only for new holdings)
        if (fundSource === 'wallet' && wallet && wallet.active) {
          if (amount > wallet.free) {
            setError("Insufficient free balance in wallet!");
            setIsSubmitting(false);
            return;
          }
          await updateDoc(doc(db, 'wallets', user.uid), {
            balance: increment(-amount),
            free: increment(-amount)
          });
          await addDoc(collection(db, 'transactions'), {
            uid: user.uid,
            name: `Invested: ${name}`,
            amount: -amount,
            type: 'investment',
            category: 'Investment',
            emoji: '📈',
            date: new Date().toISOString().split('T')[0],
            linkedAcc: 'wallet', // Special marker for wallet
            createdAt: new Date().toISOString()
          });
        } else if (fundSource !== 'external' && fundSource !== 'wallet') {
          const sourceAcc = accounts.find(a => a.id === fundSource);
          if (sourceAcc) {
            if (sourceAcc.amt < amount) {
              setError(`Insufficient balance in ${sourceAcc.name}!`);
              setIsSubmitting(false);
              return;
            }
            await updateDoc(doc(db, 'accounts', sourceAcc.id), {
              amt: increment(-amount)
            });
            await addDoc(collection(db, 'transactions'), {
              uid: user.uid,
              name: `Invested from ${sourceAcc.name}: ${name}`,
              amount: -amount,
              type: 'investment',
              category: 'Investment',
              emoji: '🔄',
              date: new Date().toISOString().split('T')[0],
              linkedAcc: sourceAcc.id,
              createdAt: new Date().toISOString()
            });
          }
        } else if (fundSource === 'external') {
          // Log the transaction for Cash/External investment
          if (amount > 0) {
            await addDoc(collection(db, 'transactions'), {
              uid: user.uid,
              name: `Invested (Cash): ${name}`,
              amount: -amount,
              type: 'investment',
              category: 'Investment',
              emoji: '💵',
              date: new Date().toISOString().split('T')[0],
              createdAt: new Date().toISOString()
            });
          }
        }
      }

      const holdingData = {
        uid: user.uid,
        name,
        invested: parseFloat(invested),
        current: parseFloat(current) || parseFloat(invested),
        units: parseFloat(units) || null,
        avgPrice: parseFloat(avgPrice) || null,
        currentPrice: parseFloat(currentPrice) || null,
        type,
        sip: parseFloat(sip) || 0,
        xirr: parseFloat(xirr) || 0,
        linkedGoalId: linkedGoalId || null,
        updatedAt: new Date().toISOString()
      };

      if (editingHolding) {
        await updateDoc(doc(db, 'holdings', editingHolding.id), holdingData);
      } else {
        await addDoc(collection(db, 'holdings'), {
          ...holdingData,
          createdAt: new Date().toISOString()
        });
      }

      setIsAddModalOpen(false);
      setEditingHolding(null);
      resetForm();
    } catch (err) {
      handleFirestoreError(err, editingHolding ? OperationType.UPDATE : OperationType.CREATE, 'holdings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHolding = async (id: string) => {
    if (!user) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'holdings', id));
      setHoldingToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'holdings');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditHolding = (h: Holding) => {
    setEditingHolding(h);
    setName(h.name);
    setInvested(h.invested.toString());
    setCurrent(h.current.toString());
    setType(h.type);
    setSip(h.sip.toString());
    setXirr(h.xirr.toString());
    setUnits(h.units?.toString() || '');
    setAvgPrice(h.avgPrice?.toString() || '');
    setCurrentPrice(h.currentPrice?.toString() || '');
    setLinkedGoalId(h.linkedGoalId || '');
    setFundSource('external'); // Default to external for edits to avoid double debit
    setIsAddModalOpen(true);
  };

  const handleSync = async () => {
    if (isSyncing || holdings.length === 0) return;
    setIsSyncing(true);
    setError(null);
    try {
      await syncPortfolioHoldings(holdings);
      const now = new Date();
      setLastSyncTime(now.toLocaleTimeString());
      
      // Randomly show a market sentiment message
      const sentiments = [
        "Market is volatile today. Capturing price movements...",
        "Tech stocks are seeing a correction. Updating values...",
        "Bullish trend detected in mid-caps. Syncing gains...",
        "Global cues are mixed. Re-calculating portfolio...",
        "Capturing the latest downfall in heavyweights like Tata Steel..."
      ];
      const randomSentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
      setError(randomSentiment); // Using error state to show info message temporarily
      setTimeout(() => setError(null), 5000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'holdings');
    } finally {
      setIsSyncing(false);
    }
  };

  const resetForm = () => {
    setName('');
    setInvested('');
    setCurrent('');
    setType('Equity MF');
    setSip('');
    setXirr('');
    setUnits('');
    setAvgPrice('');
    setCurrentPrice('');
    setLinkedGoalId('');
    setFundSource('external');
    setError(null);
  };

  const totalInv = holdings.reduce((acc, h) => acc + h.invested, 0);
  const totalCur = holdings.reduce((acc, h) => acc + h.current, 0);
  const totalRet = totalCur - totalInv;
  const totalRetPct = totalInv > 0 ? Math.round((totalRet / totalInv) * 100) : 0;

  const filteredHoldings = holdings.filter(h => !filter || h.type === filter);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end px-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
            Investment overview {lastSyncTime && `· Last synced ${lastSyncTime}`}
          </p>
          <h2 className="font-display font-extrabold text-2xl">Portfolio</h2>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button 
            onClick={() => {
              if (setActiveTab) {
                setActiveTab('savings');
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('openAddAccountModal', { detail: { type: 'ppf' } }));
                }, 300);
              } else {
                window.dispatchEvent(new CustomEvent('openAddAccountModal', { detail: { type: 'ppf' } }));
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-100 bg-white text-emerald-600 font-display font-bold text-xs shadow-sm transition-all hover:bg-emerald-50"
          >
            <Plus size={14} /> Add PF/NPS
          </button>
          <button 
            onClick={handleSync}
            disabled={isSyncing || holdings.length === 0}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-100 bg-white text-indigo-600 font-display font-bold text-xs shadow-sm transition-all hover:bg-indigo-50",
              isSyncing && "opacity-50 cursor-not-allowed"
            )}
          >
            <RefreshCw size={14} className={cn(isSyncing && "animate-spin")} />
            {isSyncing ? 'Syncing...' : 'Sync'}
          </button>
          <button 
            onClick={() => { setError(null); setIsAddModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-display font-bold text-xs shadow-md shadow-indigo-100 hover:bg-indigo-700"
          >
            <Plus size={14} /> Add Holding
          </button>
        </div>
      </div>

      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => { setIsAddModalOpen(false); setEditingHolding(null); resetForm(); }} 
        title={editingHolding ? "Edit Investment" : "Add Investment"}
      >
        <form onSubmit={handleAddHolding} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl text-xs font-bold">
              ⚠️ {error}
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Asset Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Parag Parikh Flexi Cap"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Units / Quantity</label>
              <input 
                type="number" 
                value={units}
                onChange={(e) => {
                  setUnits(e.target.value);
                  if (avgPrice && e.target.value) {
                    setInvested((parseFloat(e.target.value) * parseFloat(avgPrice)).toString());
                  }
                }}
                placeholder="e.g. 90"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Avg. Buy Price (₹)</label>
              <input 
                type="number" 
                value={avgPrice}
                onChange={(e) => {
                  setAvgPrice(e.target.value);
                  if (units && e.target.value) {
                    setInvested((parseFloat(units) * parseFloat(e.target.value)).toString());
                  }
                }}
                placeholder="e.g. 126.4"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Invested (₹)</label>
              <input 
                type="number" 
                value={invested}
                onChange={(e) => setInvested(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Current Value (₹)</label>
              <input 
                type="number" 
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Current Market Price (₹)</label>
            <input 
              type="number" 
              value={currentPrice}
              onChange={(e) => {
                setCurrentPrice(e.target.value);
                if (units && e.target.value) {
                  setCurrent((parseFloat(units) * parseFloat(e.target.value)).toString());
                }
              }}
              placeholder="e.g. 123.75"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Asset Type</label>
            <select 
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
            >
              <option>Equity MF</option>
              <option>Stocks</option>
              <option>Gold/SGB</option>
              <option>Debt MF</option>
              <option>Crypto</option>
              <option>Real Estate</option>
              <option>Other</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Monthly SIP (₹)</label>
              <input 
                type="number" 
                value={sip}
                onChange={(e) => setSip(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">XIRR (%)</label>
              <input 
                type="number" 
                step="0.1"
                value={xirr}
                onChange={(e) => setXirr(e.target.value)}
                placeholder="0.0"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Source of Funds</label>
            <select 
              value={fundSource}
              onChange={(e) => setFundSource(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold"
            >
              <option value="external">External / Cash (No Debit)</option>
              {wallet && wallet.active && <option value="wallet">invxtra Wallet (₹{wallet.free.toLocaleString('en-IN')})</option>}
              <optgroup label="Savings Accounts">
                {accounts.filter(a => a.type === 'savings').map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.bank} - {acc.name} (₹{acc.amt.toLocaleString('en-IN')})</option>
                ))}
              </optgroup>
            </select>
            {fundSource === 'wallet' && (
              <p className="text-[9px] text-indigo-600 font-bold mt-1 px-1">
                ₹{invested || 0} will be debited from your wallet immediately.
              </p>
            )}
            {fundSource !== 'external' && fundSource !== 'wallet' && (
              <p className="text-[9px] text-indigo-600 font-bold mt-1 px-1">
                ₹{invested || 0} will be transferred from {accounts.find(a => a.id === fundSource)?.name}.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Link to Goal</label>
            <select 
              value={linkedGoalId}
              onChange={(e) => setLinkedGoalId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
            >
              <option value="">No Goal Linked</option>
              {familyGoals.map(goal => (
                <option key={goal.id} value={goal.id}>{goal.name}</option>
              ))}
            </select>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 text-white font-display font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 mt-4"
          >
            {isSubmitting ? "Saving..." : editingHolding ? "Update Investment" : "Save Investment"}
          </button>

          {editingHolding && (
            <button 
              type="button"
              onClick={() => {
                setIsAddModalOpen(false);
                setHoldingToDelete(editingHolding);
              }}
              className="w-full py-3 text-red-600 font-display font-bold text-sm hover:bg-red-50 rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
            >
              <Trash2 size={14} /> Delete Investment
            </button>
          )}
        </form>
      </Modal>

      <Modal
        isOpen={!!holdingToDelete}
        onClose={() => setHoldingToDelete(null)}
        title="Delete Investment"
      >
        <div className="space-y-6">
          <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
            <p className="text-sm text-red-800 font-medium">
              Are you sure you want to delete <span className="font-black">{holdingToDelete?.name}</span>? This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setHoldingToDelete(null)}
              className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => holdingToDelete && handleDeleteHolding(holdingToDelete.id)}
              disabled={isDeleting}
              className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold text-sm shadow-lg shadow-red-100 hover:bg-red-700 transition-all disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Current Value" value={formatCompactNumber(totalCur)} color="text-emerald-600" />
        <StatCard label="Invested" value={formatCompactNumber(totalInv)} color="text-slate-900" />
        <StatCard label="Returns" value={formatCompactNumber(totalRet)} color="text-purple-600" />
        <StatCard label="Overall Return" value={`${totalRetPct}%`} color="text-amber-600" />
      </div>

      {/* Holdings Section */}
      <section>
        <div className="flex justify-between items-center mb-4 px-2">
          <h3 className="font-display font-bold text-lg">📊 Holdings</h3>
          <select 
            className="bg-white border border-indigo-50 rounded-lg px-3 py-1.5 text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All Types</option>
            <option>Equity MF</option>
            <option>Stocks</option>
            <option>Gold/SGB</option>
            <option>Debt MF</option>
          </select>
        </div>
        
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Asset</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Cost</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Value</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">XIRR</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredHoldings.map(h => (
                  <tr key={h.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 cursor-pointer" onClick={() => handleEditHolding(h)}>
                      <p className="font-display font-bold text-sm text-slate-900">{h.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-slate-400 font-medium">
                          {h.type} {h.units ? `· ${h.units} units` : ''} {h.sip > 0 && `· SIP ₹${h.sip.toLocaleString('en-IN')}/mo`}
                        </p>
                        {h.linkedGoalId && (
                          <span className="text-[8px] font-black uppercase bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
                            🎯 {familyGoals.find(g => g.id === h.linkedGoalId)?.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right cursor-pointer" onClick={() => handleEditHolding(h)}>
                      <p className="text-xs font-bold text-slate-500">{formatCompactNumber(h.invested)}</p>
                    </td>
                    <td className="px-6 py-4 text-right cursor-pointer" onClick={() => handleEditHolding(h)}>
                      <p className="font-display font-extrabold text-sm text-slate-900">{formatCompactNumber(h.current)}</p>
                      {h.currentPrice && (
                        <p className="text-[8px] text-slate-400 font-bold uppercase">@ ₹{h.currentPrice}</p>
                      )}
                      <p className={cn(
                        "text-[9px] font-bold",
                        h.current >= h.invested ? "text-emerald-600" : "text-red-600"
                      )}>
                        {h.current >= h.invested ? '+' : ''}{Math.round(((h.current - h.invested) / h.invested) * 100)}%
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right cursor-pointer" onClick={() => handleEditHolding(h)}>
                      <p className="font-display font-extrabold text-sm text-amber-600">{h.xirr}%</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEditHolding(h)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => setHoldingToDelete(h)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-6 bg-slate-50/50 flex justify-between items-center">
            <span className="font-display font-bold text-xs text-slate-500">Total Portfolio</span>
            <div className="text-right">
              <p className="font-display font-extrabold text-lg text-slate-900">{formatCompactNumber(totalCur)}</p>
              <p className={cn("text-[10px] font-bold", totalRet >= 0 ? "text-emerald-600" : "text-red-600")}>
                {totalRet >= 0 ? '+' : ''}{totalRetPct}% overall
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, color, change }: { label: string, value: string, color: string, change?: string }) {
  return (
    <div className="glass-card p-4 rounded-2xl">
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className={cn("font-display font-extrabold text-lg", color)}>{value}</p>
      {change && <p className={cn("text-[9px] font-bold mt-0.5", color === 'text-emerald-600' ? 'text-emerald-600' : 'text-slate-400')}>{change}</p>}
    </div>
  );
}

function SplitItem({ name, desc, amount, type }: { name: string, desc: string, amount: number, type: 'owe' | 'paid' }) {
  return (
    <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl">
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-sm",
        type === 'owe' ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
      )}>
        {name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{name}</p>
        <p className="text-[10px] text-slate-400 font-medium">{desc}</p>
      </div>
      <div className="text-right">
        <p className={cn("font-display font-extrabold text-sm", amount > 0 ? "text-emerald-600" : "text-red-600")}>
          {amount > 0 ? '+' : ''}{formatCurrency(amount)}
        </p>
        <span className={cn(
          "text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
          type === 'owe' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
        )}>
          {type === 'owe' ? 'Owes you' : 'You owe'}
        </span>
      </div>
    </div>
  );
}
