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
  const statusSuffix = record?.status === 'APPROVED' ? 'APPROVED' : 'OFFICIAL';
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
 * Downloads a rendered HTML letter element as a high-resolution, full-size A4 PDF using jsPDF and html2canvas-pro.
 * Ensures the letter fills standard A4 (210mm x 297mm) edge-to-edge without shrinking or double-margins.
 * Dean Approval signature (deansign.svg) is rendered crisply with lossless fidelity.
 */
export async function downloadLetterElementAsPdf(
  element: HTMLElement,
  filename: string,
  record?: RpcRecord
): Promise<void> {
  // Capture the element as high-DPI canvas using html2canvas-pro
  const canvas = await html2canvas(element, {
    scale: 2.5, // 2.5x DPI scale ensures crisp vector-like text, logos, and Dean approval signature
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: 0,
    windowWidth: 800,
    onclone: (_clonedDoc, clonedEl) => {
      // Ensure UI buttons, action bars, and print-hidden elements are hidden in the canvas
      const printHidden = clonedEl.querySelectorAll(
        '.print\\:hidden, #btn-print-letter, #btn-download-letter, #btn-download-letter-pdf, #btn-download-letter-docx, #btn-download-letter-png, button'
      );
      printHidden.forEach((item) => {
        (item as HTMLElement).style.display = 'none';
      });

      // Normalize cloned styling for crisp official white paper output
      const el = clonedEl as HTMLElement;
      el.style.backgroundColor = '#ffffff';
      el.style.boxShadow = 'none';
      el.style.border = 'none';
      el.style.margin = '0 auto';
      el.style.width = '800px';
      el.style.maxWidth = '800px';
      el.style.minHeight = 'auto'; // allow natural height so no false empty page is added
    },
  });

  // Lossless PNG data URL ensures fine serif strokes and the signature ink don't get JPEG artifacts
  const imgData = canvas.toDataURL('image/png');

  // Standard A4 dimensions in mm: 210mm x 297mm
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 210;
  const pageHeight = 297;

  // The HTML letter component already contains its own institutional paper padding.
  // Rendering full-width (210mm) with 0 external margin gives true fullsize A4 scaling!
  const imgWidth = pageWidth;
  const calculatedImgHeight = (canvas.height * pageWidth) / canvas.width;

  // If the letter fits within normal single A4 proportions (e.g. up to 308mm), fit it cleanly on a single fullsize page
  if (calculatedImgHeight <= 308) {
    const finalHeight = Math.min(calculatedImgHeight, pageHeight);
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, finalHeight, undefined, 'FAST');
  } else {
    // Multi-page slicing if letter exceeds page bounds
    let remainingHeight = calculatedImgHeight;
    let positionY = 0;

    pdf.addImage(imgData, 'PNG', 0, positionY, imgWidth, calculatedImgHeight, undefined, 'FAST');
    remainingHeight -= pageHeight;

    while (remainingHeight > 5) {
      positionY = positionY - pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, positionY, imgWidth, calculatedImgHeight, undefined, 'FAST');
      remainingHeight -= pageHeight;
    }
  }

  // Set PDF document metadata for institutional archiving
  const rpcNo = record?.rpcNumber || 'RPC';
  const scholarName = record?.scholarName || 'Doctoral Scholar';
  pdf.setProperties({
    title: `NFSU SDSR RPC ${rpcNo} Official Approval Letter - ${scholarName}`,
    subject: 'Official Ph.D. Research Progress Committee Approval Notification with Dean Signature',
    author: 'National Forensic Sciences University - School of Doctoral Studies & Research (SDSR)',
    keywords: 'NFSU, SDSR, RPC, Ph.D., Official Approval Letter, Dean Signature, Archival Record',
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
 * Downloads a rendered HTML letter element as a high-resolution PNG image.
 */
export async function downloadLetterElementAsImage(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2.5,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: 0,
    windowWidth: 800,
    onclone: (_clonedDoc, clonedEl) => {
      const printHidden = clonedEl.querySelectorAll(
        '.print\\:hidden, #btn-print-letter, #btn-download-letter, #btn-download-letter-pdf, #btn-download-letter-docx, #btn-download-letter-png, button'
      );
      printHidden.forEach((item) => {
        (item as HTMLElement).style.display = 'none';
      });
      const el = clonedEl as HTMLElement;
      el.style.backgroundColor = '#ffffff';
      el.style.boxShadow = 'none';
      el.style.border = 'none';
      el.style.margin = '0 auto';
      el.style.width = '800px';
      el.style.maxWidth = '800px';
      el.style.minHeight = 'auto';
    },
  });

  canvas.toBlob((blob) => {
    if (blob) {
      const imgFilename = filename.replace(/\.pdf$/i, '.png');
      triggerFileDownload(blob, imgFilename);
    }
  }, 'image/png');
}

/**
 * High-level helper to download an approved RPC letter as PDF.
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
