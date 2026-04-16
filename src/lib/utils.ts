import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactNumber(number: number) {
  if (number >= 10000000) {
    return `₹${(number / 10000000).toFixed(2)}Cr`;
  }
  if (number >= 100000) {
    return `₹${(number / 100000).toFixed(2)}L`;
  }
  if (number >= 1000) {
    return `₹${(number / 1000).toFixed(1)}K`;
  }
  return `₹${number}`;
}

export function getMonthlyCommitment(amount: number, frequency: string) {
  const absAmount = Math.abs(amount);
  switch (frequency) {
    case 'daily': return absAmount * 30;
    case 'weekly': return absAmount * 4.33; // Average weeks in a month
    case 'monthly': return absAmount;
    case 'quarterly': return absAmount / 3;
    case 'half-yearly': return absAmount / 6;
    case 'yearly': return absAmount / 12;
    default: return absAmount;
  }
}
