import React from 'react';

interface NFSULogoProps {
  id?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'emblem' | 'full' | 'horizontal';
}

export const NFSUEmblem: React.FC<{ className?: string; id?: string }> = ({
  className = 'w-10 h-12',
  id = 'nfsu-official-crest',
}) => {
  return (
    <svg
      id={id}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 245"
      className={`object-contain select-none shrink-0 ${className}`}
      aria-label="National Forensic Sciences University Official Emblem"
    >
      <defs>
        <linearGradient id={`${id}-goldGrad`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D9B464" />
          <stop offset="35%" stopColor="#C59E47" />
          <stop offset="70%" stopColor="#DEBE74" />
          <stop offset="100%" stopColor="#B28935" />
        </linearGradient>

        <linearGradient id={`${id}-goldBorder`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#EED596" />
          <stop offset="50%" stopColor="#B88E35" />
          <stop offset="100%" stopColor="#8F6A1E" />
        </linearGradient>

        <clipPath id={`${id}-innerShieldClip`}>
          <path d="M 32,60 L 168,60 L 168,140 Q 168,172 100,198 Q 32,172 32,140 Z" />
        </clipPath>
      </defs>

      {/* Top Architectural Battlements */}
      <g fill={`url(#${id}-goldGrad)`} stroke="#8F6A1E" strokeWidth="1">
        <rect x="91" y="2" width="18" height="22" rx="1.5" />
        <rect x="36" y="9" width="16" height="17" rx="1.5" />
        <rect x="148" y="9" width="16" height="17" rx="1.5" />
      </g>

      {/* Main Shield Body Outer */}
      <path
        d="M 22,22 L 178,22 L 178,144 Q 178,186 100,224 Q 22,186 22,144 Z"
        fill={`url(#${id}-goldGrad)`}
        stroke={`url(#${id}-goldBorder)`}
        strokeWidth="3"
      />

      {/* Top NFSU Typography Header */}
      <text
        x="100"
        y="51"
        textAnchor="middle"
        fontFamily="'Times New Roman', 'Georgia', serif"
        fontSize="28"
        fontWeight="900"
        letterSpacing="2"
        fill="#15244C"
      >
        NFSU
      </text>

      {/* Inner Quadrants Area */}
      <g clipPath={`url(#${id}-innerShieldClip)`}>
        {/* Quadrant 1: Top-Left (Navy Blue) */}
        <rect x="30" y="58" width="70" height="66" fill="#182855" />
        {/* Quadrant 2: Top-Right (Deep Crimson Red) */}
        <rect x="100" y="58" width="70" height="66" fill="#A31D24" />
        {/* Quadrant 3: Bottom-Left (Deep Crimson Red) */}
        <rect x="30" y="124" width="70" height="80" fill="#A31D24" />
        {/* Quadrant 4: Bottom-Right (Navy Blue) */}
        <rect x="100" y="124" width="70" height="80" fill="#182855" />

        {/* Quadrant borders / grid lines */}
        <line x1="100" y1="58" x2="100" y2="200" stroke="#CCA04D" strokeWidth="2.5" />
        <line x1="30" y1="124" x2="170" y2="124" stroke="#CCA04D" strokeWidth="2.5" />

        {/* 1. Digital Forensics */}
        <g transform="translate(65, 91)" stroke="#FFFFFF" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <rect x="-18" y="-14" width="36" height="23" rx="2" strokeWidth="2.2" />
          <line x1="0" y1="9" x2="0" y2="15" strokeWidth="2.2" />
          <line x1="-10" y1="15" x2="10" y2="15" strokeWidth="2.2" />
          <circle cx="-1" cy="-2.5" r="5" strokeWidth="1.8" />
          <line x1="2.5" y1="1" x2="6.5" y2="5" strokeWidth="2.2" />
        </g>

        {/* 2. Fingerprint Science */}
        <g transform="translate(135, 91)" stroke="#FFFFFF" fill="none" strokeLinecap="round">
          <path d="M -1,8 C -3,4 -3,-3 -0.5,-6 C 2,-3 2,4 0.5,8" strokeWidth="1.8" />
          <path d="M -5,11 C -8,5 -7,-7 0,-10 C 7,-7 7.5,5 4,11" strokeWidth="1.8" />
          <path d="M -9,13 C -13,6 -12,-11 0,-14 C 11.5,-11 12,6 8,13" strokeWidth="1.8" />
          <path d="M -13,15 C -17,5 -15,-15 0,-18 C 15,-15 16,5 12,15" strokeWidth="1.8" />
          <path d="M -8,15 Q -1,13 0,10 Q 1,13 8,15" strokeWidth="1.5" />
        </g>

        {/* 3. Forensic Science Microscope */}
        <g transform="translate(65, 156)" stroke="#FFFFFF" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <line x1="-6" y1="-18" x2="3" y2="-2" strokeWidth="2.6" />
          <line x1="-9" y1="-19.5" x2="-3" y2="-16" strokeWidth="2.6" />
          <line x1="3" y1="-2" x2="5" y2="3" strokeWidth="2.4" />
          <line x1="5" y1="3" x2="6.5" y2="7" strokeWidth="2" />
          <line x1="-11" y1="7.5" x2="11" y2="7.5" strokeWidth="2.6" />
          <path d="M -2,-8 C -14,-7 -15,7 -7,14 L 5,14" strokeWidth="2.2" />
          <path d="M -14,18 C -14,15 14,15 14,18 Z" fill="#FFFFFF" strokeWidth="1.5" />
        </g>

        {/* 4. DNA Double Helix */}
        <g transform="translate(135, 156)" stroke="#FFFFFF" fill="none" strokeLinecap="round">
          <path d="M -8,-18 C 12,-9 12,0 -8,9 C 12,18 12,23 -4,25" strokeWidth="2.4" />
          <path d="M 8,-18 C -12,-9 -12,0 8,9 C -12,18 -12,23 4,25" strokeWidth="2.4" />
          <line x1="-5.5" y1="-14" x2="5.5" y2="-14" strokeWidth="2" />
          <line x1="-6.5" y1="-9" x2="6.5" y2="-9" strokeWidth="2" />
          <line x1="-2" y1="-4.5" x2="2" y2="-4.5" strokeWidth="2" />
          <line x1="-2" y1="4.5" x2="2" y2="4.5" strokeWidth="2" />
          <line x1="-6.5" y1="9" x2="6.5" y2="9" strokeWidth="2" />
          <line x1="-5.5" y1="14" x2="5.5" y2="14" strokeWidth="2" />
          <line x1="-3" y1="19" x2="3" y2="19" strokeWidth="2" />
        </g>
      </g>

      {/* Inner Golden Frame */}
      <path
        d="M 32,60 L 168,60 L 168,140 Q 168,172 100,198 Q 32,172 32,140 Z"
        fill="none"
        stroke="#8F6A1E"
        strokeWidth="1.8"
      />

      {/* Flowing Golden Motto Ribbon Banner below shield */}
      <g>
        {/* Ribbon back folds */}
        <path d="M 16,212 L 28,198 L 28,218 Z" fill="#8F6A1E" />
        <path d="M 184,212 L 172,198 L 172,218 Z" fill="#8F6A1E" />

        {/* Ribbon left swallowtail tail */}
        <path d="M 12,204 L 32,200 L 30,222 L 10,226 L 16,215 Z" fill={`url(#${id}-goldGrad)`} stroke="#8F6A1E" strokeWidth="1" />
        {/* Ribbon right swallowtail tail */}
        <path d="M 188,204 L 168,200 L 170,222 L 190,226 L 184,215 Z" fill={`url(#${id}-goldGrad)`} stroke="#8F6A1E" strokeWidth="1" />

        {/* Ribbon main body banner across bottom of shield */}
        <path
          d="M 24,204 Q 100,230 176,204 L 176,224 Q 100,250 24,224 Z"
          fill={`url(#${id}-goldGrad)`}
          stroke={`url(#${id}-goldBorder)`}
          strokeWidth="1.4"
        />

        {/* Ribbon Motto Text: विद्ययाऽमृतमश्नुते */}
        <text
          x="100"
          y="222"
          textAnchor="middle"
          fontFamily="'Noto Sans Devanagari', 'Mangal', 'Segoe UI Historic', 'Siddhanta', serif"
          fontSize="11"
          fontWeight="900"
          fill="#15244C"
          letterSpacing="0.4"
        >
          विद्ययाऽमृतमश्नुते
        </text>
      </g>
    </svg>
  );
};

export const NFSULogoFull: React.FC<NFSULogoProps> = ({
  id = 'nfsu-logo-full',
  className = '',
  size = 'md',
  variant = 'horizontal',
}) => {
  const emblemSizes = {
    sm: 'w-8 h-10',
    md: 'w-12 h-14',
    lg: 'w-16 h-20',
    xl: 'w-20 h-24',
  };

  if (variant === 'emblem') {
    return <NFSUEmblem id={id} className={`${emblemSizes[size]} ${className}`} />;
  }

  return (
    <div id={id} className={`flex items-center gap-3 ${className}`}>
      {/* Official NFSU Crest Shield */}
      <NFSUEmblem id={`${id}-emblem`} className={`${emblemSizes[size]} drop-shadow-xs`} />

      {/* Official Institutional Typography matching download.jpg */}
      <div className="flex flex-col justify-center">
        <h1 className="font-serif font-bold text-stone-900 dark:text-stone-100 text-sm sm:text-base lg:text-lg tracking-tight leading-tight">
          National Forensic Sciences University
        </h1>
        <div className="font-serif text-[11px] sm:text-xs text-red-700 dark:text-red-400 font-semibold tracking-wide leading-tight">
          Knowledge | Wisdom | Fulfilment
        </div>
        <div className="text-[10px] sm:text-[11px] font-medium text-stone-700 dark:text-stone-300 leading-tight mt-0.5">
          An Institution of National Importance
        </div>
        <div className="text-[9px] sm:text-[10px] font-normal text-stone-500 dark:text-stone-400 leading-tight">
          (Ministry of Home Affairs, Government of India)
        </div>
      </div>
    </div>
  );
};

export default NFSULogoFull;
