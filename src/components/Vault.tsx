import React from 'react';
import { PiggyBank, Landmark, Shield, TrendingUp, Wallet, ArrowRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Account, Wallet as WalletType, Holding } from '../types';
import { formatCurrency, formatCompactNumber } from '../lib/utils';
import { motion } from 'motion/react';

interface VaultProps {
  accounts: Account[];
  holdings: Holding[];
  wallet: WalletType | null;
  setActiveTab: (tab: string) => void;
}

export default function Vault({ accounts, holdings, wallet, setActiveTab }: VaultProps) {
  const savingsBalance = accounts.filter(a => a.type === 'savings').reduce((acc, a) => acc + a.amt, 0);
  const depositsBalance = accounts.filter(a => ['fd', 'rd'].includes(a.type)).reduce((acc, a) => acc + a.amt, 0);
  const loansBalance = accounts.filter(a => a.type === 'loan').reduce((acc, a) => acc + (a.amt || 0), 0);
  
  // Investments: PF (from accounts) + Portfolios (from holdings)
  const pfBalance = accounts.filter(a => ['ppf', 'nps', 'epf'].includes(a.type)).reduce((acc, a) => acc + a.amt, 0);
  const holdingsBalance = holdings.reduce((acc, h) => acc + h.current, 0);
  const totalInvestments = pfBalance + holdingsBalance;

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4">
        <div>
          <h2 className="text-3xl font-display font-black tracking-tight text-slate-900">Your Vault</h2>
          <p className="text-slate-500 font-medium mt-1">Manage all your accounts, deposits, loans, and portfolios in one place.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Wallet Card */}
        <motion.div 
          onClick={() => window.dispatchEvent(new CustomEvent('openWalletModal'))}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.3, delay: 0.0 }}
          className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-3 md:mb-6">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
              <Wallet size={20} className="md:w-6 md:h-6" />
            </div>
            <div className="p-1.5 md:p-2 bg-slate-50 rounded-lg md:rounded-xl group-hover:bg-indigo-50 transition-colors">
              <ArrowRight size={12} className="text-slate-400 group-hover:text-indigo-600 md:w-4 md:h-4" />
            </div>
          </div>
          <div>
            <p className="text-[9px] md:text-xs font-black uppercase tracking-widest text-slate-400 mb-0.5 md:mb-1">Monthly Wallet</p>
            <h3 className="font-display font-black text-lg md:text-2xl text-slate-900 mb-1 md:mb-2 leading-tight">
              {wallet?.active ? <span className="text-emerald-600">Active</span> : <span className="text-slate-400 text-sm">Setup</span>}
            </h3>
            {wallet?.active && (
              <p className="text-[10px] md:text-sm font-medium text-slate-500 truncate">
                ₹{formatCurrency(wallet.free)}
              </p>
            )}
          </div>
        </motion.div>

        {/* Savings Accounts Card */}
        <motion.div 
          onClick={() => {
            setActiveTab('savings_view');
          }}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-3 md:mb-6">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <PiggyBank size={20} className="md:w-6 md:h-6" />
            </div>
            <div className="p-1.5 md:p-2 bg-slate-50 rounded-lg md:rounded-xl group-hover:bg-emerald-50 transition-colors">
              <ArrowRight size={12} className="text-slate-400 group-hover:text-emerald-600 md:w-4 md:h-4" />
            </div>
          </div>
          <div>
            <p className="text-[9px] md:text-xs font-black uppercase tracking-widest text-slate-400 mb-0.5 md:mb-1">Savings</p>
            <h3 className="font-display font-black text-lg md:text-2xl text-slate-900 mb-1 md:mb-2 leading-tight">
              ₹{formatCompactNumber(savingsBalance)}
            </h3>
            <p className="text-[10px] md:text-sm font-medium text-slate-500">
              {accounts.filter(a => a.type === 'savings').length} a/c
            </p>
          </div>
        </motion.div>

        {/* Deposits (FD/RD) Card */}
        <motion.div 
          onClick={() => {
            setActiveTab('deposits_view');
          }}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-3 md:mb-6">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
              <Landmark size={20} className="md:w-6 md:h-6" />
            </div>
            <div className="p-1.5 md:p-2 bg-slate-50 rounded-lg md:rounded-xl group-hover:bg-blue-50 transition-colors">
              <ArrowRight size={12} className="text-slate-400 group-hover:text-blue-600 md:w-4 md:h-4" />
            </div>
          </div>
          <div>
            <p className="text-[9px] md:text-xs font-black uppercase tracking-widest text-slate-400 mb-0.5 md:mb-1">Deposits</p>
            <h3 className="font-display font-black text-lg md:text-2xl text-slate-900 mb-1 md:mb-2 leading-tight">
              ₹{formatCompactNumber(depositsBalance)}
            </h3>
            <p className="text-[10px] md:text-sm font-medium text-slate-500">
              {accounts.filter(a => ['fd', 'rd'].includes(a.type)).length} active
            </p>
          </div>
        </motion.div>

        {/* Loans Card */}
        <motion.div 
          onClick={() => {
            setActiveTab('loans_view');
          }}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.3, delay: 0.3 }}
          className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-3 md:mb-6">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-red-50 flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
              <ArrowDownRight size={20} className="md:w-6 md:h-6" />
            </div>
            <div className="p-1.5 md:p-2 bg-slate-50 rounded-lg md:rounded-xl group-hover:bg-red-50 transition-colors">
              <ArrowRight size={12} className="text-slate-400 group-hover:text-red-600 md:w-4 md:h-4" />
            </div>
          </div>
          <div>
            <p className="text-[9px] md:text-xs font-black uppercase tracking-widest text-slate-400 mb-0.5 md:mb-1">Loans & Debt</p>
            <h3 className="font-display font-black text-lg md:text-2xl text-slate-900 mb-1 md:mb-2 leading-tight">
              ₹{formatCompactNumber(loansBalance)}
            </h3>
            <p className="text-[10px] md:text-sm font-medium text-slate-500">
              {accounts.filter(a => a.type === 'loan').length} active
            </p>
          </div>
        </motion.div>

        {/* PF & Pensions Card */}
        <motion.div 
          onClick={() => {
            setActiveTab('investments_view');
          }}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.3, delay: 0.4 }}
          className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-3 md:mb-6">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
              <Shield size={20} className="md:w-6 md:h-6" />
            </div>
            <div className="p-1.5 md:p-2 bg-slate-50 rounded-lg md:rounded-xl group-hover:bg-indigo-50 transition-colors">
              <ArrowRight size={12} className="text-slate-400 group-hover:text-indigo-600 md:w-4 md:h-4" />
            </div>
          </div>
          <div>
            <p className="text-[9px] md:text-xs font-black uppercase tracking-widest text-slate-400 mb-0.5 md:mb-1">PF & Pensions</p>
            <h3 className="font-display font-black text-lg md:text-2xl text-slate-900 mb-1 md:mb-2 leading-tight">
              ₹{formatCompactNumber(pfBalance)}
            </h3>
            <p className="text-[10px] md:text-sm font-medium text-slate-500">
              {accounts.filter(a => ['ppf', 'nps', 'epf'].includes(a.type)).length} active
            </p>
          </div>
        </motion.div>

        {/* Portfolio Card */}
        <motion.div 
          onClick={() => {
            setActiveTab('portfolio');
          }}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.3, delay: 0.5 }}
          className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer md:col-span-2 group"
        >
          <div className="flex justify-between items-start mb-3 md:mb-6">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
              <TrendingUp size={20} className="md:w-6 md:h-6" />
            </div>
            <div className="p-1.5 md:p-2 bg-slate-50 rounded-lg md:rounded-xl group-hover:bg-purple-50 transition-colors">
              <ArrowRight size={12} className="text-slate-400 group-hover:text-purple-600 md:w-4 md:h-4" />
            </div>
          </div>
          <div>
            <p className="text-[9px] md:text-xs font-black uppercase tracking-widest text-slate-400 mb-0.5 md:mb-1">Portfolio</p>
            <h3 className="font-display font-black text-lg md:text-3xl text-slate-900 mb-1 md:mb-2 leading-tight">
              ₹{formatCompactNumber(holdingsBalance)}
            </h3>
            <p className="text-[10px] md:text-sm font-medium text-slate-500">
              Stocks, Mutual Funds & ETFs
            </p>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
