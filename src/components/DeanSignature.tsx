import React from 'react';
import { DEAN_SIGN_SVG_PATH } from '../data/deanSignData';

interface DeanSignatureProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  color?: string;
  useImgFallback?: boolean;
}

/**
 * Dean, School of Doctoral Studies and Research (SDSR) Official Signature
 * Uses the authentic vector specimen from deansign.svg for Dean approvals and letter issuance.
 * Rendered as inline SVG to ensure 100% reliable PDF exports, canvas captures, and printouts.
 */
export const DeanSignature: React.FC<DeanSignatureProps> = ({
  className = 'h-20 w-auto',
  width,
  height,
  color = '#141847',
  useImgFallback = false,
}) => {
  if (useImgFallback) {
    return (
      <img
        src="/deansign.svg"
        alt="Dean, SDSR Official Signature"
        className={`object-contain select-none inline-block ${className}`}
        style={{ width, height }}
        draggable={false}
        loading="eager"
      />
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="650 10 740 430"
      className={`object-contain select-none inline-block ${className}`}
      style={{ width, height }}
      aria-label="Official Signature of Dean, School of Doctoral Studies and Research"
    >
      <path d={DEAN_SIGN_SVG_PATH} fill={color} />
    </svg>
  );
};

export default DeanSignature;
