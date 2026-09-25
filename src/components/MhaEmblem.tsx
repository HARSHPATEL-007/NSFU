import React from 'react';

interface MhaEmblemProps {
  className?: string;
  emblemSize?: string;
  showText?: boolean;
}

/**
 * Official Ministry of Home Affairs (MHA), Government of India Insignia
 * Uses the authentic official Ministry_of_Home_Affairs_India.svg asset.
 */
export const MhaEmblem: React.FC<MhaEmblemProps> = ({
  className = '',
  emblemSize = 'h-13 sm:h-15 w-auto',
}) => {
  return (
    <div className={`flex items-center select-none shrink-0 ${className}`}>
      <img
        src="/Ministry_of_Home_Affairs_India.svg"
        alt="Ministry of Home Affairs, Government of India"
        className={`object-contain select-none inline-block ${emblemSize}`}
        loading="eager"
        draggable={false}
      />
    </div>
  );
};

export default MhaEmblem;
