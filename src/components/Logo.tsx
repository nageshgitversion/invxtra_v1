import React from 'react';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  variant?: 'horizontal' | 'appicon' | 'stacked';
  size?: number;
}

export default function Logo({ className, variant = 'horizontal', size }: LogoProps) {
  const id = React.useId().replace(/:/g, '');
  const gradId = `logo_grad_${id}`;
  
  const defaultWidth = variant === 'stacked' ? 100 : (variant === 'horizontal' ? 200 : 100);
  const defaultHeight = variant === 'stacked' ? 120 : (variant === 'horizontal' ? 50 : 100);

  const svgProps = {
    xmlns: "http://www.w3.org/2000/svg",
    className: cn("overflow-visible select-none", className),
    width: size || defaultWidth,
    height: size ? (variant === 'stacked' ? (size * 1.2) : (variant === 'horizontal' ? (size * 0.25) : size)) : defaultHeight,
    style: { flexShrink: 0 }
  };

  const Symbol = () => (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#185FA5" />
          <stop offset="100%" stopColor="#00E5FF" />
        </linearGradient>
      </defs>
      
      {/* Background accents */}
      <path d="M60 5 H95 V40" fill="none" stroke="#064E3B" strokeWidth="8" strokeLinecap="square" />
      
      {/* Main X Shape */}
      <line x1="15" y1="15" x2="85" y2="85" stroke={`url(#${gradId})`} strokeWidth="18" strokeLinecap="round" />
      <line x1="85" y1="15" x2="15" y2="85" stroke={`url(#${gradId})`} strokeWidth="18" strokeLinecap="round" />
      
      {/* Central Dot */}
      <circle cx="50" cy="50" r="7" fill="#1E3A8A" />
      
      {/* Decorative dots */}
      <circle cx="50" cy="15" r="2" fill="#CBD5E1" />
      <circle cx="50" cy="85" r="2" fill="#CBD5E1" />
      <circle cx="15" cy="50" r="2" fill="#CBD5E1" />
      <circle cx="85" cy="50" r="2" fill="#CBD5E1" />
    </g>
  );

  if (variant === 'appicon') {
    return (
      <svg {...svgProps} viewBox="0 0 100 100">
        <Symbol />
      </svg>
    );
  }

  if (variant === 'stacked') {
    return (
      <svg {...svgProps} viewBox="0 0 100 120">
        <Symbol />
        <text x="50" y="110" textAnchor="middle" fontSize="16" fontWeight="800" letterSpacing="1" fill="currentColor" style={{ fontFamily: 'monospace' }}>invxtra</text>
      </svg>
    );
  }

  // Default: Horizontal
  return (
    <svg {...svgProps} viewBox="0 0 200 50">
      <g transform="scale(0.5)">
        <Symbol />
      </g>
      <line x1="60" y1="10" x2="60" y2="40" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
      <text x="75" y="32" fontSize="24" fontWeight="800" letterSpacing="0.5" fill="currentColor" style={{ fontFamily: 'monospace' }}>invxtra</text>
    </svg>
  );
}
