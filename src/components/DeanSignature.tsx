import React from 'react';

interface DeanSignatureProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  color?: string;
}

/**
 * Dean, School of Doctoral Studies and Research (SDSR) Official Signature
 * Uses the authentic official deansign.svg asset for Dean approvals.
 */
export const DeanSignature: React.FC<DeanSignatureProps> = ({
  className = 'h-20 w-auto',
  width,
  height,
}) => {
  return (
    <img
      src="/deansign.svg"
      alt="Official Signature of Dean, School of Doctoral Studies and Research"
      className={`object-contain select-none inline-block ${className}`}
      style={{ width, height }}
      draggable={false}
      loading="eager"
    />
  );
};

export default DeanSignature;
