import React from 'react';

/**
 * High-fidelity vector SVG representation of the State Emblem of India (Lion Capital of Ashoka)
 * paired with "गृह मंत्रालय / MINISTRY OF / HOME AFFAIRS" matching the official Government of India
 * institutional letterhead format shown in the official NFSU notification letter.
 */
export const MhaEmblem: React.FC<{
  className?: string;
  emblemSize?: string;
  showText?: boolean;
}> = ({
  className = '',
  emblemSize = 'w-11 h-14',
  showText = true,
}) => {
  return (
    <div className={`flex items-center gap-2 select-none shrink-0 ${className}`}>
      {/* State Emblem of India (Ashoka Lion Capital with Satyameva Jayate) */}
      <svg
        viewBox="0 0 100 135"
        className={`${emblemSize} shrink-0 object-contain text-stone-900 fill-current`}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="State Emblem of India"
      >
        {/* Top Lion Heads & Manes */}
        {/* Central Lion Head */}
        <path d="M 44,8 C 44,4 56,4 56,8 C 58,11 58,16 57,19 C 55,23 45,23 43,19 C 42,16 42,11 44,8 Z" />
        <ellipse cx="50" cy="14" rx="5" ry="4" fill="#FFFFFF" />
        <circle cx="48" cy="13" r="1" />
        <circle cx="52" cy="13" r="1" />
        <path d="M 48.5,15 Q 50,17 51.5,15" stroke="#000000" strokeWidth="0.8" fill="none" />
        <path d="M 45,10 C 47,8 53,8 55,10" stroke="#000000" strokeWidth="0.8" fill="none" />

        {/* Central Lion Mane & Torso */}
        <path d="M 40,20 C 37,25 36,36 38,44 C 40,49 43,54 44,60 L 56,60 C 57,54 60,49 62,44 C 64,36 63,25 60,20 C 56,23 44,23 40,20 Z" />
        <path d="M 46,26 C 44,32 44,40 45,46 C 47,52 50,56 50,56 C 50,56 53,52 55,46 C 56,40 56,32 54,26 Z" fill="#FFFFFF" opacity="0.3" />

        {/* Left Lion (Profile facing Left) */}
        <path d="M 40,15 C 36,12 28,14 26,20 C 23,26 24,34 28,40 C 32,46 36,52 38,58 L 43,58 C 41,52 38,46 37,40 C 35,32 37,24 40,15 Z" />
        <path d="M 27,18 C 25,18 23,21 23,24 C 23,26 26,27 28,26 C 30,24 30,20 27,18 Z" />
        {/* Left Lion Open Mouth / Roar detail */}
        <path d="M 23,23 L 20,24 L 23,26 Z" />

        {/* Right Lion (Profile facing Right) */}
        <path d="M 60,15 C 64,12 72,14 74,20 C 77,26 76,34 72,40 C 68,46 64,52 62,58 L 57,58 C 59,52 62,46 63,40 C 65,32 63,24 60,15 Z" />
        <path d="M 73,18 C 75,18 77,21 77,24 C 77,26 74,27 72,26 C 70,24 70,20 73,18 Z" />
        {/* Right Lion Open Mouth / Roar detail */}
        <path d="M 77,23 L 80,24 L 77,26 Z" />

        {/* Front Legs / Paws of Lions */}
        <path d="M 42,50 L 40,65 L 45,65 L 46,54 Z" />
        <path d="M 58,50 L 60,65 L 55,65 L 54,54 Z" />
        <path d="M 48,52 L 48,65 L 52,65 L 52,52 Z" />
        {/* Side Paws */}
        <path d="M 33,52 L 30,65 L 36,65 L 37,56 Z" />
        <path d="M 67,52 L 70,65 L 64,65 L 63,56 Z" />

        {/* Abacus / Circular Pedestal Platform */}
        <rect x="18" y="65" width="64" height="4" rx="1" />
        <rect x="22" y="69" width="56" height="15" rx="0.5" fill="#292524" />

        {/* Center Ashoka Chakra on Abacus */}
        <circle cx="50" cy="76.5" r="6" fill="#FFFFFF" />
        <circle cx="50" cy="76.5" r="5.2" fill="none" stroke="#292524" strokeWidth="0.8" />
        <circle cx="50" cy="76.5" r="1.2" fill="#292524" />
        {/* Chakra Spokes (24 spokes represented symmetrically) */}
        <g stroke="#292524" strokeWidth="0.5">
          <line x1="50" y1="71.5" x2="50" y2="81.5" />
          <line x1="45" y1="76.5" x2="55" y2="76.5" />
          <line x1="46.5" y1="73" x2="53.5" y2="80" />
          <line x1="46.5" y1="80" x2="53.5" y2="73" />
          <line x1="48" y1="71.8" x2="52" y2="81.2" />
          <line x1="48" y1="81.2" x2="52" y2="71.8" />
          <line x1="45.3" y1="74.5" x2="54.7" y2="78.5" />
          <line x1="45.3" y1="78.5" x2="54.7" y2="74.5" />
        </g>

        {/* Left Animal on Abacus: Galloping Horse */}
        <g fill="#FFFFFF" transform="translate(26, 73.5) scale(0.7)">
          <ellipse cx="6" cy="4" rx="4" ry="2.2" />
          <path d="M 8,3 C 9,1 11,1 12,3 L 10,5 Z" />
          <path d="M 3,4 L 1,7 L 2.5,7.5 L 4,5 Z" />
          <path d="M 8,5 L 10,8 L 11.5,7.5 L 9.5,4.5 Z" />
        </g>

        {/* Right Animal on Abacus: Humped Bull */}
        <g fill="#FFFFFF" transform="translate(62, 73.5) scale(0.7)">
          <ellipse cx="6" cy="4" rx="4.5" ry="2.6" />
          <circle cx="4" cy="2.2" r="1.2" />
          <path d="M 10,2 C 11,2 12,3 12,5 L 9,5 Z" />
          <path d="M 3,5 L 3,8 L 4.5,8 L 4.5,5.5 Z" />
          <path d="M 8,5 L 8,8 L 9.5,8 L 9.5,5 Z" />
        </g>

        {/* Lower Rim of Abacus */}
        <rect x="18" y="84" width="64" height="3" rx="1" />

        {/* Bell-shaped Inverted Lotus Base */}
        <path d="M 25,87 C 28,94 36,98 50,98 C 64,98 72,94 75,87 Z" fill="#44403C" />
        {/* Lotus Petal Lines */}
        <path d="M 34,87 C 36,92 42,96 50,96 C 58,96 64,92 66,87" stroke="#FFFFFF" strokeWidth="0.8" fill="none" opacity="0.6" />
        <line x1="50" y1="87" x2="50" y2="98" stroke="#FFFFFF" strokeWidth="0.7" opacity="0.6" />
        <line x1="42" y1="87" x2="44" y2="96" stroke="#FFFFFF" strokeWidth="0.6" opacity="0.5" />
        <line x1="58" y1="87" x2="56" y2="96" stroke="#FFFFFF" strokeWidth="0.6" opacity="0.5" />

        {/* Base Platform Line */}
        <rect x="22" y="99" width="56" height="2" rx="0.5" />

        {/* Devanagari National Motto: "सत्यमेव जयते" */}
        <text
          x="50"
          y="114"
          textAnchor="middle"
          fontFamily="'Noto Sans Devanagari', 'Mangal', 'Segoe UI Historic', 'Siddhanta', serif"
          fontSize="10.5"
          fontWeight="bold"
          fill="#1C1917"
          letterSpacing="0.8"
        >
          सत्यमेव जयते
        </text>
      </svg>

      {/* Typography: गृह मंत्रालय / MINISTRY OF / HOME AFFAIRS */}
      {showText && (
        <div className="flex flex-col text-left justify-center leading-none">
          <span className="font-hindi text-[10px] sm:text-[11px] font-bold text-stone-900 tracking-tight leading-tight">
            गृह मंत्रालय
          </span>
          <span className="font-sans text-[8.5px] sm:text-[9.5px] font-extrabold uppercase text-stone-900 tracking-wider leading-tight mt-0.5">
            MINISTRY OF
          </span>
          <span className="font-sans text-[9px] sm:text-[10px] font-black uppercase text-stone-950 tracking-wider leading-tight">
            HOME AFFAIRS
          </span>
        </div>
      )}
    </div>
  );
};
