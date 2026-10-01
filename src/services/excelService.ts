import * as XLSX from 'xlsx';
import { Scholar, RpcRecord, RpcMember } from '../types';
import { DEMO_MEMBERS } from '../data/initialDemoData';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface ParsedScholarRow {
  rowIndex: number;
  isValid: boolean;
  errors: string[];
  scholar: Scholar;
  isExisting?: boolean;
}

export interface ParsedRpcRow {
  rowIndex: number;
  isValid: boolean;
  errors: string[];
  enrollmentNo: string;
  scholarName?: string;
  school?: string;
  department?: string;
  rpcNumber: number;
  rpcDate: string;
  meetingTime: string;
  meetingMode: 'ONLINE' | 'OFFLINE' | 'HYBRID';
  venue: string;
  guideName?: string;
  guideDesignation?: string;
  guideSchool?: string;
  guideEmail?: string;
  coGuideName?: string;
  researchTopic?: string;
  internalExpertName?: string;
  internalExpertDesignation?: string;
  internalExpertDepartment?: string;
  internalExpertDept?: string;
  internalExpertLocation?: string;
  internalExpertCampus?: string;
  externalExpert1Name?: string;
  externalExpert1Designation?: string;
  externalExpert1Department?: string;
  externalExpert1Dept?: string;
  externalExpert1Institution?: string;
  externalExpert1Inst?: string;
  externalExpert1Location?: string;
  externalExpert1City?: string;
  externalExpert2Name?: string;
  externalExpert2Designation?: string;
  externalExpert2Department?: string;
  externalExpert2Dept?: string;
  externalExpert2Institution?: string;
  externalExpert2Inst?: string;
  externalExpert2Location?: string;
  externalExpert2City?: string;
  notes?: string;
}

export interface ExcelParseResult {
  fileName: string;
  sheetNames: string[];
  detectedType: 'SCHOLARS' | 'RPC_REQUESTS' | 'COMBINED';
  scholarRows: ParsedScholarRow[];
  rpcRows: ParsedRpcRow[];
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
}

export interface LoadedExcelSheet {
  id: string; // unique key `${fileId}::${sheetName}`
  fileId: string;
  fileName: string;
  sheetName: string;
  detectedType: 'SCHOLARS' | 'RPC_REQUESTS' | 'COMBINED';
  scholarRows: ParsedScholarRow[];
  rpcRows: ParsedRpcRow[];
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  isLoaded: boolean; // toggleable: true if active, false if unloaded
  loadedAt: string;
}

export interface LoadedExcelFile {
  fileId: string;
  fileName: string;
  fileSize: number;
  sheets: LoadedExcelSheet[];
  uploadedAt: string;
}

// Clean and normalize column header
function normalizeHeader(header: any): string {
  if (!header) return '';
  return String(header)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Format date value (handling Excel serial numbers or text)
function formatExcelDate(value: any): string {
  if (!value) return '';
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    return value.toISOString().split('T')[0];
  }
  if (typeof value === 'number') {
    // Excel date serial number to JS Date
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  const str = String(value).trim();
  // Try parsing YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  // Try DD/MM/YYYY or DD-MM-YYYY
  const parts = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (parts) {
    const day = parts[1].padStart(2, '0');
    const month = parts[2].padStart(2, '0');
    const year = parts[3];
    return `${year}-${month}-${day}`;
  }
  return str;
}

export function parseSingleSheetData(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  existingMap: Map<string, Scholar>
): {
  scholarRows: ParsedScholarRow[];
  rpcRows: ParsedRpcRow[];
  detectedType: 'SCHOLARS' | 'RPC_REQUESTS' | 'COMBINED';
} {
  const scholarRows: ParsedScholarRow[] = [];
  const rpcRows: ParsedRpcRow[] = [];
  let detectedType: 'SCHOLARS' | 'RPC_REQUESTS' | 'COMBINED' = 'SCHOLARS';

  const rawData = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: '' });
  if (!rawData || rawData.length < 2) {
    return { scholarRows, rpcRows, detectedType };
  }

  const rawHeaders: string[] = rawData[0] || [];
  const normalizedHeaders = rawHeaders.map(normalizeHeader);

  // Check if header is something like "01 RPC", "1st RPC", "RPC 01"
  let detectedRpcStageFromHeader: number | undefined = undefined;
  rawHeaders.forEach((rawH) => {
    const str = String(rawH).trim();
    const rpcMatch = str.match(/(\d+)\s*(?:st|nd|rd|th)?\s*rpc/i) || str.match(/rpc\s*(\d+)/i);
    if (rpcMatch) {
      detectedRpcStageFromHeader = parseInt(rpcMatch[1], 10);
    }
  });

  // Detect if this sheet is Scholars or RPC Requests
  const isRpcSheet =
    detectedRpcStageFromHeader !== undefined ||
    normalizedHeaders.some((h) =>
      h.includes('rpcnumber') ||
      h.includes('rpcstage') ||
      h.includes('rpcletter') ||
      h.includes('internalexpert') ||
      h.includes('externalexpert') ||
      (h.includes('rpc') && !h.includes('currentrpc'))
    ) ||
    sheetName.toLowerCase().includes('rpc') ||
    sheetName.toLowerCase().includes('schedule');

  if (isRpcSheet) {
    detectedType = 'RPC_REQUESTS';
  }

  // Map column index to field
  const colMap: Record<string, number> = {};

  normalizedHeaders.forEach((h, idx) => {
    // Enrollment / Registration / Roll No
    if (
      h.includes('enroll') ||
      h.includes('regno') ||
      h.includes('registrationno') ||
      h.includes('rollno') ||
      h.includes('enrolment') ||
      (h === 'id' && colMap['enrollmentNo'] === undefined)
    ) {
      if (colMap['enrollmentNo'] === undefined) colMap['enrollmentNo'] = idx;
    }
    // Scholar Name (e.g. "Scholar Name", "Candidate Name", "Student Name", "Name")
    else if (
      h.includes('scholarname') ||
      h.includes('studentname') ||
      h.includes('candidatename') ||
      h === 'name' ||
      (h.includes('name') && !h.includes('guide') && !h.includes('expert') && !h.includes('school') && !h.includes('dept') && colMap['name'] === undefined)
    ) {
      if (colMap['name'] === undefined) colMap['name'] = idx;
    }
    // School (e.g. "Name of School", "School", "Institute")
    else if (h.includes('nameofschool') || h.includes('institute') || (h.includes('school') && !h.includes('guide') && colMap['school'] === undefined)) {
      if (colMap['school'] === undefined) colMap['school'] = idx;
    }
    // Department
    else if (h.includes('department') || h.includes('dept') || h.includes('discipline') || h.includes('branch')) {
      if (colMap['department'] === undefined) colMap['department'] = idx;
    }
    // Guide Name
    else if (
      h.includes('guidename') ||
      h.includes('supervisorname') ||
      h.includes('researchguide') ||
      h.includes('nameofguide') ||
      (h.includes('guide') && !h.includes('email') && !h.includes('desig') && !h.includes('school') && !h.includes('co') && colMap['guideName'] === undefined) ||
      (h === 'supervisor' && colMap['guideName'] === undefined)
    ) {
      if (colMap['guideName'] === undefined) colMap['guideName'] = idx;
    }
    // Guide Designation
    else if (h.includes('guidedesig') || h.includes('supervisordesig') || h.includes('guidedesignation') || h.includes('supervisordesignation')) {
      colMap['guideDesignation'] = idx;
    }
    // Guide Email
    else if (h.includes('guideemail') || h.includes('supervisoremail')) {
      colMap['guideEmail'] = idx;
    }
    // Guide School
    else if (h.includes('guideschool') || h.includes('supervisorschool') || h.includes('guidedept')) {
      colMap['guideSchool'] = idx;
    }
    // Co-guide
    else if (h.includes('coguide') || h.includes('cosupervisor') || h.includes('coguidesupervisor')) {
      colMap['coGuideName'] = idx;
    }
    // Registration Date
    else if (h.includes('regdate') || h.includes('admissiondate') || h.includes('registrationdate')) {
      colMap['registrationDate'] = idx;
    }
    // Research Topic / Title / Synopsis
    else if (h.includes('topic') || h.includes('title') || h.includes('researchtitle') || (h.includes('research') && !h.includes('guide'))) {
      if (colMap['researchTopic'] === undefined) colMap['researchTopic'] = idx;
    }
    // Contact Email
    else if ((h.includes('email') || h.includes('mail')) && !h.includes('guide')) {
      colMap['email'] = idx;
    }
    // Phone
    else if (h.includes('phone') || h.includes('mobile') || h.includes('contact')) {
      colMap['phone'] = idx;
    }
    // Current RPC No
    else if (h.includes('currentrpc') || h.includes('nextrpc')) {
      colMap['currentRpcNo'] = idx;
    }
    // RPC Number column
    else if (
      h.includes('rpcnumber') ||
      h.includes('rpcstage') ||
      h.includes('rpcno') ||
      h.includes('meetingno') ||
      h.includes('stage') ||
      /(\d+)rpc/i.test(h) ||
      /rpc(\d+)/i.test(h) ||
      h === 'rpc'
    ) {
      if (colMap['rpcNumber'] === undefined) colMap['rpcNumber'] = idx;
    }
    // RPC Date (Meeting / scheduled evaluation date)
    else if (h === 'date' || h.includes('rpcdate') || h.includes('meetingdate') || h.includes('scheduledate') || h.includes('dateofrpc')) {
      if (colMap['rpcDate'] === undefined) colMap['rpcDate'] = idx;
    }
    // Meeting Time
    else if (h === 'time' || h.includes('meetingtime') || h.includes('scheduletime') || h.includes('timeofrpc')) {
      if (colMap['meetingTime'] === undefined) colMap['meetingTime'] = idx;
    }
    // Meeting Mode
    else if (h === 'mode' || h.includes('meetingmode') || h.includes('modeofmeeting')) {
      colMap['meetingMode'] = idx;
    }
    // Venue / Meeting Link
    else if (h.includes('venue') || h.includes('meetinglink') || h.includes('platform') || (h.includes('link') && !h.includes('external')) || h === 'location') {
      if (colMap['venue'] === undefined) colMap['venue'] = idx;
    }
    // Notes / Synopsis / Remarks
    else if (h.includes('note') || h.includes('remark') || h.includes('detail') || h.includes('synopsis') || h.includes('comment')) {
      if (colMap['notes'] === undefined) colMap['notes'] = idx;
    }
    // Committee Members explicit columns
    else if (h.includes('internal') && (h.includes('expert') || h.includes('member') || h.includes('drc'))) {
      if (h.includes('desig')) colMap['internalExpertDesignation'] = idx;
      else if (h.includes('dept') || h.includes('school')) colMap['internalExpertDept'] = idx;
      else if (h.includes('campus') || h.includes('city') || h.includes('loc')) colMap['internalExpertCampus'] = idx;
      else if (colMap['internalExpert'] === undefined) colMap['internalExpert'] = idx;
    }
    else if (h.includes('external') && (h.includes('1') || h.includes('one') || h.includes('first')) && (h.includes('expert') || h.includes('member'))) {
      if (h.includes('desig')) colMap['externalExpert1Designation'] = idx;
      else if (h.includes('uni') || h.includes('inst')) colMap['externalExpert1Inst'] = idx;
      else if (h.includes('dept') || h.includes('school')) colMap['externalExpert1Dept'] = idx;
      else if (h.includes('campus') || h.includes('city') || h.includes('loc')) colMap['externalExpert1City'] = idx;
      else if (colMap['externalExpert1'] === undefined) colMap['externalExpert1'] = idx;
    }
    else if (h.includes('external') && (h.includes('2') || h.includes('two') || h.includes('second')) && (h.includes('expert') || h.includes('member'))) {
      if (h.includes('desig')) colMap['externalExpert2Designation'] = idx;
      else if (h.includes('uni') || h.includes('inst')) colMap['externalExpert2Inst'] = idx;
      else if (h.includes('dept') || h.includes('school')) colMap['externalExpert2Dept'] = idx;
      else if (h.includes('campus') || h.includes('city') || h.includes('loc')) colMap['externalExpert2City'] = idx;
      else if (colMap['externalExpert2'] === undefined) colMap['externalExpert2'] = idx;
    }
  });

  // Second pass: Multi-column expert blocks (NFSU Official Format)
  // Safely check if adjacent columns are actually address subheaders (not other recognized headers)
  const isAddressOrSubheader = (colIdx: number) => {
    if (colIdx >= rawHeaders.length) return false;
    const norm = normalizeHeader(rawHeaders[colIdx]);
    if (!norm) return true; // empty header is likely an address subheader
    if (
      norm.includes('address') ||
      norm.includes('addr') ||
      norm.includes('desig') ||
      norm.includes('dept') ||
      norm.includes('campus') ||
      norm.includes('city') ||
      norm.includes('inst')
    ) {
      return true;
    }
    return false;
  };

  rawHeaders.forEach((rawH, idx) => {
    const h = normalizeHeader(rawH);
    if (!h) return;

    if (h.includes('internal') && (h.includes('expert') || h.includes('member')) && !h.includes('desig') && !h.includes('dept')) {
      if (colMap['internalExpert'] === undefined) colMap['internalExpert'] = idx;
      if (colMap['internalExpertDesignation'] === undefined && isAddressOrSubheader(idx + 1)) colMap['internalExpertDesignation'] = idx + 1;
      if (colMap['internalExpertDept'] === undefined && isAddressOrSubheader(idx + 2)) colMap['internalExpertDept'] = idx + 2;
      if (colMap['internalExpertCampus'] === undefined && isAddressOrSubheader(idx + 3)) colMap['internalExpertCampus'] = idx + 3;
    } else if (h.includes('external') && (h.includes('1') || h.includes('one')) && (h.includes('expert') || h.includes('member')) && !h.includes('2') && !h.includes('desig') && !h.includes('dept')) {
      if (colMap['externalExpert1'] === undefined) colMap['externalExpert1'] = idx;
      if (colMap['externalExpert1Designation'] === undefined && isAddressOrSubheader(idx + 1)) colMap['externalExpert1Designation'] = idx + 1;
      if (colMap['externalExpert1Dept'] === undefined && isAddressOrSubheader(idx + 2)) colMap['externalExpert1Dept'] = idx + 2;
      if (colMap['externalExpert1City'] === undefined && isAddressOrSubheader(idx + 3)) colMap['externalExpert1City'] = idx + 3;
    } else if (h.includes('external') && (h.includes('2') || h.includes('two')) && (h.includes('expert') || h.includes('member')) && !h.includes('desig') && !h.includes('dept')) {
      if (colMap['externalExpert2'] === undefined) colMap['externalExpert2'] = idx;
      if (colMap['externalExpert2Designation'] === undefined && isAddressOrSubheader(idx + 1)) colMap['externalExpert2Designation'] = idx + 1;
      if (colMap['externalExpert2Dept'] === undefined && isAddressOrSubheader(idx + 2)) colMap['externalExpert2Dept'] = idx + 2;
      if (colMap['externalExpert2City'] === undefined && isAddressOrSubheader(idx + 3)) colMap['externalExpert2City'] = idx + 3;
    }
  });

  for (let r = 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || row.length === 0 || row.every((c: any) => c === '' || c === undefined || c === null)) {
      continue;
    }

    if (isRpcSheet) {
      // Parse RPC Request row
      const enrollmentNo = String(row[colMap['enrollmentNo']] ?? '').trim();
      const scholarName = String(row[colMap['name']] ?? '').trim();
      const school = String(row[colMap['school']] ?? 'School of Forensic Science').trim();
      const department = String(row[colMap['department']] ?? school).trim();
      const guideName = String(row[colMap['guideName']] ?? '').trim();

      const rpcNumRaw = colMap['rpcNumber'] !== undefined ? row[colMap['rpcNumber']] : undefined;
      let rpcNumber = parseInt(String(rpcNumRaw).replace(/[^0-9]/g, ''), 10);
      if (isNaN(rpcNumber) || rpcNumber < 1) {
        rpcNumber = detectedRpcStageFromHeader || 1;
      }

      const rpcDateRaw = colMap['rpcDate'] !== undefined ? row[colMap['rpcDate']] : undefined;
      const rpcDate = formatExcelDate(rpcDateRaw) || new Date().toISOString().split('T')[0];
      const meetingTime = String(row[colMap['meetingTime']] ?? '11:00 AM IST').trim();

      let modeRaw = String(row[colMap['meetingMode']] ?? 'ONLINE').toUpperCase().trim();
      let meetingMode: 'ONLINE' | 'OFFLINE' | 'HYBRID' = 'ONLINE';
      if (modeRaw.includes('OFF') || modeRaw.includes('PHYSICAL')) meetingMode = 'OFFLINE';
      else if (modeRaw.includes('HYB')) meetingMode = 'HYBRID';

      const venue = String(row[colMap['venue']] ?? 'SDSR Board Room / Google Meet').trim();

      const internalExpertName = String(row[colMap['internalExpert']] ?? '').trim();
      const internalExpertDesignation = String(row[colMap['internalExpertDesignation']] ?? 'Associate Professor').trim();
      const internalExpertDepartment = String(row[colMap['internalExpertDept']] ?? school).trim();
      const internalExpertLocation = String(row[colMap['internalExpertCampus']] ?? 'NFSU, Gandhinagar').trim();

      const externalExpert1Name = String(row[colMap['externalExpert1']] ?? '').trim();
      const externalExpert1Designation = String(row[colMap['externalExpert1Designation']] ?? 'Associate Professor').trim();
      const externalExpert1Department = String(row[colMap['externalExpert1Dept']] ?? 'External Department').trim();
      const externalExpert1Institution = String(
        row[colMap['externalExpert1Inst']] ??
        row[colMap['externalExpert1Dept']] ??
        'External University'
      ).trim();
      const externalExpert1Location = String(row[colMap['externalExpert1City']] ?? 'External Location').trim();

      const externalExpert2Name = String(row[colMap['externalExpert2']] ?? '').trim();
      const externalExpert2Designation = String(row[colMap['externalExpert2Designation']] ?? 'Professor').trim();
      const externalExpert2Department = String(row[colMap['externalExpert2Dept']] ?? 'External Department').trim();
      const externalExpert2Institution = String(
        row[colMap['externalExpert2Inst']] ??
        row[colMap['externalExpert2Dept']] ??
        'External University'
      ).trim();
      const externalExpert2Location = String(row[colMap['externalExpert2City']] ?? 'External Location').trim();

      const errors: string[] = [];
      if (!enrollmentNo && !scholarName) {
        errors.push('Both Enrollment No and Scholar Name are missing');
      }

      const matchedScholar =
        existingMap.get(enrollmentNo.toLowerCase()) ||
        (scholarName ? existingMap.get(scholarName.toLowerCase()) : undefined);

      rpcRows.push({
        rowIndex: r + 1,
        isValid: errors.length === 0,
        errors,
        enrollmentNo: enrollmentNo || matchedScholar?.enrollmentNo || '',
        scholarName: scholarName || matchedScholar?.name || 'Unknown Scholar',
        school: school || matchedScholar?.school || 'School of Forensic Science',
        department: department || matchedScholar?.department || school,
        rpcNumber,
        rpcDate,
        meetingTime,
        meetingMode,
        venue,
        guideName: guideName || matchedScholar?.guideName || 'Research Supervisor',
        guideDesignation: String(row[colMap['guideDesignation']] ?? matchedScholar?.guideDesignation ?? 'Professor').trim(),
        guideSchool: school || matchedScholar?.guideSchool || school,
        guideEmail: String(row[colMap['guideEmail']] ?? matchedScholar?.guideEmail ?? '').trim() || undefined,
        coGuideName: String(row[colMap['coGuideName']] ?? matchedScholar?.coGuideName ?? '').trim() || undefined,
        researchTopic: String(row[colMap['researchTopic']] ?? row[colMap['notes']] ?? matchedScholar?.researchTopic ?? '').trim() || undefined,
        internalExpertName,
        internalExpertDesignation,
        internalExpertDepartment,
        internalExpertDept: internalExpertDepartment,
        internalExpertLocation,
        internalExpertCampus: internalExpertLocation,
        externalExpert1Name,
        externalExpert1Designation,
        externalExpert1Department,
        externalExpert1Dept: externalExpert1Department,
        externalExpert1Institution,
        externalExpert1Inst: externalExpert1Institution,
        externalExpert1Location,
        externalExpert1City: externalExpert1Location,
        externalExpert2Name,
        externalExpert2Designation,
        externalExpert2Department,
        externalExpert2Dept: externalExpert2Department,
        externalExpert2Institution,
        externalExpert2Inst: externalExpert2Institution,
        externalExpert2Location,
        externalExpert2City: externalExpert2Location,
        notes: String(row[colMap['notes']] ?? '').trim(),
      });

      // Also ensure scholar is available as a scholarRow
      scholarRows.push({
        rowIndex: r + 1,
        isValid: Boolean(enrollmentNo || scholarName),
        errors: [],
        scholar: {
          id: matchedScholar?.id || `sch-${enrollmentNo.toLowerCase().replace(/[^a-z0-9]/g, '') || String(r)}`,
          name: scholarName || matchedScholar?.name || 'Ph.D. Scholar',
          enrollmentNo: enrollmentNo || matchedScholar?.enrollmentNo || '',
          school: school || matchedScholar?.school || 'School of Forensic Science',
          department: department || matchedScholar?.department || school,
          guideName: guideName || matchedScholar?.guideName || 'Research Supervisor',
          guideDesignation: String(row[colMap['guideDesignation']] ?? matchedScholar?.guideDesignation ?? 'Professor').trim(),
          guideEmail: String(row[colMap['guideEmail']] ?? matchedScholar?.guideEmail ?? `${(scholarName || 'scholar').toLowerCase().replace(/[^a-z]/g, '.')}@nfsu.ac.in`).trim(),
          guideSchool: school || matchedScholar?.guideSchool || school,
          coGuideName: String(row[colMap['coGuideName']] ?? matchedScholar?.coGuideName ?? '').trim() || undefined,
          registrationDate: formatExcelDate(row[colMap['registrationDate']]) || new Date().toISOString().split('T')[0],
          researchTopic: String(row[colMap['researchTopic']] ?? row[colMap['notes']] ?? matchedScholar?.researchTopic ?? 'Doctoral Research Study at NFSU').trim(),
          currentRpcNo: rpcNumber,
          status: 'ACTIVE',
          contactDetails: {
            email: `${(enrollmentNo || 'scholar').toLowerCase()}@nfsu.ac.in`,
            phone: '+91-9800000000',
            address: 'NFSU Gandhinagar Campus, Sector-9, Gandhinagar 382007',
          },
          academicDetails: {
            qualifyingDegree: "Master's Degree",
            university: 'Recognized University',
            yearOfPassing: String(new Date().getFullYear() - 1),
            category: 'Regular Full-Time',
          },
        },
      });
    } else {
      // Parse Scholar row
      const enrollmentNo = String(row[colMap['enrollmentNo']] ?? '').trim();
      const name = String(row[colMap['name']] ?? '').trim().toUpperCase();
      const school = String(row[colMap['school']] ?? 'School of Forensic Science').trim();
      const department = String(row[colMap['department']] ?? school).trim();
      const guideName = String(row[colMap['guideName']] ?? '').trim();
      const guideDesignation = String(row[colMap['guideDesignation']] ?? 'Professor').trim();
      const guideEmail = String(row[colMap['guideEmail']] ?? '').trim();
      const guideSchool = String(row[colMap['guideSchool']] ?? school).trim();
      const coGuideName = String(row[colMap['coGuideName']] ?? '').trim();
      const registrationDate = formatExcelDate(row[colMap['registrationDate']]) || new Date().toISOString().split('T')[0];
      const researchTopic = String(row[colMap['researchTopic']] ?? 'Doctoral Research Study at NFSU').trim();
      const email = String(row[colMap['email']] ?? '').trim();
      const phone = String(row[colMap['phone']] ?? '').trim();

      const currentRpcRaw = row[colMap['currentRpcNo']];
      let currentRpcNo = parseInt(String(currentRpcRaw).replace(/[^0-9]/g, ''), 10);
      if (isNaN(currentRpcNo) || currentRpcNo < 1) currentRpcNo = 1;

      const qualifyingDegree = String(row[colMap['qualifyingDegree']] ?? "Master's Degree").trim();
      const university = String(row[colMap['university']] ?? 'Recognized University').trim();
      const category = String(row[colMap['category']] ?? 'Regular Full-Time').trim();
      const fellowship = String(row[colMap['fellowship']] ?? '').trim();

      const errors: string[] = [];
      if (!enrollmentNo) errors.push('Enrollment No is required');
      if (!name) errors.push('Scholar Name is required');
      if (!guideName) errors.push('Guide / Supervisor Name is required');

      const existingScholar = existingMap.get(enrollmentNo.toLowerCase());
      const id = existingScholar ? existingScholar.id : `sch-${enrollmentNo.toLowerCase().replace(/[^a-z0-9]/g, '') || Date.now()}`;

      const scholar: Scholar = {
        id,
        name,
        enrollmentNo,
        school,
        department,
        guideName,
        guideDesignation,
        guideEmail: guideEmail || `${guideName.toLowerCase().replace(/[^a-z]/g, '.')}@nfsu.ac.in`,
        guideSchool,
        coGuideName: coGuideName || undefined,
        registrationDate,
        researchTopic,
        contactDetails: {
          email: email || `${enrollmentNo.toLowerCase()}@nfsu.ac.in`,
          phone: phone || '+91-9800000000',
          address: 'NFSU Gandhinagar Campus, Sector-9, Gandhinagar 382007',
        },
        currentRpcNo,
        status: 'ACTIVE',
        academicDetails: {
          qualifyingDegree,
          university,
          yearOfPassing: '2023',
          category,
          fellowship: fellowship || undefined,
        },
      };

      scholarRows.push({
        rowIndex: r + 1,
        isValid: errors.length === 0,
        errors,
        scholar,
        isExisting: !!existingScholar,
      });
    }
  }

  if (scholarRows.length > 0 && rpcRows.length > 0) {
    detectedType = 'COMBINED';
  } else if (rpcRows.length > 0) {
    detectedType = 'RPC_REQUESTS';
  } else {
    detectedType = 'SCHOLARS';
  }

  return { scholarRows, rpcRows, detectedType };
}

export async function parseExcelWorkbookIntoSheets(
  file: File,
  existingScholars: Scholar[]
): Promise<LoadedExcelSheet[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  const existingMap = new Map<string, Scholar>();
  existingScholars.forEach((s) => {
    existingMap.set(s.enrollmentNo.trim().toLowerCase(), s);
  });

  const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const loadedSheets: LoadedExcelSheet[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const parsed = parseSingleSheetData(sheet, sheetName, existingMap);
    if (parsed.scholarRows.length === 0 && parsed.rpcRows.length === 0) return;

    const totalRows = parsed.scholarRows.length + parsed.rpcRows.length;
    const validRowsCount =
      parsed.scholarRows.filter((s) => s.isValid).length + parsed.rpcRows.filter((r) => r.isValid).length;
    const invalidRowsCount = totalRows - validRowsCount;

    loadedSheets.push({
      id: `${fileId}::${sheetName}`,
      fileId,
      fileName: file.name,
      sheetName,
      detectedType: parsed.detectedType,
      scholarRows: parsed.scholarRows,
      rpcRows: parsed.rpcRows,
      totalRows,
      validRowsCount,
      invalidRowsCount,
      isLoaded: true,
      loadedAt: new Date().toISOString(),
    });
  });

  return loadedSheets;
}

export async function parseMultipleExcelFiles(
  files: File[],
  existingScholars: Scholar[]
): Promise<{ files: LoadedExcelFile[]; sheets: LoadedExcelSheet[] }> {
  const fileRecords: LoadedExcelFile[] = [];
  const allSheets: LoadedExcelSheet[] = [];

  for (const file of files) {
    const sheets = await parseExcelWorkbookIntoSheets(file, existingScholars);
    const fileId = sheets[0]?.fileId || `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const fileRecord: LoadedExcelFile = {
      fileId,
      fileName: file.name,
      fileSize: file.size,
      sheets,
      uploadedAt: new Date().toISOString(),
    };
    fileRecords.push(fileRecord);
    allSheets.push(...sheets);
  }

  return { files: fileRecords, sheets: allSheets };
}

export function aggregateActiveSheets(sheets: LoadedExcelSheet[]): ExcelParseResult {
  const active = sheets.filter((s) => s.isLoaded);
  const scholarRows = active.flatMap((s) => s.scholarRows);
  const rpcRows = active.flatMap((s) => s.rpcRows);
  const sheetNames = active.map((s) => `${s.fileName} > ${s.sheetName}`);
  const totalRows = scholarRows.length + rpcRows.length;
  const validRowsCount =
    scholarRows.filter((s) => s.isValid).length + rpcRows.filter((r) => r.isValid).length;
  const invalidRowsCount = totalRows - validRowsCount;

  let detectedType: 'SCHOLARS' | 'RPC_REQUESTS' | 'COMBINED' = 'SCHOLARS';
  if (scholarRows.length > 0 && rpcRows.length > 0) detectedType = 'COMBINED';
  else if (rpcRows.length > 0) detectedType = 'RPC_REQUESTS';

  return {
    fileName: active.length === 1 ? active[0].fileName : `${active.length} Active Sheets`,
    sheetNames,
    detectedType,
    scholarRows,
    rpcRows,
    totalRows,
    validRowsCount,
    invalidRowsCount,
  };
}

export async function parseExcelFile(
  file: File,
  existingScholars: Scholar[]
): Promise<ExcelParseResult> {
  const sheets = await parseExcelWorkbookIntoSheets(file, existingScholars);
  if (sheets.length === 0) {
    return {
      fileName: file.name,
      sheetNames: [],
      detectedType: 'SCHOLARS',
      scholarRows: [],
      rpcRows: [],
      totalRows: 0,
      validRowsCount: 0,
      invalidRowsCount: 0,
    };
  }
  return aggregateActiveSheets(sheets);
}

// Generate and trigger download for formatted sample Excel template
export function downloadExcelTemplate(type: 'scholars' | 'rpc_requests' | 'combined') {
  const wb = XLSX.utils.book_new();

  if (type === 'scholars' || type === 'combined') {
    const scholarHeaders = [
      'Enrollment No',
      'Scholar Name',
      'School',
      'Department',
      'Guide Name',
      'Guide Designation',
      'Guide Email',
      'Guide School',
      'Co-Guide Name',
      'Registration Date',
      'Research Topic',
      'Contact Email',
      'Phone',
      'Current RPC No',
      'Qualifying Degree',
      'University',
      'Admission Category',
      'Fellowship / Funding',
    ];

    const scholarSampleRows = [
      [
        '240112006045',
        'DR. PRIYA SHARMA',
        'School of Forensic Science',
        'Forensic Chemistry and Toxicology',
        'Dr. Rakesh Yadav',
        'Associate Professor, SFS',
        'rakesh.yadav@nfsu.ac.in',
        'School of Forensic Science',
        '',
        '2024-02-15',
        'Development of Advanced Microfluidic SERS Sensors for Rapid In-field Identification of Designer Drugs',
        'priya.sharma@nfsu.ac.in',
        '+91-9876543299',
        1,
        'M.Sc. Forensic Science',
        'NFSU Gandhinagar',
        'Regular Full-Time (GATE Qualified)',
        'CSIR-JRF',
      ],
      [
        '240112006048',
        'MR. ANIKET PATEL',
        'School of Pharmacy',
        'Pharmaceutical Quality Assurance',
        'Prof. (Dr.) Manjunath Ghate',
        'Professor & Director, SPH',
        'manjunath.ghate@nfsu.ac.in',
        'School of Pharmacy',
        'Dr. Bhoomika Patel',
        '2023-09-01',
        'Design and Analytical Evaluation of Novel Targeted Nanocarriers for Blood-Brain Barrier Penetration',
        'aniket.patel@nfsu.ac.in',
        '+91-9825123456',
        2,
        'M.Pharm',
        'Gujarat Technological University',
        'Regular Full-Time',
        'NFSU Institutional Fellowship',
      ],
      [
        '240112006052',
        'MS. SNEHA MUKHERJEE',
        'School of Engineering and Technology',
        'Cyber Security & Digital Forensics',
        'Dr. Bappi Paul',
        'Associate Professor, SET',
        'bappi.paul@nfsu.ac.in',
        'School of Engineering and Technology',
        '',
        '2023-07-20',
        'Zero-Trust Cryptographic Architectures for Autonomous Cyber-Physical Forensics',
        'sneha.m@nfsu.ac.in',
        '+91-9988776655',
        3,
        'M.Tech Cyber Security',
        'IIT Kharagpur',
        'Sponsored Full-Time',
        'DRDO Sponsored Project',
      ],
    ];

    const wsScholars = XLSX.utils.aoa_to_sheet([scholarHeaders, ...scholarSampleRows]);
    // Set column widths
    wsScholars['!cols'] = [
      { wch: 16 }, // Enrollment No
      { wch: 24 }, // Scholar Name
      { wch: 28 }, // School
      { wch: 30 }, // Department
      { wch: 24 }, // Guide Name
      { wch: 24 }, // Guide Designation
      { wch: 26 }, // Guide Email
      { wch: 26 }, // Guide School
      { wch: 20 }, // Co-Guide
      { wch: 16 }, // Reg Date
      { wch: 45 }, // Topic
      { wch: 26 }, // Email
      { wch: 16 }, // Phone
      { wch: 14 }, // Current RPC
      { wch: 22 }, // Qualifying Degree
      { wch: 26 }, // University
      { wch: 24 }, // Category
      { wch: 22 }, // Fellowship
    ];
    XLSX.utils.book_append_sheet(wb, wsScholars, 'Scholars Roster');
  }

  if (type === 'rpc_requests' || type === 'combined') {
    const rpcHeaders = [
      'Enrollment No',
      'Scholar Name',
      'RPC Number',
      'RPC Scheduled Date',
      'Meeting Time',
      'Meeting Mode',
      'Venue / Meeting Link',
      'Guide Name',
      'Internal Expert Name',
      'External Expert 1 Name',
      'External Expert 2 Name',
      'Synopsis / Notes',
    ];

    const rpcSampleRows = [
      [
        '240112006037',
        'RICHARD CHEREHANI KASHINDYE',
        4,
        '2024-11-25',
        '11:30 AM IST',
        'HYBRID',
        'Conference Hall A, SDSR Building & Google Meet: meet.google.com/nfs-sdsr-rpc',
        'Dr. Rakesh Yadav',
        'Dr. Bhoomika Patel',
        'Dr. Dhiraj Bhatia',
        'Prof. (Dr.) V. K. Jain',
        '4th RPC evaluation for 3rd semester research progress and paper submission review.',
      ],
      [
        '240112006033',
        'MS. DEVANSHI LUNAGARIYA',
        1,
        '2024-12-05',
        '02:30 PM IST',
        'ONLINE',
        'Google Meet: meet.google.com/sph-rpc-01',
        'Prof. (Dr.) Manjunath Ghate',
        'Dr. Bhoomika Patel',
        'Dr. Dhiraj Bhatia',
        'Prof. (Dr.) Sanjay K. Jain',
        '1st RPC evaluation for doctoral research course-work defense and experimental protocol approval.',
      ],
    ];

    const wsRpc = XLSX.utils.aoa_to_sheet([rpcHeaders, ...rpcSampleRows]);
    wsRpc['!cols'] = [
      { wch: 16 }, // Enrollment No
      { wch: 26 }, // Scholar Name
      { wch: 12 }, // RPC Number
      { wch: 18 }, // Scheduled Date
      { wch: 16 }, // Meeting Time
      { wch: 14 }, // Meeting Mode
      { wch: 40 }, // Venue
      { wch: 24 }, // Guide Name
      { wch: 24 }, // Internal Expert
      { wch: 24 }, // External Expert 1
      { wch: 24 }, // External Expert 2
      { wch: 45 }, // Notes
    ];
    XLSX.utils.book_append_sheet(wb, wsRpc, 'RPC Schedules');
  }

  const fileName =
    type === 'scholars'
      ? 'NFSU_SDSR_Ph.D._Scholars_Template.xlsx'
      : type === 'rpc_requests'
      ? 'NFSU_SDSR_RPC_Schedule_Template.xlsx'
      : 'NFSU_SDSR_Doctoral_Master_Template.xlsx';

  XLSX.writeFile(wb, fileName);
}

// -------------------------------------------------------------
// ENHANCED STUDENT DATA MATCHING & UNLOAD (EXPORT) CAPABILITIES
// -------------------------------------------------------------

export interface StudentMatchDiscrepancy {
  field: 'guideName' | 'school' | 'department' | 'currentRpcNo';
  label: string;
  excelValue: string;
  dbValue: string;
}

export interface StudentMatchItem {
  id: string; // unique item key
  sourceFileName?: string;
  sourceSheetName?: string;
  sourceSheetId?: string;
  enrollmentNo: string;
  scholarName: string;
  school: string;
  department: string;
  guideName: string;
  guideDesignation?: string;
  guideEmail?: string;
  guideSchool?: string;
  coGuideName?: string;
  rpcNumber: number;
  rpcDate: string;
  meetingTime: string;
  meetingMode: 'ONLINE' | 'OFFLINE' | 'HYBRID';
  venue: string;
  internalExpertName?: string;
  internalExpertDesignation?: string;
  internalExpertDept?: string;
  internalExpertCampus?: string;
  externalExpert1Name?: string;
  externalExpert1Designation?: string;
  externalExpert1Inst?: string;
  externalExpert1Dept?: string;
  externalExpert1City?: string;
  externalExpert2Name?: string;
  externalExpert2Designation?: string;
  externalExpert2Inst?: string;
  externalExpert2Dept?: string;
  externalExpert2City?: string;
  researchTopic?: string;
  notes?: string;
  matchStatus: 'EXACT_MATCH' | 'NAME_MATCH' | 'NEW_STUDENT';
  existingScholar?: Scholar;
  existingRpcRecord?: RpcRecord;
  hasExistingApprovedLetter: boolean;
  approvedLetterRef?: string;
  discrepancies: StudentMatchDiscrepancy[];
  rawSource: 'SCHOLAR_ROW' | 'RPC_ROW' | 'COMBINED';
}

/**
 * Matches loaded student/scholar records from Excel against existing database scholars and RPCs.
 * Identifies exact enrollment matches, fuzzy name matches, new scholars, and field discrepancies.
 */
export function matchStudentData(
  parseResultOrSheets: ExcelParseResult | LoadedExcelSheet[],
  existingScholars: Scholar[],
  existingRpcRecords: RpcRecord[]
): StudentMatchItem[] {
  const enrollmentMap = new Map<string, Scholar>();
  const nameMap = new Map<string, Scholar>();

  existingScholars.forEach((s) => {
    if (s.enrollmentNo) {
      enrollmentMap.set(s.enrollmentNo.trim().toLowerCase(), s);
    }
    if (s.name) {
      nameMap.set(s.name.trim().toLowerCase().replace(/^dr\.\s*|^mr\.\s*|^ms\.\s*|^mrs\.\s*/i, ''), s);
    }
  });

  const matchedItems: StudentMatchItem[] = [];
  const processedKeys = new Set<string>();

  // Helper to test if two strings differ meaningfully
  const isDifferent = (a: string = '', b: string = '') => {
    const cleanA = a.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanB = b.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanA || !cleanB) return false;
    return cleanA !== cleanB && !cleanA.includes(cleanB) && !cleanB.includes(cleanA);
  };

  interface SheetUnit {
    fileName: string;
    sheetName: string;
    sheetId?: string;
    rpcRows: ParsedRpcRow[];
    scholarRows: ParsedScholarRow[];
  }

  const units: SheetUnit[] = [];

  if (Array.isArray(parseResultOrSheets)) {
    parseResultOrSheets
      .filter((s) => s.isLoaded)
      .forEach((s) => {
        units.push({
          fileName: s.fileName,
          sheetName: s.sheetName,
          sheetId: s.id,
          rpcRows: s.rpcRows,
          scholarRows: s.scholarRows,
        });
      });
  } else if (parseResultOrSheets) {
    units.push({
      fileName: parseResultOrSheets.fileName,
      sheetName: parseResultOrSheets.sheetNames[0] || 'Default',
      rpcRows: parseResultOrSheets.rpcRows,
      scholarRows: parseResultOrSheets.scholarRows,
    });
  }

  units.forEach((unit) => {
    // 1. Process RPC schedule rows
    unit.rpcRows.forEach((r, idx) => {
      const normEnroll = r.enrollmentNo.trim().toLowerCase();
      const cleanScholarName = (r.scholarName || '').trim().toLowerCase().replace(/^dr\.\s*|^mr\.\s*|^ms\.\s*|^mrs\.\s*/i, '');

      const scholarByEnroll = normEnroll ? enrollmentMap.get(normEnroll) : undefined;
      const scholarByName = cleanScholarName ? nameMap.get(cleanScholarName) : undefined;
      const existingScholar = scholarByEnroll || scholarByName;

      let matchStatus: 'EXACT_MATCH' | 'NAME_MATCH' | 'NEW_STUDENT' = 'NEW_STUDENT';
      if (scholarByEnroll) {
        matchStatus = 'EXACT_MATCH';
      } else if (scholarByName) {
        matchStatus = 'NAME_MATCH';
      }

      const discrepancies: StudentMatchDiscrepancy[] = [];
      if (existingScholar) {
        if (r.guideName && isDifferent(r.guideName, existingScholar.guideName)) {
          discrepancies.push({
            field: 'guideName',
            label: 'Research Guide',
            excelValue: r.guideName,
            dbValue: existingScholar.guideName,
          });
        }
        if (existingScholar.currentRpcNo && existingScholar.currentRpcNo !== r.rpcNumber) {
          discrepancies.push({
            field: 'currentRpcNo',
            label: 'RPC Stage in Records',
            excelValue: `RPC ${r.rpcNumber}`,
            dbValue: `RPC ${existingScholar.currentRpcNo}`,
          });
        }
      }

      // Check if an existing RPC record exists for this scholar and stage
      const existingRpc = existingRpcRecords.find(
        (rec) =>
          (rec.enrollmentNo.toLowerCase() === normEnroll ||
            (existingScholar && rec.scholarId === existingScholar.id)) &&
          rec.rpcNumber === r.rpcNumber
      );

      const hasExistingApprovedLetter = existingRpc?.status === 'APPROVED';
      const approvedLetterRef = existingRpc?.approvedDocumentReference || existingRpc?.letterData?.refNo;

      const itemKey = `${normEnroll || cleanScholarName}-rpc-${r.rpcNumber}`;
      processedKeys.add(itemKey);

      matchedItems.push({
        id: `match-rpc-${unit.sheetId || unit.sheetName}-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        sourceFileName: unit.fileName,
        sourceSheetName: unit.sheetName,
        sourceSheetId: unit.sheetId,
        enrollmentNo: r.enrollmentNo || existingScholar?.enrollmentNo || '—',
        scholarName: r.scholarName || existingScholar?.name || 'Unknown Scholar',
        school: existingScholar?.school || 'School of Forensic Science',
        department: existingScholar?.department || 'Doctoral Studies and Research',
        guideName: r.guideName || existingScholar?.guideName || 'Prof. Guide',
        guideDesignation: existingScholar?.guideDesignation || 'Professor',
        guideEmail: existingScholar?.guideEmail,
        guideSchool: existingScholar?.guideSchool || existingScholar?.school,
        rpcNumber: r.rpcNumber || existingScholar?.currentRpcNo || 1,
        rpcDate: r.rpcDate || new Date().toISOString().split('T')[0],
        meetingTime: r.meetingTime || '11:00 AM IST',
        meetingMode: r.meetingMode || 'ONLINE',
        venue: r.venue || 'SDSR Board Room / Google Meet',
        internalExpertName: r.internalExpertName || 'Dr. Bhoomika Patel',
        internalExpertDesignation: r.internalExpertDesignation || 'Dean (I/C), SPH',
        internalExpertDept: r.internalExpertDept || r.internalExpertDepartment || 'School of Pharmacy',
        internalExpertCampus: r.internalExpertCampus || r.internalExpertLocation || 'NFSU, Gandhinagar',
        externalExpert1Name: r.externalExpert1Name || 'Dr. Dhiraj Bhatia',
        externalExpert1Designation: r.externalExpert1Designation || 'Associate Professor',
        externalExpert1Inst: r.externalExpert1Inst || r.externalExpert1Institution || 'Indian Institute of Technology Gandhinagar',
        externalExpert1Dept: r.externalExpert1Dept || r.externalExpert1Department || 'Department of Biological Science and Engineering',
        externalExpert1City: r.externalExpert1City || r.externalExpert1Location || 'Gandhinagar',
        externalExpert2Name: r.externalExpert2Name || 'Prof. (Dr.) Sanjay K. Jain',
        externalExpert2Designation: r.externalExpert2Designation || 'Professor & Dean',
        externalExpert2Inst: r.externalExpert2Inst || r.externalExpert2Institution || 'Central University of Gujarat',
        externalExpert2Dept: r.externalExpert2Dept || r.externalExpert2Department || 'School of Applied Material Science',
        externalExpert2City: r.externalExpert2City || r.externalExpert2Location || 'Gandhinagar',
        coGuideName: r.coGuideName,
        researchTopic: r.researchTopic || existingScholar?.researchTopic,
        notes: r.notes,
        matchStatus,
        existingScholar,
        existingRpcRecord: existingRpc,
        hasExistingApprovedLetter,
        approvedLetterRef,
        discrepancies,
        rawSource: 'RPC_ROW',
      });
    });

    // 2. Process Scholar roster rows that were not already covered by RPC rows
    unit.scholarRows.forEach((sRow, idx) => {
      const s = sRow.scholar;
      const normEnroll = s.enrollmentNo.trim().toLowerCase();
      const cleanScholarName = (s.name || '').trim().toLowerCase().replace(/^dr\.\s*|^mr\.\s*|^ms\.\s*|^mrs\.\s*/i, '');
      const itemKey = `${normEnroll || cleanScholarName}-rpc-${s.currentRpcNo || 1}`;

      if (processedKeys.has(itemKey)) {
        return; // already handled
      }

      const scholarByEnroll = normEnroll ? enrollmentMap.get(normEnroll) : undefined;
      const scholarByName = cleanScholarName ? nameMap.get(cleanScholarName) : undefined;
      const existingScholar = scholarByEnroll || scholarByName;

      let matchStatus: 'EXACT_MATCH' | 'NAME_MATCH' | 'NEW_STUDENT' = 'NEW_STUDENT';
      if (scholarByEnroll) {
        matchStatus = 'EXACT_MATCH';
      } else if (scholarByName) {
        matchStatus = 'NAME_MATCH';
      }

      const discrepancies: StudentMatchDiscrepancy[] = [];
      if (existingScholar) {
        if (s.guideName && isDifferent(s.guideName, existingScholar.guideName)) {
          discrepancies.push({
            field: 'guideName',
            label: 'Research Guide',
            excelValue: s.guideName,
            dbValue: existingScholar.guideName,
          });
        }
        if (s.school && isDifferent(s.school, existingScholar.school)) {
          discrepancies.push({
            field: 'school',
            label: 'School',
            excelValue: s.school,
            dbValue: existingScholar.school,
          });
        }
        if (s.currentRpcNo && existingScholar.currentRpcNo !== s.currentRpcNo) {
          discrepancies.push({
            field: 'currentRpcNo',
            label: 'RPC Stage',
            excelValue: `RPC ${s.currentRpcNo}`,
            dbValue: `RPC ${existingScholar.currentRpcNo}`,
          });
        }
      }

      const targetRpcNumber = s.currentRpcNo || existingScholar?.currentRpcNo || 1;
      const existingRpc = existingRpcRecords.find(
        (rec) =>
          (rec.enrollmentNo.toLowerCase() === normEnroll ||
            (existingScholar && rec.scholarId === existingScholar.id)) &&
          rec.rpcNumber === targetRpcNumber
      );

      const hasExistingApprovedLetter = existingRpc?.status === 'APPROVED';
      const approvedLetterRef = existingRpc?.approvedDocumentReference || existingRpc?.letterData?.refNo;

      processedKeys.add(itemKey);

      matchedItems.push({
        id: `match-sch-${unit.sheetId || unit.sheetName}-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        sourceFileName: unit.fileName,
        sourceSheetName: unit.sheetName,
        sourceSheetId: unit.sheetId,
        enrollmentNo: s.enrollmentNo,
        scholarName: s.name,
        school: s.school,
        department: s.department,
        guideName: s.guideName,
        guideDesignation: s.guideDesignation,
        guideEmail: s.guideEmail,
        guideSchool: s.guideSchool,
        rpcNumber: targetRpcNumber,
        rpcDate: new Date().toISOString().split('T')[0],
        meetingTime: '11:00 AM IST',
        meetingMode: 'ONLINE',
        venue: 'SDSR Board Room / Google Meet',
        internalExpertName: 'Dr. Bhoomika Patel',
        internalExpertDesignation: 'Dean (I/C), SPH',
        internalExpertDept: 'School of Pharmacy',
        internalExpertCampus: 'NFSU, Gandhinagar',
        externalExpert1Name: 'Dr. Dhiraj Bhatia',
        externalExpert1Designation: 'Associate Professor',
        externalExpert1Inst: 'Indian Institute of Technology Gandhinagar',
        externalExpert1Dept: 'Department of Biological Science and Engineering',
        externalExpert1City: 'Gandhinagar',
        externalExpert2Name: 'Prof. (Dr.) Sanjay K. Jain',
        externalExpert2Designation: 'Professor & Dean',
        externalExpert2Inst: 'Central University of Gujarat',
        externalExpert2Dept: 'School of Applied Material Science',
        externalExpert2City: 'Gandhinagar',
        researchTopic: s.researchTopic,
        matchStatus,
        existingScholar,
        existingRpcRecord: existingRpc,
        hasExistingApprovedLetter,
        approvedLetterRef,
        discrepancies,
        rawSource: 'SCHOLAR_ROW',
      });
    });
  });

  return matchedItems;
}

/**
 * UNLOAD OPTION 1: Export matched student reconciliation report to Excel (.xlsx)
 */
export function exportMatchedStudentsToExcel(
  matchedItems: StudentMatchItem[],
  customFileName?: string
) {
  const wb = XLSX.utils.book_new();

  const headers = [
    'Enrollment No',
    'Scholar Name',
    'Match Status',
    'School',
    'Department',
    'Excel Guide Name',
    'Database Guide Name',
    'RPC Number',
    'Scheduled Date',
    'Meeting Mode',
    'Venue / Link',
    'Discrepancies Detected',
    'Approved Letter Status',
    'Official Letter Reference',
  ];

  const rows = matchedItems.map((item) => [
    item.enrollmentNo,
    item.scholarName,
    item.matchStatus === 'EXACT_MATCH'
      ? 'Matched (Exact Enrollment)'
      : item.matchStatus === 'NAME_MATCH'
      ? 'Matched (Scholar Name)'
      : 'New Student (Not in DB)',
    item.school,
    item.department,
    item.guideName,
    item.existingScholar?.guideName || '—',
    `RPC ${item.rpcNumber}`,
    item.rpcDate,
    item.meetingMode,
    item.venue,
    item.discrepancies.length > 0
      ? item.discrepancies.map((d) => `${d.label}: [Excel: ${d.excelValue} vs DB: ${d.dbValue}]`).join('; ')
      : 'None (Data Consistent)',
    item.hasExistingApprovedLetter ? 'APPROVED LETTER ISSUED' : 'Pending / Not Prepared',
    item.approvedLetterRef || '—',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 16 }, // Enrollment No
    { wch: 26 }, // Scholar Name
    { wch: 24 }, // Match Status
    { wch: 30 }, // School
    { wch: 30 }, // Department
    { wch: 24 }, // Excel Guide
    { wch: 24 }, // DB Guide
    { wch: 12 }, // RPC Number
    { wch: 14 }, // Date
    { wch: 14 }, // Mode
    { wch: 35 }, // Venue
    { wch: 45 }, // Discrepancies
    { wch: 24 }, // Letter Status
    { wch: 35 }, // Ref
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Matched Students Roster');

  const fileName =
    customFileName ||
    `NFSU_SDSR_Student_Matching_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

/**
 * UNLOAD OPTION 2: Export official approved letters register to Excel (.xlsx)
 */
export function exportApprovedLettersToExcel(
  approvedRecords: RpcRecord[],
  customFileName?: string
) {
  const wb = XLSX.utils.book_new();

  const headers = [
    'Document Reference No.',
    'Official Letter Ref.',
    'Letter Date',
    'Scholar Name',
    'Enrollment No.',
    'School / Institute',
    'RPC Stage',
    'Meeting Scheduled Date',
    'Meeting Time',
    'Meeting Mode',
    'Research Guide',
    'Internal Expert',
    'External Expert 1',
    'External Expert 2',
    'Approved By (Dean, SDSR)',
    'Approval Timestamp',
    'Status',
  ];

  const rows = approvedRecords.map((r) => [
    r.approvedDocumentReference || `DOC-NFSU-SDSR-RPC-APPROVED-${r.id}`,
    r.letterData?.refNo || `NFSU/SDSR/RPC/0${r.rpcNumber}/${new Date().getFullYear()}`,
    r.letterData?.date || '—',
    r.scholarName,
    r.enrollmentNo,
    r.school,
    `RPC ${r.rpcNumber}`,
    r.rpcDate,
    r.meetingTime,
    r.meetingMode,
    r.rpcMembers?.guide?.name || '—',
    r.rpcMembers?.internalExpert?.name || '—',
    r.rpcMembers?.externalExpert1?.name || '—',
    r.rpcMembers?.externalExpert2?.name || '—',
    r.approvedBy ? r.approvedBy.replace(/Prof\. \(Dr\.\) S\. O\. Junare/g, 'Dean, SDSR').replace(/Dean, SDSR \(Dean, SDSR\)/g, 'Dean, SDSR') : 'Dean, SDSR',
    r.approvedAt ? new Date(r.approvedAt).toLocaleString('en-GB') : '—',
    'OFFICIALLY APPROVED',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 36 }, // Document Ref
    { wch: 28 }, // Letter Ref
    { wch: 14 }, // Date
    { wch: 26 }, // Scholar Name
    { wch: 16 }, // Enrollment No
    { wch: 30 }, // School
    { wch: 12 }, // Stage
    { wch: 14 }, // Meeting Date
    { wch: 14 }, // Time
    { wch: 14 }, // Mode
    { wch: 24 }, // Guide
    { wch: 24 }, // Internal
    { wch: 24 }, // Ext 1
    { wch: 24 }, // Ext 2
    { wch: 30 }, // Approved By
    { wch: 22 }, // Approved At
    { wch: 20 }, // Status
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Approved Letters Register');

  const fileName =
    customFileName ||
    `NFSU_SDSR_Approved_RPC_Letters_${new Date().toISOString().split('T')[0]}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

/**
 * UNLOAD OPTION 3: Export master RPC database to Excel (.xlsx)
 */
export function exportAllRpcRecordsToExcel(
  records: RpcRecord[],
  customFileName?: string
) {
  const wb = XLSX.utils.book_new();

  const headers = [
    'RPC Record ID',
    'Scholar Name',
    'Enrollment No.',
    'School',
    'RPC Stage',
    'Meeting Date',
    'Meeting Time',
    'Meeting Mode',
    'Venue / Link',
    'Status',
    'Guide Name',
    'Letter Reference',
    'Approved Reference',
    'Created At',
  ];

  const rows = records.map((r) => [
    r.id,
    r.scholarName,
    r.enrollmentNo,
    r.school,
    `RPC ${r.rpcNumber}`,
    r.rpcDate,
    r.meetingTime,
    r.meetingMode,
    r.venue,
    r.status,
    r.rpcMembers?.guide?.name || '—',
    r.letterData?.refNo || '—',
    r.approvedDocumentReference || '—',
    r.createdAt,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 24 },
    { wch: 26 },
    { wch: 16 },
    { wch: 28 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 35 },
    { wch: 20 },
    { wch: 24 },
    { wch: 28 },
    { wch: 34 },
    { wch: 22 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'RPC Master Records');

  const fileName =
    customFileName ||
    `NFSU_SDSR_All_RPC_Records_${new Date().toISOString().split('T')[0]}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

/**
 * Generate a ready-to-load multi-sheet sample File in browser memory so SDSR office
 * can immediately test loading and unloading multiple Excel sheets without needing an external file.
 * Includes 3 distinct sheets:
 * 1. SPH_Pharmacy_RPC: School of Pharmacy doctoral RPC candidates
 * 2. SFS_Forensics_RPC: School of Forensic Science candidates
 * 3. New_Doctoral_Registrations: Newly admitted scholars for 1st RPC
 */
export function createSampleRosterExcelFile(): File {
  const wb = XLSX.utils.book_new();

  const rpcHeaders = [
    'Enrollment No',
    'Scholar Name',
    'RPC Number',
    'RPC Scheduled Date',
    'Meeting Time',
    'Meeting Mode',
    'Venue / Meeting Link',
    'Guide Name',
    'Internal Expert Name',
    'External Expert 1 Name',
    'External Expert 2 Name',
    'Synopsis / Notes',
  ];

  // Sheet 1: SPH Pharmacy RPC
  const sphRows = [
    [
      '240112006033', // Existing in DB: Devanshi Lunagariya
      'MS. DEVANSHI LUNAGARIYA',
      2,
      '2025-06-22',
      '02:30 PM IST',
      'ONLINE',
      'Google Meet: meet.google.com/sph-rpc-02',
      'Prof. (Dr.) Manjunath Ghate',
      'Dr. Bhoomika Patel',
      'Dr. Dhiraj Bhatia',
      'Prof. (Dr.) Prakash Jha',
      '2nd RPC evaluation for course-work presentation and literature survey defense.',
    ],
    [
      '240112006048', // Aniket Patel
      'MR. ANIKET PATEL',
      1,
      '2025-06-28',
      '11:00 AM IST',
      'HYBRID',
      'SPH Seminar Room & Google Meet',
      'Prof. (Dr.) Manjunath Ghate',
      'Dr. Bhoomika Patel',
      'Dr. Dhiraj Bhatia',
      'Prof. (Dr.) Sanjay K. Jain',
      '1st RPC evaluation for doctoral research proposal on targeted nanocarriers.',
    ],
  ];
  const wsSph = XLSX.utils.aoa_to_sheet([rpcHeaders, ...sphRows]);
  XLSX.utils.book_append_sheet(wb, wsSph, 'SPH_Pharmacy_RPC');

  // Sheet 2: SFS Forensic Science RPC
  const sfsRows = [
    [
      '240112006037', // Existing in DB: Richard Cherehani
      'RICHARD CHEREHANI KASHINDYE',
      4,
      '2025-06-18',
      '11:30 AM IST',
      'HYBRID',
      'Conference Hall A, SDSR Building & Google Meet: meet.google.com/nfs-sdsr-rpc',
      'Dr. Rakesh Yadav',
      'Dr. Bhoomika Patel',
      'Dr. Dhiraj Bhatia',
      'Prof. (Dr.) Sanjay K. Jain',
      '4th RPC evaluation for thesis progression and experimental verification.',
    ],
    [
      '240112006001', // Existing in DB: Netra Sajeev
      'NETRA SAJEEV',
      2,
      '2025-06-25',
      '03:00 PM IST',
      'HYBRID',
      'SBF Seminar Room, Sector-9 & Google Meet',
      'Dr. Priyanka Kacker',
      'Dr. Bhoomika Patel',
      'Dr. Dhiraj Bhatia',
      'Dr. Prakash Jha',
      '2nd RPC evaluation for neurometric cognitive experimentation protocols.',
    ],
    [
      '240112006045', // Dr. Priya Sharma
      'DR. PRIYA SHARMA',
      2,
      '2025-07-05',
      '03:30 PM IST',
      'ONLINE',
      'Google Meet: meet.google.com/sfs-toxicology-rpc',
      'Dr. Rakesh Yadav',
      'Dr. Bhoomika Patel',
      'Dr. Dhiraj Bhatia',
      'Prof. (Dr.) Sanjay K. Jain',
      '2nd RPC review on microfluidic SERS sensors for drug identification.',
    ],
  ];
  const wsSfs = XLSX.utils.aoa_to_sheet([rpcHeaders, ...sfsRows]);
  XLSX.utils.book_append_sheet(wb, wsSfs, 'SFS_Forensics_RPC');

  // Sheet 3: New Registrations
  const newScholarRows = [
    [
      '240112006088', // New scholar: Tanmay Deshmukh
      'MR. TANMAY DESHMUKH',
      1,
      '2025-07-02',
      '10:30 AM IST',
      'OFFLINE',
      'SDSR Board Room, First Floor, Admin Block, Gandhinagar Campus',
      'Dr. Bappi Paul',
      'Dr. Bhoomika Patel',
      'Dr. Rajnish Kumar',
      'Dr. Vivek Dave',
      '1st RPC evaluation for doctoral research proposal and experimental methodology.',
    ],
    [
      '240112006092', // New scholar: Arpita Roy
      'MS. ARPITA ROY',
      1,
      '2025-07-08',
      '02:00 PM IST',
      'ONLINE',
      'Google Meet: meet.google.com/cyber-rpc-01',
      'Dr. Naveen Kumar',
      'Dr. Bhoomika Patel',
      'Dr. Dhiraj Bhatia',
      'Prof. (Dr.) Sanjay K. Jain',
      '1st RPC defense for digital forensic memory reconstruction research.',
    ],
  ];
  const wsNew = XLSX.utils.aoa_to_sheet([rpcHeaders, ...newScholarRows]);
  XLSX.utils.book_append_sheet(wb, wsNew, 'New_Doctoral_Registrations');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return new File([blob], 'NFSU_SDSR_Doctoral_RPC_Roster_MultiSheet.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * UNLOAD OPTION: Export a multi-sheet Excel workbook containing customizable sheets
 */
export function exportMultiSheetExcelWorkbook(
  sheetsData: {
    sheetName: string;
    headers: string[];
    rows: any[][];
    colWidths?: number[];
  }[],
  customFileName?: string
) {
  const wb = XLSX.utils.book_new();
  sheetsData.forEach(({ sheetName, headers, rows, colWidths }) => {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    if (colWidths && colWidths.length > 0) {
      ws['!cols'] = colWidths.map((w) => ({ wch: w }));
    }
    const cleanSheetName = sheetName.replace(/[:\\\/\?\*\[\]]/g, '_').substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);
  });

  const fileName =
    customFileName ||
    `NFSU_SDSR_MultiSheet_Doctoral_Register_${new Date().toISOString().split('T')[0]}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

// ==========================================
// SHARED LOADED EXCEL STATE (CROSS-COMPONENT)
// ==========================================
export interface ExcelRosterCandidate {
  id: string; // unique ID
  enrollmentNo: string;
  scholarName: string;
  school: string;
  department: string;
  guideName: string;
  guideDesignation: string;
  guideEmail?: string;
  guideSchool?: string;
  coGuideName?: string;
  researchTopic?: string;
  rpcNumber: number;
  rpcDate: string;
  meetingTime: string;
  meetingMode: 'ONLINE' | 'OFFLINE' | 'HYBRID';
  venue: string;
  internalExpertName?: string;
  internalExpertDesignation?: string;
  internalExpertDepartment?: string;
  internalExpertDept?: string;
  internalExpertLocation?: string;
  internalExpertCampus?: string;
  externalExpert1Name?: string;
  externalExpert1Designation?: string;
  externalExpert1Department?: string;
  externalExpert1Dept?: string;
  externalExpert1Institution?: string;
  externalExpert1Inst?: string;
  externalExpert1Location?: string;
  externalExpert1City?: string;
  externalExpert2Name?: string;
  externalExpert2Designation?: string;
  externalExpert2Department?: string;
  externalExpert2Dept?: string;
  externalExpert2Institution?: string;
  externalExpert2Inst?: string;
  externalExpert2Location?: string;
  externalExpert2City?: string;
  notes?: string;
  sourceSheetName: string;
  sourceFileName: string;
  isExistingInDb: boolean;
  matchedScholarId?: string;
  rowIndex?: number;
}

const LOCAL_STORAGE_EXCEL_SHEETS_KEY = 'nfsu_shared_loaded_excel_sheets';
const LOCAL_STORAGE_EXCEL_FILES_KEY = 'nfsu_shared_loaded_excel_files';

let memorySharedLoadedFiles: LoadedExcelFile[] = [];
let memorySharedLoadedSheets: LoadedExcelSheet[] = [];

function initSharedExcelMemory() {
  if (typeof window === 'undefined') return;
  try {
    if (memorySharedLoadedSheets.length === 0) {
      const cachedSheets = localStorage.getItem(LOCAL_STORAGE_EXCEL_SHEETS_KEY);
      if (cachedSheets) memorySharedLoadedSheets = JSON.parse(cachedSheets);
    }
    if (memorySharedLoadedFiles.length === 0) {
      const cachedFiles = localStorage.getItem(LOCAL_STORAGE_EXCEL_FILES_KEY);
      if (cachedFiles) memorySharedLoadedFiles = JSON.parse(cachedFiles);
    }
  } catch (e) {
    console.warn('Error reading Excel cache from localStorage:', e);
  }
}

export function getSharedLoadedSheets(): LoadedExcelSheet[] {
  initSharedExcelMemory();
  return memorySharedLoadedSheets;
}

export function getSharedLoadedFiles(): LoadedExcelFile[] {
  initSharedExcelMemory();
  return memorySharedLoadedFiles;
}

export function setSharedLoadedData(files: LoadedExcelFile[], sheets: LoadedExcelSheet[], source?: string): void {
  memorySharedLoadedFiles = files;
  memorySharedLoadedSheets = sheets;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_EXCEL_FILES_KEY, JSON.stringify(files));
      localStorage.setItem(LOCAL_STORAGE_EXCEL_SHEETS_KEY, JSON.stringify(sheets));
      window.dispatchEvent(new CustomEvent('nfsu-excel-data-updated', { detail: { files, sheets, source } }));
    } catch (e) {
      console.warn('Error saving Excel data to localStorage:', e);
    }
  }

  // Also seamlessly persist loaded Excel rosters to Firestore cloud so every work is saved
  syncLoadedExcelToFirestore(files, sheets).catch((err) => {
    console.warn('Could not sync loaded Excel data to Firestore:', err);
  });
}

// Sync loaded Excel datasets to Firestore
export async function syncLoadedExcelToFirestore(
  files: LoadedExcelFile[] = memorySharedLoadedFiles,
  sheets: LoadedExcelSheet[] = memorySharedLoadedSheets
): Promise<void> {
  try {
    await setDoc(doc(db, 'portalState', 'loadedExcelData'), {
      files,
      sheets,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Firestore portalState sync warning:', err);
  }
}

// Restore loaded Excel datasets from Firestore if not present locally
export async function loadLoadedExcelFromFirestore(): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'portalState', 'loadedExcelData'));
    if (snap.exists()) {
      const data = snap.data();
      if (data && Array.isArray(data.sheets) && data.sheets.length > 0) {
        if (memorySharedLoadedSheets.length === 0) {
          memorySharedLoadedFiles = data.files || [];
          memorySharedLoadedSheets = data.sheets || [];
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(LOCAL_STORAGE_EXCEL_FILES_KEY, JSON.stringify(memorySharedLoadedFiles));
              localStorage.setItem(LOCAL_STORAGE_EXCEL_SHEETS_KEY, JSON.stringify(memorySharedLoadedSheets));
              window.dispatchEvent(
                new CustomEvent('nfsu-excel-data-updated', {
                  detail: { files: memorySharedLoadedFiles, sheets: memorySharedLoadedSheets },
                })
              );
            } catch (e) {}
          }
          return true;
        }
      }
    }
  } catch (err) {
    console.warn('Firestore loadLoadedExcelFromFirestore warning:', err);
  }
  return false;
}

export function clearSharedLoadedData(): void {
  memorySharedLoadedFiles = [];
  memorySharedLoadedSheets = [];
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(LOCAL_STORAGE_EXCEL_FILES_KEY);
      localStorage.removeItem(LOCAL_STORAGE_EXCEL_SHEETS_KEY);
      window.dispatchEvent(new CustomEvent('nfsu-excel-data-updated', { detail: { files: [], sheets: [] } }));
    } catch (e) {}
  }
  // Clear from Firestore as well
  syncLoadedExcelToFirestore([], []).catch(() => {});
}

export function getLoadedExcelRosterCandidates(existingScholars: Scholar[]): ExcelRosterCandidate[] {
  const activeSheets = getSharedLoadedSheets().filter((s) => s.isLoaded);
  if (activeSheets.length === 0) return [];

  const existingByEnroll = new Map<string, Scholar>();
  const existingByName = new Map<string, Scholar>();
  existingScholars.forEach((s) => {
    existingByEnroll.set(s.enrollmentNo.trim().toLowerCase(), s);
    existingByName.set(
      s.name.trim().toLowerCase().replace(/^dr\.\s*|^mr\.\s*|^ms\.\s*|^mrs\.\s*/i, ''),
      s
    );
  });

  const candidates: ExcelRosterCandidate[] = [];
  const seenKeys = new Set<string>();

  activeSheets.forEach((sheet) => {
    // 1. Process RPC rows
    sheet.rpcRows.forEach((r, idx) => {
      const normEnroll = (r.enrollmentNo || '').trim().toLowerCase();
      const normName = (r.scholarName || '')
        .trim()
        .toLowerCase()
        .replace(/^dr\.\s*|^mr\.\s*|^ms\.\s*|^mrs\.\s*/i, '');
      const key = `${normEnroll || normName}-rpc-${r.rpcNumber}`;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);

      const dbMatch =
        (normEnroll ? existingByEnroll.get(normEnroll) : undefined) ||
        (normName ? existingByName.get(normName) : undefined);

      candidates.push({
        id: `cand-${sheet.id}-${idx}`,
        enrollmentNo: r.enrollmentNo || dbMatch?.enrollmentNo || '',
        scholarName: r.scholarName || dbMatch?.name || 'Unknown Scholar',
        school: r.school || dbMatch?.school || 'School of Forensic Science',
        department: r.department || dbMatch?.department || dbMatch?.school || 'Doctoral Studies and Research',
        guideName: r.guideName || dbMatch?.guideName || 'Prof. Guide',
        guideDesignation: r.guideDesignation || dbMatch?.guideDesignation || 'Professor',
        guideEmail: r.guideEmail || dbMatch?.guideEmail,
        guideSchool: r.guideSchool || dbMatch?.guideSchool || dbMatch?.school,
        coGuideName: r.coGuideName || dbMatch?.coGuideName,
        researchTopic: r.researchTopic || dbMatch?.researchTopic || r.notes,
        rpcNumber: r.rpcNumber || dbMatch?.currentRpcNo || 1,
        rpcDate: r.rpcDate || new Date().toISOString().split('T')[0],
        meetingTime: r.meetingTime || '11:30 AM',
        meetingMode: r.meetingMode || 'ONLINE',
        venue: r.venue || 'SDSR Board Room / Google Meet',
        internalExpertName: r.internalExpertName,
        internalExpertDesignation: r.internalExpertDesignation,
        internalExpertDepartment: r.internalExpertDepartment,
        internalExpertDept: r.internalExpertDept || r.internalExpertDepartment,
        internalExpertLocation: r.internalExpertLocation,
        internalExpertCampus: r.internalExpertCampus || r.internalExpertLocation,
        externalExpert1Name: r.externalExpert1Name,
        externalExpert1Designation: r.externalExpert1Designation,
        externalExpert1Department: r.externalExpert1Department,
        externalExpert1Dept: r.externalExpert1Dept || r.externalExpert1Department,
        externalExpert1Institution: r.externalExpert1Institution,
        externalExpert1Inst: r.externalExpert1Inst || r.externalExpert1Institution,
        externalExpert1Location: r.externalExpert1Location,
        externalExpert1City: r.externalExpert1City || r.externalExpert1Location,
        externalExpert2Name: r.externalExpert2Name,
        externalExpert2Designation: r.externalExpert2Designation,
        externalExpert2Department: r.externalExpert2Department,
        externalExpert2Dept: r.externalExpert2Dept || r.externalExpert2Department,
        externalExpert2Institution: r.externalExpert2Institution,
        externalExpert2Inst: r.externalExpert2Inst || r.externalExpert2Institution,
        externalExpert2Location: r.externalExpert2Location,
        externalExpert2City: r.externalExpert2City || r.externalExpert2Location,
        notes: r.notes,
        sourceSheetName: sheet.sheetName,
        sourceFileName: sheet.fileName,
        isExistingInDb: !!dbMatch,
        matchedScholarId: dbMatch?.id,
        rowIndex: r.rowIndex,
      });
    });

    // 2. Process Scholar rows
    sheet.scholarRows.forEach((sRow, idx) => {
      const s = sRow.scholar;
      const normEnroll = (s.enrollmentNo || '').trim().toLowerCase();
      const normName = (s.name || '')
        .trim()
        .toLowerCase()
        .replace(/^dr\.\s*|^mr\.\s*|^ms\.\s*|^mrs\.\s*/i, '');
      const key = `${normEnroll || normName}-rpc-${s.currentRpcNo || 1}`;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);

      const dbMatch =
        (normEnroll ? existingByEnroll.get(normEnroll) : undefined) ||
        (normName ? existingByName.get(normName) : undefined);

      candidates.push({
        id: `cand-sch-${sheet.id}-${idx}`,
        enrollmentNo: s.enrollmentNo,
        scholarName: s.name,
        school: s.school,
        department: s.department || s.school,
        guideName: s.guideName,
        guideDesignation: s.guideDesignation || 'Professor',
        guideEmail: s.guideEmail,
        guideSchool: s.guideSchool || s.school,
        coGuideName: s.coGuideName,
        researchTopic: s.researchTopic,
        rpcNumber: s.currentRpcNo || 1,
        rpcDate: new Date().toISOString().split('T')[0],
        meetingTime: '11:30 AM',
        meetingMode: 'ONLINE',
        venue: 'SDSR Committee Room / Google Meet',
        sourceSheetName: sheet.sheetName,
        sourceFileName: sheet.fileName,
        isExistingInDb: !!dbMatch,
        matchedScholarId: dbMatch?.id,
        rowIndex: sRow.rowIndex,
      });
    });
  });

  return candidates;
}

export async function quickLoadSampleRosterShared(
  existingScholars: Scholar[]
): Promise<{ files: LoadedExcelFile[]; sheets: LoadedExcelSheet[]; candidates: ExcelRosterCandidate[] }> {
  const sampleFile = createSampleRosterExcelFile();
  const res = await parseMultipleExcelFiles([sampleFile], existingScholars);
  setSharedLoadedData(res.files, res.sheets);
  const candidates = getLoadedExcelRosterCandidates(existingScholars);
  return { files: res.files, sheets: res.sheets, candidates };
}

