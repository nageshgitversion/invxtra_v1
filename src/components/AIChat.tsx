import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Send, Sparkles, User, Bot, Mic, MicOff, LayoutDashboard, Settings2, ShieldCheck, Briefcase, Calculator } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import ReactMarkdown from 'react-markdown';
import { chatWithInvxtra } from '../services/geminiService';
import { cn } from '../lib/utils';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { useFirebase } from '../lib/FirebaseProvider';

interface AIChatProps {
  userData: any;
}

interface Message {
  role: 'user' | 'ai';
  text: string;
}

export default function AIChat({ userData }: AIChatProps) {
  const { user } = useFirebase();
  const userName = user?.displayName?.split(' ')[0] || 'there';
  
  const formatNW = (amount: number) => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const getInitialGreeting = (data: any, name: string) => {
    const nw = data?.netWorth || 0;
    const income = data?.monthlyIncome || 0;
    const expenses = data?.monthlyExpenses || 0;
    
    if (nw === 0 && income === 0 && expenses === 0) {
      return `👋 Hi ${name}! Welcome to your financial journey. It looks like you're just getting started. Try adding some transactions or accounts, and I'll help you analyze them! 😄`;
    }
    
    if (nw === 0) {
      return `👋 Hi ${name}! Let's start building your wealth together! Tracking your income and expenses is the first great step. How can I help you plan your savings today? 🌱`;
    }
    
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
    
    if (income > 0 && savingsRate < 20) {
      return `👋 Hi ${name}! Your net worth is ${formatNW(nw)}. I noticed your savings rate is a bit low this month (under 20%). A great rule of thumb is saving at least 20% of your income. Want me to suggest areas to cut back? 💡`;
    }
    
    return `👋 Hi ${name}! Your current net worth is ${formatNW(nw)}. This month, you've saved effectively! You spent ${formatNW(expenses)} against an income of ${formatNW(income)}. How can I assist you with your finances today? 😄`;
  };
  
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: getInitialGreeting(userData, userName) }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [persona, setPersona] = useState('Financial Advisor');
  const [priorities, setPriorities] = useState<string[]>(['Savings', 'Tax']);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { 
    isListening, 
    transcript, 
    startListening, 
    stopListening, 
    browserSupportsSpeechRecognition 
  } = useVoiceRecognition();

  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    const history = messages.map(m => ({ role: m.role, text: m.text }));
    const aiRes = await chatWithInvxtra(userMsg, history, userData, persona, priorities);

    setMessages(prev => [...prev, { role: 'ai', text: aiRes || "I'm sorry, I couldn't process that." }]);
    setIsLoading(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const chips = [
    { label: '📈 SIP Check', query: 'Check my SIP allocation' },
    { label: '🧾 Tax Tips', query: 'Tax saving tips' },
    { label: '💸 Expense Analysis', query: 'Analyse my expenses' },
    { label: '💎 Invest Ideas', query: 'Best investment for 2026' },
    { label: '🎯 Crore Goal', query: 'How to reach ₹1 Crore faster?' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] relative">
      <div className="bg-white border border-indigo-50 rounded-2xl p-4 mb-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <Bot size={20} />
          </div>
          <div>
            <h3 className="font-display font-bold text-sm">invxtra AI</h3>
            <p className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              {persona} · Online
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-all border",
              showSettings ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-indigo-50 hover:text-indigo-600"
            )}
            title="AI Persona Settings"
          >
            <Settings2 size={20} />
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.dispatchEvent(new CustomEvent('setActiveTab', { detail: 'home' }))}
            className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-100"
            title="Back to Dashboard"
          >
            <LayoutDashboard size={20} />
          </motion.button>
        </div>
      </div>

      {showSettings && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-indigo-100 rounded-2xl p-5 mb-4 shadow-xl shadow-indigo-100/20 space-y-4"
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Choose AI Persona</p>
            <div className="grid grid-cols-3 gap-2">
              <PersonaButton 
                active={persona === 'Financial Advisor'} 
                onClick={() => setPersona('Financial Advisor')}
                icon={<ShieldCheck size={14} />}
                label="Advisor"
              />
              <PersonaButton 
                active={persona === 'Tax Expert'} 
                onClick={() => setPersona('Tax Expert')}
                icon={<Calculator size={14} />}
                label="Tax Expert"
              />
              <PersonaButton 
                active={persona === 'Investment Analyst'} 
                onClick={() => setPersona('Investment Analyst')}
                icon={<Briefcase size={14} />}
                label="Analyst"
              />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Prioritize Data Points</p>
            <div className="flex flex-wrap gap-2">
              {['Savings', 'Tax', 'Investments', 'Expenses', 'Goals'].map(p => (
                <button
                  key={p}
                  onClick={() => {
                    if (priorities.includes(p)) {
                      setPriorities(priorities.filter(item => item !== p));
                    } else {
                      setPriorities([...priorities, p]);
                    }
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                    priorities.includes(p) 
                      ? "bg-indigo-600 text-white border-indigo-600" 
                      : "bg-slate-50 text-slate-500 border-slate-100 hover:border-indigo-200"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 mb-4 pr-2" ref={scrollRef}>
        {messages.map((msg, i) => (
          <div key={i} className={cn(
            "flex gap-3 max-w-[85%]",
            msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
          )}>
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1",
              msg.role === 'user' ? "bg-indigo-100 text-indigo-600" : "bg-purple-100 text-purple-600"
            )}>
              {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
            </div>
            <div className={cn(
              "p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
              msg.role === 'user' 
                ? "bg-indigo-600 text-white rounded-tr-none" 
                : "bg-white text-slate-800 border border-indigo-50 rounded-tl-none"
            )}>
              {msg.role === 'user' ? (
                <div className="prose prose-sm prose-slate max-w-none prose-invert">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              ) : (
                <GenerativeMessage text={msg.text} />
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 max-w-[85%]">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
              <Sparkles size={16} />
            </div>
            <div className="bg-white border border-indigo-50 p-4 rounded-2xl rounded-tl-none shadow-sm flex gap-1 items-center">
              <div className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-bounce"></div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {chips.map((chip, i) => (
            <button
              key={i}
              onClick={() => { setInput(chip.query); }}
              className="px-4 py-2 rounded-full bg-indigo-50 text-indigo-600 text-xs font-display font-bold whitespace-nowrap border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all"
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 bg-white p-3 rounded-[24px] border border-indigo-50 shadow-lg shadow-indigo-100/20">
          <input 
            type="text" 
            placeholder={isListening ? "Listening..." : "Ask invxtra AI anything..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className={cn(
              "flex-1 bg-slate-50 rounded-xl px-6 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all",
              isListening && "border-indigo-500 ring-2 ring-indigo-500/20"
            )}
          />
          {browserSupportsSpeechRecognition && (
            <button 
              onClick={toggleListening}
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                isListening 
                  ? "bg-red-500 text-white animate-pulse" 
                  : "bg-slate-50 text-slate-400 hover:text-indigo-600"
              )}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isListening}
            className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none transition-all"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

function PersonaButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all",
        active 
          ? "bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm" 
          : "bg-slate-50 border-slate-100 text-slate-400 hover:border-indigo-100"
      )}
    >
      {icon}
      <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
    </button>
  );
}

function GenerativeMessage({ text }: { text: string }) {
  // Check for [PIE_CHART: {...}]
  const chartMatch = text.match(/\[PIE_CHART:\s*(\{.*?\})\s*\]/s);
  let cleanText = text;
  let chartData = null;

  if (chartMatch && chartMatch[1]) {
    cleanText = text.replace(chartMatch[0], '');
    try {
      chartData = JSON.parse(chartMatch[1]).data;
    } catch (e) {
      console.error("Failed to parse chart data", e);
    }
  }

  const COLORS = ['#4F46E5', '#EF4444', '#F59E0B', '#10B981', '#0EA5E9', '#8B5CF6', '#EC4899'];

  return (
    <div className="space-y-4">
      <div className="prose prose-sm prose-slate max-w-none">
        <ReactMarkdown>{cleanText}</ReactMarkdown>
      </div>
      {chartData && chartData.length > 0 && (
        <div className="w-full h-56 bg-slate-50 border border-slate-100 rounded-2xl p-2 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
              <Legend verticalAlign="bottom" height={20} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
