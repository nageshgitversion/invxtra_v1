import React from 'react';
import { motion } from 'motion/react';
import { 
  User, 
  Mail, 
  Shield, 
  LogOut, 
  Calendar, 
  TrendingUp, 
  Wallet, 
  Target, 
  Award,
  ChevronRight,
  ExternalLink,
  Bell,
  Smartphone,
  ArrowLeft,
  Trash2,
  AlertTriangle,
  RefreshCcw,
  LayoutDashboard
} from 'lucide-react';
import { useFirebase } from '../lib/FirebaseProvider';
import { logout, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { formatCurrency, cn } from '../lib/utils';

export default function Profile() {
  const { user, transactions, accounts, familyGoals, holdings, wallet } = useFirebase();
  const [isResetting, setIsResetting] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  const handleResetEverything = async () => {
    if (!user) return;
    setIsResetting(true);
    
    try {
      const collections = [
        'transactions',
        'holdings',
        'accounts',
        'familyGoals',
        'familyMembers',
        'splits'
      ];

      const batch = writeBatch(db);

      for (const collName of collections) {
        const q = query(collection(db, collName), where('uid', '==', user.uid));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach((d) => {
          batch.delete(d.ref);
        });
      }

      const walletRef = doc(db, 'wallets', user.uid);
      batch.delete(walletRef);

      await batch.commit();
      localStorage.removeItem(`wealthos_onboarding_${user.uid}`);
      
      setShowConfirm(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'multiple-collections');
    } finally {
      setIsResetting(false);
    }
  };

  const stats = [
    { label: 'Total Assets', value: formatCurrency(holdings.reduce((acc, h) => acc + h.current, 0) + accounts.reduce((acc, a) => acc + a.amt, 0)), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Active Goals', value: familyGoals.length, icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Accounts', value: accounts.length, icon: Wallet, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="px-2 pt-2">
        <p className="text-slate-400 text-xs font-medium">Account</p>
        <h2 className="font-display font-extrabold text-3xl text-slate-900">My Profile</h2>
      </div>

      {/* Floating Back Button */}
      <motion.button 
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => window.dispatchEvent(new CustomEvent('setActiveTab', { detail: 'home' }))}
        className="fixed bottom-24 right-6 md:bottom-10 md:right-10 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl shadow-indigo-300 flex items-center justify-center z-50 group border-4 border-white"
        title="Back to Dashboard"
      >
        <LayoutDashboard size={24} className="group-hover:rotate-12 transition-transform" />
        <div className="absolute -top-10 right-0 bg-slate-900 text-white text-[10px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none uppercase tracking-widest">
          Dashboard
        </div>
      </motion.button>

      {/* Profile Header */}
      <div className="glass-card p-8 rounded-[32px] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-600/5 rounded-full -ml-24 -mb-24 blur-3xl"></div>
        
        <div className="relative flex flex-col md:flex-row items-center gap-8">
          <div className="relative group">
            <div className="w-32 h-32 rounded-[40px] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-5xl font-display font-black shadow-2xl shadow-indigo-200 group-hover:scale-105 transition-transform duration-300">
              {user?.displayName?.charAt(0) || 'U'}
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-2xl shadow-lg flex items-center justify-center text-indigo-600 border border-indigo-50">
              <Award size={20} />
            </div>
          </div>

          <div className="flex-1 text-center md:text-left space-y-2">
            <h3 className="font-display font-black text-3xl text-slate-900">{user?.displayName}</h3>
            <div className="flex flex-wrap justify-center md:justify-start gap-4">
              <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                <Mail size={16} className="text-indigo-400" />
                {user?.email}
              </div>
              <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                <Shield size={16} className="text-emerald-400" />
                Verified Account
              </div>
            </div>
          </div>

          <button 
            onClick={logout}
            className="px-6 py-3 rounded-2xl bg-red-50 text-red-600 font-display font-bold text-sm hover:bg-red-100 transition-all flex items-center gap-2"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="glass-card p-6 rounded-2xl flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", stat.bg, stat.color)}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
              <p className="text-lg font-display font-black text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Wallet Management Section */}
      <div className="glass-card p-6 rounded-[32px] border-l-4 border-l-indigo-500">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Wallet size={24} />
            </div>
            <div>
              <h4 className="font-display font-bold text-lg">Wallet Management</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Track cash & envelopes</p>
            </div>
          </div>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('openWalletModal'))}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-display font-bold text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            {wallet?.active ? "Manage Wallet" : "Setup Wallet"}
          </button>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Your digital wallet helps you automate savings and track daily spending through virtual envelopes. 
          Set your monthly balance and let invxtra handle the rest.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Details */}
        <div className="glass-card p-6 rounded-[32px] space-y-6">
          <h4 className="font-display font-bold text-lg flex items-center gap-2">
            <User size={20} className="text-indigo-600" />
            Personal Information
          </h4>
          
          <div className="space-y-4">
            <InfoRow label="Full Name" value={user?.displayName || 'Not set'} />
            <InfoRow label="Email Address" value={user?.email || 'Not set'} />
            <InfoRow label="Signup Date" value={user?.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not available'} />
            <InfoRow label="Last Login" value={user?.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Not available'} />
            <InfoRow label="User ID" value={user?.uid.substring(0, 12) + '...'} />
            <InfoRow label="Currency" value="INR (₹)" />
            <InfoRow label="Timezone" value={Intl.DateTimeFormat().resolvedOptions().timeZone} />
          </div>
        </div>

        {/* Preferences & Settings */}
        <div className="glass-card p-6 rounded-[32px] space-y-6">
          <div className="flex justify-between items-center">
            <h4 className="font-display font-bold text-lg flex items-center gap-2">
              <Bell size={20} className="text-indigo-600" />
              Preferences
            </h4>
            <button 
              onClick={() => {
                // We need to pass setActiveTab to Profile or use a global state
                // For now, I'll assume it's handled via a custom event or just add a note
                window.dispatchEvent(new CustomEvent('setActiveTab', { detail: 'settings' }));
              }}
              className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
            >
              Manage Settings
            </button>
          </div>
          
          <div className="space-y-2">
            <PreferenceToggle label="Email Notifications" description="Receive weekly financial reports" defaultChecked />
            <PreferenceToggle label="Push Notifications" description="Alerts for large transactions" defaultChecked />
            <PreferenceToggle label="AI Insights" description="Get personalized tips from Gemini" defaultChecked />
            <PreferenceToggle label="Biometric Login" description="Use FaceID or Fingerprint" />
          </div>
        </div>
      </div>

      {/* Support & Legal */}
      <div className="glass-card p-6 rounded-[32px] space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SupportLink icon={Smartphone} label="Download App" />
          <SupportLink icon={ExternalLink} label="Privacy Policy" />
          <SupportLink icon={ExternalLink} label="Terms of Service" />
        </div>

        {/* Danger Zone */}
        <div className="pt-6 border-t border-red-50">
          <div className="bg-red-50/50 border border-red-100 rounded-2xl p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="font-display font-bold text-red-900 text-sm">Danger Zone</h4>
                <p className="text-[11px] text-red-700 leading-relaxed font-medium">
                  Resetting your data will permanently delete all transactions, accounts, and goals. This action is irreversible.
                </p>
              </div>
            </div>

            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-50 border border-emerald-100 text-emerald-700 p-3 rounded-xl text-[11px] font-bold text-center"
              >
                ✓ Data reset successfully.
              </motion.div>
            )}

            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="w-full bg-white border border-red-200 text-red-600 font-display font-bold py-3 rounded-xl hover:bg-red-50 transition-all flex items-center justify-center gap-2 text-xs"
              >
                <Trash2 size={16} />
                Reset All Financial Data
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-[10px] font-black text-red-800 uppercase text-center tracking-widest">Confirm permanent deletion?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 bg-white border border-slate-200 text-slate-600 font-display font-bold py-2.5 rounded-xl hover:bg-slate-50 transition-all text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResetEverything}
                    disabled={isResetting}
                    className="flex-1 bg-red-600 text-white font-display font-bold py-2.5 rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
                  >
                    {isResetting ? (
                      <RefreshCcw size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    Yes, Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <span className="text-sm font-bold text-slate-900">{value}</span>
    </div>
  );
}

function PreferenceToggle({ label, description, defaultChecked = false }: { label: string, description: string, defaultChecked?: boolean }) {
  const [checked, setChecked] = React.useState(defaultChecked);
  return (
    <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
      <div className="space-y-0.5">
        <p className="text-sm font-bold text-slate-900">{label}</p>
        <p className="text-[10px] text-slate-500 font-medium">{description}</p>
      </div>
      <button 
        onClick={() => setChecked(!checked)}
        className={cn(
          "w-12 h-6 rounded-full transition-all relative",
          checked ? "bg-indigo-600" : "bg-slate-200"
        )}
      >
        <div className={cn(
          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
          checked ? "left-7" : "left-1"
        )}></div>
      </button>
    </div>
  );
}

function SupportLink({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <button className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 transition-all group">
      <div className="flex items-center gap-3">
        <Icon size={18} className="text-slate-400 group-hover:text-indigo-600" />
        <span className="text-sm font-bold">{label}</span>
      </div>
      <ChevronRight size={16} className="text-slate-300" />
    </button>
  );
}
