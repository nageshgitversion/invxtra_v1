import React from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, 
  ShieldCheck, 
  Users, 
  Coffee, 
  Zap, 
  BarChart3, 
  Target, 
  PieChart,
  Terminal,
  Search,
  MessageSquare,
  Scale
} from 'lucide-react';
import { cn } from '../lib/utils';

const FEATURES = [
  {
    title: "AI Financial Intelligence",
    desc: "Personalized insights generated daily by analyzing your assets and liabilities.",
    icon: Sparkles,
    color: "text-purple-500",
    bg: "bg-purple-50"
  },
  {
    title: "Zero-Knowledge Privacy",
    desc: "We don't link to banks. Your data stays 100% private and manually controlled.",
    icon: ShieldCheck,
    color: "text-emerald-500",
    bg: "bg-emerald-50"
  },
  {
    title: "The Chai Meter",
    desc: "Behavioral tracking that converts abstract currency into real-world items like cutting chais.",
    icon: Coffee,
    color: "text-amber-500",
    bg: "bg-amber-50"
  },
  {
    title: "Collaborative Household",
    desc: "Track shared family goals and household envelopes with your partner.",
    icon: Users,
    color: "text-pink-500",
    bg: "bg-pink-50"
  },
  {
    title: "Scenario Simulator",
    desc: "Project your wealth 30 years into the future with custom inflation and yield rates.",
    icon: Zap,
    color: "text-orange-500",
    bg: "bg-orange-50"
  },
  {
    title: "XIRR Portfolio Analysis",
    desc: "Unified view of MFs, Stocks, FDs, and RDs with automated return calculations.",
    icon: BarChart3,
    color: "text-blue-500",
    bg: "bg-blue-50"
  },
  {
    title: "Tax Optimization Hub",
    desc: "Dedicated section for 80C and Section 24 trackers to maximize your savings.",
    icon: Scale,
    color: "text-indigo-500",
    bg: "bg-indigo-50"
  },
  {
    title: "Smart Budget Envelopes",
    desc: "Allocate money to envelopes. Unspent money is 'swept' into your goals automatically.",
    icon: PieChart,
    color: "text-cyan-500",
    bg: "bg-cyan-50"
  },
  {
    title: "Generative Chat",
    desc: "Query your finances in natural language and receive interactive, dynamic charts.",
    icon: MessageSquare,
    color: "text-violet-500",
    bg: "bg-violet-50"
  },
  {
    title: "Command Palette",
    desc: "Navigate the entire app and perform actions instantly using CMD+K shortcut.",
    icon: Terminal,
    color: "text-slate-700",
    bg: "bg-slate-100"
  }
];

export default function FeatureGuide() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {FEATURES.map((feature, idx) => (
        <motion.div
          key={feature.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
          className="p-4 rounded-xl border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-sm transition-all group"
        >
          <div className="flex gap-4">
            <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center shrink-0", feature.bg)}>
              <feature.icon className={feature.color} size={24} />
            </div>
            <div>
              <h4 className="font-display font-bold text-sm text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">
                {feature.title}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {feature.desc}
              </p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
