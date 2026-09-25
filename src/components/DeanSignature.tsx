import React from 'react';

interface DeanSignatureProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  color?: string;
}

/**
 * Dean, School of Doctoral Studies and Research (SDSR) Official Signature
 * Vector SVG specimen matching the approved uploaded signature specimen.
 */
export const DeanSignature: React.FC<DeanSignatureProps> = ({
  className = 'h-20 w-auto',
  width,
  height,
  color = '#0e1f57',
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="310 5 465 315"
      className={`object-contain select-none inline-block ${className}`}
      style={{ width, height }}
      aria-label="Official Signature of Dean, School of Doctoral Studies and Research"
    >
      <g
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Leftmost horizontal loop extending to the left */}
        <path
          d="M 445,130 C 418,135 372,156 355,167 C 342,176 348,187 362,187 C 382,187 416,160 448,141"
          strokeWidth="4.2"
        />

        {/* Interior horizontal bar crossing through the leftmost loop */}
        <path
          d="M 378,154 C 400,147 425,141 446,135"
          strokeWidth="3.0"
        />

        {/* Upper ink flick above the left loop */}
        <path
          d="M 388,126 C 400,121 414,118 430,116"
          strokeWidth="2.6"
        />

        {/* Sharp angular bottom-left arrowhead tick */}
        <path
          d="M 432,224 L 406,245 L 434,236"
          strokeWidth="4.0"
        />

        {/* Main central loop knot */}
        <path
          d="M 442,124 C 416,140 404,175 407,212 C 410,230 422,246 438,244 C 460,240 476,200 488,165 C 470,185 440,215 408,238 C 416,242 450,236 492,204"
          strokeWidth="4.2"
        />

        {/* Upper horizontal connecting bridge */}
        <path
          d="M 440,139 C 465,124 500,104 532,94"
          strokeWidth="3.6"
        />

        {/* Lower horizontal crossbar slicing through vertical pillars */}
        <path
          d="M 410,228 L 576,164"
          strokeWidth="4.4"
        />

        {/* Middle crossbar connecting stroke */}
        <path
          d="M 444,177 L 556,144"
          strokeWidth="3.4"
        />

        {/* Vertical Pillar 1 (Left vertical) */}
        <path
          d="M 495,84 C 494,110 495,145 498,178"
          strokeWidth="4.4"
        />

        {/* Vertical Pillar 2 (Middle vertical) */}
        <path
          d="M 524,87 C 523,115 524,150 527,184"
          strokeWidth="4.4"
        />

        {/* Vertical Pillar 3 (Right vertical) */}
        <path
          d="M 552,89 C 551,118 554,148 556,178"
          strokeWidth="4.2"
        />

        {/* Top arched crest spanning across vertical pillars */}
        <path
          d="M 491,85 C 494,67 516,60 546,67 C 558,71 565,84 560,102"
          strokeWidth="4.0"
        />

        {/* Needle-sharp high vertical spike (highest point of signature) */}
        <path
          d="M 537,13 L 569,160"
          strokeWidth="4.6"
        />

        {/* Top return flick on the tall spike */}
        <path
          d="M 538,13 C 541,25 548,49 556,70"
          strokeWidth="3.2"
        />

        {/* Right swooping cursive flourish */}
        <path
          d="M 556,144 C 570,165 585,176 606,172 C 626,168 643,145 660,124"
          strokeWidth="4.0"
        />

        {/* Upper right cursive tail extension flick */}
        <path
          d="M 568,114 C 585,127 610,138 632,134"
          strokeWidth="3.2"
        />

        {/* Dynamic sweeping underline flourish slanting up to the right */}
        <path
          d="M 464,303 C 508,270 588,212 752,100"
          strokeWidth="4.6"
        />

        {/* Feathered double-line at underline start */}
        <path
          d="M 464,303 C 486,280 534,246 564,228"
          strokeWidth="3.0"
        />

        {/* Sharp downward end hook on the underline */}
        <path
          d="M 750,100 L 741,112"
          strokeWidth="3.6"
        />

        {/* Accent dash 1 beneath underline */}
        <path
          d="M 618,252 L 640,238"
          strokeWidth="4.0"
        />

        {/* Accent dot 2 beneath underline */}
        <ellipse
          cx="660"
          cy="220"
          rx="3.6"
          ry="2.8"
          fill={color}
          stroke="none"
        />

        {/* Accent dot 3 above underline */}
        <circle
          cx="704"
          cy="182"
          r="2.6"
          fill={color}
          stroke="none"
        />
      </g>
    </svg>
  );
};

export default DeanSignature;
