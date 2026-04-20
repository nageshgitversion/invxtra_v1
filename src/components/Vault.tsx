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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Wallet Card */}
        <motion.div 
          onClick={() => window.dispatchEvent(new CustomEvent('openWalletModal'))}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.3, delay: 0.0 }}
          className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
              <Wallet size={24} />
            </div>
            <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-indigo-50 transition-colors">
              <ArrowRight size={16} className="text-slate-400 group-hover:text-indigo-600" />
            </div>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Monthly Wallet</p>
            <h3 className="font-display font-black text-2xl text-slate-900 mb-2">
              {wallet?.active ? <span className="text-emerald-600">Active</span> : <span className="text-slate-400">Not Setup</span>}
            </h3>
            {wallet?.active && (
              <p className="text-sm font-medium text-slate-500">
                Free Balance: <strong>₹{formatCurrency(wallet.free)}</strong>
              </p>
            )}
          </div>
        </motion.div>

        {/* Savings Accounts Card */}
        <motion.div 
          onClick={() => {
            setActiveTab('savings_view');
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('openAddAccountModal', { detail: { type: 'savings' } }));
            }, 300);
          }}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <PiggyBank size={24} />
            </div>
            <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-emerald-50 transition-colors">
              <ArrowRight size={16} className="text-slate-400 group-hover:text-emerald-600" />
            </div>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Savings & Salary</p>
            <h3 className="font-display font-black text-2xl text-slate-900 mb-2">
              ₹{formatCompactNumber(savingsBalance)}
            </h3>
            <p className="text-sm font-medium text-slate-500">
              {accounts.filter(a => a.type === 'savings').length} active account(s)
            </p>
          </div>
        </motion.div>

        {/* Deposits (FD/RD) Card */}
        <motion.div 
          onClick={() => {
            setActiveTab('deposits_view');
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('openAddAccountModal', { detail: { type: 'fd' } }));
            }, 300);
          }}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
              <Landmark size={24} />
            </div>
            <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-blue-50 transition-colors">
              <ArrowRight size={16} className="text-slate-400 group-hover:text-blue-600" />
            </div>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Deposits (FD & RD)</p>
            <h3 className="font-display font-black text-2xl text-slate-900 mb-2">
              ₹{formatCompactNumber(depositsBalance)}
            </h3>
            <p className="text-sm font-medium text-slate-500">
              {accounts.filter(a => ['fd', 'rd'].includes(a.type)).length} active deposit(s)
            </p>
          </div>
        </motion.div>

        {/* Loans Card */}
        <motion.div 
          onClick={() => {
            setActiveTab('loans_view');
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('openAddAccountModal', { detail: { type: 'loan' } }));
            }, 300);
          }}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.3, delay: 0.3 }}
          className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-6">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
              <ArrowDownRight size={24} />
            </div>
            <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-red-50 transition-colors">
              <ArrowRight size={16} className="text-slate-400 group-hover:text-red-600" />
            </div>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Loans & Debt</p>
            <h3 className="font-display font-black text-2xl text-slate-900 mb-2">
              ₹{formatCompactNumber(loansBalance)}
            </h3>
            <p className="text-sm font-medium text-slate-500">
              {accounts.filter(a => a.type === 'loan').length} active loan(s)
            </p>
          </div>
        </motion.div>

        {/* Investments Card */}
        <motion.div 
          onClick={() => {
            setActiveTab('portfolio');
          }}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.3, delay: 0.4 }}
          className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer md:col-span-2 group"
        >
          <div className="flex justify-between items-start mb-6">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
              <TrendingUp size={24} />
            </div>
            <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-purple-50 transition-colors">
              <ArrowRight size={16} className="text-slate-400 group-hover:text-purple-600" />
            </div>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Investments & Portfolios</p>
            <h3 className="font-display font-black text-3xl text-slate-900 mb-2">
              ₹{formatCompactNumber(totalInvestments)}
            </h3>
            <p className="text-sm font-medium text-slate-500">
              Includes {accounts.filter(a => ['ppf', 'nps', 'epf'].includes(a.type)).length} PF accounts and your market portfolios
            </p>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
