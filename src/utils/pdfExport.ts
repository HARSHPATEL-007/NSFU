import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { OfficialLetterData, RpcRecord } from '../types';

export interface PdfExportOptions {
  filename?: string;
  onStart?: () => void;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Generates a standard institutional filename for the RPC letter PDF.
 */
export function generateLetterPdfFilename(
  record?: RpcRecord,
  letterData?: OfficialLetterData
): string {
  const rpcNo = record?.rpcNumber || letterData?.rpcOrdinal || 'RPC';
  const scholarIdentifier =
    record?.enrollmentNo ||
    record?.scholarName?.replace(/[^a-zA-Z0-9]/g, '_') ||
    'Scholar';
  const statusSuffix = record?.status === 'APPROVED' ? 'APPROVED' : 'DRAFT';
  return `NFSU_SDSR_RPC_${rpcNo}_${scholarIdentifier}_${statusSuffix}.pdf`;
}

/**
 * Helper to reliably trigger file download in browsers & iframes
 */
export function triggerFileDownload(blob: Blob, filename: string): void {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (err) {
    console.warn('URL.createObjectURL download failed, fallback to direct open:', err);
  }
}

/**
 * Downloads a rendered HTML letter element as a high-resolution A4 PDF using jsPDF and html2canvas-pro.
 */
export async function downloadLetterElementAsPdf(
  element: HTMLElement,
  filename: string,
  record?: RpcRecord
): Promise<void> {
  // Capture the element as high-DPI canvas using html2canvas-pro (supports modern CSS / oklch / lab)
  const canvas = await html2canvas(element, {
    scale: 2, // 2x DPI scale ensures crisp vector-like text and official letterhead resolution
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: 0,
    windowWidth: Math.max(element.scrollWidth, 800),
    onclone: (clonedDoc, clonedEl) => {
      // Ensure elements marked with .print:hidden or action buttons are hidden in the canvas
      const printHidden = clonedEl.querySelectorAll(
        '.print\\:hidden, #btn-print-letter, #btn-download-letter, #btn-download-letter-pdf, #btn-download-letter-pdf-modal, button'
      );
      printHidden.forEach((item) => {
        (item as HTMLElement).style.display = 'none';
      });

      // Normalize cloned styling for crisp white paper output
      const el = clonedEl as HTMLElement;
      el.style.backgroundColor = '#ffffff';
      el.style.boxShadow = 'none';
      el.style.border = 'none';
      el.style.margin = '0 auto';
    },
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.98);

  // Standard A4 dimensions in mm: 210mm x 297mm
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 8; // 8mm margin around page for institutional border aesthetics
  const printableWidth = pageWidth - margin * 2;
  const printableHeight = pageHeight - margin * 2;

  // Calculate proportional height
  const imgWidth = printableWidth;
  const imgHeight = (canvas.height * printableWidth) / canvas.width;

  if (imgHeight <= printableHeight) {
    // Fits comfortably on a single A4 page
    pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight, undefined, 'FAST');
  } else {
    // Multi-page slicing for multi-page doctoral progress notifications
    let remainingHeight = imgHeight;
    let positionY = margin;

    pdf.addImage(imgData, 'JPEG', margin, positionY, imgWidth, imgHeight, undefined, 'FAST');
    remainingHeight -= printableHeight;

    while (remainingHeight > 0) {
      positionY = positionY - printableHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, positionY, imgWidth, imgHeight, undefined, 'FAST');
      remainingHeight -= printableHeight;
    }
  }

  // Set PDF document metadata for institutional archiving
  const rpcNo = record?.rpcNumber || 'RPC';
  const scholarName = record?.scholarName || 'Doctoral Scholar';
  pdf.setProperties({
    title: `NFSU SDSR RPC ${rpcNo} Approval Letter - ${scholarName}`,
    subject: 'Official Ph.D. Research Progress Committee Approval Notification',
    author: 'National Forensic Sciences University - School of Doctoral Studies & Research (SDSR)',
    keywords: 'NFSU, SDSR, RPC, Ph.D., Official Approval Letter, Archival Record',
    creator: 'NFSU SDSR RPC Digital Portal (jsPDF)',
  });

  // Reliably trigger download using Blob or direct save
  try {
    const pdfBlob = pdf.output('blob');
    triggerFileDownload(pdfBlob, filename);
  } catch {
    pdf.save(filename);
  }
}

/**
 * High-level helper to download an approved RPC letter as PDF.
 * If targetElement is provided, it captures that element.
 * Otherwise, it attempts to find '#nfsu-official-letter-sheet' in the DOM.
 */
export async function downloadApprovedRpcLetterPdf(
  record: RpcRecord,
  targetElement?: HTMLElement | null
): Promise<boolean> {
  const filename = generateLetterPdfFilename(record, record.letterData);
  const el = targetElement || document.getElementById('nfsu-official-letter-sheet');

  if (!el) {
    throw new Error('Letter document element not found in DOM.');
  }

  await downloadLetterElementAsPdf(el as HTMLElement, filename, record);
  return true;
}
