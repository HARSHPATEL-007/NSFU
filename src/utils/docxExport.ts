import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  VerticalAlign,
  ImageRun,
  Packer,
} from 'docx';
import { OfficialLetterData, RpcRecord } from '../types';
import { triggerFileDownload } from './pdfExport';

/**
 * Generates institutional filename for DOCX export
 */
export function generateLetterDocxFilename(
  record?: RpcRecord,
  letterData?: OfficialLetterData
): string {
  const rpcNo = record?.rpcNumber || letterData?.rpcOrdinal || 'RPC';
  const scholarIdentifier =
    record?.enrollmentNo ||
    record?.scholarName?.replace(/[^a-zA-Z0-9]/g, '_') ||
    'Scholar';
  const statusSuffix = record?.status === 'APPROVED' ? 'APPROVED' : 'OFFICIAL';
  return `NFSU_SDSR_RPC_${rpcNo}_${scholarIdentifier}_${statusSuffix}.docx`;
}

/**
 * Reliably loads an image as byte array for DOCX embedding.
 * Directly fetches PNG files as binary buffer (fast, crisp, 100% reliable in browsers & iframes).
 * Falls back to Image/Canvas rasterization if needed.
 */
export async function fetchImageAsPngBytes(
  url: string,
  targetWidth = 300,
  targetHeight = 120
): Promise<Uint8Array | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  // 1. Direct binary fetch for PNG files (fast, lossless, zero canvas taint)
  if (url.toLowerCase().endsWith('.png')) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        if (buf && buf.byteLength > 0) {
          return new Uint8Array(buf);
        }
      }
    } catch (e) {
      console.warn(`Direct fetch of ${url} failed, trying fallback:`, e);
    }
  }

  // 2. Fallback to Image and Canvas rendering (for SVG or other formats)
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth * 2;
          canvas.height = targetHeight * 2;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (!blob) return resolve(null);
            blob
              .arrayBuffer()
              .then((buf) => resolve(new Uint8Array(buf)))
              .catch(() => resolve(null));
          }, 'image/png');
        } catch {
          resolve(null);
        }
      };

      img.onerror = () => resolve(null);
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Generates and downloads an authentic, beautifully formatted Microsoft Word (.docx) document
 * of the official NFSU SDSR RPC Approval Letter that exactly matches the on-screen preview.
 */
export async function downloadApprovedRpcLetterDocx(
  record: RpcRecord,
  customLetterData?: OfficialLetterData,
  isApprovedOverride?: boolean
): Promise<void> {
  const letterData: OfficialLetterData = customLetterData || record.letterData || {
    refNo: `NFSU/SDSR/RPC/${String(record.rpcNumber || 1).padStart(2, '0')}/25`,
    date: record.rpcDate || '10/06/2025',
    schoolName: record.school || 'School of Pharmacy',
    schoolCampus: 'Gandhinagar',
    guideName: record.rpcMembers?.guide?.name || 'Prof. (Dr.) Manjunath Ghate',
    guideDesignation: record.rpcMembers?.guide?.designation || 'Professor, SPH',
    guideSchool: record.rpcMembers?.guide?.schoolOrInstitution || 'NFSU',
    internalExpertName: record.rpcMembers?.internalExpert?.name || 'Dr. Bhoomika Patel',
    internalExpertDesignation: record.rpcMembers?.internalExpert?.designation || 'Dean (I/C), SPH',
    internalExpertDept: record.rpcMembers?.internalExpert?.department || '',
    internalExpertCampus: record.rpcMembers?.internalExpert?.location || 'Gandhinagar',
    externalExpert1Name: record.rpcMembers?.externalExpert1?.name || 'Dr. Dhiraj Bhatia',
    externalExpert1Designation: record.rpcMembers?.externalExpert1?.designation || 'Associate Professor & INYAS-INSA Member',
    externalExpert1Dept: record.rpcMembers?.externalExpert1?.department || 'Department of Biological Science and Engineering',
    externalExpert1Inst: record.rpcMembers?.externalExpert1?.schoolOrInstitution || 'Indian Institute of Technology Gandhinagar',
    externalExpert1City: record.rpcMembers?.externalExpert1?.location || 'Gujarat',
    externalExpert2Name: record.rpcMembers?.externalExpert2?.name || 'Dr. Prakash Jha',
    externalExpert2Designation: record.rpcMembers?.externalExpert2?.designation || 'Professor & Dean',
    externalExpert2Dept: record.rpcMembers?.externalExpert2?.department || 'School of Applied Material Science',
    externalExpert2Inst: record.rpcMembers?.externalExpert2?.schoolOrInstitution || 'Central University of Gujarat',
    externalExpert2City: record.rpcMembers?.externalExpert2?.location || 'Gujarat',
    subject: `1st Meeting of the Research Progress Committee (RPC) for Ph.D. Scholar Registered under ${record.rpcMembers?.guide?.name || 'Prof. (Dr.) Manjunath Ghate'}, ${record.rpcMembers?.guide?.designation || 'Professor, SPH'}, NFSU.`,
    meetingDateText: record.rpcDate || '10th June, 2025',
    meetingTimeText: record.meetingTime || '12:00 Noon',
    meetingModeText: record.meetingMode?.toLowerCase() || 'online',
    meetingVenue: record.venue || '',
    scholarName: record.scholarName || 'Ms. Devanshi Lunagariya',
    rpcOrdinal: String(record.rpcNumber || '1'),
  };

  const isApproved = isApprovedOverride ?? (record.status === 'APPROVED');

  // Load authentic high-resolution PNG assets for DOCX embedding
  // Uses direct 300-DPI PNGs with fallback to SVGs
  const [mhaLogoBytes, nfsuLogoBytes, deanSignBytes] = await Promise.all([
    fetchImageAsPngBytes('/Ministry_of_Home_Affairs_India.png', 140, 55).then(
      (b) => b || fetchImageAsPngBytes('/Ministry_of_Home_Affairs_India.svg', 140, 55)
    ),
    fetchImageAsPngBytes('/nfsu-emblem.png', 65, 80).then(
      (b) => b || fetchImageAsPngBytes('/nfsu-emblem.svg', 65, 80)
    ),
    isApproved
      ? fetchImageAsPngBytes('/deansign.png', 180, 65).then(
          (b) => b || fetchImageAsPngBytes('/deansign.svg', 180, 65)
        )
      : Promise.resolve(null),
  ]);

  const cleanOrdinal = (ord: string) => {
    const trimmed = (ord || '1').trim();
    if (trimmed.endsWith('st') || trimmed.endsWith('nd') || trimmed.endsWith('rd') || trimmed.endsWith('th')) {
      return trimmed;
    }
    if (trimmed === '1') return '1st';
    if (trimmed === '2') return '2nd';
    if (trimmed === '3') return '3rd';
    return `${trimmed}th`;
  };

  const ordinalText = cleanOrdinal(letterData.rpcOrdinal);
  const scholarName = letterData.scholarName || record.scholarName || 'Doctoral Scholar';
  const schoolName = letterData.schoolName || record.school || 'School of Pharmacy';
  const meetingDate = letterData.meetingDateText || '10th June, 2025';
  const meetingTime = letterData.meetingTimeText || '12:00 Noon';
  const rawMode = (letterData.meetingModeText || 'online').replace(/\s*mode$/i, '').trim();
  const guideName = letterData.guideName || 'Prof. (Dr.) Manjunath Ghate';
  const guideDesignation = letterData.guideDesignation || 'Professor, SPH';

  // Format reference number
  const formattedRefNo = letterData.refNo
    ? letterData.refNo.replace(/^Ref:\s*No:\s*/i, '').trim()
    : `NFSU/SDSR/RPC/${String(record.rpcNumber || 1).padStart(2, '0')}/25`;

  // Standard document children array
  const docChildren: (Paragraph | Table)[] = [];

  // ==========================================
  // 1. Header Table (MHA Logo, Titles, NFSU Crest)
  // Symmetrically balanced so the University Titles are exactly in the center of the page
  // and equidistant between the two symbols:
  // Printable width on A4 with 720 dxa (0.5 in) margins is 10466 dxa (11906 - 1440)
  // Left symbol cell: 1600 dxa (MHA Emblem of India)
  // Right symbol cell: 1600 dxa (NFSU Official Crest)
  // Center titles cell: 7266 dxa (10466 - 1600 - 1600 = 7266 dxa)
  // Center of Center cell: 1600 + (7266 / 2) = 5233 dxa (exactly 10466 / 2, the true page center!)
  // ==========================================
  const sideWidthDxa = 1600;
  const centerWidthDxa = 7266;

  const headerLeftChildren: Paragraph[] = [];
  if (mhaLogoBytes) {
    headerLeftChildren.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new ImageRun({
            data: mhaLogoBytes,
            transformation: { width: 75, height: 29.5 },
            type: 'png',
          }),
        ],
      })
    );
  } else {
    headerLeftChildren.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({ text: 'गृह मंत्रालय', bold: true, size: 16, font: 'Times New Roman' }),
          new TextRun({ text: 'MINISTRY OF HOME AFFAIRS', break: 1, bold: true, size: 14, font: 'Times New Roman' }),
        ],
      })
    );
  }

  const headerCenterChildren: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 8 },
      children: [
        new TextRun({
          text: 'राष्ट्रीय न्यायालयिक विज्ञान विश्वविद्यालय',
          bold: true,
          size: 23,
          color: '15244C',
          font: 'Times New Roman',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 10 },
      children: [
        new TextRun({
          text: '(राष्ट्रीय महत्त्व का संस्थान, गृह मंत्रालय, भारत सरकार)',
          bold: true,
          size: 16.5,
          color: '1C1917',
          font: 'Times New Roman',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 8 },
      children: [
        new TextRun({
          text: 'National Forensic Sciences University',
          bold: true,
          size: 23,
          color: '15244C',
          font: 'Times New Roman',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 16 },
      children: [
        new TextRun({
          text: '(An Institution of National Importance under Ministry of Home Affairs, Government of India)',
          size: 15,
          color: '44403C',
          font: 'Times New Roman',
        }),
      ],
    }),
  ];

  const headerRightChildren: Paragraph[] = [];
  if (nfsuLogoBytes) {
    headerRightChildren.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new ImageRun({
            data: nfsuLogoBytes,
            transformation: { width: 42.5, height: 52 },
            type: 'png',
          }),
        ],
      })
    );
  } else {
    headerRightChildren.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: 'NFSU Crest', bold: true, size: 16, font: 'Times New Roman' }),
        ],
      })
    );
  }

  const headerTable = new Table({
    width: { size: 10466, type: WidthType.DXA },
    columnWidths: [sideWidthDxa, centerWidthDxa, sideWidthDxa],
    alignment: AlignmentType.CENTER,
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.SINGLE, size: 12, color: '1C1917' },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: sideWidthDxa, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            margins: { bottom: 40, top: 20 },
            children: headerLeftChildren,
          }),
          new TableCell({
            width: { size: centerWidthDxa, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            margins: { bottom: 40, top: 20, left: 30, right: 30 },
            children: headerCenterChildren,
          }),
          new TableCell({
            width: { size: sideWidthDxa, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            margins: { bottom: 40, top: 20 },
            children: headerRightChildren,
          }),
        ],
      }),
    ],
  });

  docChildren.push(headerTable);

  // ==========================================
  // 2. Reference & Date Line (Matches Preview)
  // ==========================================
  const refDateTable = new Table({
    width: { size: 10466, type: WidthType.DXA },
    columnWidths: [6666, 3800],
    alignment: AlignmentType.CENTER,
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 6666, type: WidthType.DXA },
            margins: { top: 70, bottom: 70 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Ref: No: ', bold: true, size: 20, font: 'Times New Roman' }),
                  new TextRun({ text: formattedRefNo, bold: true, size: 20, font: 'Times New Roman' }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 3800, type: WidthType.DXA },
            margins: { top: 70, bottom: 70 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Date: ', bold: true, size: 20, font: 'Times New Roman' }),
                  new TextRun({ text: letterData.date || '10/06/2025', bold: true, size: 20, font: 'Times New Roman' }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  docChildren.push(refDateTable);

  // ==========================================
  // 3. Addressees ("To,++") - Exactly matches numbered list layout in Preview
  // ==========================================
  docChildren.push(
    new Paragraph({
      spacing: { before: 40, after: 25 },
      children: [new TextRun({ text: 'To,++', bold: true, size: 20, font: 'Times New Roman' })],
    })
  );

  // Member 1: Dean
  docChildren.push(
    new Paragraph({
      spacing: { after: 25 },
      indent: { left: 450, hanging: 240 },
      children: [
        new TextRun({ text: '1.\tDean', bold: true, size: 20, font: 'Times New Roman' }),
        new TextRun({ text: schoolName, break: 1, bold: true, size: 20, font: 'Times New Roman' }),
        new TextRun({ text: `NFSU, ${letterData.schoolCampus || 'Gandhinagar'}`, break: 1, bold: true, size: 20, font: 'Times New Roman' }),
      ],
    })
  );

  // Member 2: Guide
  docChildren.push(
    new Paragraph({
      spacing: { after: 25 },
      indent: { left: 450, hanging: 240 },
      children: [
        new TextRun({ text: `2.\t${guideName}`, bold: true, size: 20, font: 'Times New Roman' }),
        new TextRun({ text: guideDesignation, break: 1, bold: true, size: 20, font: 'Times New Roman' }),
        new TextRun({ text: 'NFSU', break: 1, bold: true, size: 20, font: 'Times New Roman' }),
      ],
    })
  );

  // Member 3: Internal Expert
  const internalExpertCampusStr = letterData.internalExpertCampus
    ? `, ${letterData.internalExpertCampus.replace(/^NFSU,\s*/i, '')}`
    : ', Gandhinagar';

  docChildren.push(
    new Paragraph({
      spacing: { after: 25 },
      indent: { left: 450, hanging: 240 },
      children: [
        new TextRun({
          text: `3.\t${letterData.internalExpertName || 'Dr. Bhoomika Patel'} (Internal Expert Member).`,
          bold: true,
          size: 20,
          font: 'Times New Roman',
        }),
        new TextRun({
          text: letterData.internalExpertDesignation || 'Dean (I/C), SPH',
          break: 1,
          bold: true,
          size: 20,
          font: 'Times New Roman',
        }),
        new TextRun({
          text: `${letterData.internalExpertDept ? `${letterData.internalExpertDept}, ` : ''}NFSU${internalExpertCampusStr}`,
          break: 1,
          bold: true,
          size: 20,
          font: 'Times New Roman',
        }),
      ],
    })
  );

  // Member 4: External Expert 1
  docChildren.push(
    new Paragraph({
      spacing: { after: 25 },
      indent: { left: 450, hanging: 240 },
      children: [
        new TextRun({
          text: `4.\t${letterData.externalExpert1Name || 'Dr. Dhiraj Bhatia'} (External Expert Member)`,
          bold: true,
          size: 20,
          font: 'Times New Roman',
        }),
        new TextRun({
          text: letterData.externalExpert1Designation || 'Associate Professor & INYAS-INSA Member',
          break: 1,
          bold: true,
          size: 20,
          font: 'Times New Roman',
        }),
        new TextRun({
          text: letterData.externalExpert1Dept || 'Department of Biological Science and Engineering',
          break: 1,
          bold: true,
          size: 20,
          font: 'Times New Roman',
        }),
        new TextRun({
          text: letterData.externalExpert1Inst || 'Indian Institute of Technology Gandhinagar',
          break: 1,
          bold: true,
          size: 20,
          font: 'Times New Roman',
        }),
        new TextRun({
          text: letterData.externalExpert1City || 'Gujarat',
          break: 1,
          bold: true,
          size: 20,
          font: 'Times New Roman',
        }),
      ],
    })
  );

  // Member 5: External Expert 2
  const member5Runs = [
    new TextRun({
      text: `5.\t${letterData.externalExpert2Name || 'Dr. Prakash Jha'} (External Expert Member).`,
      bold: true,
      size: 20,
      font: 'Times New Roman',
    }),
    new TextRun({
      text: letterData.externalExpert2Designation || 'Professor & Dean',
      break: 1,
      bold: true,
      size: 20,
      font: 'Times New Roman',
    }),
    new TextRun({
      text: letterData.externalExpert2Dept || 'School of Applied Material Science',
      break: 1,
      bold: true,
      size: 20,
      font: 'Times New Roman',
    }),
    new TextRun({
      text: letterData.externalExpert2Inst || 'Central University of Gujarat',
      break: 1,
      bold: true,
      size: 20,
      font: 'Times New Roman',
    }),
  ];

  if (
    letterData.externalExpert2City &&
    letterData.externalExpert2City !== 'Gandhinagar' &&
    letterData.externalExpert2City !== 'Gujarat'
  ) {
    member5Runs.push(
      new TextRun({
        text: letterData.externalExpert2City,
        break: 1,
        bold: true,
        size: 20,
        font: 'Times New Roman',
      })
    );
  }

  docChildren.push(
    new Paragraph({
      spacing: { after: 40 },
      indent: { left: 450, hanging: 240 },
      children: member5Runs,
    })
  );

  // ==========================================
  // 4. Subject Line
  // ==========================================
  const subjectText =
    letterData.subject ||
    `${ordinalText} Meeting of the Research Progress Committee (RPC) for Ph.D. Scholar Registered under ${guideName}, ${guideDesignation}, NFSU.`;

  docChildren.push(
    new Paragraph({
      spacing: { before: 40, after: 40 },
      children: [
        new TextRun({ text: 'Subject: ', bold: true, size: 20, font: 'Times New Roman' }),
        new TextRun({ text: subjectText, bold: true, size: 20, font: 'Times New Roman' }),
      ],
    })
  );

  // ==========================================
  // 5. Salutation & Body
  // ==========================================
  docChildren.push(
    new Paragraph({
      spacing: { after: 30 },
      children: [new TextRun({ text: 'Dear Sir/Madam,', size: 20, font: 'Times New Roman' })],
    })
  );

  docChildren.push(
    new Paragraph({
      spacing: { after: 30 },
      children: [
        new TextRun({ text: 'The meeting of ', size: 20, font: 'Times New Roman' }),
        new TextRun({ text: 'Research Progress Committee (RPC)', bold: true, size: 20, font: 'Times New Roman' }),
        new TextRun({ text: ' for undernoted Ph.D. ', size: 20, font: 'Times New Roman' }),
        new TextRun({ text: schoolName, bold: true, size: 20, font: 'Times New Roman' }),
        new TextRun({ text: ' NFSU is scheduled on ', size: 20, font: 'Times New Roman' }),
        new TextRun({ text: `${meetingDate} from ${meetingTime}`, bold: true, size: 20, font: 'Times New Roman' }),
        new TextRun({ text: ' onwards through ', size: 20, font: 'Times New Roman' }),
        new TextRun({ text: rawMode, bold: true, size: 20, font: 'Times New Roman' }),
        new TextRun({ text: ' mode', size: 20, font: 'Times New Roman' }),
        new TextRun({
          text: letterData.meetingVenue && rawMode.toLowerCase() !== 'online' ? ` at ${letterData.meetingVenue}.` : '.',
          size: 20,
          font: 'Times New Roman',
        }),
      ],
    })
  );

  // Bullet Point: Scholar Info (Indented with bold bullet)
  docChildren.push(
    new Paragraph({
      spacing: { before: 20, after: 30 },
      indent: { left: 450 },
      children: [
        new TextRun({ text: '•  ', bold: true, size: 21, font: 'Times New Roman' }),
        new TextRun({
          text: `Name of Ph.D. Scholar- ${scholarName} (${ordinalText}RPC)`,
          bold: true,
          size: 20,
          font: 'Times New Roman',
        }),
      ],
    })
  );

  docChildren.push(
    new Paragraph({
      spacing: { after: 25 },
      children: [
        new TextRun({
          text: 'Your presence and valuable suggestions are highly appreciated. Kindly make it convenient to attend the meeting.',
          size: 20,
          font: 'Times New Roman',
        }),
      ],
    })
  );

  docChildren.push(
    new Paragraph({
      spacing: { after: 30 },
      children: [new TextRun({ text: 'Thanking you,', size: 20, font: 'Times New Roman' })],
    })
  );

  // ==========================================
  // 6. Dean Signatory Block (Right Aligned)
  // ==========================================
  const signBlockChildren: Paragraph[] = [];

  if (deanSignBytes) {
    signBlockChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: deanSignBytes,
            transformation: { width: 120, height: 42 },
            type: 'png',
          }),
        ],
      })
    );
  } else {
    signBlockChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 140, after: 20 },
        children: [
          new TextRun({
            text: isApproved ? 'Approved by Dean, SDSR' : '',
            italics: true,
            size: 17,
            color: '666666',
            font: 'Times New Roman',
          }),
        ],
      })
    );
  }

  signBlockChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'Dean', bold: true, size: 20, font: 'Times New Roman' }),
        new TextRun({ text: 'School of Doctoral Studies and Research', break: 1, bold: true, size: 20, font: 'Times New Roman' }),
      ],
    })
  );

  const signatoryTable = new Table({
    width: { size: 10466, type: WidthType.DXA },
    columnWidths: [5700, 4766],
    alignment: AlignmentType.CENTER,
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 5700, type: WidthType.DXA },
            children: [new Paragraph({ children: [] })],
          }),
          new TableCell({
            width: { size: 4766, type: WidthType.DXA },
            children: signBlockChildren,
          }),
        ],
      }),
    ],
  });

  docChildren.push(signatoryTable);

  // ==========================================
  // 7. Copy to Section (Matches Preview)
  // ==========================================
  docChildren.push(
    new Paragraph({
      spacing: { before: 40, after: 15 },
      children: [new TextRun({ text: 'Copy to:', bold: true, size: 19, font: 'Times New Roman' })],
    })
  );

  docChildren.push(
    new Paragraph({
      spacing: { after: 60 },
      indent: { left: 300 },
      children: [
        new TextRun({ text: '1.\tAssociate Dean- SDSR', bold: true, size: 19, font: 'Times New Roman' }),
      ],
    })
  );

  // ==========================================
  // 8. Footer Section with Dividing Line (Matches Preview)
  // ==========================================
  const footerTable = new Table({
    width: { size: 10466, type: WidthType.DXA },
    columnWidths: [5700, 4766],
    alignment: AlignmentType.CENTER,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 10, color: '1C1917' },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 5700, type: WidthType.DXA },
            margins: { top: 50 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'National Forensic Sciences University',
                    bold: true,
                    size: 17,
                    color: '15244C',
                    font: 'Times New Roman',
                  }),
                  new TextRun({
                    text: 'School of Doctoral Studies & Research',
                    break: 1,
                    size: 16,
                    color: '1C355E',
                    font: 'Times New Roman',
                  }),
                  new TextRun({
                    text: 'Sector-9, Gandhinagar, Gujarat – 382 007',
                    break: 1,
                    size: 16,
                    color: '1C355E',
                    font: 'Times New Roman',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 4766, type: WidthType.DXA },
            margins: { top: 50 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Tel: +91-79-23977104, Fax: +91-723247465',
                    size: 16,
                    color: '1C355E',
                    font: 'Times New Roman',
                  }),
                  new TextRun({
                    text: 'Email: phd@nfsu.ac.in',
                    break: 1,
                    size: 16,
                    color: '1C355E',
                    font: 'Times New Roman',
                  }),
                  new TextRun({
                    text: 'Website: nfsu.ac.in',
                    break: 1,
                    size: 16,
                    color: '1C355E',
                    font: 'Times New Roman',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  docChildren.push(footerTable);

  // ==========================================
  // Assemble Document with A4 Dimensions & Proportions
  // ==========================================
  const doc = new Document({
    creator: 'NFSU SDSR RPC Digital Portal',
    title: `NFSU SDSR RPC ${ordinalText} Approval Letter - ${scholarName}`,
    description: 'Official Ph.D. Research Progress Committee Approval Notification with Dean Signature',
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906, // A4 width: 210mm in dxa
              height: 16838, // A4 height: 297mm in dxa
            },
            margin: {
              top: 720, // 0.5 in (~12.7mm)
              bottom: 720,
              left: 720, // ~12.7mm (0.5 in)
              right: 720,
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  const docxBlob = await Packer.toBlob(doc);
  const filename = generateLetterDocxFilename(record, letterData);
  triggerFileDownload(docxBlob, filename);
}
