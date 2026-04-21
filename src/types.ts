export type TransactionType = 'income' | 'expense' | 'investment' | 'savings' | 'debt';
export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'half-yearly' | 'yearly';
export type PayoutFrequency = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly' | 'at-maturity';

export interface Transaction {
  id: string;
  type: TransactionType;
  category: string;
  subCategory: string;
  emoji: string;
  name: string;
  date: string;
  amount: number;
  note?: string;
  linkedAcc?: string;
  targetId?: string; // ID of Account or Holding impacted (e.g., Loan id for EMI)
  isRecurring?: boolean;
  recurrence?: RecurrenceFrequency;
  lastProcessed?: string; // ISO date string
  isTaxDeductible?: boolean;
  taxSection?: string; // e.g., '80C', '80D'
  isCapitalGain?: boolean;
  gainType?: 'LTCG' | 'STCG';
  status?: 'completed' | 'scheduled';
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
  householdId?: string; // Optional for backward compatibility
  name: string;
  role: string;
  contribution: number;
  color: string;
  initial: string;
}

export interface UserProfile {
  uid: string;
  householdId: string;
  displayName: string;
}


export interface FamilyGoal {
  id: string;
  uid: string;
  householdId?: string; // Optional for backward compatibility
  ownerUid?: string; // new field for item-level sharing
  allowedUids?: string[]; // array of UIDs allowed to see and contribute
  isShared: boolean; // distinguish between personal and family goals
  name: string;
  target: number;
  saved: number;
  startDate: string; // ISO date string
  eta: string; // Target date (ISO string)
  contributions: Record<string, number>; // memberId -> amount
}

export interface Split {
  id: string;
  uid: string; // owner
  allowedUids?: string[]; // for multi-partner visibility
  name: string;
  desc?: string;
  date: string;
  totalAmount: number;
  payerUid: string; // Who paid the whole bill
  participants: Record<string, number>; // uid -> share amount
  status: 'pending' | 'settled';
}

export interface SmartNudge {
  id: string;
  type: 'alert' | 'opportunity' | 'insight' | 'milestone';
  title: string;
  description: string;
  icon: string;
  actionLabel?: string;
  actionTab?: string;
  actionPayload?: any;
  priority: 'low' | 'medium' | 'high';
  dismissible: boolean;
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

export interface SharedEnvelope {
  id: string;
  uid: string; // householdId (legacy)
  ownerUid?: string; // new field for item-level sharing
  allowedUids?: string[]; // array of UIDs allowed to see and contribute
  isShared: boolean; // distinguish between personal buckets and shared envelopes
  name: string;
  icon: string;
  budget: number;
  spent: number;
  color: string;
  contributions: Record<string, number>; // memberId -> amount funded
}
