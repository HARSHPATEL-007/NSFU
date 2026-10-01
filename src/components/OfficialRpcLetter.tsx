import React, { useRef, useState } from 'react';
import { OfficialLetterData, RpcRecord } from '../types';
import { Download, Printer, CheckCircle2, FileText, Loader2, Image, ShieldCheck, FileDown } from 'lucide-react';
import { downloadLetterElementAsPdf, downloadLetterElementAsImage, generateLetterPdfFilename } from '../utils/pdfExport';
import { downloadApprovedRpcLetterDocx } from '../utils/docxExport';
import { NFSUEmblem } from './NFSULogo';
import { MhaEmblem } from './MhaEmblem';
import { DeanSignature } from './DeanSignature';

interface OfficialRpcLetterProps {
  letterData: OfficialLetterData;
  rpcRecord?: RpcRecord;
  isApproved?: boolean;
  onPrint?: () => void;
  showActions?: boolean;
  forceSignature?: boolean;
}

export const OfficialRpcLetter: React.FC<OfficialRpcLetterProps> = ({
  letterData,
  rpcRecord,
  isApproved = false,
  onPrint,
  showActions = true,
  forceSignature = false,
}) => {
  const letterRef = useRef<HTMLDivElement>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Check if officially approved
  const isRecordApproved = isApproved || rpcRecord?.status === 'APPROVED' || forceSignature;
  const [includeSignature, setIncludeSignature] = useState<boolean>(isRecordApproved);

  // Keep includeSignature in sync if record becomes approved
  React.useEffect(() => {
    if (isRecordApproved) {
      setIncludeSignature(true);
    }
  }, [isRecordApproved]);

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const handleDownloadPdf = async () => {
    if (!letterRef.current || isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      const filename = generateLetterPdfFilename(rpcRecord, letterData);
      await downloadLetterElementAsPdf(letterRef.current, filename, rpcRecord);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to generate letter PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadDocx = async () => {
    if (isDownloadingDocx) return;
    setIsDownloadingDocx(true);
    try {
      const fallbackRecord: RpcRecord = rpcRecord || {
        id: 'export-docx',
        scholarId: 'temp',
        scholarName: letterData.scholarName || 'Ph.D. Scholar',
        enrollmentNo: 'DOCX_EXPORT',
        school: letterData.schoolName || 'School of Doctoral Studies and Research',
        rpcNumber: parseInt(letterData.rpcOrdinal) || 1,
        rpcDate: letterData.date || '10/06/2025',
        meetingTime: letterData.meetingTimeText || '12:00 Noon',
        meetingMode: 'ONLINE',
        status: isRecordApproved ? 'APPROVED' : 'DRAFTED',
        requestDetails: 'RPC Meeting',
        rpcMembers: {
          guide: {
            id: '1',
            name: letterData.guideName || 'Research Supervisor',
            designation: letterData.guideDesignation || 'Professor',
            department: '',
            schoolOrInstitution: letterData.guideSchool || 'NFSU',
            location: 'Gandhinagar',
            email: '',
            memberType: 'GUIDE',
          },
          internalExpert: {
            id: '2',
            name: letterData.internalExpertName || '',
            designation: letterData.internalExpertDesignation || (letterData.internalExpertName ? 'Internal Expert Member' : ''),
            department: letterData.internalExpertDept || '',
            schoolOrInstitution: letterData.internalExpertCampus || 'NFSU',
            location: letterData.internalExpertCampus || 'Gandhinagar',
            email: '',
            memberType: 'INTERNAL',
          },
          externalExpert1: {
            id: '3',
            name: letterData.externalExpert1Name || '',
            designation: letterData.externalExpert1Designation || (letterData.externalExpert1Name ? 'External Expert Member' : ''),
            department: letterData.externalExpert1Dept || '',
            schoolOrInstitution: letterData.externalExpert1Inst || '',
            location: letterData.externalExpert1City || '',
            email: '',
            memberType: 'EXTERNAL_1',
          },
          externalExpert2: {
            id: '4',
            name: letterData.externalExpert2Name || '',
            designation: letterData.externalExpert2Designation || (letterData.externalExpert2Name ? 'External Expert Member' : ''),
            department: letterData.externalExpert2Dept || '',
            schoolOrInstitution: letterData.externalExpert2Inst || '',
            location: letterData.externalExpert2City || '',
            email: '',
            memberType: 'EXTERNAL_2',
          },
        },
        letterData,
        createdBy: 'SDSR',
        createdAt: new Date().toISOString(),
      };

      await downloadApprovedRpcLetterDocx(fallbackRecord, letterData, includeSignature || isRecordApproved);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to generate letter DOCX:', err);
    } finally {
      setIsDownloadingDocx(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!letterRef.current || isDownloadingImage) return;
    setIsDownloadingImage(true);
    try {
      const filename = generateLetterPdfFilename(rpcRecord, letterData);
      await downloadLetterElementAsImage(letterRef.current, filename);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to generate letter image:', err);
    } finally {
      setIsDownloadingImage(false);
    }
  };

  // Helper to format ordinals (e.g. 1st, 2nd, 3rd)
  const formatOrdinal = (ord?: string) => {
    if (!ord) return '1st';
    const clean = ord.trim();
    if (clean === '1' || clean === '1st') return '1st';
    if (clean === '2' || clean === '2nd') return '2nd';
    if (clean === '3' || clean === '3rd') return '3rd';
    if (clean.toLowerCase().endsWith('th') || clean.toLowerCase().endsWith('st') || clean.toLowerCase().endsWith('nd') || clean.toLowerCase().endsWith('rd')) {
      return clean;
    }
    return `${clean}th`;
  };

  // Format reference number line matching official letterhead format (e.g. NFSU/SDSR/RPC/       /25 or NFSU/SDSR/RPC/01/25)
  const formattedRefNo = () => {
    if (letterData.refNo) {
      const cleaned = letterData.refNo.replace(/^Ref:\s*No:\s*/i, '').trim();
      return cleaned;
    }
    const rpcNum = rpcRecord?.rpcNumber ? String(rpcRecord.rpcNumber).padStart(2, '0') : '       ';
    return `NFSU/SDSR/RPC/${rpcNum}/25`;
  };

  const ordinalText = formatOrdinal(letterData.rpcOrdinal);
  const scholarName = letterData.scholarName || 'Ph.D. Scholar';
  const schoolName = letterData.schoolName || 'School of Doctoral Studies and Research';
  const meetingDate = letterData.meetingDateText || '10th June, 2025';
  const meetingTime = letterData.meetingTimeText || '12:00 Noon';
  const rawMode = (letterData.meetingModeText || 'online mode').replace(/\s*mode$/i, '').trim() || 'online';
  const guideName = letterData.guideName || 'Research Supervisor';
  const guideDesignation = letterData.guideDesignation || 'Professor';

  return (
    <div className="flex flex-col items-center w-full">
      {/* Action Bar for Downloading & Printing */}
      {showActions && (
        <div className="w-full max-w-[840px] mb-4 flex flex-wrap items-center justify-between gap-3 bg-stone-100 p-3 rounded-lg border border-stone-300 print:hidden">
          <div className="flex items-center gap-2">
            {isRecordApproved ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Officially Approved with Dean Signature
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                Institutional Letter Draft
              </span>
            )}

            {/* Toggle Dean Signature for Letter Issuance / Archival */}
            <label className="inline-flex items-center gap-1.5 ml-2 text-xs font-medium text-stone-700 cursor-pointer bg-white px-2.5 py-1 rounded border border-stone-300 hover:bg-stone-50 select-none">
              <input
                type="checkbox"
                checked={includeSignature}
                onChange={(e) => setIncludeSignature(e.target.checked)}
                className="w-3.5 h-3.5 text-emerald-600 rounded border-stone-300 focus:ring-emerald-500 cursor-pointer"
              />
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Affix Dean Approval Sign (deansign.svg)</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            {downloadSuccess && (
              <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 font-medium animate-fade-in flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Downloaded!
              </span>
            )}

            {/* Download as PDF Button */}
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              id="btn-download-letter-pdf"
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded shadow-xs transition cursor-pointer disabled:opacity-60 bg-emerald-700 hover:bg-emerald-800 text-white ring-1 ring-emerald-600/30"
              title="Download fully finalized fullsize A4 PDF with Dean approval signature"
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

            {/* Download as DOCX Button */}
            <button
              onClick={handleDownloadDocx}
              disabled={isDownloadingDocx}
              id="btn-download-letter-docx"
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded shadow-xs transition cursor-pointer disabled:opacity-60 bg-[#15244C] hover:bg-[#1f3570] text-white ring-1 ring-blue-900/30"
              title="Download official letter in editable Microsoft Word (.docx) format with institutional styling"
            >
              {isDownloadingDocx ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating DOCX...
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5" />
                  Download as DOCX
                </>
              )}
            </button>

            {/* Download as PNG Image Button */}
            <button
              onClick={handleDownloadImage}
              disabled={isDownloadingImage}
              id="btn-download-letter-png"
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded shadow-xs transition cursor-pointer"
              title="Download high-resolution letter document image"
            >
              <Image className="w-3.5 h-3.5 text-stone-600" />
              Download PNG
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              id="btn-print-letter"
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded shadow-xs transition cursor-pointer"
              title="Print official letter on A4 paper"
            >
              <Printer className="w-3.5 h-3.5 text-stone-600" />
              Print
            </button>
          </div>
        </div>
      )}

      {/* Official Institutional Letter Paper (Matches uploaded official format exactly) */}
      <div
        ref={letterRef}
        id="nfsu-official-letter-sheet"
        className="official-letter-paper w-full max-w-[800px] bg-white text-stone-950 shadow-md border border-stone-300 px-7 py-6 sm:px-10 sm:py-7 relative print:shadow-none print:border-none print:p-0 print:m-0 font-serif select-text"
        style={{ width: '800px', maxWidth: '800px', backgroundColor: '#ffffff', fontFamily: "'Times New Roman', Times, serif" }}
      >
        {/* Draft Watermark only if not approved and signature not affixed */}
        {!includeSignature && !isRecordApproved && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 rotate-[-25deg] select-none z-0">
            <span className="text-8xl font-black font-sans tracking-widest text-stone-900 uppercase">
              DRAFT COPY
            </span>
          </div>
        )}

        {/* Letterhead Header Section */}
        <header className="relative z-10 pb-0.5 mb-1.5">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Ministry of Home Affairs Lion Emblem of India */}
            <div className="w-[125px] sm:w-[135px] shrink-0 flex items-center justify-start">
              <MhaEmblem emblemSize="h-11 sm:h-12 w-auto" />
            </div>

            {/* Center: University Bilingual Institutional Titles */}
            <div className="text-center flex-1 px-1">
              <h1 className="text-[15px] sm:text-[16px] font-bold text-[#15244C] tracking-wide font-serif mb-0 leading-tight">
                राष्ट्रीय न्यायालयिक विज्ञान विश्वविद्यालय
              </h1>
              <p className="text-[10px] sm:text-[10.5px] text-stone-950 font-bold mb-0.5 font-serif leading-tight">
                (राष्ट्रीय महत्त्व का संस्थान, गृह मंत्रालय, भारत सरकार)
              </p>
              <h2 className="text-[15px] sm:text-[16px] font-bold text-[#15244C] tracking-tight font-serif mb-0 leading-tight font-['Times_New_Roman',serif]">
                National Forensic Sciences University
              </h2>
              <p className="text-[9.5px] sm:text-[10px] text-stone-800 font-serif leading-tight">
                (An Institution of National Importance under Ministry of Home Affairs, Government of India)
              </p>
            </div>

            {/* Right: Official NFSU Crest */}
            <div className="w-[125px] sm:w-[135px] shrink-0 flex items-center justify-end">
              <NFSUEmblem id="letter-nfsu-emblem" className="w-14 h-18 sm:w-16 sm:h-20 drop-shadow-xs" />
            </div>
          </div>

          {/* Full-width dividing rule matching official specimen */}
          <hr className="border-t-[1.5px] border-stone-900 mt-2 mb-2.5" />
        </header>

        {/* Reference Number and Date Line */}
        <div className="relative z-10 flex justify-between items-baseline mb-3 font-serif text-[12px] sm:text-[12.5px] font-bold text-stone-950">
          <div>
            <span>Ref: No: </span>
            <span>{formattedRefNo()}</span>
          </div>
          <div>
            <span>Date: </span>
            <span>{letterData.date || '10/06/2025'}</span>
          </div>
        </div>

        {/* Addressees Section ("To,++") */}
        <div className="relative z-10 mb-2.5 text-[12px] sm:text-[12.5px] leading-[1.3] text-stone-950 font-serif font-bold">
          <p className="font-bold mb-1">To,++</p>
          <ol className="list-decimal pl-6 space-y-1.5 font-bold">
            {/* 1. Dean */}
            <li className="pl-1">
              <div>Dean</div>
              <div>{schoolName}</div>
              <div>NFSU, {letterData.schoolCampus || 'Gandhinagar'}</div>
            </li>

            {/* 2. Guide / Supervisor */}
            <li className="pl-1">
              <div>{guideName}</div>
              <div>{guideDesignation}</div>
              <div>NFSU</div>
            </li>

            {/* 3. Internal Expert Member / Internal Guide */}
            {letterData.internalExpertName ? (
              <li className="pl-1">
                <div>
                  {letterData.internalExpertName} (Internal Expert Member).
                </div>
                {letterData.internalExpertDesignation && <div>{letterData.internalExpertDesignation}</div>}
                <div>
                  {letterData.internalExpertDept ? `${letterData.internalExpertDept}, ` : ''}
                  NFSU{letterData.internalExpertCampus ? `, ${letterData.internalExpertCampus.replace(/^NFSU,\s*/i, '')}` : ', Gandhinagar'}
                </div>
              </li>
            ) : null}

            {/* 4. External Expert Member 1 / External Guide */}
            {letterData.externalExpert1Name ? (
              <li className="pl-1">
                <div>
                  {letterData.externalExpert1Name} (External Expert Member)
                </div>
                {letterData.externalExpert1Designation && (
                  <div>{letterData.externalExpert1Designation}</div>
                )}
                {letterData.externalExpert1Dept && (
                  <div>{letterData.externalExpert1Dept}</div>
                )}
                {letterData.externalExpert1Inst && (
                  <div>{letterData.externalExpert1Inst}</div>
                )}
                {letterData.externalExpert1City && <div>{letterData.externalExpert1City}</div>}
              </li>
            ) : null}

            {/* 5. External Expert Member 2 */}
            {letterData.externalExpert2Name ? (
              <li className="pl-1">
                <div>
                  {letterData.externalExpert2Name} (External Expert Member).
                </div>
                {letterData.externalExpert2Designation && (
                  <div>{letterData.externalExpert2Designation}</div>
                )}
                {letterData.externalExpert2Dept && (
                  <div>{letterData.externalExpert2Dept}</div>
                )}
                {letterData.externalExpert2Inst && (
                  <div>{letterData.externalExpert2Inst}</div>
                )}
                {letterData.externalExpert2City &&
                  letterData.externalExpert2City !== 'Gandhinagar' &&
                  letterData.externalExpert2City !== 'Gujarat' && (
                    <div>{letterData.externalExpert2City}</div>
                  )}
              </li>
            ) : null}
          </ol>
        </div>

        {/* Subject Line (Matching exact specimen format) */}
        <div className="relative z-10 my-2.5 text-[12px] sm:text-[12.5px] font-bold text-stone-950 font-serif leading-snug">
          <span>Subject: </span>
          <span>
            {letterData.subject || (
              <>
                {ordinalText} Meeting of the Research Progress Committee (RPC) for Ph.D. Scholar Registered under {guideName}, {guideDesignation}, NFSU.
              </>
            )}
          </span>
        </div>

        {/* Salutation & Body Text */}
        <div className="relative z-10 space-y-2 text-[12px] sm:text-[12.5px] text-stone-950 font-serif leading-[1.38] text-left">
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

          {/* Bullet Point with Scholar Info (Exact format from specimen) */}
          <div className="py-1 pl-6 sm:pl-10">
            <p className="font-bold text-stone-950 flex items-baseline gap-2.5">
              <span className="text-sm select-none">•</span>
              <span>
                Name of Ph.D. Scholar- {scholarName} ({ordinalText}RPC)
              </span>
            </p>
          </div>

          <p>
            Your presence and valuable suggestions are highly appreciated. Kindly make it convenient to attend the
            meeting.
          </p>

          <p className="pt-1">Thanking you,</p>
        </div>

        {/* Signatory & Dean Block with Authentic deansign.svg Signature (Right Aligned) */}
        <div className="relative z-10 mt-2 mb-2 flex justify-end">
          <div className="text-center w-64 flex flex-col items-center font-serif">
            {/* Authentic Dean Signature Specimen rendered from deansign.svg */}
            {includeSignature || isRecordApproved ? (
              <div className="flex flex-col items-center justify-end w-full h-14 sm:h-16 mb-0.5">
                <DeanSignature
                  className="h-14 sm:h-16 w-auto drop-shadow-2xs"
                  color="#141847"
                />
              </div>
            ) : (
              <div className="h-14 sm:h-16 mb-0.5" />
            )}

            <div className="font-bold text-[12px] sm:text-[12.5px] text-stone-950 leading-tight">Dean</div>
            <div className="font-bold text-[12px] sm:text-[12.5px] text-stone-950 leading-tight">
              School of Doctoral Studies and Research
            </div>
          </div>
        </div>

        {/* Copy to Section */}
        <div className="relative z-10 mb-2 text-[11.5px] sm:text-[12px] font-serif text-stone-950 leading-tight">
          <p className="font-bold mb-0.5">Copy to:</p>
          <p className="font-bold pl-3">1.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Associate Dean- SDSR</p>
        </div>

        {/* Institutional Footer (Separated by horizontal rule) */}
        <div className="relative z-10 pt-1.5 border-t-[1.5px] border-stone-800 text-[10px] sm:text-[10.5px] flex flex-col sm:flex-row justify-between items-start gap-1 font-serif text-[#1c355e] leading-tight">
          <div>
            <p className="font-bold text-[#15244C] text-[11px] sm:text-[11.5px]">
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

export default OfficialRpcLetter;
