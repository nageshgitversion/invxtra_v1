import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  ReceiptIndianRupee, 
  PiggyBank, 
  TrendingUp, 
  BarChart3, 
  MessageSquare, 
  Mic, 
  Bell, 
  Plus, 
  Search, 
  ChevronRight,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  User,
  LogOut,
  Settings as SettingsIcon,
  Menu,
  X
} from 'lucide-react';
import { INITIAL_TRANSACTIONS, INITIAL_HOLDINGS, INITIAL_ACCOUNTS } from './constants';
import { Transaction, Holding, Account, Wallet as WalletType } from './types';
import { formatCurrency, formatCompactNumber, cn } from './lib/utils';
import { getFinancialInsights, chatWithInvxtra } from './services/geminiService';
import { useFirebase } from './lib/FirebaseProvider';
import { processRecurringTransactions } from './lib/recurrence';
import { checkAndSweepWallet } from './lib/walletService';
import { signInWithGoogle, logout } from './lib/firebase';

// Components
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import Vault from './components/Vault';
import Savings from './components/Savings';
import Portfolio from './components/Portfolio';
import Analytics from './components/Analytics';
import Planner from './components/Planner';

import AIChat from './components/AIChat';
import TaxPlanner from './components/TaxPlanner';
import ScenarioSimulator from './components/ScenarioSimulator';
import Profile from './components/Profile';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import Topbar from './components/Topbar';
import Household from './components/Household';
import LandingPage from './components/LandingPage';
import Modal from './components/Modal';
import Settings from './components/Settings';
import Onboarding from './components/Onboarding';
import Space from './components/Space';
import CashFlow from './components/CashFlow';
import Reports from './components/Reports';
import Insights from './components/Insights';
import Autopilot from './components/Autopilot';
import WalletModal from './components/WalletModal';
import Logo from './components/Logo';
import CommandPalette from './components/CommandPalette';

import FeatureGuide from './components/FeatureGuide';
import SmartSplit from './components/SmartSplit';

export default function App() {
  const { 
    user, 
    loading, 
    transactions, 
    holdings, 
    accounts, 
    wallet,
    familyGoals,
    splits,
    familyMembers
  } = useFirebase();
  const [activeTab, setActiveTab] = useState('home');
  const [insights, setInsights] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasCheckedRecurring, setHasCheckedRecurring] = useState(false);
  const [modalType, setModalType] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isFeatureGuideOpen, setIsFeatureGuideOpen] = useState(false);
  const [chatPos, setChatPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleTabChange = (e: any) => setActiveTab(e.detail);
    const handleOpenWallet = () => setIsWalletModalOpen(true);
    const handleOpenFeatureGuide = () => setIsFeatureGuideOpen(true);
    
    window.addEventListener('setActiveTab', handleTabChange);
    window.addEventListener('openWalletModal', handleOpenWallet);
    window.addEventListener('openFeatureGuide', handleOpenFeatureGuide);
    
    return () => {
      window.removeEventListener('setActiveTab', handleTabChange);
      window.removeEventListener('openWalletModal', handleOpenWallet);
      window.removeEventListener('openFeatureGuide', handleOpenFeatureGuide);
    };
  }, []);

  useEffect(() => {
    if (!loading && user && transactions.length === 0 && accounts.length === 0 && !showOnboarding) {
      const hasSeenOnboarding = localStorage.getItem(`wealthos_onboarding_${user.uid}`);
      if (!hasSeenOnboarding) {
        setShowOnboarding(true);
      }
    }
  }, [loading, user, transactions.length, accounts.length]);

  const handleOnboardingComplete = () => {
    if (user) {
      localStorage.setItem(`wealthos_onboarding_${user.uid}`, 'true');
    }
    setShowOnboarding(false);
  };

  useEffect(() => {
    if (!user) return;
    const loadInsights = async () => {
      const now = new Date();
      const currentMonth = now.toISOString().slice(0, 7);
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonth = lastMonthDate.toISOString().slice(0, 7);
      
      const currentMonthTransactions = transactions.filter(t => !t.isRecurring && t.date.startsWith(currentMonth));
      const lastMonthTransactions = transactions.filter(t => !t.isRecurring && t.date.startsWith(lastMonth));
      
      const getCategoryBreakdown = (txs: Transaction[]) => {
        return txs.reduce((acc: any, t) => {
          if (t.type === 'expense') {
            acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
          }
          return acc;
        }, {});
      };

      const data = {
        age: user?.metadata?.creationTime ? Math.floor((Date.now() - new Date(user.metadata.creationTime).getTime()) / (1000 * 60 * 60 * 24 * 365)) + 25 : 30, // Mock age if not available
        netWorth: holdings.reduce((acc, h) => acc + h.current, 0) + accounts.reduce((acc, a) => acc + a.amt, 0),
        currentMonth: {
          income: currentMonthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0),
          expenses: Math.abs(currentMonthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0)),
          breakdown: getCategoryBreakdown(currentMonthTransactions)
        },
        lastMonth: {
          income: lastMonthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0),
          expenses: Math.abs(lastMonthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0)),
          breakdown: getCategoryBreakdown(lastMonthTransactions)
        },
        taxSavings80C: 0, // Will be calculated in Dashboard but good to have here too
        goals: familyGoals.map(g => ({ name: g.name, target: g.target, saved: g.saved }))
      };
      
      const res = await getFinancialInsights(data);
      if (Array.isArray(res)) setInsights(res);
    };
    loadInsights();
  }, [user, holdings, transactions]);

  useEffect(() => {
    if (!user || transactions.length === 0 || hasCheckedRecurring) return;

    const checkRecurring = async () => {
      setHasCheckedRecurring(true);
      await processRecurringTransactions(user.uid, transactions, accounts, wallet, holdings);
      if (wallet) {
        await checkAndSweepWallet(user.uid, wallet, accounts, transactions);
      }
    };

    checkRecurring();
  }, [user, transactions, hasCheckedRecurring, accounts, wallet]);

  const netWorth = useMemo(() => holdings.reduce((acc, h) => acc + h.current, 0), [holdings]);
  const monthlyIncome = useMemo(() => 
    transactions.filter(t => !t.isRecurring && t.type === 'income').reduce((acc, t) => acc + t.amount, 0), 
  [transactions]);
  const monthlyExpenses = useMemo(() => 
    Math.abs(transactions.filter(t => !t.isRecurring && t.type === 'expense').reduce((acc, t) => acc + t.amount, 0)), 
  [transactions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060d1a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <Logo variant="appicon" size={100} className="animate-pulse" />
          <p className="font-display font-bold text-white/60 tracking-widest uppercase text-[10px]">invxtra is loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage onLogin={signInWithGoogle} />;
  }

  const refreshInsights = async () => {
    const data = {
      netWorth: holdings.reduce((acc, h) => acc + h.current, 0),
      monthlyIncome: transactions
        .filter(t => !t.isRecurring && t.type === 'income')
        .reduce((acc, t) => acc + t.amount, 0),
      monthlyExpenses: Math.abs(
        transactions
          .filter(t => !t.isRecurring && t.type === 'expense')
          .reduce((acc, t) => acc + t.amount, 0)
      ),
    };
    const res = await getFinancialInsights(data, true);
    if (Array.isArray(res)) setInsights(res);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return <Dashboard transactions={transactions} holdings={holdings} accounts={accounts} insights={insights} wallet={wallet} onRefreshInsights={refreshInsights} onTabChange={setActiveTab} />;
      case 'transactions': return <Transactions transactions={transactions} wallet={wallet} onBack={() => setActiveTab('cashflow')} />;
      case 'vault': return <Vault accounts={accounts} holdings={holdings} wallet={wallet} setActiveTab={setActiveTab} />;
      case 'savings_view': return <Savings accounts={accounts} transactions={transactions} viewGroup="savings" onBack={() => setActiveTab('vault')} />;
      case 'deposits_view': return <Savings accounts={accounts} transactions={transactions} viewGroup="deposits" onBack={() => setActiveTab('vault')} />;
      case 'loans_view': return <Savings accounts={accounts} transactions={transactions} viewGroup="loans" onBack={() => setActiveTab('vault')} />;
      case 'investments_view': return <Savings accounts={accounts} transactions={transactions} viewGroup="investments" onBack={() => setActiveTab('vault')} />;
      case 'savings': return <Savings accounts={accounts} transactions={transactions} />;
      case 'portfolio': return <Portfolio holdings={holdings} allTransactions={transactions} setActiveTab={setActiveTab} onBack={() => setActiveTab('vault')} />;
      case 'analytics': return <Analytics transactions={transactions} holdings={holdings} onBack={() => setActiveTab('insights')} />;
      case 'planner': return <Planner wallet={wallet} familyGoals={familyGoals} transactions={transactions} />;
      case 'taxplanner': return <TaxPlanner holdings={holdings} onBack={() => setActiveTab('insights')} />;
      case 'simulator': return <ScenarioSimulator onBack={() => setActiveTab('insights')} />;
      case 'insights': return <Insights setActiveTab={setActiveTab} />;
      case 'cashflow': return <CashFlow transactions={transactions} setActiveTab={setActiveTab} />;
      case 'autopilot': return <Autopilot transactions={transactions} accounts={accounts} holdings={holdings} onBack={() => setActiveTab('cashflow')} />;
      case 'reports': return <Reports transactions={transactions} onBack={() => setActiveTab('cashflow')} />;
      case 'split': return <SmartSplit onBack={() => setActiveTab('space')} />;
      case 'household': return <Household onBack={() => setActiveTab('space')} />;
      case 'space': return <Space setActiveTab={setActiveTab} />;
      case 'settings': return <Settings />;
      case 'profile': return <Profile />;
      case 'aichat': return <AIChat userData={{ netWorth, monthlyIncome, monthlyExpenses }} />;
      default: return <Dashboard transactions={transactions} holdings={holdings} accounts={accounts} insights={insights} wallet={wallet} onRefreshInsights={refreshInsights} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-bg-main text-slate-900 font-sans">
      {/* Desktop Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full relative">
        <Topbar activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <div className="flex-1 overflow-y-auto no-scrollbar pb-24 md:pb-8 px-4 md:px-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Mobile Bottom Nav */}
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Floating Add Transaction Button */}
        <AnimatePresence>
          {activeTab !== 'profile' && (
            <div className="fixed bottom-24 right-6 md:bottom-10 md:right-10 z-50">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <button
                  onClick={() => {
                    setActiveTab('transactions');
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('openAddTransactionModal'));
                    }, 50);
                  }}
                  className="w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-200 flex items-center justify-center group"
                >
                  <Plus size={28} className="group-hover:rotate-90 transition-transform duration-300" />
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}

      <Modal 
        isOpen={isWalletModalOpen} 
        onClose={() => setIsWalletModalOpen(false)} 
        title={wallet && wallet.active ? "Manage Wallet" : "Setup Your Wallet"}
      >
        <WalletModal 
          isOpen={isWalletModalOpen} 
          onClose={() => setIsWalletModalOpen(false)} 
          wallet={wallet} 
        />
      </Modal>

      <Modal
        isOpen={isFeatureGuideOpen}
        onClose={() => setIsFeatureGuideOpen(false)}
        title="App Features & Capabilities"
      >
        <FeatureGuide />
      </Modal>

      {/* Desktop Right Panel (Optional/Conditional) */}
      <aside className="hidden xl:flex w-80 flex-col p-6 gap-6 sticky top-0 h-screen overflow-y-auto border-l border-indigo-100 bg-white/50 backdrop-blur-sm">
        <div className="glass-card p-5 rounded-xl">
          <h3 className="font-display font-bold text-sm mb-4">🎯 Goals Progress</h3>
          {familyGoals.length > 0 ? familyGoals.slice(0, 3).map(goal => (
            <GoalItem 
              key={goal.id}
              label={goal.name} 
              progress={goal.target > 0 ? Math.round((goal.saved / goal.target) * 100) : 0} 
              color="bg-indigo-500" 
            />
          )) : (
            <p className="text-[10px] text-slate-400 font-medium text-center py-4">No goals set up</p>
          )}
        </div>

        <div className="glass-card p-5 rounded-xl">
          <h3 className="font-display font-bold text-sm mb-4 text-purple-600 flex items-center gap-2">
            <Sparkles size={16} /> AI Tip of the Day
          </h3>
          <p className="text-xs leading-relaxed text-slate-600 bg-purple-50 p-3 rounded-lg border border-purple-100">
            Investing ₹5,000/month in a Nifty 50 index fund for 20 years at 12% CAGR grows to <strong>₹49.9 Lakhs</strong>! 🚀
          </p>
        </div>
      </aside>

      <CommandPalette />
      {/* Modals would be handled here */}
    </div>
  );
}

function GoalItem({ label, progress, color }: { label: string, progress: number, color: string }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between text-xs font-bold mb-1.5">
        <span>{label}</span>
        <span className={cn("text-emerald-600")}>{progress}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className={cn("h-full rounded-full", color)}
        />
      </div>
    </div>
  );
}
