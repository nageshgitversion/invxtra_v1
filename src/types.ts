export type TransactionType = 'income' | 'expense' | 'investment' | 'savings';
export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'half-yearly' | 'yearly';
export type PayoutFrequency = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly' | 'at-maturity';

export interface Transaction {
  id: string;
  type: TransactionType;
  category: string;
  emoji: string;
  name: string;
  date: string;
  amount: number;
  note?: string;
  linkedAcc?: string;
  isRecurring?: boolean;
  recurrence?: RecurrenceFrequency;
  lastProcessed?: string; // ISO date string
  isTaxDeductible?: boolean;
  taxSection?: string; // e.g., '80C', '80D'
  isCapitalGain?: boolean;
  gainType?: 'LTCG' | 'STCG';
}

export interface Holding {
  id: string;
  type: string;
  name: string;
  invested: number;
  current: number;
  xirr: number;
  sip: number;
  note: string;
  units?: number;
  nav?: number;
  avgPrice?: number;
  currentPrice?: number;
  updatable: boolean;
  lastUpdated: string;
  linkedGoalId?: string;
}

export interface Account {
  id: string;
  type: 'savings' | 'fd' | 'rd' | 'loan' | 'ppf' | 'nps' | 'epf';
  category: 'savings' | 'investment' | 'loan';
  name: string;
  amt: number;
  rate: number;
  bank: string;
  start: string;
  end?: string;
  emi?: number;
  emiday?: number;
  goal?: number;
  maturity?: number;
  interestEarned?: number;
  maturityDate?: string;
  payoutFrequency?: PayoutFrequency;
  lastPayoutDate?: string; // ISO date string
  isTaxExempt?: boolean; // Section 80C etc
  linkedGoalId?: string;
}

export type TaxRegime = 'old' | 'new';

export interface TaxProfile {
  regime: TaxRegime;
  annualIncome: number;
  deductions80C: number;
  deductions80D: number;
  hra: number;
  otherDeductions: number;
  ltcg: number;
  stcg: number;
  age: number;
}

export interface WalletEnvelope {
  name: string;
  icon: string;
  budget: number;
  spent: number;
  cat: string;
}

export interface Wallet {
  active: boolean;
  balance: number;
  topup: number;
  committed: number;
  free: number;
  lastSweepMonth?: string; // YYYY-MM
  envelopes: Record<string, WalletEnvelope>;
}

export interface FamilyMember {
  id: string;
  uid: string;
  name: string;
  role: string;
  contribution: number;
  color: string;
  initial: string;
}

export interface FamilyGoal {
  id: string;
  uid: string;
  name: string;
  target: number;
  saved: number;
  eta: string;
  contributions: Record<string, number>; // memberId -> amount
}

export interface Split {
  id: string;
  uid: string;
  name: string;
  desc: string;
  date: string;
  amount: number;
  type: 'owe_you' | 'you_owe';
  initial: string;
  color: string;
}

export interface SpendingFine {
  id: string;
  uid: string;
  category: string;
  limit: number;
  fineAmount: number;
  targetGoalId: string;
  active: boolean;
}

