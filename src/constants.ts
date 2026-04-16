import { Transaction, Holding, Account } from './types';

export const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: '1', type: 'income', category: 'Income', emoji: '💼', name: 'Salary — TCS', date: '2026-03-01', amount: 115000, linkedAcc: '1' },
  { id: '2', type: 'investment', category: 'Investment', emoji: '📈', name: 'HDFC Nifty 50 SIP', date: '2026-03-05', amount: -10000, linkedAcc: '1' },
  { id: '3', type: 'expense', category: 'Groceries', emoji: '🛒', name: 'BigBasket', date: '2026-03-13', amount: -2340, linkedAcc: '1' },
  { id: '4', type: 'income', category: 'Income', emoji: '💰', name: 'Rental Income', date: '2026-03-02', amount: 18000, note: 'Flat rent', linkedAcc: '1' },
  { id: '5', type: 'expense', category: 'Transport', emoji: '🚗', name: 'Ola Cab', date: '2026-03-10', amount: -420, linkedAcc: '1' },
  { id: '6', type: 'expense', category: 'Food & Dining', emoji: '🍕', name: 'Zomato Order', date: '2026-03-11', amount: -1200, note: 'Dinner', linkedAcc: '1' },
  { id: '7', type: 'expense', category: 'Shopping', emoji: '🛍️', name: 'Amazon', date: '2026-03-08', amount: -3200, note: 'Clothes', linkedAcc: '1' },
  { id: '8', type: 'expense', category: 'Entertainment', emoji: '🎬', name: 'Netflix + Hotstar', date: '2026-03-01', amount: -900, linkedAcc: '1' },
  { id: '9', type: 'investment', category: 'Investment', emoji: '📊', name: 'Parag Parikh SIP', date: '2026-03-05', amount: -5000, linkedAcc: '1' },
  { id: '10', type: 'expense', category: 'Housing', emoji: '🏠', name: 'Home Loan EMI', date: '2026-03-17', amount: -35200, linkedAcc: '5' },
  { id: '11', type: 'savings', category: 'Savings', emoji: '🏦', name: 'Emergency Fund Deposit', date: '2026-03-10', amount: -10000, linkedAcc: '1' },
  { id: '12', type: 'expense', category: 'Healthcare', emoji: '💊', name: 'Pharmacy', date: '2026-03-12', amount: -650, linkedAcc: '1' },
];

export const INITIAL_HOLDINGS: Holding[] = [
  { id: '1', type: 'Equity MF', name: 'HDFC Nifty 50 Index', invested: 480000, current: 612000, xirr: 16.8, sip: 10000, note: 'Direct plan', units: 4980, nav: 122.89, updatable: true, lastUpdated: '2026-03-14' },
  { id: '2', type: 'Equity MF', name: 'Parag Parikh Flexi Cap', invested: 210000, current: 282000, xirr: 19.2, sip: 5000, note: '', units: 3200, nav: 88.12, updatable: true, lastUpdated: '2026-03-14' },
  { id: '3', type: 'Stocks', name: 'Infosys, TCS, HDFC Bank', invested: 320000, current: 410000, xirr: 14.6, sip: 0, note: '3 holdings', updatable: false, lastUpdated: '2026-03-14' },
  { id: '4', type: 'Gold/SGB', name: 'Sovereign Gold Bond 2022', invested: 180000, current: 204000, xirr: 10.1, sip: 0, note: 'Matures 2030', units: 50, nav: 4080, updatable: true, lastUpdated: '2026-03-14' },
];

export const INITIAL_ACCOUNTS: Account[] = [
  { id: '1', type: 'savings', category: 'savings', name: 'Emergency Fund', amt: 320000, rate: 3.5, bank: 'HDFC Virtual', start: '2024-01-01', goal: 400000 },
  { id: '2', type: 'fd', category: 'savings', name: 'SBI FD 7.2%', amt: 500000, rate: 7.2, bank: 'SBI', start: '2025-09-14', end: '2027-03-14', maturity: 572000 },
  { id: '3', type: 'fd', category: 'savings', name: 'HDFC FD 7.4%', amt: 350000, rate: 7.4, bank: 'HDFC', start: '2025-12-22', end: '2026-06-22', maturity: 362950 },
  { id: '4', type: 'rd', category: 'savings', name: 'Monthly RD SBI', amt: 180000, rate: 6.8, bank: 'SBI', start: '2024-09-01', end: '2027-03-01', emi: 10000, emiday: 28, maturity: 202300 },
  { id: '5', type: 'loan', category: 'loan', name: 'HDFC Home Loan', amt: 4200000, rate: 8.6, bank: 'HDFC', start: '2024-03-17', end: '2048-03-17', emi: 35200, emiday: 17 },
  { id: '6', type: 'loan', category: 'loan', name: 'ICICI Car Loan', amt: 280000, rate: 9.2, bank: 'ICICI', start: '2023-05-25', end: '2028-11-25', emi: 8400, emiday: 25 },
];
