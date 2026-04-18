import React, { useMemo } from 'react';
import { Transaction, Wallet as WalletType } from '../types';
import { getNextOccurrence } from '../lib/recurrence';
import { formatCurrency, cn } from '../lib/utils';
import { Calendar as CalendarIcon, AlertCircle } from 'lucide-react';

interface MoneyCalendarProps {
  transactions: Transaction[];
  wallet: WalletType | null;
}

export default function MoneyCalendar({ transactions, wallet }: MoneyCalendarProps) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday

  // Identify all recurring expenses and project them for the rest of the month
  const projections = useMemo(() => {
    const projectedEvents: Record<number, Transaction[]> = {};
    let upcomingBillsTotal = 0;

    const templates = transactions.filter(t => t.isRecurring && (t.type === 'expense' || t.type === 'investment'));
    
    templates.forEach(t => {
      let nextDate = t.lastProcessed 
        ? getNextOccurrence(new Date(t.lastProcessed), t.recurrence)
        : new Date(t.date);

      // Project up to end of this month
      while (nextDate.getMonth() === currentMonth && nextDate.getFullYear() === currentYear) {
        const dateNum = nextDate.getDate();
        if (!projectedEvents[dateNum]) projectedEvents[dateNum] = [];
        projectedEvents[dateNum].push(t);
        
        // If it's in the future, count it towards upcoming bills
        if (dateNum >= now.getDate()) {
          upcomingBillsTotal += Math.abs(t.amount);
        }

        nextDate = getNextOccurrence(nextDate, t.recurrence);
      }
    });

    return { projectedEvents, upcomingBillsTotal };
  }, [transactions, currentMonth, currentYear, now]);

  const safeToSpend = wallet ? wallet.free - projections.upcomingBillsTotal : 0;
  const safePerDay = (daysInMonth - now.getDate() + 1) > 0 
    ? Math.max(0, safeToSpend / (daysInMonth - now.getDate() + 1))
    : 0;

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanksArray = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-2xl flex items-center justify-between border-l-4 border-emerald-500">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Safe to Spend</p>
            <p className="font-display font-extrabold text-2xl text-emerald-600">{formatCurrency(Math.max(0, safeToSpend))}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Daily Pace</p>
            <p className="font-display font-bold text-lg text-slate-700">{formatCurrency(safePerDay)}/day</p>
          </div>
        </div>
        
        <div className="glass-card p-5 rounded-2xl flex items-center justify-between border-l-4 border-amber-500">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Upcoming Bills</p>
            <p className="font-display font-extrabold text-2xl text-amber-600">{formatCurrency(projections.upcomingBillsTotal)}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
            <AlertCircle size={20} />
          </div>
        </div>
      </div>

      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-6">
          <CalendarIcon size={18} className="text-indigo-600" />
          <h3 className="font-display font-bold text-lg">Money Weather</h3>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-[10px] font-black uppercase text-slate-400">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {blanksArray.map(b => (
            <div key={`blank-${b}`} className="h-14 md:h-20 bg-slate-50/50 rounded-xl"></div>
          ))}
          
          {daysArray.map(day => {
            const isToday = day === now.getDate();
            const isPast = day < now.getDate();
            const events = projections.projectedEvents[day] || [];
            const hasBills = events.length > 0;
            
            return (
              <div 
                key={day} 
                className={cn(
                  "h-14 md:h-20 rounded-xl p-1.5 flex flex-col justify-between border transition-all relative group",
                  isToday ? "border-indigo-500 shadow-md bg-white" : 
                  isPast ? "bg-slate-50 border-slate-100 opacity-60" : 
                  hasBills ? "bg-amber-50/30 border-amber-200" : "bg-white border-slate-100",
                )}
              >
                <div className={cn(
                  "text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full",
                  isToday ? "bg-indigo-600 text-white" : "text-slate-600"
                )}>
                  {day}
                </div>
                
                {hasBills && (
                  <div className="flex flex-col gap-0.5">
                    {events.slice(0, 2).map((e, i) => (
                      <div key={i} className="text-[8px] bg-amber-100 text-amber-800 font-bold px-1 rounded truncate">
                        {e.name}
                      </div>
                    ))}
                    {events.length > 2 && <div className="text-[8px] text-slate-400 text-center">+{events.length - 2} more</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
