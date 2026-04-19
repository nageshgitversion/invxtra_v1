import React from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { ShieldCheck, Sparkles, Users, Coffee, ArrowRight, Zap, PieChart, BarChart3 } from 'lucide-react';
import Logo from './Logo';

interface LandingPageProps {
  onLogin: () => void;
}

export default function LandingPage({ onLogin }: LandingPageProps) {
  const { scrollYProgress } = useScroll();
  const y1 = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -200]);

  return (
    <div className="min-h-screen bg-[#060d1a] text-slate-300 font-sans overflow-x-hidden selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#060d1a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Logo variant="horizontal" className="h-8 text-white" />
          <button 
            onClick={onLogin}
            className="px-6 py-2.5 bg-white text-[#060d1a] rounded-full font-display font-bold text-sm hover:scale-105 transition-transform"
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 lg:pt-56 lg:pb-32 px-6 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[100px] pointer-events-none translate-x-1/4"></div>
        
        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-bold uppercase tracking-widest mb-8">
              <Sparkles size={14} /> Meet The Future of Finance
            </div>
            
            <h1 className="font-display font-extrabold text-5xl md:text-7xl lg:text-8xl tracking-tighter text-white leading-[1.1] mb-8">
              Your Financial <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                Command Center.
              </span>
            </h1>
            
            <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 leading-relaxed mb-10">
              No bank logins required. 100% private. Supercharged by AI. 
              Track your net worth, split goals with your family, and talk to your money.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={onLogin}
                className="w-full sm:w-auto px-8 py-4 bg-white text-[#060d1a] rounded-2xl font-display font-bold text-lg flex items-center justify-center gap-3 hover:scale-105 transition-transform shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                Start for free
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-24 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Feature 1 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-2 glass-card p-10 rounded-[40px] border border-white/10 bg-white/5 backdrop-blur-xl relative overflow-hidden group"
            >
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-500/20 rounded-full blur-[80px] group-hover:bg-emerald-500/30 transition-colors"></div>
              <ShieldCheck className="text-emerald-400 mb-6" size={40} />
              <h3 className="font-display font-bold text-3xl text-white mb-4">Zero-Credential Privacy</h3>
              <p className="text-slate-400 text-lg leading-relaxed max-w-md">
                We don't ask for your bank passwords. Enter data manually via voice, scan receipts with AI, and keep your data mathematically secure. Your net worth is your business.
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="glass-card p-10 rounded-[40px] border border-white/10 bg-white/5 backdrop-blur-xl relative overflow-hidden group"
            >
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-purple-500/20 rounded-full blur-[60px] group-hover:bg-purple-500/30 transition-colors"></div>
              <Sparkles className="text-purple-400 mb-6" size={40} />
              <h3 className="font-display font-bold text-2xl text-white mb-4">Generative UI Chat</h3>
              <p className="text-slate-400 leading-relaxed">
                Don't just read charts. Talk to them. Ask the AI "Show me my expenses," and watch interactive charts generate live inside the chat.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="glass-card p-10 rounded-[40px] border border-white/10 bg-white/5 backdrop-blur-xl relative overflow-hidden group"
            >
              <div className="absolute -left-10 -top-10 w-40 h-40 bg-pink-500/20 rounded-full blur-[60px] group-hover:bg-pink-500/30 transition-colors"></div>
              <Users className="text-pink-400 mb-6" size={40} />
              <h3 className="font-display font-bold text-2xl text-white mb-4">Multi-Player Mode</h3>
              <p className="text-slate-400 leading-relaxed">
                Add your partner and contribute to shared goals without sharing your individual spending habits. Complete financial autonomy.
              </p>
            </motion.div>

            {/* Feature 4 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="glass-card p-10 rounded-[40px] border border-white/10 bg-white/5 backdrop-blur-xl relative overflow-hidden group"
            >
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500/20 rounded-full blur-[60px] group-hover:bg-blue-500/30 transition-colors"></div>
              <BarChart3 className="text-blue-400 mb-6" size={40} />
              <h3 className="font-display font-bold text-2xl text-white mb-4">Investment Alpha</h3>
              <p className="text-slate-400 leading-relaxed">
                Track Stocks, MFs, FDs, and RDs in one place. Calculate XIRR returns and see how your portfolio stacks up against inflation.
              </p>
            </motion.div>

            {/* Feature 5 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="glass-card p-10 rounded-[40px] border border-white/10 bg-white/5 backdrop-blur-xl relative overflow-hidden group"
            >
              <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-[60px] group-hover:bg-emerald-500/30 transition-colors"></div>
              <ShieldCheck className="text-emerald-400 mb-6" size={40} />
              <h3 className="font-display font-bold text-2xl text-white mb-4">Tax Optimization</h3>
              <p className="text-slate-400 leading-relaxed">
                Built-in 80C and Section 24 trackers. Know exactly how much more you need to invest to minimize your tax liability.
              </p>
            </motion.div>

            {/* Feature 6 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="glass-card p-10 rounded-[40px] border border-white/10 bg-white/5 backdrop-blur-xl relative overflow-hidden group"
            >
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-orange-500/20 rounded-full blur-[60px] group-hover:bg-orange-500/30 transition-colors"></div>
              <Zap className="text-orange-400 mb-6" size={40} />
              <h3 className="font-display font-bold text-2xl text-white mb-4">Future Simulator</h3>
              <p className="text-slate-400 leading-relaxed">
                Run "What-If" scenarios. See how a 10% increase in SIP or a 5-year delay in retirement changes your lifetime wealth accumulation.
              </p>
            </motion.div>

            {/* Feature 7 - The Chai Meter */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-3 glass-card p-10 rounded-[40px] border border-white/10 bg-white/5 backdrop-blur-xl relative overflow-hidden group"
            >
              <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-amber-500/20 rounded-full blur-[80px] group-hover:bg-amber-500/30 transition-colors"></div>
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="flex-1">
                  <Coffee className="text-amber-400 mb-6" size={40} />
                  <h3 className="font-display font-bold text-3xl text-white mb-4">The Chai Meter</h3>
                  <p className="text-slate-400 text-lg leading-relaxed">
                    Money isn't just numbers. We translate your spending into real-world items like "Vada Pavs" or "Cutting Chais" so you actually feel the weight of your purchases.
                  </p>
                </div>
                <div className="w-full md:w-64 h-48 bg-[#060d1a]/50 rounded-3xl border border-white/5 flex items-center justify-center p-6 text-center">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">You Spent</p>
                    <p className="font-display font-bold text-3xl text-white mb-2">₹1,200</p>
                    <p className="text-xs text-amber-400 font-bold">≈ 80 Cutting Chais ☕</p>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/20 to-transparent"></div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="font-display font-extrabold text-4xl md:text-6xl text-white mb-8">
            Ready to take control?
          </h2>
          <button 
            onClick={onLogin}
            className="px-10 py-5 bg-indigo-600 text-white rounded-2xl font-display font-bold text-xl inline-flex items-center gap-3 hover:bg-indigo-500 hover:scale-105 transition-all shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)]"
          >
            Enter the Command Center <ArrowRight size={24} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-white/5 text-center text-slate-500 text-sm">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Logo variant="appicon" size={24} className="text-indigo-500 opacity-50" />
        </div>
        <p>© {new Date().getFullYear()} invxtra. Built for privacy. Powered by AI.</p>
      </footer>
    </div>
  );
}
