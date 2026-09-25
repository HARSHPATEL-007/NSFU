import React, { useState, useEffect } from 'react';
import { RpcRecord } from '../types';
import { OfficialRpcLetter } from './OfficialRpcLetter';
import { downloadLetterElementAsPdf, generateLetterPdfFilename } from '../utils/pdfExport';
import { X, Printer, Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface LetterViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RpcRecord;
  autoDownload?: boolean;
}

export const LetterViewerModal: React.FC<LetterViewerModalProps> = ({
  isOpen,
  onClose,
  record,
  autoDownload = false,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const isApproved = record.status === 'APPROVED';

  // Keyboard shortcut listener for Esc (close) and Ctrl+S / Cmd+S (download PDF)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc to close modal
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }

      // Ctrl+S / Cmd+S to download PDF in viewer
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (!isDownloading) {
          handleDownloadPdf();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDownloading, record, isApproved]);

  const handleDownloadPdf = async () => {
    const el = document.getElementById('nfsu-official-letter-sheet');
    if (!el || isDownloading) return;

    setIsDownloading(true);
    setPdfError('');
    try {
      const filename = generateLetterPdfFilename(record, record.letterData);
      await downloadLetterElementAsPdf(el as HTMLElement, filename, record);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err: any) {
      console.error('Failed to export letter as PDF with jsPDF:', err);
      setPdfError(err?.message || 'Failed to generate PDF. Please try again or use the Print option.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Auto-download trigger if opened directly via a Download action
  useEffect(() => {
    if (isOpen && autoDownload && !isDownloading) {
      const timer = setTimeout(() => {
        handleDownloadPdf();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoDownload]);

  if (!isOpen || !record.letterData) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
    >
      <div className="bg-stone-100 rounded-xl shadow-2xl max-w-5xl w-full border border-stone-300 flex flex-col max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-3.5 bg-white border-b border-stone-200 flex items-center justify-between print:hidden">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-stone-900">
                Official Research Progress Committee Notification
              </h2>
              {isApproved ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Approved & Finalized
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                  Draft
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500">
              National Forensic Sciences University • Ref: {record.letterData.refNo}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {downloadSuccess && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 font-medium animate-fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Saved to Downloads
              </span>
            )}

            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              id="btn-download-letter-pdf"
              data-testid="btn-download-pdf"
              type="button"
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded shadow-xs transition cursor-pointer disabled:opacity-60 ${
                isApproved
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white ring-1 ring-emerald-600/30'
                  : 'bg-stone-900 hover:bg-stone-800 text-white'
              }`}
              title="Download official PDF using jsPDF for institutional archival (Ctrl+S / Cmd+S)"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download as PDF</span>
                  <kbd className="hidden sm:inline-block font-mono text-[10px] bg-black/20 text-white px-1 py-0.2 rounded border border-white/20">
                    Ctrl+S
                  </kbd>
                </>
              )}
            </button>

            <button
              onClick={() => window.print()}
              id="btn-print-letter-modal"
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 rounded border border-stone-300 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>

            <button
              onClick={onClose}
              className="inline-flex items-center gap-1 text-stone-400 hover:text-stone-700 p-1.5 rounded transition cursor-pointer ml-1"
              aria-label="Close"
              title="Close modal (Esc)"
            >
              <kbd className="hidden sm:inline-block text-[10px] bg-stone-100 text-stone-500 border border-stone-300 px-1.5 py-0.5 rounded font-mono font-normal">
                Esc
              </kbd>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Archival Banner for Final Approved Letters */}
        {isApproved && (
          <div className="px-6 py-2.5 bg-emerald-50/95 border-b border-emerald-200 text-emerald-950 text-xs flex flex-wrap items-center justify-between gap-2 print:hidden">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Official Approved Document:</strong> Signed & sealed by Dean, SDSR. Use <strong>Download as PDF</strong> to archive this official record.
              </span>
            </div>
            {record.approvedDocumentReference && (
              <span className="font-mono text-[11px] bg-emerald-100/80 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300/60 font-medium">
                Archive Ref: {record.approvedDocumentReference}
              </span>
            )}
          </div>
        )}

        {/* Optional Error Alert */}
        {pdfError && (
          <div className="px-6 py-2 bg-red-50 border-b border-red-200 text-red-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{pdfError}</span>
            </div>
            <button
              onClick={() => setPdfError('')}
              className="text-red-600 hover:text-red-900 font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Scrollable Letter Document */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 flex justify-center bg-stone-200/60">
          <OfficialRpcLetter
            letterData={record.letterData}
            rpcRecord={record}
            isApproved={isApproved}
            showActions={false}
          />
        </div>
      </div>
    </div>
  );
};
