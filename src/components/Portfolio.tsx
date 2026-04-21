import React, { useState, useMemo } from 'react';
import { TrendingUp, Plus, RefreshCw, ArrowRight, ArrowLeft, Share2, X, CheckCircle2, Trash2, Edit2, ChevronRight, Repeat, Info, ShieldCheck, Zap, PieChart as PieChartIcon } from 'lucide-react';
import { Holding, RecurrenceFrequency, Transaction } from '../types';
import { formatCurrency, formatCompactNumber, cn, getMonthlyCommitment } from '../lib/utils';
import { useFirebase } from '../lib/FirebaseProvider';
import { processRecurringTransactions } from '../lib/recurrence';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { syncPortfolioHoldings } from '../services/portfolioService';
import Modal from './Modal';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Legend } from 'recharts';

interface PortfolioProps {
  holdings: Holding[];
  allTransactions: Transaction[];
  setActiveTab?: (tab: string) => void;
  onBack?: () => void;
}

export default function Portfolio({ holdings, allTransactions, setActiveTab, onBack }: PortfolioProps) {
  const { user } = useFirebase();
  const [filter, setFilter] = useState('');
  const [showInsights, setShowInsights] = useState(false);

  // ... rest of the existing state ...
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
  const [sipDay, setSipDay] = useState('5');
  const [isRecurringSIP, setIsRecurringSIP] = useState(false);
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

  // Aggregate Data for Chart
  const allocationData = useMemo(() => {
    const categories: Record<string, number> = {};
    holdings.forEach(h => {
      categories[h.type] = (categories[h.type] || 0) + h.current;
    });

    return Object.entries(categories).map(([name, value]) => ({
      name,
      value,
    })).sort((a, b) => b.value - a.value);
  }, [holdings]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  const totalInv = holdings.reduce((acc, h) => acc + h.invested, 0);
  const totalCur = holdings.reduce((acc, h) => acc + h.current, 0);
  const totalRet = totalCur - totalInv;
  const totalRetPct = totalInv > 0 ? Math.round((totalRet / totalInv) * 100) : 0;

  // Weighted XIRR calculation (simplified)
  const weightedXirr = useMemo(() => {
    if (holdings.length === 0 || totalCur === 0) return 0;
    const sum = holdings.reduce((acc, h) => acc + (h.xirr * h.current), 0);
    return Math.round((sum / totalCur) * 10) / 10;
  }, [holdings, totalCur]);

  const taxInsights = useMemo(() => {
    const elssActive = holdings.some(h => h.name.toLowerCase().includes('elss') || h.type.includes('ELSS'));
    const debtExposure = holdings.filter(h => h.type.includes('Debt')).reduce((acc, h) => acc + h.current, 0);
    const goldExposure = holdings.filter(h => h.type.includes('Gold')).reduce((acc, h) => acc + h.current, 0);
    
    return {
      elssActive,
      debtExposure,
      goldExposure,
      hasTaxSavers: elssActive || holdings.some(h => h.name.toLowerCase().includes('ppf')),
      efficiency: elssActive ? 'High' : 'Medium'
    };
  }, [holdings]);

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

      let holdingId = editingHolding?.id;
      if (editingHolding) {
        await updateDoc(doc(db, 'holdings', editingHolding.id), holdingData);
      } else {
        const docRef = await addDoc(collection(db, 'holdings'), {
          ...holdingData,
          createdAt: new Date().toISOString()
        });
        holdingId = docRef.id;
      }

      // Handle Recurring SIP
      if (isRecurringSIP && sip && sipDay) {
        const amount = Math.round(parseFloat(sip));
        const day = parseInt(sipDay);
        const now = new Date();
        const nextDate = new Date(now.getFullYear(), now.getMonth(), day);
        if (nextDate < now) {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }

        const existingRec = (allTransactions as Transaction[]).find(t => t.isRecurring && t.targetId === holdingId);
        
        const recData: any = {
          uid: user.uid,
          name: `SIP: ${name}`,
          amount: -Math.abs(amount),
          type: 'investment',
          category: 'Investment',
          subCategory: type.includes('MF') ? 'Mutual Funds' : 'Stocks',
          date: nextDate.toISOString().split('T')[0],
          emoji: '📈',
          isRecurring: true,
          recurrence: 'monthly',
          linkedAcc: fundSource === 'wallet' ? 'wallet' : fundSource,
          targetId: holdingId,
          lastProcessed: null,
          createdAt: new Date().toISOString()
        };

        if (existingRec) {
          await updateDoc(doc(db, 'transactions', existingRec.id), recData);
          await processRecurringTransactions(user.uid, [{ id: existingRec.id, ...recData } as any], accounts, wallet, holdings);
        } else {
          const recDocRef = await addDoc(collection(db, 'transactions'), recData);
          await processRecurringTransactions(user.uid, [{ id: recDocRef.id, ...recData } as any], accounts, wallet, holdings);
        }
      } else if (editingHolding) {
        const existingRec = (allTransactions as Transaction[]).find(t => t.isRecurring && t.targetId === editingHolding.id);
        if (existingRec) {
          await deleteDoc(doc(db, 'transactions', existingRec.id));
        }
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
      
      // Delete recurring SIP if exists
      const recTx = (allTransactions as Transaction[]).find(t => t.isRecurring && t.targetId === id);
      if (recTx) {
        await deleteDoc(doc(db, 'transactions', recTx.id));
      }

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
    setSipDay('5');
    setIsRecurringSIP(!!(allTransactions as Transaction[]).find(t => t.isRecurring && t.targetId === h.id));
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
    setSipDay('5');
    setIsRecurringSIP(false);
    setXirr('');
    setUnits('');
    setAvgPrice('');
    setCurrentPrice('');
    setLinkedGoalId('');
    setFundSource('external');
    setError(null);
  };

  const filteredHoldings = holdings.filter(h => !filter || h.type === filter);

  return (
    <div className="space-y-8 pb-20">
      {onBack && (
        <div className="flex items-center gap-4 px-2">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Back to Vault</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 px-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
            Investment overview {lastSyncTime && `· Last synced ${lastSyncTime}`}
          </p>
          <h2 className="font-display font-extrabold text-3xl md:text-4xl tracking-tight text-slate-900">Portfolio</h2>
        </div>
        <div className="flex gap-2 flex-wrap md:justify-end w-full md:w-auto">
          <button 
            onClick={() => setShowInsights(!showInsights)}
            className={cn(
              "flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-display font-bold text-xs transition-all shadow-sm",
              showInsights ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-100 text-slate-600 hover:bg-slate-50"
            )}
          >
            <Zap size={14} /> Insights
          </button>
          <button 
            onClick={handleSync}
            disabled={isSyncing || holdings.length === 0}
            className={cn(
              "flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-100 bg-white text-slate-900 font-display font-bold text-xs shadow-sm transition-all hover:bg-slate-50",
              isSyncing && "opacity-50 cursor-not-allowed"
            )}
          >
            <RefreshCw size={14} className={cn(isSyncing && "animate-spin")} />
            {isSyncing ? 'Syncing...' : 'Sync'}
          </button>
          <button 
            onClick={() => { setError(null); setIsAddModalOpen(true); }}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-display font-bold text-xs shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            <Plus size={14} /> Add Holding
          </button>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 px-2">
        {/* Main Stats and Chart */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-100 p-8 rounded-[40px] shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-8">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Portfolio Value</p>
                <h3 className="text-4xl font-display font-black text-slate-900 leading-tight">
                  {formatCurrency(totalCur)}
                </h3>
              </div>
              <div className={cn(
                "px-3 py-1.5 rounded-full flex items-center gap-1.5 font-display font-black text-xs",
                totalRet >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              )}>
                {totalRet >= 0 ? <TrendingUp size={14} /> : <TrendingUp size={14} className="rotate-180" />}
                {totalRetPct > 0 ? '+' : ''}{totalRetPct}%
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Invested Capital</p>
                <p className="text-xl font-display font-black text-slate-700">{formatCompactNumber(totalInv)}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Weighted XIRR</p>
                <p className="text-xl font-display font-black text-amber-600">{weightedXirr}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-100 p-8 rounded-[40px] shadow-sm relative overflow-hidden h-full min-h-[250px]">
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Asset Allocation</p>
             <div className="h-[180px] w-full">
                {holdings.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {allocationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ReTooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl border border-white/10 shadow-xl">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{payload[0].name}</p>
                                <p className="text-sm font-display font-black">{formatCurrency(payload[0].value as number)}</p>
                                <p className="text-[10px] font-bold text-indigo-400">{Math.round((payload[0].value as number / totalCur) * 100)}% Allocation</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center flex-col text-slate-300 gap-2">
                    <PieChartIcon size={32} />
                    <p className="text-[10px] font-black uppercase">No Data Available</p>
                  </div>
                )}
             </div>
             {holdings.length > 0 && (
               <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 justify-center">
                 {allocationData.slice(0, 4).map((item, i) => (
                   <div key={i} className="flex items-center gap-1.5">
                     <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                     <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">{item.name}</span>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>

        {/* Tactical Insights Section */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-xl relative overflow-hidden h-full">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Tax & Strategy</h4>
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-indigo-400">
                  <Zap size={16} />
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tax Efficiency</p>
                    <span className={cn(
                      "text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                      taxInsights.efficiency === 'High' ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                    )}>{taxInsights.efficiency}</span>
                  </div>
                  {!taxInsights.elssActive && (
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-start gap-3 mt-4 group cursor-pointer hover:bg-white/10 transition-all">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                        <TrendingUp size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white mb-1">ELSS Suggestion</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Save up to ₹46,800 in taxes annually with Equity Linked Savings Schemes (80C).</p>
                      </div>
                    </div>
                  )}
                  {taxInsights.goldExposure < (totalCur * 0.05) && (
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-start gap-3 mt-3 group cursor-pointer hover:bg-white/10 transition-all">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                        <Zap size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white mb-1">Gold Under-allocation</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Consider Sovereign Gold Bonds (SGB) for tax-free capital gains and 2.5% annual interest.</p>
                      </div>
                    </div>
                  )}
                  {taxInsights.hasTaxSavers && (
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/10 flex items-start gap-3 mt-4">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                        <ShieldCheck size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white mb-1">Tax Shield Active</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Your portfolio currently includes tax-saving instruments like ELSS or PPF.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
          </div>
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
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 text-slate-400">SIP Day</label>
              <input 
                type="number" 
                value={sipDay}
                onChange={(e) => setSipDay(e.target.value)}
                placeholder="1-31"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                <Repeat size={18} />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 leading-tight">Recurring SIP</p>
                <p className="text-[10px] font-bold text-indigo-600">Add to Autopilot</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsRecurringSIP(!isRecurringSIP)}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative",
                isRecurringSIP ? "bg-indigo-600" : "bg-slate-200"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                isRecurringSIP ? "right-1" : "left-1"
              )} />
            </button>
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
                  <tr key={h.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => handleEditHolding(h)}>
                    <td className="px-6 py-4">
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
                        <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-600 transition-all" />
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleEditHolding(h); }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all md:opacity-0 md:group-hover:opacity-100"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setHoldingToDelete(h); }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all md:opacity-0 md:group-hover:opacity-100"
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
