import React, { useRef, useState } from 'react';
import { OfficialLetterData, RpcRecord } from '../types';
import { Download, Printer, CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { downloadLetterElementAsPdf, generateLetterPdfFilename } from '../utils/pdfExport';
import { NFSUEmblem } from './NFSULogo';
import { MhaEmblem } from './MhaEmblem';
import { DeanSignature } from './DeanSignature';

interface OfficialRpcLetterProps {
  letterData: OfficialLetterData;
  rpcRecord?: RpcRecord;
  isApproved?: boolean;
  onPrint?: () => void;
  showActions?: boolean;
}

export const OfficialRpcLetter: React.FC<OfficialRpcLetterProps> = ({
  letterData,
  rpcRecord,
  isApproved = false,
  onPrint,
  showActions = true,
}) => {
  const letterRef = useRef<HTMLDivElement>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const isOfficiallyApproved = isApproved || rpcRecord?.status === 'APPROVED';

  const handleDownloadPdf = async () => {
    if (!letterRef.current || isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      const filename = generateLetterPdfFilename(rpcRecord, letterData);
      await downloadLetterElementAsPdf(letterRef.current, filename, rpcRecord);
    } catch (err) {
      console.error('Failed to generate letter PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Helper to format ordinals with superscripts (e.g. 1st -> 1ˢᵗ, 10th -> 10ᵗʰ)
  const formatOrdinalUnicode = (ord?: string) => {
    if (!ord) return '1ˢᵗ';
    const clean = ord.trim();
    if (clean === '1st' || clean === '1') return '1ˢᵗ';
    if (clean === '2nd' || clean === '2') return '2ⁿᵈ';
    if (clean === '3rd' || clean === '3') return '3ʳᵈ';
    if (clean.toLowerCase().endsWith('th')) {
      const num = clean.slice(0, -2);
      return `${num}ᵗʰ`;
    }
    return clean;
  };

  // Format reference number line matching the official letterhead format (e.g. NFSU/SDSR/RPC/     /25 or NFSU/SDSR/RPC/01/25)
  const formattedRefNo = () => {
    if (letterData.refNo) {
      // Clean prefix if already present
      const cleaned = letterData.refNo.replace(/^Ref:\s*No:\s*/i, '').trim();
      return cleaned;
    }
    const rpcNum = rpcRecord?.rpcNumber ? String(rpcRecord.rpcNumber).padStart(2, '0') : '     ';
    return `NFSU/SDSR/RPC/${rpcNum}/25`;
  };

  const ordinalText = formatOrdinalUnicode(letterData.rpcOrdinal);
  const scholarName = letterData.scholarName || 'Ms. Devanshi Lunagariya';
  const schoolName = letterData.schoolName || 'School of Pharmacy';
  const meetingDate = letterData.meetingDateText || '10ᵗʰ June, 2025';
  const meetingTime = letterData.meetingTimeText || '12:00 Noon';
  const rawMode = (letterData.meetingModeText || 'online mode').replace(/\s*mode$/i, '').trim();
  const guideName = letterData.guideName || 'Prof. (Dr.) Manjunath Ghate';
  const guideDesignation = letterData.guideDesignation || 'Professor, SPH';

  return (
    <div className="flex flex-col items-center w-full">
      {/* Action Bar */}
      {showActions && (
        <div className="w-full max-w-[820px] mb-4 flex items-center justify-between bg-stone-100 p-3 rounded-lg border border-stone-300 print:hidden">
          <div className="flex items-center gap-2">
            {isOfficiallyApproved ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Officially Approved & Finalized Document
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                Institutional Letter Draft (Official Template)
              </span>
            )}
            {rpcRecord?.approvedDocumentReference && (
              <span className="text-xs text-stone-500 font-mono hidden sm:inline">
                Ref: {rpcRecord.approvedDocumentReference}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              id="btn-download-letter-pdf"
              type="button"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded shadow-xs transition cursor-pointer disabled:opacity-60 ${
                isOfficiallyApproved
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  : 'bg-stone-900 hover:bg-stone-800 text-white'
              }`}
              title="Download official PDF generated with jsPDF"
            >
              {isDownloadingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Download as PDF
                </>
              )}
            </button>
            <button
              onClick={handlePrint}
              id="btn-print-letter"
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded shadow-xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
          </div>
        </div>
      )}

      {/* Official Institutional Letter Paper (Matches uploaded official format exactly) */}
      <div
        ref={letterRef}
        id="nfsu-official-letter-sheet"
        className="official-letter-paper w-full max-w-[820px] bg-white text-stone-950 shadow-md border border-stone-300 p-8 sm:p-12 relative print:shadow-none print:border-none print:p-0 print:m-0 font-serif leading-relaxed select-text"
        style={{ minHeight: '1100px', backgroundColor: '#ffffff' }}
      >
        {/* Draft Watermark if not approved */}
        {!isOfficiallyApproved && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 rotate-[-25deg] select-none z-0">
            <span className="text-8xl font-black font-sans tracking-widest text-stone-900 uppercase">
              DRAFT COPY
            </span>
          </div>
        )}

        {/* Letterhead Header Section */}
        <header className="relative z-10 pb-2 mb-3">
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            {/* Left: Ministry of Home Affairs Lion Emblem of India */}
            <div className="shrink-0">
              <MhaEmblem emblemSize="w-12 h-16 sm:w-14 sm:h-18" showText={true} />
            </div>

            {/* Center: University Bilingual Institutional Titles */}
            <div className="text-center flex-1 px-1 sm:px-2">
              <h1 className="text-base sm:text-[18px] md:text-[20px] font-bold text-[#15244C] tracking-wide font-serif mb-0.5 leading-snug">
                राष्ट्रीय न्यायालयिक विज्ञान विश्वविद्यालय
              </h1>
              <p className="text-[11px] sm:text-[12px] md:text-[13px] text-stone-950 font-bold mb-0.5 font-serif">
                (राष्ट्रीय महत्त्व का संस्थान, गृह मंत्रालय, भारत सरकार)
              </p>
              <h2 className="text-base sm:text-[18px] md:text-[20px] font-bold text-[#15244C] tracking-tight font-serif mb-0.5 leading-snug font-['Times_New_Roman',serif]">
                National Forensic Sciences University
              </h2>
              <p className="text-[10px] sm:text-[11px] text-stone-800 font-serif leading-tight">
                (An Institution of National Importance under Ministry of Home Affairs, Government of India)
              </p>
            </div>

            {/* Right: Official NFSU Crest */}
            <div className="shrink-0 flex justify-end">
              <NFSUEmblem id="letter-nfsu-emblem" className="w-16 h-20 sm:w-20 sm:h-24 drop-shadow-xs" />
            </div>
          </div>

          {/* Full-width dividing rule */}
          <hr className="border-t-[1.5px] border-stone-900 mt-3 mb-4" />
        </header>

        {/* Reference Number and Date Line */}
        <div className="relative z-10 flex justify-between items-baseline mb-6 font-serif text-[13px] sm:text-[14px] font-bold text-stone-950">
          <div>
            <span>Ref: No: </span>
            <span>{formattedRefNo()}</span>
          </div>
          <div>
            <span>Date: </span>
            <span>{letterData.date || '10/06/2025'}</span>
          </div>
        </div>

        {/* Addressees Section ("To,") */}
        <div className="relative z-10 mb-6 text-[13px] sm:text-[14px] leading-snug text-stone-950 font-serif">
          <p className="font-bold mb-2">To,</p>
          <ol className="list-decimal pl-7 space-y-2.5 font-bold">
            {/* 1. Dean */}
            <li className="pl-1">
              <div>Dean</div>
              <div>{schoolName}</div>
              <div>NFSU, {letterData.schoolCampus || 'Gandhinagr'}</div>
            </li>

            {/* 2. Guide */}
            <li className="pl-1">
              <div>{guideName}</div>
              <div>{guideDesignation}</div>
              <div>NFSU</div>
            </li>

            {/* 3. Internal Expert Member */}
            <li className="pl-1">
              <div>
                {letterData.internalExpertName || 'Dr. Bhoomika Patel'} (Internal Expert Member).
              </div>
              <div>{letterData.internalExpertDesignation || 'Dean (I/C), SPH'}</div>
              <div>
                {letterData.internalExpertDept ? `${letterData.internalExpertDept}, ` : ''}
                NFSU{letterData.internalExpertCampus ? `, ${letterData.internalExpertCampus.replace(/^NFSU,\s*/i, '')}` : ', Gandhinagar'}
              </div>
            </li>

            {/* 4. External Expert Member 1 */}
            <li className="pl-1">
              <div>
                {letterData.externalExpert1Name || 'Dr. Dhiraj Bhatia'} (External Expert Member)
              </div>
              <div>
                {letterData.externalExpert1Designation || 'Associate Professor & INYAS-INSA Member'}
              </div>
              <div>
                {letterData.externalExpert1Dept || 'Department of Biological Science and Engineering'}
              </div>
              <div>
                {letterData.externalExpert1Inst || 'Indian Institute of Technology Gandhinagar'}
              </div>
              <div>{letterData.externalExpert1City || 'Gujarat'}</div>
            </li>

            {/* 5. External Expert Member 2 */}
            <li className="pl-1">
              <div>
                {letterData.externalExpert2Name || 'Dr. Prakash Jha'} (External Expert Member).
              </div>
              <div>{letterData.externalExpert2Designation || 'Professor & Dean'}</div>
              <div>
                {letterData.externalExpert2Dept || 'School of Applied Material Science'}
              </div>
              <div>
                {letterData.externalExpert2Inst || 'Central University of Gujarat'}
              </div>
              {letterData.externalExpert2City &&
                letterData.externalExpert2City !== 'Gandhinagar' &&
                letterData.externalExpert2City !== 'Gujarat' && (
                  <div>{letterData.externalExpert2City}</div>
                )}
            </li>
          </ol>
        </div>

        {/* Subject Line */}
        <div className="relative z-10 my-5 text-[13px] sm:text-[14px] font-bold text-stone-950 font-serif leading-snug">
          <span>Subject: </span>
          <span>
            {letterData.subject ||
              `${ordinalText} Meeting of the Research Progress Committee (RPC) for Ph.D. Scholar Registered under ${guideName}, ${guideDesignation}, NFSU.`}
          </span>
        </div>

        {/* Salutation & Body Text */}
        <div className="relative z-10 space-y-3.5 text-[13px] sm:text-[14px] text-stone-950 font-serif leading-relaxed text-left">
          <p>Dear Sir/Madam,</p>

          <p>
            The meeting of <strong className="font-bold">Research Progress Committee (RPC)</strong> for undernoted
            Ph.D. <strong className="font-bold">{schoolName}</strong> NFSU is
            scheduled on <strong className="font-bold">{meetingDate} from {meetingTime}</strong> onwards
            through <strong className="font-bold">{rawMode}</strong> mode
            {letterData.meetingVenue && rawMode.toLowerCase() !== 'online'
              ? ` at ${letterData.meetingVenue}`
              : ''}
            .
          </p>

          {/* Bullet Point with Scholar Info */}
          <div className="py-2 pl-8 sm:pl-14">
            <p className="font-bold text-stone-950 flex items-baseline gap-3">
              <span className="text-base select-none">•</span>
              <span>
                Name of Ph.D. Scholar- {scholarName} ({ordinalText}RPC)
              </span>
            </p>
          </div>

          <p>
            Your presence and valuable suggestions are highly appreciated. Kindly make it convenient to attend the
            meeting.
          </p>

          <p className="pt-2">Thanking you,</p>
        </div>

        {/* Signatory & Dean Block (Right Aligned) */}
        <div className="relative z-10 mt-6 mb-6 flex justify-end">
          <div className="text-center w-72 flex flex-col items-center font-serif">
            {/* Authentic Dean Signature SVG upon official approval */}
            {isOfficiallyApproved ? (
              <div className="flex flex-col items-center justify-end w-full h-20 sm:h-24 mb-1">
                <DeanSignature
                  className="h-20 sm:h-24 w-auto drop-shadow-2xs"
                  color="#0e1f57"
                />
              </div>
            ) : (
              <div className="h-20 sm:h-24 mb-1" />
            )}

            <div className="font-bold text-[13px] sm:text-[14px] text-stone-950">Dean</div>
            <div className="font-bold text-[13px] sm:text-[14px] text-stone-950">
              School of Doctoral Studies and Research
            </div>
          </div>
        </div>

        {/* Copy to Section */}
        <div className="relative z-10 mb-8 text-[13px] sm:text-[14px] font-serif text-stone-950">
          <p className="font-bold mb-1">Copy to:</p>
          <p className="font-bold pl-3">1.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Associate Dean- SDSR</p>
        </div>

        {/* Institutional Footer (Separated by horizontal rule) */}
        <div className="relative z-10 pt-2 border-t-[1.5px] border-stone-800 text-[11px] sm:text-[12px] flex flex-col sm:flex-row justify-between items-start gap-2 font-serif text-[#1c355e]">
          <div>
            <p className="font-bold text-[#15244C] text-[12.5px] sm:text-[13px]">
              National Forensic Sciences University
            </p>
            <p>School of Doctoral Studies &amp; Research</p>
            <p>Sector-9, Gandhinagar, Gujarat – 382 007</p>
          </div>
          <div className="sm:text-right">
            <p>Tel: +91-79-23977104, Fax: +91-723247465</p>
            <p>Email: phd@nfsu.ac.in</p>
            <p>Website: nfsu.ac.in</p>
          </div>
        </div>
      </div>
    </div>
  );
};

