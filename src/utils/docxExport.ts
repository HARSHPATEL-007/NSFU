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
  ImageRun,
  Packer,
  HeadingLevel,
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
 * Helper to convert an image or SVG URL to PNG byte array in browser
 */
export async function fetchImageAsPngBytes(
  url: string,
  targetWidth = 300,
  targetHeight = 120
): Promise<Uint8Array | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth * 2; // 2x DPI for sharp high-res rendering
          canvas.height = targetHeight * 2;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(null);
          }
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
 * of the official NFSU SDSR RPC Approval Letter.
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

  // Attempt to load authentic images for DOCX embedding
  const [mhaLogoBytes, nfsuLogoBytes, deanSignBytes] = await Promise.all([
    fetchImageAsPngBytes('/Ministry_of_Home_Affairs_India.svg', 160, 60),
    fetchImageAsPngBytes('/nfsu-emblem.svg', 80, 100),
    isApproved ? fetchImageAsPngBytes('/deansign.svg', 220, 85) : Promise.resolve(null),
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
  // ==========================================
  const headerLeftChildren: Paragraph[] = [];
  if (mhaLogoBytes) {
    headerLeftChildren.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: mhaLogoBytes,
            transformation: { width: 140, height: 55 },
            type: 'png',
          }),
        ],
      })
    );
  } else {
    headerLeftChildren.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'गृह मंत्रालय\n', bold: true, size: 18, font: 'Times New Roman' }),
          new TextRun({ text: 'MINISTRY OF HOME AFFAIRS', bold: true, size: 16, font: 'Times New Roman' }),
        ],
      })
    );
  }

  const headerCenterChildren: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'राष्ट्रीय न्यायालयिक विज्ञान विश्वविद्यालय',
          bold: true,
          size: 26,
          color: '15244C',
          font: 'Times New Roman',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: '(राष्ट्रीय महत्त्व का संस्थान, गृह मंत्रालय, भारत सरकार)',
          bold: true,
          size: 19,
          color: '1C1917',
          font: 'Times New Roman',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'National Forensic Sciences University',
          bold: true,
          size: 26,
          color: '15244C',
          font: 'Times New Roman',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: '(An Institution of National Importance under Ministry of Home Affairs, Government of India)',
          size: 18,
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
            transformation: { width: 65, height: 80 },
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
          new TextRun({ text: 'NFSU Crest', bold: true, size: 18, font: 'Times New Roman' }),
        ],
      })
    );
  }

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.SINGLE, size: 16, color: '1C1917' },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 24, type: WidthType.PERCENTAGE },
            margins: { bottom: 120 },
            children: headerLeftChildren,
          }),
          new TableCell({
            width: { size: 62, type: WidthType.PERCENTAGE },
            margins: { bottom: 120 },
            children: headerCenterChildren,
          }),
          new TableCell({
            width: { size: 14, type: WidthType.PERCENTAGE },
            margins: { bottom: 120 },
            children: headerRightChildren,
          }),
        ],
      }),
    ],
  });

  docChildren.push(headerTable);

  // ==========================================
  // 2. Reference & Date Line
  // ==========================================
  const refDateTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
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
            width: { size: 65, type: WidthType.PERCENTAGE },
            margins: { top: 180, bottom: 180 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Ref: No: ', bold: true, size: 22, font: 'Times New Roman' }),
                  new TextRun({ text: formattedRefNo, bold: true, size: 22, font: 'Times New Roman' }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            margins: { top: 180, bottom: 180 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Date: ', bold: true, size: 22, font: 'Times New Roman' }),
                  new TextRun({ text: letterData.date || '10/06/2025', bold: true, size: 22, font: 'Times New Roman' }),
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
  // 3. Addressees ("To,++")
  // ==========================================
  docChildren.push(
    new Paragraph({
      spacing: { before: 100, after: 80 },
      children: [new TextRun({ text: 'To,++', bold: true, size: 22, font: 'Times New Roman' })],
    })
  );

  // Member 1: Dean
  docChildren.push(
    new Paragraph({
      spacing: { after: 60 },
      indent: { left: 400 },
      children: [
        new TextRun({ text: '1.\tDean\n\t', bold: true, size: 22, font: 'Times New Roman' }),
        new TextRun({ text: `${schoolName}\n\t`, bold: true, size: 22, font: 'Times New Roman' }),
        new TextRun({ text: `NFSU, ${letterData.schoolCampus || 'Gandhinagar'}`, bold: true, size: 22, font: 'Times New Roman' }),
      ],
    })
  );

  // Member 2: Guide
  docChildren.push(
    new Paragraph({
      spacing: { after: 60 },
      indent: { left: 400 },
      children: [
        new TextRun({ text: `2.\t${guideName}\n\t`, bold: true, size: 22, font: 'Times New Roman' }),
        new TextRun({ text: `${guideDesignation}\n\t`, bold: true, size: 22, font: 'Times New Roman' }),
        new TextRun({ text: 'NFSU', bold: true, size: 22, font: 'Times New Roman' }),
      ],
    })
  );

  // Member 3: Internal Expert
  docChildren.push(
    new Paragraph({
      spacing: { after: 60 },
      indent: { left: 400 },
      children: [
        new TextRun({ text: `3.\t${letterData.internalExpertName || 'Dr. Bhoomika Patel'} (Internal Expert Member).\n\t`, bold: true, size: 22, font: 'Times New Roman' }),
        new TextRun({ text: `${letterData.internalExpertDesignation || 'Dean (I/C), SPH'}\n\t`, bold: true, size: 22, font: 'Times New Roman' }),
        new TextRun({
          text: `${letterData.internalExpertDept ? `${letterData.internalExpertDept}, ` : ''}NFSU, ${letterData.internalExpertCampus || 'Gandhinagar'}`,
          bold: true,
          size: 22,
          font: 'Times New Roman',
        }),
      ],
    })
  );

  // Member 4: External Expert 1
  docChildren.push(
    new Paragraph({
      spacing: { after: 60 },
      indent: { left: 400 },
      children: [
        new TextRun({ text: `4.\t${letterData.externalExpert1Name || 'Dr. Dhiraj Bhatia'} (External Expert Member)\n\t`, bold: true, size: 22, font: 'Times New Roman' }),
        new TextRun({ text: `${letterData.externalExpert1Designation || 'Associate Professor & INYAS-INSA Member'}\n\t`, bold: true, size: 22, font: 'Times New Roman' }),
        new TextRun({ text: `${letterData.externalExpert1Dept || 'Department of Biological Science and Engineering'}\n\t`, bold: true, size: 22, font: 'Times New Roman' }),
        new TextRun({ text: `${letterData.externalExpert1Inst || 'Indian Institute of Technology Gandhinagar'}\n\t`, bold: true, size: 22, font: 'Times New Roman' }),
        new TextRun({ text: letterData.externalExpert1City || 'Gujarat', bold: true, size: 22, font: 'Times New Roman' }),
      ],
    })
  );

  // Member 5: External Expert 2
  docChildren.push(
    new Paragraph({
      spacing: { after: 140 },
      indent: { left: 400 },
      children: [
        new TextRun({ text: `5.\t${letterData.externalExpert2Name || 'Dr. Prakash Jha'} (External Expert Member).\n\t`, bold: true, size: 22, font: 'Times New Roman' }),
        new TextRun({ text: `${letterData.externalExpert2Designation || 'Professor & Dean'}\n\t`, bold: true, size: 22, font: 'Times New Roman' }),
        new TextRun({ text: `${letterData.externalExpert2Dept || 'School of Applied Material Science'}\n\t`, bold: true, size: 22, font: 'Times New Roman' }),
        new TextRun({ text: `${letterData.externalExpert2Inst || 'Central University of Gujarat'}`, bold: true, size: 22, font: 'Times New Roman' }),
        ...(letterData.externalExpert2City && letterData.externalExpert2City !== 'Gandhinagar' && letterData.externalExpert2City !== 'Gujarat'
          ? [new TextRun({ text: `\n\t${letterData.externalExpert2City}`, bold: true, size: 22, font: 'Times New Roman' })]
          : []),
      ],
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
      spacing: { before: 100, after: 120 },
      children: [
        new TextRun({ text: 'Subject: ', bold: true, size: 22, font: 'Times New Roman' }),
        new TextRun({ text: subjectText, bold: true, size: 22, font: 'Times New Roman' }),
      ],
    })
  );

  // ==========================================
  // 5. Salutation & Body
  // ==========================================
  docChildren.push(
    new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ text: 'Dear Sir/Madam,', size: 22, font: 'Times New Roman' })],
    })
  );

  docChildren.push(
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({ text: 'The meeting of ', size: 22, font: 'Times New Roman' }),
        new TextRun({ text: 'Research Progress Committee (RPC)', bold: true, size: 22, font: 'Times New Roman' }),
        new TextRun({ text: ' for undernoted Ph.D. ', size: 22, font: 'Times New Roman' }),
        new TextRun({ text: schoolName, bold: true, size: 22, font: 'Times New Roman' }),
        new TextRun({ text: ' NFSU is scheduled on ', size: 22, font: 'Times New Roman' }),
        new TextRun({ text: `${meetingDate} from ${meetingTime}`, bold: true, size: 22, font: 'Times New Roman' }),
        new TextRun({ text: ' onwards through ', size: 22, font: 'Times New Roman' }),
        new TextRun({ text: rawMode, bold: true, size: 22, font: 'Times New Roman' }),
        new TextRun({ text: ' mode', size: 22, font: 'Times New Roman' }),
        new TextRun({
          text: letterData.meetingVenue && rawMode.toLowerCase() !== 'online' ? ` at ${letterData.meetingVenue}.` : '.',
          size: 22,
          font: 'Times New Roman',
        }),
      ],
    })
  );

  // Bullet Point: Scholar Info
  docChildren.push(
    new Paragraph({
      spacing: { before: 80, after: 100 },
      indent: { left: 720 },
      children: [
        new TextRun({ text: '•  ', bold: true, size: 24, font: 'Times New Roman' }),
        new TextRun({
          text: `Name of Ph.D. Scholar- ${scholarName} (${ordinalText}RPC)`,
          bold: true,
          size: 22,
          font: 'Times New Roman',
        }),
      ],
    })
  );

  docChildren.push(
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: 'Your presence and valuable suggestions are highly appreciated. Kindly make it convenient to attend the meeting.',
          size: 22,
          font: 'Times New Roman',
        }),
      ],
    })
  );

  docChildren.push(
    new Paragraph({
      spacing: { after: 140 },
      children: [new TextRun({ text: 'Thanking you,', size: 22, font: 'Times New Roman' })],
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
            transformation: { width: 140, height: 50 },
            type: 'png',
          }),
        ],
      })
    );
  } else {
    signBlockChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 80 },
        children: [
          new TextRun({
            text: isApproved ? 'Approved by Dean, SDSR' : '',
            italics: true,
            size: 18,
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
        new TextRun({ text: 'Dean\n', bold: true, size: 22, font: 'Times New Roman' }),
        new TextRun({ text: 'School of Doctoral Studies and Research', bold: true, size: 22, font: 'Times New Roman' }),
      ],
    })
  );

  const signatoryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
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
            width: { size: 55, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [] })],
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: signBlockChildren,
          }),
        ],
      }),
    ],
  });

  docChildren.push(signatoryTable);

  // ==========================================
  // 7. Copy to Section
  // ==========================================
  docChildren.push(
    new Paragraph({
      spacing: { before: 180, after: 40 },
      children: [new TextRun({ text: 'Copy to:', bold: true, size: 22, font: 'Times New Roman' })],
    })
  );

  docChildren.push(
    new Paragraph({
      spacing: { after: 200 },
      indent: { left: 400 },
      children: [
        new TextRun({ text: '1.\tAssociate Dean- SDSR', bold: true, size: 22, font: 'Times New Roman' }),
      ],
    })
  );

  // ==========================================
  // 8. Footer Section with Dividing Line
  // ==========================================
  const footerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 12, color: '1C1917' },
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
            width: { size: 55, type: WidthType.PERCENTAGE },
            margins: { top: 100 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'National Forensic Sciences University\n',
                    bold: true,
                    size: 19,
                    color: '15244C',
                    font: 'Times New Roman',
                  }),
                  new TextRun({
                    text: 'School of Doctoral Studies & Research\nSector-9, Gandhinagar, Gujarat – 382 007',
                    size: 18,
                    color: '1C355E',
                    font: 'Times New Roman',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            margins: { top: 100 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Tel: +91-79-23977104, Fax: +91-723247465\n',
                    size: 18,
                    color: '1C355E',
                    font: 'Times New Roman',
                  }),
                  new TextRun({
                    text: 'Email: phd@nfsu.ac.in\nWebsite: nfsu.ac.in',
                    size: 18,
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
  // Assemble Document
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
              top: 1000, // ~17.6mm
              bottom: 1000,
              left: 1134, // ~20mm
              right: 1134,
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
